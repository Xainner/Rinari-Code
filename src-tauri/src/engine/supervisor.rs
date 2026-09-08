//! EngineSupervisor: locate, spawn, handshake, route, and restart the engine.
//!
//! Path: Tauri command → EngineSupervisor → EngineTransport → Engine Protocol.
//! No harness logic lives here; this is process lifecycle plus typed routing.

use std::path::PathBuf;
use std::sync::Arc;
use std::thread::{self, JoinHandle};
use std::time::Duration;

use serde::Serialize;
use serde_json::{json, Value};

use crate::engine::protocol::{EngineEvent, Hello};
use crate::engine::transport::{EngineTransport, TransportError};

/// Dev override: engine binary. Production uses the bundled sidecar / PATH.
const ENV_ENGINE_BIN: &str = "RINARI_ENGINE_BIN";
/// Dev override: extra args before `engine --stdio`, space-separated
/// (e.g. `run rinari` so `RINARI_ENGINE_BIN=uv` runs the local checkout).
const ENV_ENGINE_ARGS: &str = "RINARI_ENGINE_ARGS";
/// Dev override: working directory for the engine process.
const ENV_ENGINE_CWD: &str = "RINARI_ENGINE_CWD";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum EngineState {
    Stopped,
    Starting,
    Handshaking,
    Ready,
    Degraded,
    Restarting,
    Failed,
}

#[derive(Debug, Clone, Serialize)]
pub struct EngineStatus {
    pub state: EngineState,
    pub engine_version: Option<String>,
    pub protocol_version: Option<u32>,
    pub detail: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CommandError {
    pub code: String,
    pub message: String,
}

impl CommandError {
    fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
        }
    }
}

impl From<TransportError> for CommandError {
    fn from(error: TransportError) -> Self {
        match error {
            TransportError::Engine(engine) => Self::new(engine.code, engine.message),
            TransportError::Timeout(message) => Self::new("ENGINE_TIMEOUT", message),
            TransportError::ShutDown => Self::new("ENGINE_DOWN", "engine is not running"),
            TransportError::Spawn(message) => Self::new("ENGINE_SPAWN", message),
            TransportError::Handshake(message) => Self::new("ENGINE_HANDSHAKE", message),
            TransportError::Io(message) => Self::new("ENGINE_IO", message),
        }
    }
}

impl From<String> for CommandError {
    fn from(message: String) -> Self {
        Self::new("ENGINE_ERROR", message)
    }
}

/// Frontend event sink. `main.rs` installs a closure that forwards to the
/// WebView; kept as a trait object so this module never links Tauri
/// (unit-test binaries have no SxS manifest for the UI runtime).
pub type EventSink = Arc<dyn Fn(EngineEvent) + Send + Sync + 'static>;

struct Inner {
    state: EngineState,
    transport: Option<Arc<EngineTransport>>,
    hello: Option<Hello>,
    detail: Option<String>,
    pump: Option<JoinHandle<()>>,
    sink: Option<EventSink>,
}

pub struct EngineSupervisor {
    inner: std::sync::Mutex<Inner>,
}

impl EngineSupervisor {
    pub fn new() -> Self {
        Self {
            inner: std::sync::Mutex::new(Inner {
                state: EngineState::Stopped,
                transport: None,
                hello: None,
                detail: None,
                pump: None,
                sink: None,
            }),
        }
    }

    /// Install (or replace) the event sink; starts the pump when a live
    /// transport is already present.
    pub fn set_sink(&self, sink: EventSink) {
        if let Ok(mut inner) = self.inner.lock() {
            inner.sink = Some(sink);
        }
        self.maybe_start_pump();
    }

