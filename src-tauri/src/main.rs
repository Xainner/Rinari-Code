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
    // Production: bundled sidecar wins; dev override (RINARI_ENGINE_BIN)
    // and PATH stay as fallback via supervisor.start().
    if std::env::var("RINARI_ENGINE_BIN").is_err() {
        if let Ok(resource_dir) = app.path().resource_dir() {
            if let Some(result) = supervisor.start_with_sidecar(&resource_dir) {
                return result;
            }
        }
    }
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
fn session_open(
    supervisor: State<'_, EngineSupervisor>,
    reference: String,
) -> Result<serde_json::Value, CommandError> {
    supervisor.session_open(&reference)
}

#[tauri::command]
fn session_history(
    supervisor: State<'_, EngineSupervisor>,
    reference: String,
    limit: Option<u32>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.session_history(&reference, limit)
}

#[tauri::command]
fn session_mode_set(
    supervisor: State<'_, EngineSupervisor>,
    reference: String,
    mode: String,
) -> Result<serde_json::Value, CommandError> {
    supervisor.session_mode_set(&reference, &mode)
}

#[tauri::command]
fn task_tree(
    supervisor: State<'_, EngineSupervisor>,
    path: String,
) -> Result<serde_json::Value, CommandError> {
    supervisor.task_tree(&path)
}

#[tauri::command]
fn task_get(
    supervisor: State<'_, EngineSupervisor>,
    path: String,
    task_id: String,
) -> Result<serde_json::Value, CommandError> {
    supervisor.task_get(&path, &task_id)
}

#[tauri::command]
fn verification_latest(
    supervisor: State<'_, EngineSupervisor>,
    path: String,
    kinds: Option<Vec<String>>,
    limit: Option<u32>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.verification_latest(&path, kinds, limit)
}

#[tauri::command]
fn verification_plan(
    supervisor: State<'_, EngineSupervisor>,
    path: String,
    changed_files: Vec<String>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.verification_plan(&path, changed_files)
}

#[tauri::command]
fn checkpoint_list(
    supervisor: State<'_, EngineSupervisor>,
    path: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.checkpoint_list(path)
}

#[tauri::command]
fn checkpoint_show(
    supervisor: State<'_, EngineSupervisor>,
    checkpoint_id: String,
) -> Result<serde_json::Value, CommandError> {
    supervisor.checkpoint_show(&checkpoint_id)
}

