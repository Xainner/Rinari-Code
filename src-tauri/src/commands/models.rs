//! Model commands: catalog, aliases, discovery, selection.
use tauri::State;

use rinari_code_lib::engine::{CommandError, EngineSupervisor};

#[tauri::command]
pub(crate) fn model_list(
    supervisor: State<'_, EngineSupervisor>,
    provider: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.model_list(provider)
}

#[tauri::command]
pub(crate) fn model_get(
    supervisor: State<'_, EngineSupervisor>,
    reference: String,
    provider: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.model_get(&reference, provider)
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) fn model_add(
    supervisor: State<'_, EngineSupervisor>,
    provider: String,
    provider_model_id: String,
    alias: String,
    capabilities: Option<serde_json::Value>,
    settings: Option<serde_json::Value>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.model_add(serde_json::json!({
        "provider": provider,
        "provider_model_id": provider_model_id,
        "alias": alias,
        "capabilities": capabilities,
        "settings": settings,
    }))
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) fn model_alias(
    supervisor: State<'_, EngineSupervisor>,
    reference: String,
    new_alias: String,
    provider: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.model_alias(&reference, &new_alias, provider)
}

#[tauri::command]
pub(crate) fn model_remove(
    supervisor: State<'_, EngineSupervisor>,
    reference: String,
    provider: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.model_remove(&reference, provider)
}

#[tauri::command]
pub(crate) fn model_use(
    supervisor: State<'_, EngineSupervisor>,
    reference: String,
    provider: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.model_use(&reference, provider)
}

#[tauri::command]
pub(crate) fn model_discover(
    supervisor: State<'_, EngineSupervisor>,
    provider: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.model_discover(provider)
}

#[tauri::command]
pub(crate) fn model_refresh(
    supervisor: State<'_, EngineSupervisor>,
    provider: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.model_refresh(provider)
}

#[tauri::command]
pub(crate) fn model_test(
    supervisor: State<'_, EngineSupervisor>,
    reference: String,
    provider: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.model_test(&reference, provider)
}