    pub fn status(&self) -> EngineStatus {
        match self.inner.lock() {
            Ok(inner) => {
                let mut state = inner.state;
                let mut detail = inner.detail.clone();
                if state == EngineState::Ready
                    && !inner
                        .transport
                        .as_ref()
                        .map(|transport| transport.is_running())
                        .unwrap_or(false)
                {
                    // The child exited without shutdown(): surface Degraded
                    // instead of a stale Ready so the UI can offer restart.
                    state = EngineState::Degraded;
                    detail = Some("engine process exited".to_string());
                }
                EngineStatus {
                    state,
                    engine_version: inner
                        .hello
                        .as_ref()
                        .map(|hello| hello.engine_version.clone()),
                    protocol_version: inner.hello.as_ref().map(|hello| hello.protocol_version),
                    detail,
                }
            }
            Err(_) => EngineStatus {
                state: EngineState::Failed,
                engine_version: None,
                protocol_version: None,
                detail: Some("supervisor lock poisoned".to_string()),
            },
        }
    }

    fn set_state(&self, state: EngineState, detail: Option<String>) {
        if let Ok(mut inner) = self.inner.lock() {
            inner.state = state;
            if state != EngineState::Failed {
                inner.detail = detail;
            } else if inner.detail.is_none() {
                inner.detail = detail;
            }
        }
    }

    /// Locate the engine binary: dev override first, `rinari` on PATH otherwise.
    fn locate() -> Result<(String, Vec<String>, Option<PathBuf>), CommandError> {
        if let Ok(bin) = std::env::var(ENV_ENGINE_BIN) {
            let mut args: Vec<String> = std::env::var(ENV_ENGINE_ARGS)
                .map(|raw| raw.split_whitespace().map(str::to_string).collect())
                .unwrap_or_default();
            args.push("engine".to_string());
            args.push("--stdio".to_string());
            let cwd = std::env::var(ENV_ENGINE_CWD).ok().map(PathBuf::from);
            return Ok((bin, args, cwd));
        }
        Ok((
            "rinari".to_string(),
            vec!["engine".to_string(), "--stdio".to_string()],
            None,
        ))
    }

    pub fn start(&self) -> Result<EngineStatus, CommandError> {
        if self.status().state == EngineState::Ready {
            return Ok(self.status());
        }
        self.set_state(EngineState::Starting, None);
        let (program, args, cwd) = Self::locate()?;
        self.start_with(&program, &args, cwd.as_deref())
    }

    /// Start with an explicit binary: bundled sidecar path in production,
    /// or a scripted fake engine in tests. `start()` locates via env/PATH
    /// and then calls this.
    pub fn start_with(
        &self,
        program: &str,
        args: &[String],
        cwd: Option<&std::path::Path>,
    ) -> Result<EngineStatus, CommandError> {
        if self.status().state == EngineState::Ready {
            return Ok(self.status());
        }
        self.set_state(
            EngineState::Handshaking,
            Some(format!("spawning {program}")),
        );
        let (transport, hello) =
            EngineTransport::spawn(&program, &args, cwd.as_deref()).map_err(|error| {
                self.set_state(EngineState::Failed, Some(error.to_string()));
                CommandError::from(error)
            })?;
        let transport = Arc::new(transport);
        if let Ok(mut inner) = self.inner.lock() {
            inner.transport = Some(Arc::clone(&transport));
            inner.hello = Some(hello);
            inner.state = EngineState::Ready;
            inner.detail = None;
        }
        self.maybe_start_pump();
        Ok(self.status())
    }

    pub fn shutdown(&self) -> EngineStatus {
        // Take the transport FIRST: dropping our Arc lets the pump observe
        // strong_count == 1, drain once, and exit so join() below returns.
        // Joining before the take deadlocks (pump waits for us, we for it).
        let pump = if let Ok(mut inner) = self.inner.lock() {
            if let Some(transport) = inner.transport.take() {
                transport.shutdown();
            }
            inner.hello = None;
            inner.state = EngineState::Stopped;
            inner.detail = None;
            inner.pump.take()
        } else {
            None
        };
        if let Some(pump) = pump {
            let _ = pump.join();
        }
        self.status()
    }

