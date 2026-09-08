// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Rinari Code entry point. Owns the whole Tauri surface: commands,
// plugins, event forwarding, run(). Path per call:
// Tauri command → EngineSupervisor → EngineTransport → Engine Protocol.
// No harness logic here; the engine (Python) owns sessions, tools,
// providers, policy, tasks and verification.
use std::sync::Arc;

use tauri::{AppHandle, Emitter, Manager, State};

use rinari_code_lib::engine::{
    protocol::EngineEvent, CommandError, EngineStatus, EngineSupervisor,
};

/// Frontend event channel carrying every async engine event.
const FRONTEND_EVENT: &str = "rinari-engine-event";

#[tauri::command]
fn engine_status(supervisor: State<'_, EngineSupervisor>) -> EngineStatus {
    supervisor.status()
}

#[tauri::command]
fn engine_start(
    app: AppHandle,
    supervisor: State<'_, EngineSupervisor>,
) -> Result<EngineStatus, CommandError> {
    let forwarder = app.clone();
    let sink = Arc::new(move |event: EngineEvent| {
        let _ = forwarder.emit(FRONTEND_EVENT, &event);
    });
    supervisor.set_sink(sink);
    supervisor.start()
}

#[tauri::command]
fn engine_shutdown(supervisor: State<'_, EngineSupervisor>) -> EngineStatus {
    supervisor.shutdown()
}

#[tauri::command]
fn engine_restart(
    app: AppHandle,
    supervisor: State<'_, EngineSupervisor>,
) -> Result<EngineStatus, CommandError> {
    let forwarder = app.clone();
    let sink = Arc::new(move |event: EngineEvent| {
        let _ = forwarder.emit(FRONTEND_EVENT, &event);
    });
    supervisor.set_sink(sink);
    supervisor.restart()
}

#[tauri::command]
fn session_list(
    supervisor: State<'_, EngineSupervisor>,
    kind: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.session_list(kind)
}

#[tauri::command]
fn session_create(
    supervisor: State<'_, EngineSupervisor>,
    cwd: Option<String>,
    chat: Option<bool>,
    title: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.session_create(cwd, chat.unwrap_or(false), title)
}

#[tauri::command]
fn turn_start(
    supervisor: State<'_, EngineSupervisor>,
    session_id: String,
    message: String,
) -> Result<serde_json::Value, CommandError> {
    supervisor.turn_start(&session_id, &message)
}

#[tauri::command]
fn turn_cancel(
    supervisor: State<'_, EngineSupervisor>,
    session_id: String,
) -> Result<serde_json::Value, CommandError> {
    supervisor.turn_cancel(&session_id)
}

#[tauri::command]
fn approval_resolve(
    supervisor: State<'_, EngineSupervisor>,
    approval_id: String,
    decision: String,
) -> Result<serde_json::Value, CommandError> {
    supervisor.approval_resolve(&approval_id, &decision)
}

#[tauri::command]
fn snapshot_get(
    supervisor: State<'_, EngineSupervisor>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.snapshot_get()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .manage(EngineSupervisor::new())
        .invoke_handler(tauri::generate_handler![
            engine_status,
            engine_start,
            engine_shutdown,
            engine_restart,
            session_list,
            session_create,
            turn_start,
            turn_cancel,
            approval_resolve,
            snapshot_get,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run()
}
