use rinari_code_lib::engine::{methods::Method, CommandError, EngineSupervisor};
use tauri::State;
use tauri_plugin_opener::OpenerExt;

#[tauri::command(rename_all = "snake_case")]
pub(crate) async fn workspace_preview_start(
    supervisor: State<'_, EngineSupervisor>,
    session_id: String,
    path: String,
    turn_id: Option<String>,
    run_dev: Option<bool>,
    dev_url: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    super::run_engine(supervisor, move |engine| {
        engine.request(
            Method::WorkspacePreviewStart,
            Some(serde_json::json!({
                "session_id": session_id, "path": path, "turn_id": turn_id,
                "run_dev": run_dev.unwrap_or(false), "dev_url": dev_url
            })),
        )
    })
    .await
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) async fn workspace_preview_status(
    supervisor: State<'_, EngineSupervisor>,
    session_id: String,
    preview_id: String,
) -> Result<serde_json::Value, CommandError> {
    super::run_engine(supervisor, move |engine| {
        engine.request(
            Method::WorkspacePreviewStatus,
            Some(serde_json::json!({"session_id": session_id, "preview_id": preview_id})),
        )
    })
    .await
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) async fn workspace_preview_stop(
    supervisor: State<'_, EngineSupervisor>,
    session_id: String,
    preview_id: String,
) -> Result<serde_json::Value, CommandError> {
    super::run_engine(supervisor, move |engine| {
        engine.request(
            Method::WorkspacePreviewStop,
            Some(serde_json::json!({"session_id": session_id, "preview_id": preview_id})),
        )
    })
    .await
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) async fn workspace_file_open(
    app: tauri::AppHandle,
    supervisor: State<'_, EngineSupervisor>,
    session_id: String,
    path: String,
    turn_id: Option<String>,
) -> Result<(), CommandError> {
    let preview = workspace_file_read(supervisor, session_id, path, turn_id).await?;
    let path = preview
        .get("path")
        .and_then(|value| value.as_str())
        .ok_or_else(|| CommandError::from("Engine returned no file path".to_owned()))?;
    app.opener()
        .open_path(path, None::<&str>)
        .map_err(|error| CommandError::from(error.to_string()))
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) async fn session_move(
    supervisor: State<'_, EngineSupervisor>,
    session_id: String,
    project_id: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    super::run_engine(supervisor, move |engine| {
        engine.request(
            Method::SessionMove,
            Some(serde_json::json!({"session_id": session_id, "project_id": project_id})),
        )
    })
    .await
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) async fn workspace_file_read(
    supervisor: State<'_, EngineSupervisor>,
    session_id: String,
    path: String,
    turn_id: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    super::run_engine(supervisor, move |engine| {
        engine.request(
            Method::WorkspaceFileRead,
            Some(serde_json::json!({"session_id": session_id, "path": path, "turn_id": turn_id})),
        )
    })
    .await
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) async fn question_list(
    supervisor: State<'_, EngineSupervisor>,
    session_id: String,
) -> Result<serde_json::Value, CommandError> {
    super::run_engine(supervisor, move |engine| {
        engine.request(
            Method::QuestionList,
            Some(serde_json::json!({"session_id": session_id})),
        )
    })
    .await
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) async fn question_resolve(
    supervisor: State<'_, EngineSupervisor>,
    session_id: String,
    request_id: String,
    status: String,
    answers: std::collections::HashMap<String, String>,
) -> Result<serde_json::Value, CommandError> {
    super::run_engine(supervisor, move |engine| engine.request(Method::QuestionResolve, Some(serde_json::json!({"session_id": session_id, "request_id": request_id, "status": status, "answers": answers})))).await
}
