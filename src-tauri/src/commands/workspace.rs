//! Workspace commands: tasks, verification, checkpoints, project diff,
//! file search, artifacts, context, usage.
use tauri::State;

use rinari_code_lib::engine::{CommandError, EngineSupervisor};

#[tauri::command]
pub(crate) fn task_tree(
    supervisor: State<'_, EngineSupervisor>,
    path: String,
) -> Result<serde_json::Value, CommandError> {
    supervisor.task_tree(&path)
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) fn task_get(
    supervisor: State<'_, EngineSupervisor>,
    path: String,
    task_id: String,
) -> Result<serde_json::Value, CommandError> {
    supervisor.task_get(&path, &task_id)
}

#[tauri::command]
pub(crate) fn verification_latest(
    supervisor: State<'_, EngineSupervisor>,
    path: String,
    kinds: Option<Vec<String>>,
    limit: Option<u32>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.verification_latest(&path, kinds, limit)
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) fn verification_plan(
    supervisor: State<'_, EngineSupervisor>,
    path: String,
    changed_files: Vec<String>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.verification_plan(&path, changed_files)
}

#[tauri::command]
pub(crate) fn checkpoint_list(
    supervisor: State<'_, EngineSupervisor>,
    path: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.checkpoint_list(path)
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) fn checkpoint_show(
    supervisor: State<'_, EngineSupervisor>,
    checkpoint_id: String,
) -> Result<serde_json::Value, CommandError> {
    supervisor.checkpoint_show(&checkpoint_id)
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) fn checkpoint_restore(
    supervisor: State<'_, EngineSupervisor>,
    path: String,
    checkpoint_id: Option<String>,
    preview: Option<bool>,
    allow_mixed: Option<bool>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.checkpoint_restore(serde_json::json!({
        "path": path,
        "checkpoint_id": checkpoint_id,
        "preview": preview.unwrap_or(false),
        "allow_mixed": allow_mixed.unwrap_or(false),
    }))
}

#[tauri::command]
pub(crate) fn project_changes(
    supervisor: State<'_, EngineSupervisor>,
    path: String,
) -> Result<serde_json::Value, CommandError> {
    supervisor.project_changes(&path)
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) fn project_diff(
    supervisor: State<'_, EngineSupervisor>,
    path: String,
    file: Option<String>,
    max_chars: Option<u32>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.project_diff(&path, file, max_chars)
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) fn workspace_file_search(
    supervisor: State<'_, EngineSupervisor>,
    session_id: String,
    query: String,
    limit: Option<u32>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.workspace_file_search(&session_id, &query, limit.unwrap_or(30))
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) fn artifact_list(
    supervisor: State<'_, EngineSupervisor>,
    session_id: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.artifact_list(session_id)
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) fn artifact_read(
    supervisor: State<'_, EngineSupervisor>,
    uri: String,
    max_bytes: Option<u32>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.artifact_read(&uri, max_bytes)
}

#[tauri::command]
pub(crate) fn context_get(
    supervisor: State<'_, EngineSupervisor>,
    reference: String,
) -> Result<serde_json::Value, CommandError> {
    supervisor.context_get(&reference)
}

#[tauri::command]
pub(crate) fn usage_get(
    supervisor: State<'_, EngineSupervisor>,
    reference: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.usage_get(reference)
}
