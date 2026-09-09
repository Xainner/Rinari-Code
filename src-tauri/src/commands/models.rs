//! Model commands: catalog, aliases, discovery, selection.
use tauri::State;

use rinari_code_lib::engine::{CommandError, EngineSupervisor};

#[tauri::command]
pub(crate) async fn model_list(
    supervisor: State<'_, EngineSupervisor>,
    provider: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    super::run_engine(supervisor, move |engine| engine.model_list(provider)).await
}

#[tauri::command]
pub(crate) async fn model_get(
    supervisor: State<'_, EngineSupervisor>,
    reference: String,
    provider: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    super::run_engine(supervisor, move |engine| {
        engine.model_get(&reference, provider)
    })
    .await
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) async fn model_add(
    supervisor: State<'_, EngineSupervisor>,
    provider: String,
    provider_model_id: String,
    alias: String,
    capabilities: Option<serde_json::Value>,
    settings: Option<serde_json::Value>,
) -> Result<serde_json::Value, CommandError> {
    let params = serde_json::json!({
        "provider": provider,
        "provider_model_id": provider_model_id,
        "alias": alias,
        "capabilities": capabilities,
        "settings": settings,
    });
    super::run_engine(supervisor, move |engine| engine.model_add(params)).await
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) async fn model_alias(
    supervisor: State<'_, EngineSupervisor>,
    reference: String,
    new_alias: String,
    provider: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    super::run_engine(supervisor, move |engine| {
        engine.model_alias(&reference, &new_alias, provider)
    })
    .await
}

#[tauri::command]
pub(crate) async fn model_remove(
    supervisor: State<'_, EngineSupervisor>,
    reference: String,
    provider: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    super::run_engine(supervisor, move |engine| {
        engine.model_remove(&reference, provider)
    })
    .await
}

#[tauri::command]
pub(crate) async fn model_use(
    supervisor: State<'_, EngineSupervisor>,
    reference: String,
    provider: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    super::run_engine(supervisor, move |engine| {
        engine.model_use(&reference, provider)
    })
    .await
}

#[tauri::command]
pub(crate) async fn model_discover(
    supervisor: State<'_, EngineSupervisor>,
    provider: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    super::run_engine(supervisor, move |engine| engine.model_discover(provider)).await
}

#[tauri::command]
pub(crate) async fn model_discovery_start(
    supervisor: State<'_, EngineSupervisor>,
    provider: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    super::run_engine(supervisor, move |engine| {
        engine.model_discovery_start(provider)
    })
    .await
}

#[tauri::command]
pub(crate) async fn model_refresh(
    supervisor: State<'_, EngineSupervisor>,
    provider: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    super::run_engine(supervisor, move |engine| engine.model_refresh(provider)).await
}

#[tauri::command]
pub(crate) async fn model_test(
    supervisor: State<'_, EngineSupervisor>,
    reference: String,
    provider: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    super::run_engine(supervisor, move |engine| {
        engine.model_test(&reference, provider)
    })
    .await
}
