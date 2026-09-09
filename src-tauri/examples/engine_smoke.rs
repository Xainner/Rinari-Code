//! Manual desktop-supervisor smoke against a real Engine Protocol process.
//!
//! Set `RINARI_ENGINE_BIN` and optionally `RINARI_ENGINE_ARGS` / cwd. When
//! `RINARI_REQUIRE_REAL_TURN=1`, a configured provider and completed model
//! response are mandatory. Output is deliberately credential-safe.

use std::sync::{mpsc, Arc};
use std::time::{Duration, Instant};

use rinari_code_lib::engine::{methods::Method, protocol::EngineEvent, EngineSupervisor};

fn count(result: &serde_json::Value, key: &str) -> usize {
    result
        .get(key)
        .and_then(serde_json::Value::as_array)
        .map_or(0, Vec::len)
}

fn main() {
    let require_real = std::env::var("RINARI_REQUIRE_REAL_TURN").as_deref() == Ok("1");
    let (event_tx, event_rx) = mpsc::channel::<EngineEvent>();
    let supervisor = EngineSupervisor::new();
    supervisor.set_sink(Arc::new(move |event| {
        let _ = event_tx.send(event);
    }));

    let status = supervisor.start().expect("engine start");
    assert_eq!(format!("{:?}", status.state), "Ready");
    let providers = supervisor
        .request(Method::ProviderList, None)
        .expect("provider.list");
    let models = supervisor
        .request(Method::ModelList, None)
        .expect("model.list");
    let provider_count = count(&providers, "providers");
    let model_count = count(&models, "models");
    let active_provider = providers
        .get("active_alias")
        .and_then(serde_json::Value::as_str)
        .is_some();
    let active_model = models
        .get("models")
        .and_then(serde_json::Value::as_array)
        .is_some_and(|items| {
            items
                .iter()
                .any(|item| item.get("active") == Some(&true.into()))
        });

    if !(active_provider && active_model) {
        assert!(
            !require_real,
            "real turn required but no active provider/model exists"
        );
        println!(
            "SMOKE-OK handshake=true providers={provider_count} models={model_count} real_turn=skipped"
        );
        supervisor.shutdown();
        return;
    }

    let created = supervisor
        .session_create_with_options(
            None,
            true,
            Some("Desktop supervisor smoke".to_string()),
            Some("build".to_string()),
            Some("workspace".to_string()),
        )
        .expect("session.create");
    let session_id = created
        .pointer("/session/id")
        .and_then(serde_json::Value::as_str)
        .expect("session.create result.session.id");
    let accepted = supervisor
        .turn_start(session_id, "Respond exactly with OK. Do not call tools.")
        .expect("session.turn.start");
    let turn_id = accepted
        .get("turn_id")
        .and_then(serde_json::Value::as_str)
        .expect("turn id");

    let started = Instant::now();
    let deadline = started + Duration::from_secs(120);
    let terminal = loop {
        let remaining = deadline.saturating_duration_since(Instant::now());
        let event = event_rx
            .recv_timeout(remaining)
            .expect("terminal turn event before timeout");
        if event
            .payload
            .get("turn_id")
            .and_then(serde_json::Value::as_str)
            != Some(turn_id)
        {
            continue;
        }
        if matches!(
            event.event.as_str(),
            "turn.completed" | "turn.failed" | "turn.cancelled" | "turn.stopped"
        ) {
            let code = event
                .payload
                .pointer("/error/code")
                .and_then(serde_json::Value::as_str)
                .map(str::to_string);
            break (event.event, code);
        }
    };
    supervisor
        .session_delete(session_id, true)
        .expect("delete smoke session");
    assert_eq!(
        terminal.0, "turn.completed",
        "real provider turn did not complete (code={:?})",
        terminal.1
    );
    println!(
        "SMOKE-OK handshake=true providers={provider_count} models={model_count} terminal={} elapsed_ms={}",
        terminal.0,
        started.elapsed().as_millis()
    );
    supervisor.shutdown();
}
