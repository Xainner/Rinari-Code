//! Hermetic Engine Protocol roundtrips against a scripted fake engine.
//!
//! No provider, network, or credentials needed: each test spawns
//! `tests/fixtures/fake_engine.py --scenario=…` through the real
//! EngineSupervisor and asserts the client-side contract (streaming order,
//! cancel terminality, approval roundtrip, crash surfacing). Explicit binary
//! paths are used (`start_with`), so tests stay parallel-safe: no process
//! env is mutated.
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use rinari_code_lib::engine::{protocol::EngineEvent, EngineSupervisor};

fn fixture() -> String {
    format!(
        "{}/tests/fixtures/fake_engine.py",
        env!("CARGO_MANIFEST_DIR")
    )
}

struct Harness {
    supervisor: EngineSupervisor,
    events: Arc<Mutex<Vec<EngineEvent>>>,
}

fn start_fake(scenario: &str) -> Harness {
    let supervisor = EngineSupervisor::new();
    let events: Arc<Mutex<Vec<EngineEvent>>> = Arc::new(Mutex::new(Vec::new()));
    let sink_events = Arc::clone(&events);
    supervisor.set_sink(Arc::new(move |event: EngineEvent| {
        sink_events.lock().expect("events lock").push(event);
    }));
    let status = supervisor
        .start_with(
            "python",
            &[fixture(), format!("--scenario={scenario}")],
            None,
        )
        .expect("fake engine starts and handshakes");
    assert_eq!(format!("{:?}", status.state), "Ready");
    Harness { supervisor, events }
}

fn create_session(harness: &Harness) -> String {
    let created = harness
        .supervisor
        .session_create(None, true, Some("roundtrip".to_string()))
        .expect("session.create");
    created["session_id"]
        .as_str()
        .expect("created.session_id")
        .to_string()
}

fn wait_for(
    harness: &Harness,
    timeout: Duration,
    mut matches: impl FnMut(&EngineEvent) -> bool,
) -> EngineEvent {
    let start = Instant::now();
    loop {
        if let Some(found) = harness
            .events
            .lock()
            .expect("events lock")
            .iter()
            .find(|event| matches(event))
            .cloned()
        {
            return found;
        }
        assert!(
            start.elapsed() < timeout,
            "timed out waiting for engine event"
        );
        std::thread::sleep(Duration::from_millis(20));
    }
}

fn is(name: &str) -> impl Fn(&EngineEvent) -> bool + '_ {
    move |event: &EngineEvent| event.event == name
}

#[test]
fn history_grows_with_turns_and_rejects_unknown_sessions() {
    let harness = start_fake("stream");
    let session_id = create_session(&harness);

    let empty = harness
        .supervisor
        .session_history(&session_id, None)
        .expect("session.history");
    assert_eq!(empty["total"], serde_json::json!(0));
    assert_eq!(empty["has_more"], serde_json::json!(false));

    harness
        .supervisor
        .turn_start(&session_id, "hola rinari")
        .expect("session.turn.start");
    wait_for(&harness, Duration::from_secs(10), is("turn.completed"));

    // Transcript rows land just after the terminal event; poll briefly.
    let start = Instant::now();
    let history = loop {
        let history = harness
            .supervisor
            .session_history(&session_id, None)
            .expect("session.history");
        if history["total"].as_u64().unwrap_or(0) >= 2 {
            break history;
        }
        assert!(
            start.elapsed() < Duration::from_secs(10),
            "history must persist"
        );
        std::thread::sleep(Duration::from_millis(20));
    };
    let roles: Vec<&str> = history["messages"]
        .as_array()
        .expect("messages array")
        .iter()
        .map(|m| m["role"].as_str().unwrap_or_default())
        .collect();
    assert_eq!(roles, vec!["user", "assistant"]);
    assert_eq!(
        history["messages"][0]["content"].as_str(),
        Some("hola rinari")
    );
    assert_eq!(
        history["messages"][1]["content"].as_str(),
        Some("Hola, soy Rinari.")
    );

    let opened = harness
        .supervisor
        .session_open(&session_id)
        .expect("session.open");
    assert_eq!(opened["session"]["kind"], serde_json::json!("CHAT"));

    let error = harness
        .supervisor
        .session_history("ses_missing", None)
        .expect_err("unknown session must fail");
    assert_eq!(error.code, "NOT_FOUND");

    assert_eq!(
        format!("{:?}", harness.supervisor.shutdown().state),
        "Stopped"
    );
}

