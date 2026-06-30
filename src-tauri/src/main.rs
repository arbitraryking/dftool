mod config_io;

use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::ShortcutState;

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

#[tauri::command]
fn set_overlay_interactive(app: tauri::AppHandle, interactive: bool) -> Result<(), String> {
    let window = app
        .get_webview_window("overlay")
        .ok_or_else(|| "找不到覆盖层窗口".to_string())?;

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
        window.show().map_err(|error| format!("显示覆盖层失败: {error}"))?;
        window.set_focus().map_err(|error| format!("聚焦覆盖层失败: {error}"))?;
    } else {
        window.hide().map_err(|error| format!("隐藏覆盖层失败: {error}"))?;
    }

    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_shortcuts(SHORTCUTS)
                .expect("failed to register DFtool global shortcuts")
                .with_handler(|app, shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        let _ = app.emit(SHORTCUT_EVENT, shortcut.to_string());
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            config_io::load_config_bundle,
            config_io::save_user_settings,
            config_io::save_map_config,
            set_overlay_interactive,
            set_overlay_visible,
        ])
        .setup(|app| {
            if let Some(overlay) = app.get_webview_window("overlay") {
                let _ = overlay.set_ignore_cursor_events(true);
                let _ = overlay.set_always_on_top(true);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to run DFtool");
}
