#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod config_io;

use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{path::BaseDirectory, Emitter, Manager, WindowEvent};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

const SHORTCUT_EVENT: &str = "dftool://global-shortcut";
const PENDING_SCREENSHOT_IMPORTS_FILE: &str = "pending-screenshot-imports.json";
const MAX_IMPORTED_SCREENSHOT_BYTES: u64 = 25 * 1024 * 1024;
const IMPORTED_SCREENSHOT_EXTENSIONS: [&str; 5] = ["png", "jpg", "jpeg", "webp", "gif"];
const SHORTCUTS: [&str; 8] = [
    "CommandOrControl+PageUp",
    "CommandOrControl+PageDown",
    "CommandOrControl+Alt+H",
    "CommandOrControl+Alt+1",
    "CommandOrControl+Alt+2",
    "CommandOrControl+Alt+3",
    "CommandOrControl+Alt+Space",
    "CommandOrControl+Alt+E",
];

#[derive(Default)]
struct StartupWarnings(Mutex<Vec<String>>);

#[derive(Default, Deserialize, Serialize)]
struct PendingScreenshotImports {
    paths: Vec<String>,
}

fn push_startup_warning(app: &tauri::AppHandle, message: String) {
    if let Some(warnings) = app.try_state::<StartupWarnings>() {
        if let Ok(mut warnings) = warnings.0.lock() {
            warnings.push(message);
        }
    }
}

#[tauri::command]
fn get_startup_warnings(state: tauri::State<StartupWarnings>) -> Result<Vec<String>, String> {
    state
        .0
        .lock()
        .map(|warnings| warnings.clone())
        .map_err(|_| "读取启动警告失败".to_string())
}

fn base64_encode(bytes: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut output = String::with_capacity(bytes.len().div_ceil(3) * 4);

    for chunk in bytes.chunks(3) {
        let b0 = chunk[0];
        let b1 = *chunk.get(1).unwrap_or(&0);
        let b2 = *chunk.get(2).unwrap_or(&0);

        output.push(TABLE[(b0 >> 2) as usize] as char);
        output.push(TABLE[(((b0 & 0b0000_0011) << 4) | (b1 >> 4)) as usize] as char);
        output.push(if chunk.len() > 1 {
            TABLE[(((b1 & 0b0000_1111) << 2) | (b2 >> 6)) as usize] as char
        } else {
            '='
        });
        output.push(if chunk.len() > 2 {
            TABLE[(b2 & 0b0011_1111) as usize] as char
        } else {
            '='
        });
    }

    output
}

fn resource_mime_type(path: &Path) -> &'static str {
    match path.extension().and_then(|extension| extension.to_str()) {
        Some("svg") => "image/svg+xml",
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("webp") => "image/webp",
        Some("gif") => "image/gif",
        _ => "application/octet-stream",
    }
}

fn is_safe_relative_resource_path(path: &str) -> bool {
    if path.is_empty() || path.contains('\\') {
        return false;
    }

    let relative_path = PathBuf::from(path);
    relative_path
        .components()
        .all(|component| matches!(component, Component::Normal(_)))
}

fn is_safe_id(value: &str) -> bool {
    !value.is_empty()
        && value
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == '-' || ch == '_')
}

fn sanitize_file_stem(value: &str) -> String {
    let mut output = String::new();
    let mut previous_dash = false;

    for ch in value.chars() {
        let next = if ch.is_ascii_alphanumeric() {
            previous_dash = false;
            Some(ch.to_ascii_lowercase())
        } else if ch == '-' || ch == '_' {
            if previous_dash {
                None
            } else {
                previous_dash = true;
                Some('-')
            }
        } else {
            if previous_dash {
                None
            } else {
                previous_dash = true;
                Some('-')
            }
        };

        if let Some(ch) = next {
            output.push(ch);
        }
    }

    let trimmed = output.trim_matches('-').to_string();
    if trimmed.is_empty() {
        "import".to_string()
    } else {
        trimmed
    }
}

fn imported_screenshot_extension(path: &Path) -> Option<&'static str> {
    let extension = path.extension()?.to_str()?.to_ascii_lowercase();
    IMPORTED_SCREENSHOT_EXTENSIONS
        .iter()
        .copied()
        .find(|supported| *supported == extension)
}

fn selected_file_name_extension(file_name: &str) -> Option<&'static str> {
    imported_screenshot_extension(Path::new(file_name))
}

fn imported_screenshot_relative_path(map_id: &str, file_name: &str) -> String {
    format!("assets/screenshots/{map_id}/{file_name}")
}