#[test]
fn mode_set_roundtrip_emits_change_and_rejects_unknown() {
    let harness = start_fake("stream");
    let session_id = create_session(&harness);

    let updated = harness
        .supervisor
        .session_mode_set(&session_id, "plan")
        .expect("session.mode.set");
    assert_eq!(updated["session"]["mode"], serde_json::json!("plan"));

    let changed = wait_for(&harness, Duration::from_secs(10), |event: &EngineEvent| {
        event.event == "session.mode.changed"
            && event.payload["session_id"].as_str() == Some(session_id.as_str())
    });
    assert_eq!(changed.payload["mode"], serde_json::json!("plan"));

    let error = harness
        .supervisor
        .session_mode_set(&session_id, "yolo")
        .expect_err("unknown mode must fail");
    assert_eq!(error.code, "INVALID_USAGE");

    assert_eq!(
        format!("{:?}", harness.supervisor.shutdown().state),
        "Stopped"
    );
}

#[test]
fn workspace_reads_cover_tasks_verification_checkpoints_and_diff() {
    let harness = start_fake("stream");

    let tree = harness
        .supervisor
        .task_tree("/fake/work")
        .expect("task.tree");
    assert_eq!(tree["tasks"].as_array().map(Vec::len), Some(2));
    assert_eq!(tree["depths"]["tsk_fake2"], serde_json::json!(1));

    let detail = harness
        .supervisor
        .task_get("/fake/work", "tsk_fake1")
        .expect("task.get");
    assert_eq!(detail["task"]["title"], serde_json::json!("Fake task"));

    let missing = harness
        .supervisor
        .task_get("/fake/work", "tsk_nope")
        .expect_err("unknown task must fail");
    assert_eq!(missing.code, "NOT_FOUND");

    let latest = harness
        .supervisor
        .verification_latest("/fake/work", None, None)
        .expect("verification.latest");
    assert_eq!(latest["records"].as_array().map(Vec::len), Some(1));

    let plan = harness
        .supervisor
        .verification_plan("/fake/work", vec!["a.txt".to_string()])
        .expect("verification.plan");
    assert_eq!(
        plan["plan"]["test_commands"],
        serde_json::json!(["pytest -q"])
    );

    let points = harness
        .supervisor
        .checkpoint_list(Some("/fake/work".to_string()))
        .expect("checkpoint.list");
    assert_eq!(points["checkpoints"].as_array().map(Vec::len), Some(1));

    let preview = harness
        .supervisor
        .checkpoint_restore(serde_json::json!({
            "path": "/fake/work",
            "checkpoint_id": "chk_fake1",
            "preview": true,
            "allow_mixed": false,
        }))
        .expect("checkpoint.restore");
    assert_eq!(preview["result"]["preview"], serde_json::json!(true));

    let changes = harness
        .supervisor
        .project_changes("/fake/work")
        .expect("changes");
    assert_eq!(changes["dirty"], serde_json::json!(true));
    assert_eq!(changes["files"][0]["path"], serde_json::json!("a.txt"));

    let diff = harness
        .supervisor
        .project_diff("/fake/work", Some("a.txt".to_string()), None)
        .expect("project.diff");
    assert_eq!(diff["truncated"], serde_json::json!(false));
    assert!(diff["diff"]
        .as_str()
        .unwrap_or_default()
        .contains("+fake line"));

    assert_eq!(
        format!("{:?}", harness.supervisor.shutdown().state),
        "Stopped"
    );
}

