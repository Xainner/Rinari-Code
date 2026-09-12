// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Rinari Code entry point. Owns the Tauri surface: plugins, event
// forwarding, command registration, run(). Path per call:
// Tauri command → EngineSupervisor → EngineTransport → Engine Protocol.
// No harness logic here; the engine (Python) owns sessions, tools,
// providers, policy, tasks and verification.
//
// Command handlers live in `commands/` (bin crate, Tauri-linked); the
// engine client lives in the lib crate (Tauri-free, unit-testable).
mod commands;
mod menu;

use tauri::{Emitter, Manager};

use commands::engine::parse_open_request;
use rinari_code_lib::engine::EngineSupervisor;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .menu(menu::build)
        .on_menu_event(|app, event| menu::handle(app, event.id().as_ref()))
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
            let request = parse_open_request(&argv);
            if request.project.is_some() || request.session.is_some() {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.emit("rinari-open-request", &request);
                }
            }
        }))
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .manage(EngineSupervisor::new())
        .invoke_handler(tauri::generate_handler![
            commands::desktop::session_move,
            commands::desktop::workspace_preview_start,
            commands::desktop::workspace_preview_status,
            commands::desktop::workspace_preview_stop,
            commands::desktop::workspace_file_read,
            commands::desktop::workspace_file_open,
            commands::desktop::question_list,
            commands::desktop::question_resolve,
            commands::engine::engine_status,
            commands::engine::engine_start,
            commands::engine::engine_shutdown,
            commands::engine::engine_restart,
            commands::engine::snapshot_get,
            commands::engine::initial_open_request,
            commands::sessions::session_list,
            commands::sessions::session_open,
            commands::sessions::session_rename,
            commands::sessions::session_archive,
            commands::sessions::session_restore,
            commands::sessions::session_fork,
            commands::sessions::session_history,
            commands::sessions::session_timeline,
            commands::sessions::session_mode_set,
            commands::sessions::session_create,
            commands::sessions::session_model_set,
            commands::sessions::session_permission_get,
            commands::sessions::session_permission_set,
            commands::sessions::turn_changes_get,
            commands::sessions::turn_changes_review,
            commands::sessions::turn_changes_undo_preview,
            commands::sessions::turn_changes_undo,
            commands::sessions::session_events,
            commands::sessions::session_close,
            commands::sessions::session_delete,
            commands::sessions::turn_start,
            commands::sessions::turn_cancel,
            commands::sessions::approval_resolve,
            commands::sessions::queue_add,
            commands::sessions::queue_list,
            commands::sessions::queue_clear,
            commands::workspace::task_tree,
            commands::workspace::task_get,
            commands::workspace::verification_latest,
            commands::workspace::verification_plan,
            commands::workspace::checkpoint_list,
            commands::workspace::checkpoint_show,
            commands::workspace::checkpoint_restore,
            commands::workspace::project_changes,
            commands::workspace::project_diff,
            commands::workspace::workspace_file_search,
            commands::workspace::artifact_list,
            commands::workspace::artifact_read,
            commands::workspace::attachment_prepare,
            commands::workspace::attachment_preview,
            commands::workspace::attachment_prepare_start,
            commands::workspace::attachment_prepare_get,
            commands::workspace::attachment_prepare_cancel,
            commands::workspace::context_get,
            commands::workspace::usage_get,
            commands::agents::agent_list,
            commands::agents::agent_config_get,
            commands::agents::agent_config_set,
            commands::souls::soul_list,
            commands::souls::soul_get,
            commands::souls::soul_create,
            commands::souls::soul_update,
            commands::souls::soul_remove,
            commands::souls::soul_activate,
            commands::ecosystem::mcp_list,
            commands::ecosystem::mcp_get,
            commands::ecosystem::mcp_create,
            commands::ecosystem::mcp_remove,
            commands::ecosystem::mcp_set_enabled,
            commands::ecosystem::mcp_test,
            commands::ecosystem::plugin_list,
            commands::ecosystem::plugin_set_enabled,
            commands::ecosystem::plugin_diagnostics,
            commands::ecosystem::tool_list,
            commands::ecosystem::policy_get,
            commands::workflow::bundle_list,
            commands::workflow::bundle_create,
            commands::workflow::bundle_remove,
            commands::workflow::bundle_apply,
            commands::projects::project_list_recent,
            commands::projects::project_list,
            commands::projects::project_get,
            commands::projects::project_add,
            commands::projects::project_update,
            commands::projects::project_remove,
            commands::projects::project_open,
            commands::projects::project_status,
            commands::projects::project_intelligence,
            commands::projects::project_trust,
            commands::providers::provider_list,
            commands::providers::provider_create,
            commands::providers::provider_get,
            commands::providers::provider_update,
            commands::providers::provider_remove,
            commands::providers::provider_test,
            commands::providers::provider_discover,
            commands::providers::provider_use,
            commands::models::model_list,
            commands::models::model_get,
            commands::models::model_add,
            commands::models::model_alias,
            commands::models::model_remove,
            commands::models::model_use,
            commands::models::model_discover,
            commands::models::model_discovery_start,
            commands::models::model_refresh,
            commands::models::model_test,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run()
}