    pub fn restart(&self) -> Result<EngineStatus, CommandError> {
        self.set_state(EngineState::Restarting, None);
        self.shutdown();
        self.start()
    }

    /// Poll one pending engine event (pump forwards the rest to the frontend).
    pub fn poll_event(&self) -> Option<EngineEvent> {
        if let Ok(inner) = self.inner.lock() {
            inner.transport.as_ref()?.try_recv_event()
        } else {
            None
        }
    }

    pub fn request(&self, method: &str, params: Option<Value>) -> Result<Value, CommandError> {
        let transport = self.current_transport()?;
        transport
            .request(method, params)
            .map_err(CommandError::from)
    }

    pub fn session_list(&self, kind: Option<String>) -> Result<Value, CommandError> {
        let mut params = serde_json::Map::new();
        if let Some(kind) = kind {
            params.insert("kind".to_string(), Value::String(kind));
        }
        self.request("session.list", Some(Value::Object(params)))
    }

    pub fn session_create(
        &self,
        cwd: Option<String>,
        chat: bool,
        title: Option<String>,
    ) -> Result<Value, CommandError> {
        let mut params = serde_json::Map::new();
        if let Some(cwd) = cwd {
            params.insert("cwd".to_string(), Value::String(cwd));
        }
        params.insert("chat".to_string(), Value::Bool(chat));
        if let Some(title) = title {
            params.insert("title".to_string(), Value::String(title));
        }
        self.request("session.create", Some(Value::Object(params)))
    }

    pub fn turn_start(&self, session_id: &str, message: &str) -> Result<Value, CommandError> {
        self.request(
            "session.turn.start",
            Some(json!({"session_id": session_id, "message": message})),
        )
    }

    pub fn turn_cancel(&self, session_id: &str) -> Result<Value, CommandError> {
        self.request(
            "session.turn.cancel",
            Some(json!({"session_id": session_id})),
        )
    }

    pub fn session_open(&self, reference: &str) -> Result<Value, CommandError> {
        self.request("session.open", Some(json!({"ref": reference})))
    }

    pub fn session_history(
        &self,
        reference: &str,
        limit: Option<u32>,
    ) -> Result<Value, CommandError> {
        let mut params = serde_json::Map::new();
        params.insert("ref".to_string(), Value::String(reference.to_string()));
        if let Some(limit) = limit {
            params.insert("limit".to_string(), Value::Number(limit.into()));
        }
        self.request("session.history", Some(Value::Object(params)))
    }

    pub fn session_mode_set(&self, reference: &str, mode: &str) -> Result<Value, CommandError> {
        self.request(
            "session.mode.set",
            Some(json!({"ref": reference, "mode": mode})),
        )
    }

    // -- tasks / verification / checkpoints / working tree (Phase 6) --------

    pub fn task_tree(&self, path: &str) -> Result<Value, CommandError> {
        self.request("task.tree", Some(json!({"path": path})))
    }

    pub fn task_get(&self, path: &str, task_id: &str) -> Result<Value, CommandError> {
        self.request("task.get", Some(json!({"path": path, "task_id": task_id})))
    }

    pub fn verification_latest(
        &self,
        path: &str,
        kinds: Option<Vec<String>>,
        limit: Option<u32>,
    ) -> Result<Value, CommandError> {
        let mut params = serde_json::Map::new();
        params.insert("path".to_string(), Value::String(path.to_string()));
        if let Some(kinds) = kinds {
            params.insert("kinds".to_string(), json!(kinds));
        }
        if let Some(limit) = limit {
            params.insert("limit".to_string(), Value::Number(limit.into()));
        }
        self.request("verification.latest", Some(Value::Object(params)))
    }

    pub fn verification_plan(
        &self,
        path: &str,
        changed_files: Vec<String>,
    ) -> Result<Value, CommandError> {
        self.request(
            "verification.plan",
            Some(json!({"path": path, "changed_files": changed_files})),
        )
    }

