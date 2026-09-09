//! Engine lifecycle + runtime snapshot + `rinari code` handoff parsing.
use std::sync::Arc;

use tauri::{AppHandle, Emitter, State};

use rinari_code_lib::engine::{
    protocol::EngineEvent, CommandError, EngineStatus, EngineSupervisor,
};

/// Frontend event channel carrying every async engine event.
const FRONTEND_EVENT: &str = "rinari-engine-event";

pub(crate) fn start_supervised_engine(
    _app: &AppHandle,
    supervisor: &EngineSupervisor,
) -> Result<EngineStatus, CommandError> {
    // A development build must use the live checkout selected by
    // EngineSupervisor::locate(), never a possibly stale packaged sidecar.
    // The supervised Python process imports that checkout once per launch;
    // Restarting the Tauri host picks up engine and process-probe changes made during dev.
    #[cfg(not(debug_assertions))]
    if std::env::var("RINARI_ENGINE_BIN").is_err() {
        if let Ok(resource_dir) = _app.path().resource_dir() {
            if let Some(result) = supervisor.start_with_sidecar(&resource_dir) {
                return result;
            }
        }
    }
    supervisor.start()
}

#[tauri::command]
pub(crate) fn engine_status(supervisor: State<'_, EngineSupervisor>) -> EngineStatus {
    supervisor.status()
}

#[tauri::command]
pub(crate) fn engine_start(
    app: AppHandle,
    supervisor: State<'_, EngineSupervisor>,
) -> Result<EngineStatus, CommandError> {
    let forwarder = app.clone();
    let sink = Arc::new(move |event: EngineEvent| {
        let _ = forwarder.emit(FRONTEND_EVENT, &event);
    });
    supervisor.set_sink(sink);
    start_supervised_engine(&app, &supervisor)
}

#[tauri::command]
pub(crate) fn engine_shutdown(supervisor: State<'_, EngineSupervisor>) -> EngineStatus {
    supervisor.shutdown()
}

#[tauri::command]
pub(crate) fn engine_restart(
    app: AppHandle,
    supervisor: State<'_, EngineSupervisor>,
) -> Result<EngineStatus, CommandError> {
    let forwarder = app.clone();
    let sink = Arc::new(move |event: EngineEvent| {
        let _ = forwarder.emit(FRONTEND_EVENT, &event);
    });
    supervisor.set_sink(sink);
    supervisor.shutdown();
    start_supervised_engine(&app, &supervisor)
}

#[tauri::command]
pub(crate) fn snapshot_get(
    supervisor: State<'_, EngineSupervisor>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.snapshot_get()
}

/// `rinari code [path] [--session id]` handoff: explicit args only.
#[derive(Debug, Clone, serde::Serialize)]
pub(crate) struct OpenRequest {
    pub(crate) project: Option<String>,
    pub(crate) session: Option<String>,
}

#[tauri::command]
pub(crate) fn initial_open_request() -> OpenRequest {
    parse_open_request(&std::env::args().collect::<Vec<_>>())
}

pub(crate) fn parse_open_request(argv: &[String]) -> OpenRequest {
    let mut project = None;
    let mut session = None;
    let mut iter = argv.iter().skip(1).peekable();
    while let Some(arg) = iter.next() {
        match arg.as_str() {
            "--project" => project = iter.next().cloned(),
            "--session" => session = iter.next().cloned(),
            other if !other.starts_with("--") && project.is_none() => {
                project = Some(other.to_string());
            }
            _ => {}
        }
    }
    OpenRequest { project, session }
}

#[cfg(test)]
mod open_request_tests {
    use super::parse_open_request;

    #[test]
    fn parses_project_and_session_flags() {
        let argv = vec![
            "rinari-code".to_string(),
            "--project".to_string(),
            "C:/work/demo".to_string(),
            "--session".to_string(),
            "abc123".to_string(),
        ];
        let request = parse_open_request(&argv);
        assert_eq!(request.project.as_deref(), Some("C:/work/demo"));
        assert_eq!(request.session.as_deref(), Some("abc123"));
    }

    #[test]
    fn ignores_unrelated_flags() {
        let argv = vec!["rinari-code".to_string(), "--devtools".to_string()];
        let request = parse_open_request(&argv);
        assert!(request.project.is_none());
        assert!(request.session.is_none());
    }
}
