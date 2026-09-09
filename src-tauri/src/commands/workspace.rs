//! Workspace commands: tasks, verification, checkpoints, project diff,
//! file search, artifacts, context, usage.
use tauri::State;

use super::run_engine;
use rinari_code_lib::engine::{CommandError, EngineSupervisor};

#[tauri::command]
pub(crate) async fn task_tree(
    supervisor: State<'_, EngineSupervisor>,
    path: String,
) -> Result<serde_json::Value, CommandError> {
    run_engine(supervisor, move |engine| engine.task_tree(&path)).await
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) async fn task_get(
    supervisor: State<'_, EngineSupervisor>,
    path: String,
    task_id: String,
) -> Result<serde_json::Value, CommandError> {
    run_engine(supervisor, move |engine| engine.task_get(&path, &task_id)).await
}

#[tauri::command]
pub(crate) async fn verification_latest(
    supervisor: State<'_, EngineSupervisor>,
    path: String,
    kinds: Option<Vec<String>>,
    limit: Option<u32>,
) -> Result<serde_json::Value, CommandError> {
    run_engine(supervisor, move |engine| {
        engine.verification_latest(&path, kinds, limit)
    })
    .await
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) async fn verification_plan(
    supervisor: State<'_, EngineSupervisor>,
    path: String,
    changed_files: Vec<String>,
) -> Result<serde_json::Value, CommandError> {
    run_engine(supervisor, move |engine| {
        engine.verification_plan(&path, changed_files)
    })
    .await
}

#[tauri::command]
pub(crate) async fn checkpoint_list(
    supervisor: State<'_, EngineSupervisor>,
    path: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    run_engine(supervisor, move |engine| engine.checkpoint_list(path)).await
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) async fn checkpoint_show(
    supervisor: State<'_, EngineSupervisor>,
    checkpoint_id: String,
) -> Result<serde_json::Value, CommandError> {
    run_engine(supervisor, move |engine| {
        engine.checkpoint_show(&checkpoint_id)
    })
    .await
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) async fn checkpoint_restore(
    supervisor: State<'_, EngineSupervisor>,
    path: String,
    checkpoint_id: Option<String>,
    preview: Option<bool>,
    allow_mixed: Option<bool>,
) -> Result<serde_json::Value, CommandError> {
    run_engine(supervisor, move |engine| {
        engine.checkpoint_restore(serde_json::json!({
            "path": path,
            "checkpoint_id": checkpoint_id,
            "preview": preview.unwrap_or(false),
            "allow_mixed": allow_mixed.unwrap_or(false),
        }))
    })
    .await
}

#[tauri::command]
pub(crate) async fn project_changes(
    supervisor: State<'_, EngineSupervisor>,
    path: String,
) -> Result<serde_json::Value, CommandError> {
    run_engine(supervisor, move |engine| engine.project_changes(&path)).await
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) async fn project_diff(
    supervisor: State<'_, EngineSupervisor>,
    path: String,
    file: Option<String>,
    max_chars: Option<u32>,
) -> Result<serde_json::Value, CommandError> {
    run_engine(supervisor, move |engine| {
        engine.project_diff(&path, file, max_chars)
    })
    .await
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) async fn workspace_file_search(
    supervisor: State<'_, EngineSupervisor>,
    session_id: String,
    query: String,
    limit: Option<u32>,
) -> Result<serde_json::Value, CommandError> {
    run_engine(supervisor, move |engine| {
        engine.workspace_file_search(&session_id, &query, limit.unwrap_or(30))
    })
    .await
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) async fn artifact_list(
    supervisor: State<'_, EngineSupervisor>,
    session_id: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    run_engine(supervisor, move |engine| engine.artifact_list(session_id)).await
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) async fn artifact_read(
    supervisor: State<'_, EngineSupervisor>,
    uri: String,
    max_bytes: Option<u32>,
) -> Result<serde_json::Value, CommandError> {
    run_engine(supervisor, move |engine| {
        engine.artifact_read(&uri, max_bytes)
    })
    .await
}

#[tauri::command]
pub(crate) async fn context_get(
    supervisor: State<'_, EngineSupervisor>,
    reference: String,
) -> Result<serde_json::Value, CommandError> {
    run_engine(supervisor, move |engine| engine.context_get(&reference)).await
}

#[tauri::command]
pub(crate) async fn usage_get(
    supervisor: State<'_, EngineSupervisor>,
    reference: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    run_engine(supervisor, move |engine| engine.usage_get(reference)).await
}
