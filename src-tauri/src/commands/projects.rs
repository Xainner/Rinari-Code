//! Project commands: recents, open, live Git status, intelligence.
use tauri::State;

use rinari_agent_lib::engine::{CommandError, EngineSupervisor};

#[tauri::command(rename_all = "snake_case")]
pub(crate) async fn project_list(
    supervisor: State<'_, EngineSupervisor>,
    include_archived: Option<bool>,
) -> Result<serde_json::Value, CommandError> {
    super::run_engine(supervisor, move |engine| {
        engine.project_list(include_archived.unwrap_or(false))
    })
    .await
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) async fn project_get(
    supervisor: State<'_, EngineSupervisor>,
    project_id: String,
) -> Result<serde_json::Value, CommandError> {
    super::run_engine(supervisor, move |engine| engine.project_get(&project_id)).await
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) async fn project_add(
    supervisor: State<'_, EngineSupervisor>,
    path: String,
    name: Option<String>,
    description: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    let params = serde_json::json!({"path": path, "name": name, "description": description});
    super::run_engine(supervisor, move |engine| engine.project_add(params)).await
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) async fn project_update(
    supervisor: State<'_, EngineSupervisor>,
    project_id: String,
    name: Option<String>,
    description: Option<String>,
    pinned: Option<bool>,
    archived: Option<bool>,
) -> Result<serde_json::Value, CommandError> {
    let params = serde_json::json!({
        "project_id": project_id,
        "name": name,
        "description": description,
        "pinned": pinned,
        "archived": archived,
    });
    super::run_engine(supervisor, move |engine| engine.project_update(params)).await
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) async fn project_remove(
    supervisor: State<'_, EngineSupervisor>,
    project_id: String,
    session_policy: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    let policy = session_policy.unwrap_or_else(|| "archive".to_string());
    super::run_engine(supervisor, move |engine| {
        engine.project_remove(&project_id, &policy)
    })
    .await
}

#[tauri::command]
pub(crate) async fn project_list_recent(
    supervisor: State<'_, EngineSupervisor>,
    limit: Option<u32>,
) -> Result<serde_json::Value, CommandError> {
    super::run_engine(supervisor, move |engine| engine.project_list_recent(limit)).await
}

#[tauri::command]
pub(crate) async fn project_open(
    supervisor: State<'_, EngineSupervisor>,
    path: String,
) -> Result<serde_json::Value, CommandError> {
    super::run_engine(supervisor, move |engine| engine.project_open(&path)).await
}

#[tauri::command]
pub(crate) async fn project_status(
    supervisor: State<'_, EngineSupervisor>,
    path: String,
) -> Result<serde_json::Value, CommandError> {
    super::run_engine(supervisor, move |engine| engine.project_status(&path)).await
}

#[tauri::command]
pub(crate) async fn project_intelligence(
    supervisor: State<'_, EngineSupervisor>,
    path: String,
) -> Result<serde_json::Value, CommandError> {
    super::run_engine(supervisor, move |engine| engine.project_intelligence(&path)).await
}

#[tauri::command]
pub(crate) async fn project_trust(
    supervisor: State<'_, EngineSupervisor>,
    path: String,
) -> Result<serde_json::Value, CommandError> {
    super::run_engine(supervisor, move |engine| engine.project_trust(&path)).await
}