fn is_managed_screenshot_path(path: &str) -> bool {
    if !is_safe_relative_resource_path(path) {
        return false;
    }

    let components = PathBuf::from(path)
        .components()
        .map(|component| component.as_os_str().to_string_lossy().to_string())
        .collect::<Vec<_>>();

    components.len() == 4
        && components[0] == "assets"
        && components[1] == "screenshots"
        && is_safe_id(&components[2])
        && imported_screenshot_extension(Path::new(&components[3])).is_some()
}

fn pending_screenshot_imports_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|error| format!("无法定位用户数据目录: {error}"))?
        .join(PENDING_SCREENSHOT_IMPORTS_FILE))
}

fn load_pending_screenshot_imports(
    app: &tauri::AppHandle,
) -> Result<PendingScreenshotImports, String> {
    let path = pending_screenshot_imports_path(app)?;
    if !path.exists() {
        return Ok(PendingScreenshotImports::default());
    }

    let text = std::fs::read_to_string(&path)
        .map_err(|error| format!("读取待清理截图清单 {} 失败: {error}", path.display()))?;
    serde_json::from_str(&text)
        .map_err(|error| format!("解析待清理截图清单 {} 失败: {error}", path.display()))
}

fn save_pending_screenshot_imports(
    app: &tauri::AppHandle,
    pending: &PendingScreenshotImports,
) -> Result<(), String> {
    let path = pending_screenshot_imports_path(app)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|error| format!("创建目录 {} 失败: {error}", parent.display()))?;
    }

    let unique_paths = pending
        .paths
        .iter()
        .filter(|path| is_managed_screenshot_path(path))
        .cloned()
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect::<Vec<_>>();
    let text = serde_json::to_string_pretty(&PendingScreenshotImports { paths: unique_paths })
        .map_err(|error| format!("序列化待清理截图清单失败: {error}"))?;

    std::fs::write(&path, format!("{text}\n"))
        .map_err(|error| format!("写入待清理截图清单 {} 失败: {error}", path.display()))
}

fn add_pending_screenshot_import(app: &tauri::AppHandle, path: String) -> Result<(), String> {
    if !is_managed_screenshot_path(&path) {
        return Err("导入截图路径不是受管理的截图资源路径".to_string());
    }

    let mut pending = load_pending_screenshot_imports(app)?;
    if !pending.paths.contains(&path) {
        pending.paths.push(path);
    }
    save_pending_screenshot_imports(app, &pending)
}

fn resolve_managed_screenshot_path(app: &tauri::AppHandle, path: &str) -> Result<PathBuf, String> {
    if !is_managed_screenshot_path(path) {
        return Err("只能清理由截图导入功能创建的资源路径".to_string());
    }

    app.path()
        .resolve(PathBuf::from(path), BaseDirectory::Resource)
        .map_err(|error| format!("无法定位导入截图 {path}: {error}"))
}

fn delete_pending_screenshot_files(
    app: &tauri::AppHandle,
    paths: &[String],
) -> Result<Vec<String>, String> {
    let mut failed_paths = Vec::new();
    let mut messages = Vec::new();

    for path in paths {
        match resolve_managed_screenshot_path(app, path) {
            Ok(resolved_path) => {
                if resolved_path.exists() {
                    if let Err(error) = std::fs::remove_file(&resolved_path) {
                        failed_paths.push(path.clone());
                        messages.push(format!("删除 {} 失败: {error}", resolved_path.display()));
                    }
                }
            }
            Err(error) => messages.push(error),
        }
    }

    if messages.is_empty() {
        Ok(failed_paths)
    } else {
        Err(messages.join("；"))
    }
}

fn discard_pending_screenshot_imports(
    app: &tauri::AppHandle,
    paths: &[String],
) -> Result<(), String> {
    if paths.is_empty() {
        return Ok(());
    }

    let mut pending = load_pending_screenshot_imports(app)?;
    let pending_paths = pending.paths.iter().cloned().collect::<BTreeSet<_>>();
    let requested = paths
        .iter()
        .filter(|path| pending_paths.contains(*path))
        .cloned()
        .collect::<Vec<_>>();

    let failed = delete_pending_screenshot_files(app, &requested)?;
    let failed_set = failed.into_iter().collect::<BTreeSet<_>>();
    let requested_set = requested.into_iter().collect::<BTreeSet<_>>();

    pending.paths.retain(|path| {
        !requested_set.contains(path) || failed_set.contains(path)
    });
    save_pending_screenshot_imports(app, &pending)
}