#[test]
fn agent_routing_roundtrip_with_validation_and_events() {
    let harness = start_fake("stream");

    let list = harness.supervisor.agent_list().expect("agent.list");
    let names: Vec<&str> = list["agents"]
        .as_array()
        .expect("agents array")
        .iter()
        .map(|a| a["name"].as_str().unwrap_or_default())
        .collect();
    assert!(names.contains(&"explore"));
    assert!(names.contains(&"verifier"));

    let set = harness
        .supervisor
        .agent_config_set(serde_json::json!({
            "agent": "explore",
            "model": "fake-one",
            "fallback": null,
            "enabled": null,
            "clear": false,
        }))
        .expect("agent.config.set");
    assert_eq!(
        set["agent"]["assignment"]["model"],
        serde_json::json!("fake-one")
    );

    let get = harness
        .supervisor
        .agent_config_get("explore")
        .expect("agent.config.get");
    assert_eq!(
        get["agent"]["assignment"]["model"],
        serde_json::json!("fake-one")
    );

    let cleared = harness
        .supervisor
        .agent_config_set(serde_json::json!({
            "agent": "explore",
            "model": null,
            "fallback": null,
            "enabled": null,
            "clear": true,
        }))
        .expect("agent.config.set clear");
    assert_eq!(
        cleared["agent"]["assignment"]["model"],
        serde_json::Value::Null
    );

    let unknown = harness
        .supervisor
        .agent_config_get("nope")
        .expect_err("unknown agent must fail");
    assert_eq!(unknown.code, "NOT_FOUND");

    let session_id = create_session(&harness);
    let events = harness
        .supervisor
        .session_events(&session_id, None, None)
        .expect("session.events");
    assert_eq!(
        events["events"][0]["type"],
        serde_json::json!("SubagentStart")
    );
    assert_eq!(events["has_more"], serde_json::json!(false));

    assert_eq!(
        format!("{:?}", harness.supervisor.shutdown().state),
        "Stopped"
    );
}

fn deltas(harness: &Harness) -> Vec<String> {
    harness
        .events
        .lock()
        .expect("events lock")
        .iter()
        .filter(|event| event.event == "model.content.delta")
        .map(|event| {
            event.payload["delta"]
                .as_str()
                .unwrap_or_default()
                .to_string()
        })
        .collect()
}

#[test]
fn streams_turn_to_completion_in_order() {
    let harness = start_fake("stream");
    let session_id = create_session(&harness);

    let accept = harness
        .supervisor
        .turn_start(&session_id, "hola")
        .expect("turn accepted");
    let turn_id = accept["turn_id"].as_str().expect("accept.turn_id");
    assert_eq!(accept["session_id"].as_str(), Some(session_id.as_str()));

    let completed = wait_for(&harness, Duration::from_secs(15), is("turn.completed"));
    assert_eq!(completed.payload["turn_id"].as_str(), Some(turn_id));
    assert_eq!(
        deltas(&harness),
        vec![
            "Hola, ".to_string(),
            "soy ".to_string(),
            "Rinari.".to_string()
        ]
    );

    assert_eq!(
        format!("{:?}", harness.supervisor.shutdown().state),
        "Stopped"
    );
}

#[test]
fn cancel_ends_slow_turn_without_completion() {
    let harness = start_fake("slow");
    let session_id = create_session(&harness);
    harness
        .supervisor
        .turn_start(&session_id, "cuenta lento")
        .expect("turn accepted");

    std::thread::sleep(Duration::from_millis(400));
    harness
        .supervisor
        .turn_cancel(&session_id)
        .expect("cancel accepted");
    wait_for(&harness, Duration::from_secs(15), is("turn.cancelled"));

    // A cancelled turn must never complete afterwards.
    std::thread::sleep(Duration::from_millis(600));
    let completed = harness
        .events
        .lock()
        .expect("events lock")
        .iter()
        .any(|event| event.event == "turn.completed");
    assert!(!completed, "cancelled turn completed");
    assert!(
        !deltas(&harness).is_empty(),
        "expected some deltas before cancel"
    );

    assert_eq!(
        format!("{:?}", harness.supervisor.shutdown().state),
        "Stopped"
    );
}

