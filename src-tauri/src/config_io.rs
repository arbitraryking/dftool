use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{path::BaseDirectory, Manager};

#[derive(Debug, Serialize, Deserialize)]
pub struct NamedJsonFile {
    pub name: String,
    pub data: Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConfigBundle {
    pub loot_types: Value,
    pub maps: Vec<NamedJsonFile>,
    pub settings: Option<Value>,
}

#[derive(Debug, Serialize)]
pub struct ConfigPaths {
    pub bundled_config_dir: String,
    pub bundled_maps_dir: String,
    pub bundled_loot_types_path: String,
    pub bundled_assets_dir: String,
    pub bundled_icons_dir: String,
    pub bundled_screenshots_dir: String,
}

fn path_to_string(path: &Path) -> String {
    let text = path.display().to_string();
    text.strip_prefix(r"\\?\").unwrap_or(&text).to_string()
}

fn bundled_config_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .resolve("config", BaseDirectory::Resource)
        .map_err(|error| format!("无法定位内置配置目录: {error}"))
}

fn bundled_assets_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .resolve("assets", BaseDirectory::Resource)
        .map_err(|error| format!("无法定位内置图片资源目录: {error}"))
}

fn user_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|error| format!("无法定位用户数据目录: {error}"))
}

fn user_settings_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(user_data_dir(app)?.join("settings.json"))
}

fn read_json(path: &Path) -> Result<Value, String> {
    let text = fs::read_to_string(path)
        .map_err(|error| format!("读取 {} 失败: {error}", path.display()))?;
    serde_json::from_str(&text).map_err(|error| format!("解析 {} 失败: {error}", path.display()))
}

fn write_json(path: &Path, value: &Value) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("创建目录 {} 失败: {error}", parent.display()))?;
    }

    let text = serde_json::to_string_pretty(value)
        .map_err(|error| format!("序列化 JSON 失败: {error}"))?;
    fs::write(path, format!("{text}\n"))
        .map_err(|error| format!("写入 {} 失败: {error}", path.display()))
}

fn safe_map_file_name(map_id: &str) -> Result<String, String> {
    let is_safe = map_id
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || ch == '-' || ch == '_');

    if !is_safe || map_id.is_empty() {
        return Err("地图 ID 只能包含字母、数字、横线和下划线".to_string());
    }

    Ok(format!("{map_id}.json"))
}

fn read_maps_into(maps_dir: &Path, maps: &mut BTreeMap<String, Value>) -> Result<(), String> {
    if !maps_dir.exists() {
        return Ok(());
    }

    let entries = fs::read_dir(maps_dir)
        .map_err(|error| format!("读取地图目录 {} 失败: {error}", maps_dir.display()))?;
    for entry in entries {
        let entry = entry.map_err(|error| format!("读取地图文件失败: {error}"))?;
        let path = entry.path();
        if path.extension().and_then(|ext| ext.to_str()) != Some("json") {
            continue;
        }

        let name = path
            .file_stem()
            .and_then(|stem| stem.to_str())
            .unwrap_or_default()
            .to_string();

        match read_json(&path) {
            Ok(data) => {
                maps.insert(name, data);
            }
            Err(error) => eprintln!("{error}"),
        }
    }

    Ok(())
}

#[tauri::command]
pub fn get_config_paths(app: tauri::AppHandle) -> Result<ConfigPaths, String> {
    let bundled_config_dir = bundled_config_dir(&app)?;
    let bundled_maps_dir = bundled_config_dir.join("maps");
    let bundled_loot_types_path = bundled_config_dir.join("loot-types.json");
    let bundled_assets_dir = bundled_assets_dir(&app)?;
    let bundled_icons_dir = bundled_assets_dir.join("icons");
    let bundled_screenshots_dir = bundled_assets_dir.join("screenshots");

    Ok(ConfigPaths {
        bundled_config_dir: path_to_string(&bundled_config_dir),
        bundled_maps_dir: path_to_string(&bundled_maps_dir),
        bundled_loot_types_path: path_to_string(&bundled_loot_types_path),
        bundled_assets_dir: path_to_string(&bundled_assets_dir),
        bundled_icons_dir: path_to_string(&bundled_icons_dir),
        bundled_screenshots_dir: path_to_string(&bundled_screenshots_dir),
    })
}

#[tauri::command]
pub fn load_config_bundle(app: tauri::AppHandle) -> Result<ConfigBundle, String> {
    let config_dir = bundled_config_dir(&app)?;
    let bundled_maps_dir = config_dir.join("maps");
    let user_settings_path = user_settings_path(&app)?;

    let loot_types = read_json(&config_dir.join("loot-types.json"))?;
    let mut maps_by_name = BTreeMap::new();

    read_maps_into(&bundled_maps_dir, &mut maps_by_name)?;

    let maps = maps_by_name
        .into_iter()
        .map(|(name, data)| NamedJsonFile { name, data })
        .collect();

    let settings = if user_settings_path.exists() {
        Some(read_json(&user_settings_path)?)
    } else {
        None
    };

    Ok(ConfigBundle {
        loot_types,
        maps,
        settings,
    })
}

#[tauri::command]
pub fn save_user_settings(app: tauri::AppHandle, settings: Value) -> Result<(), String> {
    let path = user_settings_path(&app)?;
    write_json(&path, &settings)
}

#[tauri::command]
pub fn save_map_config(
    app: tauri::AppHandle,
    map_id: String,
    map_config: Value,
) -> Result<(), String> {
    let file_name = safe_map_file_name(&map_id)?;
    let path = bundled_config_dir(&app)?.join("maps").join(file_name);

    if path.exists() {
        let backup_path = path.with_extension("json.bak");
        fs::copy(&path, &backup_path).map_err(|error| {
            format!(
                "备份地图配置 {} 到 {} 失败: {error}",
                path.display(),
                backup_path.display()
            )
        })?;
    }

    write_json(&path, &map_config)
}
