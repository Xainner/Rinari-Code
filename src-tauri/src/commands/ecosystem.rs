//! Ecosystem commands: MCP servers, plugins, native tools, policy.
use tauri::State;

use rinari_code_lib::engine::{CommandError, EngineSupervisor};

#[tauri::command]
pub(crate) fn mcp_list(
    supervisor: State<'_, EngineSupervisor>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.mcp_list()
}

#[tauri::command]
pub(crate) fn mcp_get(
    supervisor: State<'_, EngineSupervisor>,
    name: String,
) -> Result<serde_json::Value, CommandError> {
    supervisor.mcp_get(&name)
}

#[tauri::command]
pub(crate) fn mcp_create(
    supervisor: State<'_, EngineSupervisor>,
    name: String,
    command: Vec<String>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.mcp_create(&name, command)
}

#[tauri::command]
pub(crate) fn mcp_remove(
    supervisor: State<'_, EngineSupervisor>,
    name: String,
) -> Result<serde_json::Value, CommandError> {
    supervisor.mcp_remove(&name)
}

#[tauri::command]
pub(crate) fn mcp_set_enabled(
    supervisor: State<'_, EngineSupervisor>,
    name: String,
    enabled: bool,
) -> Result<serde_json::Value, CommandError> {
    if enabled {
        supervisor.mcp_enable(&name)
    } else {
        supervisor.mcp_disable(&name)
    }
}

#[tauri::command]
pub(crate) fn mcp_test(
    supervisor: State<'_, EngineSupervisor>,
    name: String,
) -> Result<serde_json::Value, CommandError> {
    supervisor.mcp_test(&name)
}

#[tauri::command]
pub(crate) fn plugin_list(
    supervisor: State<'_, EngineSupervisor>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.plugin_list()
}

#[tauri::command]
pub(crate) fn plugin_set_enabled(
    supervisor: State<'_, EngineSupervisor>,
    name: String,
    enabled: bool,
) -> Result<serde_json::Value, CommandError> {
    if enabled {
        supervisor.plugin_enable(&name)
    } else {
        supervisor.plugin_disable(&name)
    }
}

#[tauri::command]
pub(crate) fn plugin_diagnostics(
    supervisor: State<'_, EngineSupervisor>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.plugin_diagnostics()
}

#[tauri::command]
pub(crate) fn tool_list(
    supervisor: State<'_, EngineSupervisor>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.tool_list()
}

#[tauri::command]
pub(crate) fn policy_get(
    supervisor: State<'_, EngineSupervisor>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.policy_get()
}
