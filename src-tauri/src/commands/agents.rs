//! Built-in agent registry + per-agent model assignment.
use tauri::State;

use rinari_code_lib::engine::{CommandError, EngineSupervisor};

#[tauri::command]
pub(crate) fn agent_list(
    supervisor: State<'_, EngineSupervisor>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.agent_list()
}

#[tauri::command]
pub(crate) fn agent_config_get(
    supervisor: State<'_, EngineSupervisor>,
    agent: String,
) -> Result<serde_json::Value, CommandError> {
    supervisor.agent_config_get(&agent)
}

#[tauri::command]
pub(crate) fn agent_config_set(
    supervisor: State<'_, EngineSupervisor>,
    agent: String,
    model: Option<String>,
    fallback: Option<String>,
    enabled: Option<bool>,
    clear: Option<bool>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.agent_config_set(serde_json::json!({
        "agent": agent,
        "model": model,
        "fallback": fallback,
        "enabled": enabled,
        "clear": clear.unwrap_or(false),
    }))
}