    pub fn checkpoint_list(&self, path: Option<String>) -> Result<Value, CommandError> {
        let mut params = serde_json::Map::new();
        if let Some(path) = path {
            params.insert("path".to_string(), Value::String(path));
        }
        self.request("checkpoint.list", Some(Value::Object(params)))
    }

    pub fn checkpoint_show(&self, checkpoint_id: &str) -> Result<Value, CommandError> {
        self.request(
            "checkpoint.show",
            Some(json!({"checkpoint_id": checkpoint_id})),
        )
    }

    pub fn checkpoint_restore(&self, params: Value) -> Result<Value, CommandError> {
        self.request("checkpoint.restore", Some(params))
    }

    pub fn project_changes(&self, path: &str) -> Result<Value, CommandError> {
        self.request("project.changes", Some(json!({"path": path})))
    }

    pub fn project_diff(
        &self,
        path: &str,
        file: Option<String>,
        max_chars: Option<u32>,
    ) -> Result<Value, CommandError> {
        let mut params = serde_json::Map::new();
        params.insert("path".to_string(), Value::String(path.to_string()));
        if let Some(file) = file {
            params.insert("file".to_string(), Value::String(file));
        }
        if let Some(max_chars) = max_chars {
            params.insert("max_chars".to_string(), Value::Number(max_chars.into()));
        }
        self.request("project.diff", Some(Value::Object(params)))
    }

    // -- agents (Phase 7) -----------------------------------------------------

    pub fn agent_list(&self) -> Result<Value, CommandError> {
        self.request("agent.list", None)
    }

    pub fn agent_config_get(&self, agent: &str) -> Result<Value, CommandError> {
        self.request("agent.config.get", Some(json!({"agent": agent})))
    }

    pub fn agent_config_set(&self, params: Value) -> Result<Value, CommandError> {
        self.request("agent.config.set", Some(params))
    }

    pub fn session_events(
        &self,
        reference: &str,
        after_seq: Option<u64>,
        limit: Option<u32>,
    ) -> Result<Value, CommandError> {
        let mut params = serde_json::Map::new();
        params.insert("ref".to_string(), Value::String(reference.to_string()));
        if let Some(after_seq) = after_seq {
            params.insert("after_seq".to_string(), Value::Number(after_seq.into()));
        }
        if let Some(limit) = limit {
            params.insert("limit".to_string(), Value::Number(limit.into()));
        }
        self.request("session.events", Some(Value::Object(params)))
    }

    // -- souls (Phase 8) ------------------------------------------------------

    pub fn soul_list(&self) -> Result<Value, CommandError> {
        self.request("soul.list", None)
    }

    pub fn soul_get(&self, soul_id: &str) -> Result<Value, CommandError> {
        self.request("soul.get", Some(json!({"id": soul_id})))
    }

    pub fn soul_create(&self, params: Value) -> Result<Value, CommandError> {
        self.request("soul.create", Some(params))
    }

    pub fn soul_update(&self, params: Value) -> Result<Value, CommandError> {
        self.request("soul.update", Some(params))
    }

    pub fn soul_remove(&self, soul_id: &str) -> Result<Value, CommandError> {
        self.request("soul.remove", Some(json!({"id": soul_id})))
    }

    pub fn soul_activate(&self, soul_id: &str) -> Result<Value, CommandError> {
        self.request("soul.activate", Some(json!({"id": soul_id})))
    }

    // -- ecosystem (Phase 9) ----------------------------------------------------

    pub fn mcp_list(&self) -> Result<Value, CommandError> {
        self.request("mcp.list", None)
    }

    pub fn mcp_get(&self, name: &str) -> Result<Value, CommandError> {
        self.request("mcp.get", Some(json!({"name": name})))
    }

    pub fn mcp_create(&self, name: &str, command: Vec<String>) -> Result<Value, CommandError> {
        self.request(
            "mcp.create",
            Some(json!({"name": name, "command": command})),
        )
    }

