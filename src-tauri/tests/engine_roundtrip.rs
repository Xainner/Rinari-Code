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