fn commit_pending_screenshot_imports(
    app: &tauri::AppHandle,
    paths: &[String],
) -> Result<(), String> {
    if paths.is_empty() {
        return Ok(());
    }

    let committed = paths.iter().cloned().collect::<BTreeSet<_>>();
    let mut pending = load_pending_screenshot_imports(app)?;
    pending.paths.retain(|path| !committed.contains(path));
    save_pending_screenshot_imports(app, &pending)
}

fn cleanup_pending_screenshot_imports(app: &tauri::AppHandle) -> Result<(), String> {
    let pending = load_pending_screenshot_imports(app)?;
    if pending.paths.is_empty() {
        return Ok(());
    }

    let failed = delete_pending_screenshot_files(app, &pending.paths)?;
    save_pending_screenshot_imports(app, &PendingScreenshotImports { paths: failed })
}

fn unique_screenshot_destination(
    directory: &Path,
    point_id: Option<&str>,
    extension: &str,
) -> Result<(PathBuf, String), String> {
    let prefix = point_id
        .map(sanitize_file_stem)
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "import".to_string());
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("获取系统时间失败: {error}"))?
        .as_millis();

    for index in 0..1000 {
        let suffix = if index == 0 {
            String::new()
        } else {
            format!("-{index}")
        };
        let file_name = format!("{prefix}-{timestamp}{suffix}.{extension}");
        let path = directory.join(&file_name);
        if !path.exists() {
            return Ok((path, file_name));
        }
    }

    Err("无法生成唯一截图文件名".to_string())
}

#[tauri::command]
fn import_point_screenshot(
    app: tauri::AppHandle,
    map_id: String,
    point_id: Option<String>,
    file_name: String,
    bytes: Vec<u8>,
) -> Result<String, String> {
    if !is_safe_id(&map_id) {
        return Err("地图 ID 只能包含字母、数字、横线和下划线".to_string());
    }

    if bytes.is_empty() {
        return Err("截图文件不能为空".to_string());
    }
    if bytes.len() as u64 > MAX_IMPORTED_SCREENSHOT_BYTES {
        return Err("截图文件不能超过 25 MB".to_string());
    }

    let extension = selected_file_name_extension(&file_name)
        .ok_or_else(|| "仅支持 png、jpg、jpeg、webp、gif 截图".to_string())?;
    let screenshot_dir = app
        .path()
        .resolve(PathBuf::from("assets").join("screenshots").join(&map_id), BaseDirectory::Resource)
        .map_err(|error| format!("无法定位截图目录: {error}"))?;
    std::fs::create_dir_all(&screenshot_dir)
        .map_err(|error| format!("创建截图目录 {} 失败: {error}", screenshot_dir.display()))?;

    let (destination_path, stored_file_name) =
        unique_screenshot_destination(&screenshot_dir, point_id.as_deref(), extension)?;
    std::fs::write(&destination_path, bytes)
        .map_err(|error| format!("写入截图 {} 失败: {error}", destination_path.display()))?;

    let relative_path = imported_screenshot_relative_path(&map_id, &stored_file_name);
    if let Err(error) = add_pending_screenshot_import(&app, relative_path.clone()) {
        let _ = std::fs::remove_file(&destination_path);
        return Err(error);
    }

    Ok(relative_path)
}

#[tauri::command]
fn discard_imported_screenshots(app: tauri::AppHandle, paths: Vec<String>) -> Result<(), String> {
    discard_pending_screenshot_imports(&app, &paths)
}

#[tauri::command]
fn commit_imported_screenshots(app: tauri::AppHandle, paths: Vec<String>) -> Result<(), String> {
    commit_pending_screenshot_imports(&app, &paths)
}

#[tauri::command]
fn resolve_resource_url(app: tauri::AppHandle, path: String) -> Result<String, String> {
    if !is_safe_relative_resource_path(&path) {
        return Err("资源路径只能使用相对文件路径".to_string());
    }

    let resolved_path = app
        .path()
        .resolve(PathBuf::from(&path), BaseDirectory::Resource)
        .map_err(|error| format!("无法定位资源 {path}: {error}"))?;
    let bytes = std::fs::read(&resolved_path)
        .map_err(|error| format!("读取资源 {} 失败: {error}", resolved_path.display()))?;
    let mime_type = resource_mime_type(&resolved_path);

    Ok(format!("data:{mime_type};base64,{}", base64_encode(&bytes)))
}

