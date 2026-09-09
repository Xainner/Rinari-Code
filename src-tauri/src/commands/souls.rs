//! Soul commands: list/get/create/update/remove/activate (global scope).
use tauri::State;

use rinari_code_lib::engine::{CommandError, EngineSupervisor};

#[tauri::command]
pub(crate) fn soul_list(
    supervisor: State<'_, EngineSupervisor>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.soul_list()
}

#[tauri::command]
pub(crate) fn soul_get(
    supervisor: State<'_, EngineSupervisor>,
    id: String,
) -> Result<serde_json::Value, CommandError> {
    supervisor.soul_get(&id)
}

#[tauri::command]
pub(crate) fn soul_create(
    supervisor: State<'_, EngineSupervisor>,
    id: String,
    name: String,
    identity: String,
    description: Option<String>,
    version: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.soul_create(serde_json::json!({
        "id": id,
        "name": name,
        "identity": identity,
        "description": description,
        "version": version,
    }))
}

#[tauri::command]
pub(crate) fn soul_update(
    supervisor: State<'_, EngineSupervisor>,
    id: String,
    name: Option<String>,
    identity: Option<String>,
    description: Option<String>,
    version: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    let mut params = serde_json::Map::new();
    params.insert("id".to_string(), serde_json::Value::String(id));
    if let Some(name) = name {
        params.insert("name".to_string(), serde_json::Value::String(name));
    }
    if let Some(identity) = identity {
        params.insert("identity".to_string(), serde_json::Value::String(identity));
    }
    if let Some(description) = description {
        params.insert(
            "description".to_string(),
            serde_json::Value::String(description),
        );
    }
    if let Some(version) = version {
        params.insert("version".to_string(), serde_json::Value::String(version));
    }
    supervisor.soul_update(serde_json::Value::Object(params))
}

#[tauri::command]
pub(crate) fn soul_remove(
    supervisor: State<'_, EngineSupervisor>,
    id: String,
) -> Result<serde_json::Value, CommandError> {
    supervisor.soul_remove(&id)
}

#[tauri::command]
pub(crate) fn soul_activate(
    supervisor: State<'_, EngineSupervisor>,
    id: String,
) -> Result<serde_json::Value, CommandError> {
    supervisor.soul_activate(&id)
}
