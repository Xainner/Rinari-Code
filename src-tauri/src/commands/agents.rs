//! Built-in agent registry + per-agent model assignment.
use tauri::State;

use super::run_engine;
use rinari_code_lib::engine::{CommandError, EngineSupervisor};

#[tauri::command]
pub(crate) async fn agent_list(
    supervisor: State<'_, EngineSupervisor>,
) -> Result<serde_json::Value, CommandError> {
    run_engine(supervisor, |engine| engine.agent_list()).await
}

#[tauri::command]
pub(crate) async fn agent_config_get(
    supervisor: State<'_, EngineSupervisor>,
    agent: String,
) -> Result<serde_json::Value, CommandError> {
    run_engine(supervisor, move |engine| engine.agent_config_get(&agent)).await
}

#[tauri::command]
pub(crate) async fn agent_config_set(
    supervisor: State<'_, EngineSupervisor>,
    agent: String,
    model: Option<String>,
    fallback: Option<String>,
    enabled: Option<bool>,
    clear: Option<bool>,
) -> Result<serde_json::Value, CommandError> {
    run_engine(supervisor, move |engine| {
        engine.agent_config_set(serde_json::json!({
            "agent": agent,
            "model": model,
            "fallback": fallback,
            "enabled": enabled,
            "clear": clear.unwrap_or(false),
        }))
    })
    .await
}
