//! Session + turn-runtime commands: list/open/history/mode, turn
//! start/cancel, approvals, prompt queue.
use tauri::State;

use rinari_code_lib::engine::{CommandError, EngineSupervisor};

#[tauri::command]
pub(crate) fn session_list(
    supervisor: State<'_, EngineSupervisor>,
    kind: Option<String>,
    include_closed: Option<bool>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.session_list(kind, include_closed.unwrap_or(false))
}

#[tauri::command]
pub(crate) fn session_open(
    supervisor: State<'_, EngineSupervisor>,
    reference: String,
) -> Result<serde_json::Value, CommandError> {
    supervisor.session_open(&reference)
}

#[tauri::command]
pub(crate) fn session_close(
    supervisor: State<'_, EngineSupervisor>,
    reference: String,
) -> Result<serde_json::Value, CommandError> {
    supervisor.session_close(&reference)
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) fn session_delete(
    supervisor: State<'_, EngineSupervisor>,
    reference: String,
    cascade: Option<bool>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.session_delete(&reference, cascade.unwrap_or(false))
}

#[tauri::command]
pub(crate) fn session_history(
    supervisor: State<'_, EngineSupervisor>,
    reference: String,
    limit: Option<u32>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.session_history(&reference, limit)
}

#[tauri::command]
pub(crate) fn session_mode_set(
    supervisor: State<'_, EngineSupervisor>,
    reference: String,
    mode: String,
) -> Result<serde_json::Value, CommandError> {
    supervisor.session_mode_set(&reference, &mode)
}

#[tauri::command]
pub(crate) fn session_create(
    supervisor: State<'_, EngineSupervisor>,
    cwd: Option<String>,
    chat: Option<bool>,
    title: Option<String>,
    mode: Option<String>,
    permission_profile: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.session_create_with_options(
        cwd,
        chat.unwrap_or(false),
        title,
        mode,
        permission_profile,
    )
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) fn session_permission_set(
    supervisor: State<'_, EngineSupervisor>,
    reference: String,
    permission_profile: String,
) -> Result<serde_json::Value, CommandError> {
    supervisor.session_permission_set(&reference, &permission_profile)
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) fn session_permission_get(
    supervisor: State<'_, EngineSupervisor>,
    reference: String,
) -> Result<serde_json::Value, CommandError> {
    supervisor.session_permission_get(&reference)
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) fn session_model_set(
    supervisor: State<'_, EngineSupervisor>,
    reference: String,
    model: String,
    provider: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.session_model_set(&reference, &model, provider.as_deref())
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) fn session_events(
    supervisor: State<'_, EngineSupervisor>,
    reference: String,
    after_seq: Option<u64>,
    limit: Option<u32>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.session_events(&reference, after_seq, limit)
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) fn turn_start(
    supervisor: State<'_, EngineSupervisor>,
    session_id: String,
    message: String,
    reasoning_effort: Option<String>,
    attachments: Option<serde_json::Value>,
) -> Result<serde_json::Value, CommandError> {
    // Un solo nombre canónico: el frontend siempre manda snake_case.
    // (Se probó aceptar también camelCase, pero dos params que solo se
    // diferencian por casing/underscores confunden al parser de args.)
    if session_id.is_empty() {
        return Err("turn_start requires session_id (app 0.1.1)"
            .to_string()
            .into());
    }
    supervisor.turn_start_with_options(
        &session_id,
        &message,
        reasoning_effort.as_deref(),
        attachments,
    )
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) fn turn_cancel(
    supervisor: State<'_, EngineSupervisor>,
    session_id: String,
) -> Result<serde_json::Value, CommandError> {
    if session_id.is_empty() {
        return Err("turn_cancel requires session_id (app 0.1.1)"
            .to_string()
            .into());
    }
    supervisor.turn_cancel(&session_id)
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) fn approval_resolve(
    supervisor: State<'_, EngineSupervisor>,
    approval_id: String,
    decision: String,
) -> Result<serde_json::Value, CommandError> {
    supervisor.approval_resolve(&approval_id, &decision)
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) fn queue_add(
    supervisor: State<'_, EngineSupervisor>,
    session_id: String,
    message: String,
) -> Result<serde_json::Value, CommandError> {
    if session_id.is_empty() {
        return Err("queue_add requires session_id (app 0.1.1)"
            .to_string()
            .into());
    }
    supervisor.queue_add(&session_id, &message)
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) fn queue_list(
    supervisor: State<'_, EngineSupervisor>,
    session_id: String,
) -> Result<serde_json::Value, CommandError> {
    if session_id.is_empty() {
        return Err("queue_list requires session_id (app 0.1.1)"
            .to_string()
            .into());
    }
    supervisor.queue_list(&session_id)
}

#[tauri::command(rename_all = "snake_case")]
pub(crate) fn queue_clear(
    supervisor: State<'_, EngineSupervisor>,
    session_id: String,
) -> Result<serde_json::Value, CommandError> {
    if session_id.is_empty() {
        return Err("queue_clear requires session_id (app 0.1.1)"
            .to_string()
            .into());
    }
    supervisor.queue_clear(&session_id)
}
