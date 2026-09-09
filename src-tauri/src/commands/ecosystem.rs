//! Ecosystem commands: MCP servers, plugins, native tools, policy.
use tauri::State;

use super::run_engine;
use rinari_code_lib::engine::{CommandError, EngineSupervisor};

#[tauri::command]
pub(crate) async fn mcp_list(
    supervisor: State<'_, EngineSupervisor>,
) -> Result<serde_json::Value, CommandError> {
    run_engine(supervisor, |engine| engine.mcp_list()).await
}

#[tauri::command]
pub(crate) async fn mcp_get(
    supervisor: State<'_, EngineSupervisor>,
    name: String,
) -> Result<serde_json::Value, CommandError> {
    run_engine(supervisor, move |engine| engine.mcp_get(&name)).await
}

#[tauri::command]
pub(crate) async fn mcp_create(
    supervisor: State<'_, EngineSupervisor>,
    name: String,
    command: Vec<String>,
) -> Result<serde_json::Value, CommandError> {
    run_engine(supervisor, move |engine| engine.mcp_create(&name, command)).await
}

#[tauri::command]
pub(crate) async fn mcp_remove(
    supervisor: State<'_, EngineSupervisor>,
    name: String,
) -> Result<serde_json::Value, CommandError> {
    run_engine(supervisor, move |engine| engine.mcp_remove(&name)).await
}

#[tauri::command]
pub(crate) async fn mcp_set_enabled(
    supervisor: State<'_, EngineSupervisor>,
    name: String,
    enabled: bool,
) -> Result<serde_json::Value, CommandError> {
    run_engine(supervisor, move |engine| {
        if enabled {
            engine.mcp_enable(&name)
        } else {
            engine.mcp_disable(&name)
        }
    })
    .await
}

#[tauri::command]
pub(crate) async fn mcp_test(
    supervisor: State<'_, EngineSupervisor>,
    name: String,
) -> Result<serde_json::Value, CommandError> {
    run_engine(supervisor, move |engine| engine.mcp_test(&name)).await
}

#[tauri::command]
pub(crate) async fn plugin_list(
    supervisor: State<'_, EngineSupervisor>,
) -> Result<serde_json::Value, CommandError> {
    run_engine(supervisor, |engine| engine.plugin_list()).await
}

#[tauri::command]
pub(crate) async fn plugin_set_enabled(
    supervisor: State<'_, EngineSupervisor>,
    name: String,
    enabled: bool,
) -> Result<serde_json::Value, CommandError> {
    run_engine(supervisor, move |engine| {
        if enabled {
            engine.plugin_enable(&name)
        } else {
            engine.plugin_disable(&name)
        }
    })
    .await
}

#[tauri::command]
pub(crate) async fn plugin_diagnostics(
    supervisor: State<'_, EngineSupervisor>,
) -> Result<serde_json::Value, CommandError> {
    run_engine(supervisor, |engine| engine.plugin_diagnostics()).await
}

#[tauri::command]
pub(crate) async fn tool_list(
    supervisor: State<'_, EngineSupervisor>,
) -> Result<serde_json::Value, CommandError> {
    run_engine(supervisor, |engine| engine.tool_list()).await
}

#[tauri::command]
pub(crate) async fn policy_get(
    supervisor: State<'_, EngineSupervisor>,
) -> Result<serde_json::Value, CommandError> {
    run_engine(supervisor, |engine| engine.policy_get()).await
}