#[tauri::command]
fn checkpoint_restore(
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
fn project_changes(
    supervisor: State<'_, EngineSupervisor>,
    path: String,
) -> Result<serde_json::Value, CommandError> {
    supervisor.project_changes(&path)
}

#[tauri::command]
fn project_diff(
    supervisor: State<'_, EngineSupervisor>,
    path: String,
    file: Option<String>,
    max_chars: Option<u32>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.project_diff(&path, file, max_chars)
}

#[tauri::command]
fn agent_list(supervisor: State<'_, EngineSupervisor>) -> Result<serde_json::Value, CommandError> {
    supervisor.agent_list()
}

#[tauri::command]
fn agent_config_get(
    supervisor: State<'_, EngineSupervisor>,
    agent: String,
) -> Result<serde_json::Value, CommandError> {
    supervisor.agent_config_get(&agent)
}

#[tauri::command]
fn agent_config_set(
    supervisor: State<'_, EngineSupervisor>,
    agent: String,
    model: Option<String>,
    fallback: Option<String>,
    enabled: Option<bool>,
    clear: Option<bool>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.agent_config_set(serde_json::json!({
        "agent": agent,
        "model": model,
        "fallback": fallback,
        "enabled": enabled,
        "clear": clear.unwrap_or(false),
    }))
}

#[tauri::command]
fn session_events(
    supervisor: State<'_, EngineSupervisor>,
    reference: String,
    after_seq: Option<u64>,
    limit: Option<u32>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.session_events(&reference, after_seq, limit)
}

#[tauri::command]
fn soul_list(supervisor: State<'_, EngineSupervisor>) -> Result<serde_json::Value, CommandError> {
    supervisor.soul_list()
}

#[tauri::command]
fn soul_get(
    supervisor: State<'_, EngineSupervisor>,
    id: String,
) -> Result<serde_json::Value, CommandError> {
    supervisor.soul_get(&id)
}

#[tauri::command]
fn soul_create(
    supervisor: State<'_, EngineSupervisor>,
    id: String,
    name: String,
    identity: String,
    description: Option<String>,
    version: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.soul_create(serde_json::json!({
        "id": id,
        "name": name,
        "identity": identity,
        "description": description,
        "version": version,
    }))
}

#[tauri::command]
fn soul_update(
    supervisor: State<'_, EngineSupervisor>,
    id: String,
    name: Option<String>,
    identity: Option<String>,
    description: Option<String>,
    version: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    let mut params = serde_json::Map::new();
    params.insert("id".to_string(), serde_json::Value::String(id));
    if let Some(name) = name {
        params.insert("name".to_string(), serde_json::Value::String(name));
    }
    if let Some(identity) = identity {
        params.insert("identity".to_string(), serde_json::Value::String(identity));
    }
    if let Some(description) = description {
        params.insert(
            "description".to_string(),
            serde_json::Value::String(description),
        );
    }
    if let Some(version) = version {
        params.insert("version".to_string(), serde_json::Value::String(version));
    }
    supervisor.soul_update(serde_json::Value::Object(params))
}

#[tauri::command]
fn soul_remove(
    supervisor: State<'_, EngineSupervisor>,
    id: String,
) -> Result<serde_json::Value, CommandError> {
    supervisor.soul_remove(&id)
}

#[tauri::command]
fn soul_activate(
    supervisor: State<'_, EngineSupervisor>,
    id: String,
) -> Result<serde_json::Value, CommandError> {
    supervisor.soul_activate(&id)
}

#[tauri::command]
fn mcp_list(supervisor: State<'_, EngineSupervisor>) -> Result<serde_json::Value, CommandError> {
    supervisor.mcp_list()
}

#[tauri::command]
fn mcp_get(
    supervisor: State<'_, EngineSupervisor>,
    name: String,
) -> Result<serde_json::Value, CommandError> {
    supervisor.mcp_get(&name)
}

#[tauri::command]
fn mcp_create(
    supervisor: State<'_, EngineSupervisor>,
    name: String,
    command: Vec<String>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.mcp_create(&name, command)
}

#[tauri::command]
fn mcp_remove(
    supervisor: State<'_, EngineSupervisor>,
    name: String,
) -> Result<serde_json::Value, CommandError> {
    supervisor.mcp_remove(&name)
}

#[tauri::command]
fn mcp_set_enabled(
    supervisor: State<'_, EngineSupervisor>,
    name: String,
    enabled: bool,
) -> Result<serde_json::Value, CommandError> {
    if enabled {
        supervisor.mcp_enable(&name)
    } else {
        supervisor.mcp_disable(&name)
    }
}

#[tauri::command]
fn mcp_test(
    supervisor: State<'_, EngineSupervisor>,
    name: String,
) -> Result<serde_json::Value, CommandError> {
    supervisor.mcp_test(&name)
}

#[tauri::command]
fn plugin_list(supervisor: State<'_, EngineSupervisor>) -> Result<serde_json::Value, CommandError> {
    supervisor.plugin_list()
}

#[tauri::command]
fn plugin_set_enabled(
    supervisor: State<'_, EngineSupervisor>,
    name: String,
    enabled: bool,
) -> Result<serde_json::Value, CommandError> {
    if enabled {
        supervisor.plugin_enable(&name)
    } else {
        supervisor.plugin_disable(&name)
    }
}

#[tauri::command]
fn plugin_diagnostics(
    supervisor: State<'_, EngineSupervisor>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.plugin_diagnostics()
}

#[tauri::command]
fn tool_list(supervisor: State<'_, EngineSupervisor>) -> Result<serde_json::Value, CommandError> {
    supervisor.tool_list()
}

#[tauri::command]
fn policy_get(supervisor: State<'_, EngineSupervisor>) -> Result<serde_json::Value, CommandError> {
    supervisor.policy_get()
}

#[tauri::command]
fn artifact_list(
    supervisor: State<'_, EngineSupervisor>,
    session_id: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.artifact_list(session_id)
}

#[tauri::command]
fn artifact_read(
    supervisor: State<'_, EngineSupervisor>,
    uri: String,
    max_bytes: Option<u32>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.artifact_read(&uri, max_bytes)
}

#[tauri::command]
fn context_get(
    supervisor: State<'_, EngineSupervisor>,
    reference: String,
) -> Result<serde_json::Value, CommandError> {
    supervisor.context_get(&reference)
}

#[tauri::command]
fn usage_get(
    supervisor: State<'_, EngineSupervisor>,
    reference: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.usage_get(reference)
}

#[tauri::command]
fn queue_add(
    supervisor: State<'_, EngineSupervisor>,
    session_id: String,
    message: String,
) -> Result<serde_json::Value, CommandError> {
    supervisor.queue_add(&session_id, &message)
}

#[tauri::command]
fn queue_list(
    supervisor: State<'_, EngineSupervisor>,
    session_id: String,
) -> Result<serde_json::Value, CommandError> {
    supervisor.queue_list(&session_id)
}

#[tauri::command]
fn queue_clear(
    supervisor: State<'_, EngineSupervisor>,
    session_id: String,
) -> Result<serde_json::Value, CommandError> {
    supervisor.queue_clear(&session_id)
}

#[tauri::command]
fn bundle_list(supervisor: State<'_, EngineSupervisor>) -> Result<serde_json::Value, CommandError> {
    supervisor.bundle_list()
}

#[tauri::command]
fn bundle_create(
    supervisor: State<'_, EngineSupervisor>,
    id: String,
    name: String,
    description: Option<String>,
    soul_id: Option<String>,
    mode: Option<String>,
    agents: Option<serde_json::Value>,
) -> Result<serde_json::Value, CommandError> {
    let mut params = serde_json::Map::new();
    params.insert("id".to_string(), serde_json::Value::String(id));
    params.insert("name".to_string(), serde_json::Value::String(name));
    if let Some(description) = description {
        params.insert(
            "description".to_string(),
            serde_json::Value::String(description),
        );
    }
    if let Some(soul_id) = soul_id {
        params.insert("soul_id".to_string(), serde_json::Value::String(soul_id));
    }
    if let Some(mode) = mode {
        params.insert("mode".to_string(), serde_json::Value::String(mode));
    }
    if let Some(agents) = agents {
        params.insert("agents".to_string(), agents);
    }
    supervisor.bundle_create(serde_json::Value::Object(params))
}

#[tauri::command]
fn bundle_remove(
    supervisor: State<'_, EngineSupervisor>,
    id: String,
) -> Result<serde_json::Value, CommandError> {
    supervisor.bundle_remove(&id)
}

#[tauri::command]
fn bundle_apply(
    supervisor: State<'_, EngineSupervisor>,
    id: String,
    session_ref: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.bundle_apply(&id, session_ref)
}

/// `rinari code [path] [--session id]` handoff: explicit args only.
#[derive(Debug, Clone, serde::Serialize)]
struct OpenRequest {
    project: Option<String>,
    session: Option<String>,
}

#[tauri::command]
fn initial_open_request() -> OpenRequest {
    parse_open_request(&std::env::args().collect::<Vec<_>>())
}

fn parse_open_request(argv: &[String]) -> OpenRequest {
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

#[tauri::command]
fn provider_list(
    supervisor: State<'_, EngineSupervisor>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.provider_list()
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
fn provider_create(
    supervisor: State<'_, EngineSupervisor>,
    alias: String,
    provider_type: String,
    auth_method: Option<String>,
    endpoint: Option<String>,
    account_hint: Option<String>,
    secret: Option<String>,
    secret_env: Option<String>,
    settings: Option<serde_json::Value>,
) -> Result<serde_json::Value, CommandError> {
    // Secrets travel only in memory to the local engine child, which stores
    // them via its credential backend. They never touch frontend storage.
    supervisor.provider_create(serde_json::json!({
        "alias": alias,
        "type": provider_type,
        "auth_method": auth_method,
        "endpoint": endpoint,
        "account_hint": account_hint,
        "secret": secret,
        "secret_env": secret_env,
        "settings": settings,
    }))
}

#[tauri::command]
fn provider_get(
    supervisor: State<'_, EngineSupervisor>,
    reference: String,
) -> Result<serde_json::Value, CommandError> {
    supervisor.provider_get(&reference)
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
fn provider_update(
    supervisor: State<'_, EngineSupervisor>,
    reference: String,
    alias: Option<String>,
    endpoint: Option<String>,
    account_hint: Option<String>,
    secret: Option<String>,
    secret_env: Option<String>,
    settings: Option<serde_json::Value>,
) -> Result<serde_json::Value, CommandError> {
    let mut params = serde_json::Map::new();
    params.insert("ref".to_string(), serde_json::Value::String(reference));
    if let Some(v) = alias {
        params.insert("alias".to_string(), serde_json::Value::String(v));
    }
    if let Some(v) = endpoint {
        params.insert("endpoint".to_string(), serde_json::Value::String(v));
    }
    if let Some(v) = account_hint {
        params.insert("account_hint".to_string(), serde_json::Value::String(v));
    }
    if let Some(v) = secret {
        params.insert("secret".to_string(), serde_json::Value::String(v));
    }
    if let Some(v) = secret_env {
        params.insert("secret_env".to_string(), serde_json::Value::String(v));
    }
    if let Some(v) = settings {
        params.insert("settings".to_string(), v);
    }
    supervisor.provider_update(serde_json::Value::Object(params))
}

#[tauri::command]
fn provider_remove(
    supervisor: State<'_, EngineSupervisor>,
    reference: String,
    switch_to: Option<String>,
    keep_credentials: Option<bool>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.provider_remove(&reference, switch_to, keep_credentials.unwrap_or(false))
}

#[tauri::command]
fn provider_test(
    supervisor: State<'_, EngineSupervisor>,
    reference: String,
) -> Result<serde_json::Value, CommandError> {
    supervisor.provider_test(&reference)
}

#[tauri::command]
fn provider_discover(
    supervisor: State<'_, EngineSupervisor>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.provider_discover()
}

#[tauri::command]
fn provider_use(
    supervisor: State<'_, EngineSupervisor>,
    reference: String,
) -> Result<serde_json::Value, CommandError> {
    supervisor.provider_use(&reference)
}

#[tauri::command]
fn model_list(
    supervisor: State<'_, EngineSupervisor>,
    provider: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.model_list(provider)
}

#[tauri::command]
fn model_get(
    supervisor: State<'_, EngineSupervisor>,
    reference: String,
    provider: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.model_get(&reference, provider)
}

#[tauri::command]
fn model_add(
    supervisor: State<'_, EngineSupervisor>,
    provider: String,
    provider_model_id: String,
    alias: String,
    capabilities: Option<serde_json::Value>,
    settings: Option<serde_json::Value>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.model_add(serde_json::json!({
        "provider": provider,
        "provider_model_id": provider_model_id,
        "alias": alias,
        "capabilities": capabilities,
        "settings": settings,
    }))
}

#[tauri::command]
fn model_alias(
    supervisor: State<'_, EngineSupervisor>,
    reference: String,
    new_alias: String,
    provider: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.model_alias(&reference, &new_alias, provider)
}

#[tauri::command]
fn model_remove(
    supervisor: State<'_, EngineSupervisor>,
    reference: String,
    provider: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.model_remove(&reference, provider)
}

#[tauri::command]
fn model_use(
    supervisor: State<'_, EngineSupervisor>,
    reference: String,
    provider: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.model_use(&reference, provider)
}

#[tauri::command]
fn model_discover(
    supervisor: State<'_, EngineSupervisor>,
    provider: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.model_discover(provider)
}

#[tauri::command]
fn model_refresh(
    supervisor: State<'_, EngineSupervisor>,
    provider: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.model_refresh(provider)
}

#[tauri::command]
fn model_test(
    supervisor: State<'_, EngineSupervisor>,
    reference: String,
    provider: Option<String>,
) -> Result<serde_json::Value, CommandError> {
    supervisor.model_test(&reference, provider)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
            engine_status,
            engine_start,
            engine_shutdown,
            engine_restart,
            session_list,
            session_open,
            session_history,
            session_mode_set,
            task_tree,
            task_get,
            verification_latest,
            verification_plan,
            checkpoint_list,
            checkpoint_show,
            checkpoint_restore,
            project_changes,
            project_diff,
            agent_list,
            agent_config_get,
            agent_config_set,
            session_events,
            soul_list,
            soul_get,
            soul_create,
            soul_update,
            soul_remove,
            soul_activate,
            mcp_list,
            mcp_get,
            mcp_create,
            mcp_remove,
            mcp_set_enabled,
            mcp_test,
            plugin_list,
            plugin_set_enabled,
            plugin_diagnostics,
            tool_list,
            policy_get,
            artifact_list,
            artifact_read,
            context_get,
            usage_get,
            queue_add,
            queue_list,
            queue_clear,
            bundle_list,
            bundle_create,
            bundle_remove,
            bundle_apply,
            initial_open_request,
            session_create,
            turn_start,
            turn_cancel,
            approval_resolve,
            snapshot_get,
            provider_list,
            provider_create,
            provider_get,
            provider_update,
            provider_remove,
            provider_test,
            provider_discover,
            provider_use,
            model_list,
            model_get,
            model_add,
            model_alias,
            model_remove,
            model_use,
            model_discover,
            model_refresh,
            model_test,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run()
}
