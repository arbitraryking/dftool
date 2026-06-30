use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};

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

fn project_root() -> Result<PathBuf, String> {
    let current_dir = std::env::current_dir().map_err(|error| format!("无法获取当前目录: {error}"))?;

    if current_dir.join("config").join("loot-types.json").exists() {
        return Ok(current_dir);
    }

    if let Some(parent) = current_dir.parent() {
        if parent.join("config").join("loot-types.json").exists() {
            return Ok(parent.to_path_buf());
        }
    }

    Ok(current_dir)
}

fn read_json(path: &Path) -> Result<Value, String> {
    let text = fs::read_to_string(path).map_err(|error| format!("读取 {} 失败: {error}", path.display()))?;
    serde_json::from_str(&text).map_err(|error| format!("解析 {} 失败: {error}", path.display()))
}

fn write_json(path: &Path, value: &Value) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| format!("创建目录 {} 失败: {error}", parent.display()))?;
    }

    let text = serde_json::to_string_pretty(value).map_err(|error| format!("序列化 JSON 失败: {error}"))?;
    fs::write(path, format!("{text}\n")).map_err(|error| format!("写入 {} 失败: {error}", path.display()))
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

#[tauri::command]
pub fn load_config_bundle() -> Result<ConfigBundle, String> {
    let root = project_root()?;
    let config_dir = root.join("config");
    let maps_dir = config_dir.join("maps");
    let user_settings_path = root.join("user-data").join("settings.json");

    let loot_types = read_json(&config_dir.join("loot-types.json"))?;
    let mut maps = Vec::new();

    if maps_dir.exists() {
        let entries = fs::read_dir(&maps_dir).map_err(|error| format!("读取地图目录失败: {error}"))?;
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
                Ok(data) => maps.push(NamedJsonFile { name, data }),
                Err(error) => eprintln!("{error}"),
            }
        }
    }

    maps.sort_by(|a, b| a.name.cmp(&b.name));

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
pub fn save_user_settings(settings: Value) -> Result<(), String> {
    let path = project_root()?.join("user-data").join("settings.json");
    write_json(&path, &settings)
}

#[tauri::command]
pub fn save_map_config(map_id: String, map_config: Value) -> Result<(), String> {
    let file_name = safe_map_file_name(&map_id)?;
    let path = project_root()?.join("config").join("maps").join(file_name);

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
