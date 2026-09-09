//! Project commands: recents, open, live Git status, intelligence.
use tauri::State;

use rinari_code_lib::engine::{CommandError, EngineSupervisor};

#[tauri::command]
pub(crate) fn project_list_recent(
    supervisor: State<'_, EngineSupervisor>,
    limit: Option<u32>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.project_list_recent(limit)
}

#[tauri::command]
pub(crate) fn project_open(
    supervisor: State<'_, EngineSupervisor>,
    path: String,
) -> Result<serde_json::Value, CommandError> {
    supervisor.project_open(&path)
}

#[tauri::command]
pub(crate) fn project_status(
    supervisor: State<'_, EngineSupervisor>,
    path: String,
) -> Result<serde_json::Value, CommandError> {
    supervisor.project_status(&path)
}

#[tauri::command]
pub(crate) fn project_intelligence(
    supervisor: State<'_, EngineSupervisor>,
    path: String,
) -> Result<serde_json::Value, CommandError> {
    supervisor.project_intelligence(&path)
}
