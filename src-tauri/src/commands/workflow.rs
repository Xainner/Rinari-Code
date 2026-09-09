//! Rinari profile bundles: full working-configuration presets.
use tauri::State;

use super::run_engine;
use rinari_code_lib::engine::{CommandError, EngineSupervisor};

#[tauri::command]
pub(crate) async fn bundle_list(
    supervisor: State<'_, EngineSupervisor>,
) -> Result<serde_json::Value, CommandError> {
    run_engine(supervisor, |engine| engine.bundle_list()).await
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) async fn bundle_create(
    supervisor: State<'_, EngineSupervisor>,
    id: String,
    name: String,
    description: Option<String>,
    soul_id: Option<String>,
    mode: Option<String>,
    agents: Option<serde_json::Value>,
) -> Result<serde_json::Value, CommandError> {
    let mut params = serde_json::Map::new();
    params.insert("id".to_string(), serde_json::Value::String(id));
    params.insert("name".to_string(), serde_json::Value::String(name));
    if let Some(description) = description {
        params.insert(
            "description".to_string(),
            serde_json::Value::String(description),
        );
    }
    if let Some(soul_id) = soul_id {
        params.insert("soul_id".to_string(), serde_json::Value::String(soul_id));
    }
    if let Some(mode) = mode {
        params.insert("mode".to_string(), serde_json::Value::String(mode));
    }
    if let Some(agents) = agents {
        params.insert("agents".to_string(), agents);
    }
    run_engine(supervisor, move |engine| {
        engine.bundle_create(serde_json::Value::Object(params))
    })
    .await
}

#[tauri::command]
pub(crate) async fn bundle_remove(
    supervisor: State<'_, EngineSupervisor>,
    id: String,
) -> Result<serde_json::Value, CommandError> {
    run_engine(supervisor, move |engine| engine.bundle_remove(&id)).await
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) async fn bundle_apply(
    supervisor: State<'_, EngineSupervisor>,
    id: String,
    session_ref: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    run_engine(supervisor, move |engine| {
        engine.bundle_apply(&id, session_ref)
    })
    .await
}