#[tauri::command]
fn set_overlay_interactive(app: tauri::AppHandle, interactive: bool) -> Result<(), String> {
    let Some(window) = app.get_webview_window("overlay") else {
        return Ok(());
    };

    window
        .set_ignore_cursor_events(!interactive)
        .map_err(|error| format!("切换点击穿透失败: {error}"))
}

#[tauri::command]
fn set_overlay_visible(app: tauri::AppHandle, visible: bool) -> Result<(), String> {
    let window = app
        .get_webview_window("overlay")
        .ok_or_else(|| "找不到覆盖层窗口".to_string())?;

    if visible {
        window
            .show()
            .map_err(|error| format!("显示覆盖层失败: {error}"))?;
        window
            .set_focus()
            .map_err(|error| format!("聚焦覆盖层失败: {error}"))?;
    } else {
        window
            .hide()
            .map_err(|error| format!("隐藏覆盖层失败: {error}"))?;
    }

    Ok(())
}

fn main() {
    let result = tauri::Builder::default()
        .manage(StartupWarnings::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        let _ = app.emit(SHORTCUT_EVENT, shortcut.to_string());
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            config_io::get_config_paths,
            config_io::load_config_bundle,
            config_io::save_user_settings,
            config_io::save_map_config,
            commit_imported_screenshots,
            discard_imported_screenshots,
            get_startup_warnings,
            import_point_screenshot,
            resolve_resource_url,
            set_overlay_interactive,
            set_overlay_visible,
        ])
        .on_window_event(|window, event| {
            if window.label() == "control" {
                if let WindowEvent::CloseRequested { .. } = event {
                    if let Err(error) = cleanup_pending_screenshot_imports(window.app_handle()) {
                        eprintln!("清理待处理截图失败: {error}");
                    }
                    window.app_handle().exit(0);
                }
            }
        })
        .setup(|app| {
            if let Err(error) = cleanup_pending_screenshot_imports(app.handle()) {
                push_startup_warning(app.handle(), format!("清理上次未保存截图失败：{error}"));
            }

            for shortcut in SHORTCUTS {
                if let Err(error) = app.global_shortcut().register(shortcut) {
                    push_startup_warning(
                        app.handle(),
                        format!("全局快捷键 {shortcut} 注册失败，可能已被其他程序占用。该快捷键将不可用：{error}"),
                    );
                }
            }

            if let Some(overlay) = app.get_webview_window("overlay") {
                if let Err(error) = overlay.set_ignore_cursor_events(true) {
                    push_startup_warning(app.handle(), format!("设置覆盖层点击穿透失败：{error}"));
                }
                if let Err(error) = overlay.set_always_on_top(true) {
                    push_startup_warning(app.handle(), format!("设置覆盖层置顶失败：{error}"));
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!());

    if let Err(error) = result {
        eprintln!("DFtool 启动失败: {error}");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_safe_ids() {
        assert!(is_safe_id("zero-dam"));
        assert!(is_safe_id("map_001"));
        assert!(!is_safe_id(""));
        assert!(!is_safe_id("../zero-dam"));
        assert!(!is_safe_id("zero dam"));
    }

    #[test]
    fn sanitizes_file_stems() {
        assert_eq!(sanitize_file_stem("Diamond 001"), "diamond-001");
        assert_eq!(sanitize_file_stem("../截图"), "import");
        assert_eq!(sanitize_file_stem("a__b---c"), "a-b-c");
    }

    #[test]
    fn detects_supported_import_extensions() {
        assert_eq!(imported_screenshot_extension(Path::new("shot.PNG")), Some("png"));
        assert_eq!(imported_screenshot_extension(Path::new("shot.jpeg")), Some("jpeg"));
        assert_eq!(imported_screenshot_extension(Path::new("shot.txt")), None);
    }

    #[test]
    fn creates_forward_slash_relative_paths() {
        assert_eq!(
            imported_screenshot_relative_path("zero-dam", "diamond-001.png"),
            "assets/screenshots/zero-dam/diamond-001.png",
        );
    }

    #[test]
    fn validates_managed_screenshot_paths() {
        assert!(is_managed_screenshot_path("assets/screenshots/zero-dam/shot.png"));
        assert!(!is_managed_screenshot_path(""));
        assert!(!is_managed_screenshot_path("assets\\screenshots\\zero-dam\\shot.png"));
        assert!(!is_managed_screenshot_path("assets/screenshots/zero-dam/../shot.png"));
        assert!(!is_managed_screenshot_path("assets/screenshots/zero-dam/nested/shot.png"));
        assert!(!is_managed_screenshot_path("assets/icons/diamond.svg"));
    }
}
