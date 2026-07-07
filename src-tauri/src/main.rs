#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod config_io;

use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;
use tauri::{path::BaseDirectory, Emitter, Manager, WindowEvent};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

const SHORTCUT_EVENT: &str = "dftool://global-shortcut";
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

#[tauri::command]
fn resolve_resource_url(app: tauri::AppHandle, path: String) -> Result<String, String> {
    let relative_path = PathBuf::from(&path);
    let is_safe = relative_path
        .components()
        .all(|component| matches!(component, Component::Normal(_)));

    if !is_safe {
        return Err("资源路径只能使用相对文件路径".to_string());
    }

    let resolved_path = app
        .path()
        .resolve(relative_path, BaseDirectory::Resource)
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
            get_startup_warnings,
            resolve_resource_url,
            set_overlay_interactive,
            set_overlay_visible,
        ])
        .on_window_event(|window, event| {
            if window.label() == "control" {
                if let WindowEvent::CloseRequested { .. } = event {
                    window.app_handle().exit(0);
                }
            }
        })
        .setup(|app| {
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