    pub fn mcp_remove(&self, name: &str) -> Result<Value, CommandError> {
        self.request("mcp.remove", Some(json!({"name": name})))
    }

    pub fn mcp_enable(&self, name: &str) -> Result<Value, CommandError> {
        self.request("mcp.enable", Some(json!({"name": name})))
    }

    pub fn mcp_disable(&self, name: &str) -> Result<Value, CommandError> {
        self.request("mcp.disable", Some(json!({"name": name})))
    }

    pub fn mcp_test(&self, name: &str) -> Result<Value, CommandError> {
        self.request("mcp.test", Some(json!({"name": name})))
    }

    pub fn plugin_list(&self) -> Result<Value, CommandError> {
        self.request("plugin.list", None)
    }

    pub fn plugin_get(&self, name: &str) -> Result<Value, CommandError> {
        self.request("plugin.get", Some(json!({"name": name})))
    }

    pub fn plugin_enable(&self, name: &str) -> Result<Value, CommandError> {
        self.request("plugin.enable", Some(json!({"name": name})))
    }

    pub fn plugin_disable(&self, name: &str) -> Result<Value, CommandError> {
        self.request("plugin.disable", Some(json!({"name": name})))
    }

    pub fn plugin_diagnostics(&self) -> Result<Value, CommandError> {
        self.request("plugin.diagnostics", None)
    }

    pub fn tool_list(&self) -> Result<Value, CommandError> {
        self.request("tool.list", None)
    }

    pub fn policy_get(&self) -> Result<Value, CommandError> {
        self.request("policy.get", None)
    }

    pub fn approval_resolve(
        &self,
        approval_id: &str,
        decision: &str,
    ) -> Result<Value, CommandError> {
        self.request(
            "approval.resolve",
            Some(json!({"approval_id": approval_id, "decision": decision})),
        )
    }

    pub fn snapshot_get(&self) -> Result<Value, CommandError> {
        self.request("runtime.snapshot.get", None)
    }

    // -- providers / models (Phase 3) --------------------------------------

    pub fn provider_list(&self) -> Result<Value, CommandError> {
        self.request("provider.list", None)
    }

    pub fn provider_create(&self, params: Value) -> Result<Value, CommandError> {
        self.request("provider.create", Some(params))
    }

    pub fn provider_get(&self, ref_: &str) -> Result<Value, CommandError> {
        self.request("provider.get", Some(json!({ "ref": ref_ })))
    }

    pub fn provider_update(&self, params: Value) -> Result<Value, CommandError> {
        self.request("provider.update", Some(params))
    }

    pub fn provider_remove(
        &self,
        ref_: &str,
        switch_to: Option<String>,
        keep_credentials: bool,
    ) -> Result<Value, CommandError> {
        self.request(
            "provider.remove",
            Some(json!({ "ref": ref_, "switch_to": switch_to, "keep_credentials": keep_credentials })),
        )
    }

    pub fn provider_test(&self, ref_: &str) -> Result<Value, CommandError> {
        self.request("provider.test", Some(json!({ "ref": ref_ })))
    }

    pub fn provider_discover(&self) -> Result<Value, CommandError> {
        self.request("provider.discover", None)
    }

    pub fn provider_use(&self, ref_: &str) -> Result<Value, CommandError> {
        self.request("provider.use", Some(json!({ "ref": ref_ })))
    }

    pub fn model_list(&self, provider: Option<String>) -> Result<Value, CommandError> {
        self.request("model.list", Some(json!({ "provider": provider })))
    }

    pub fn model_get(&self, ref_: &str, provider: Option<String>) -> Result<Value, CommandError> {
        self.request(
            "model.get",
            Some(json!({ "ref": ref_, "provider": provider })),
        )
    }

    pub fn model_add(&self, params: Value) -> Result<Value, CommandError> {
        self.request("model.add", Some(params))
    }

