use std::sync::Mutex;

use tauri::{Manager, State};

mod engine;
use engine::{EngineState, EngineSupervisor};

#[tauri::command]
fn engine_status(supervisor: State<'_, Mutex<EngineSupervisor>>) -> EngineState {
    supervisor
        .lock()
        .map(|s| s.status())
        .unwrap_or(EngineState::Failed)
}

#[tauri::command]
fn engine_spawn_test(supervisor: State<'_, Mutex<EngineSupervisor>>) -> Result<String, String> {
    supervisor
        .lock()
        .map_err(|_| "engine supervisor lock poisoned".to_string())
        .and_then(|mut s| s.spawn_test_sidecar())
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
        .manage(Mutex::new(EngineSupervisor::new()))
        .invoke_handler(tauri::generate_handler![engine_status, engine_spawn_test])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