#[test]
fn approval_roundtrip_continues_turn() {
    let harness = start_fake("approval");
    let session_id = create_session(&harness);
    harness
        .supervisor
        .turn_start(&session_id, "hazlo")
        .expect("turn accepted");

    let requested = wait_for(&harness, Duration::from_secs(15), is("approval.requested"));
    let approval_id = requested.payload["approval_id"]
        .as_str()
        .expect("requested.approval_id");
    assert_eq!(approval_id, "apr_fake1");

    let resolved = harness
        .supervisor
        .approval_resolve(approval_id, "allow_once")
        .expect("approval resolved");
    assert_eq!(resolved["decision"].as_str(), Some("allow_once"));

    let completed = wait_for(&harness, Duration::from_secs(15), is("turn.completed"));
    assert_eq!(
        completed.payload["session_id"].as_str(),
        Some(session_id.as_str())
    );
    let saw_resolved = harness
        .events
        .lock()
        .expect("events lock")
        .iter()
        .any(|event| event.event == "approval.resolved");
    assert!(saw_resolved, "expected approval.resolved before completion");

    assert_eq!(
        format!("{:?}", harness.supervisor.shutdown().state),
        "Stopped"
    );
}

#[test]
fn dead_engine_surfaces_as_error_not_hang() {
    let harness = start_fake("die");
    let session_id = create_session(&harness);
    harness
        .supervisor
        .turn_start(&session_id, "hola")
        .expect("turn accepted");
    wait_for(&harness, Duration::from_secs(15), is("turn.started"));

    // The fake exits abruptly mid-turn. Reads must fail fast (well under the
    // 60s request ceiling) and health must downgrade instead of lying Ready.
    let start = Instant::now();
    let error = harness
        .supervisor
        .request("session.list", None)
        .expect_err("dead engine must error");
    assert!(
        start.elapsed() < Duration::from_secs(15),
        "error took too long: {:?}",
        start.elapsed()
    );
    assert!(!error.code.is_empty(), "typed machine code, got {error:?}");
    assert_eq!(
        format!("{:?}", harness.supervisor.status().state),
        "Degraded"
    );

    assert_eq!(
        format!("{:?}", harness.supervisor.shutdown().state),
        "Stopped"
    );
}

#[test]
fn provider_crud_roundtrip() {
    let harness = start_fake("stream");
    let supervisor = &harness.supervisor;

    let list = supervisor.provider_list().expect("provider.list");
    assert_eq!(list["providers"].as_array().map(Vec::len), Some(0));

    let created = supervisor
        .provider_create(serde_json::json!({
            "alias": "ollama",
            "type": "custom",
            "auth_method": "none",
            "endpoint": "http://127.0.0.1:11434/v1",
        }))
        .expect("provider.create");
    assert_eq!(created["provider"]["alias"], "ollama");
    assert_eq!(created["provider"]["has_credential"], false);

    let conflict = supervisor
        .provider_create(serde_json::json!({"alias": "ollama", "type": "custom"}))
        .expect_err("duplicate alias");
    assert_eq!(conflict.code, "CONFLICT");

    let updated = supervisor
        .provider_update(serde_json::json!({"ref": "ollama", "endpoint": "http://x:9/v1"}))
        .expect("provider.update");
    assert_eq!(updated["provider"]["endpoint"], "http://x:9/v1");

    let health = supervisor.provider_test("ollama").expect("provider.test");
    assert_eq!(health["connected"], true);
    assert_eq!(health["models_discovered"], 2);

    let found = supervisor
        .model_discover(Some("ollama".to_string()))
        .expect("model.discover");
    assert_eq!(found["providers"]["fake"].as_array().map(Vec::len), Some(2));

    let added = supervisor
        .model_add(serde_json::json!({
            "provider": "ollama",
            "provider_model_id": "mx-1",
            "alias": "principal",
        }))
        .expect("model.add");
    assert_eq!(added["model"]["active"], true);

    let used = supervisor.model_use("principal", None).expect("model.use");
    assert_eq!(used["model"]["alias"], "principal");

    supervisor
        .provider_create(serde_json::json!({"alias": "b", "type": "custom"}))
        .expect("second provider");
    supervisor.provider_use("b").expect("provider.use");
    let removed = supervisor
        .provider_remove("ollama", Some("b".to_string()), false)
        .expect("provider.remove");
    assert_eq!(removed["removed"]["alias"], "ollama");
    let list = supervisor.provider_list().expect("provider.list");
    assert_eq!(list["active_alias"], "b");

    assert_eq!(format!("{:?}", supervisor.shutdown().state), "Stopped");
}