    pub fn model_alias(
        &self,
        ref_: &str,
        new_alias: &str,
        provider: Option<String>,
    ) -> Result<Value, CommandError> {
        self.request(
            "model.alias",
            Some(json!({ "ref": ref_, "new_alias": new_alias, "provider": provider })),
        )
    }

    pub fn model_remove(
        &self,
        ref_: &str,
        provider: Option<String>,
    ) -> Result<Value, CommandError> {
        self.request(
            "model.remove",
            Some(json!({ "ref": ref_, "provider": provider })),
        )
    }

    pub fn model_use(&self, ref_: &str, provider: Option<String>) -> Result<Value, CommandError> {
        self.request(
            "model.use",
            Some(json!({ "ref": ref_, "provider": provider })),
        )
    }

    pub fn model_discover(&self, provider: Option<String>) -> Result<Value, CommandError> {
        self.request("model.discover", Some(json!({ "provider": provider })))
    }

    pub fn model_refresh(&self, provider: Option<String>) -> Result<Value, CommandError> {
        self.request("model.refresh", Some(json!({ "provider": provider })))
    }

    pub fn model_test(&self, ref_: &str, provider: Option<String>) -> Result<Value, CommandError> {
        self.request(
            "model.test",
            Some(json!({ "ref": ref_, "provider": provider })),
        )
    }

    fn current_transport(&self) -> Result<Arc<EngineTransport>, CommandError> {
        let inner = self
            .inner
            .lock()
            .map_err(|_| CommandError::new("ENGINE_ERROR", "lock"))?;
        if inner.state != EngineState::Ready {
            return Err(CommandError::new(
                "ENGINE_NOT_READY",
                format!("engine is {:?}, start it first", inner.state),
            ));
        }
        inner
            .transport
            .clone()
            .ok_or_else(|| CommandError::new("ENGINE_DOWN", "no transport"))
    }

    /// Start the forward pump when a sink and a live transport are present.
    fn maybe_start_pump(&self) {
        let (transport, sink) = match self.inner.lock() {
            Ok(inner) => match (inner.transport.clone(), inner.sink.clone()) {
                (Some(transport), Some(sink)) if inner.pump.is_none() => (transport, sink),
                _ => return,
            },
            Err(_) => return,
        };
        self.start_pump(transport, sink);
    }

    fn start_pump(&self, transport: Arc<EngineTransport>, sink: EventSink) {
        // Only called with inner.pump == None (see maybe_start_pump).
        let pump = thread::Builder::new()
            .name("engine-event-pump".to_string())
            .spawn(move || {
                loop {
                    match transport.try_recv_event() {
                        Some(event) => sink(event),
                        None => thread::sleep(Duration::from_millis(20)),
                    }
                    // Exit when a newer pump replaced us; transport shutdown
                    // also ends the stream (reader EOF drains pending).
                    if Arc::strong_count(&transport) == 1 {
                        // Only our own Arc left: supervisor dropped it.
                        // Drain once more, then exit.
                        while let Some(event) = transport.try_recv_event() {
                            sink(event);
                        }
                        break;
                    }
                }
            })
            .expect("spawn event pump");
        if let Ok(mut inner) = self.inner.lock() {
            inner.pump = Some(pump);
        }
    }
}

impl Default for EngineSupervisor {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn initial_state_is_stopped() {
        let supervisor = EngineSupervisor::new();
        let status = supervisor.status();
        assert_eq!(status.state, EngineState::Stopped);
        assert!(status.engine_version.is_none());
    }

    #[test]
    fn request_without_engine_is_not_ready() {
        let supervisor = EngineSupervisor::new();
        let error = supervisor
            .request("session.list", None)
            .expect_err("must refuse");
        assert_eq!(error.code, "ENGINE_NOT_READY");
    }

    #[test]
    fn shutdown_is_idempotent_from_stopped() {
        let supervisor = EngineSupervisor::new();
        assert_eq!(supervisor.shutdown().state, EngineState::Stopped);
        assert_eq!(supervisor.shutdown().state, EngineState::Stopped);
    }
}
