// Manual roundtrip smoke: desktop EngineSupervisor against a real engine.
// Run with env pointing at a checkout, e.g. (git-bash):
//   RINARI_ENGINE_BIN=uv RINARI_ENGINE_ARGS="run rinari" \
//   RINARI_ENGINE_CWD=C:/Users/Xainner/Documents/DEV/Rinari-CLI \
//   RINARI_HOME=$LOCALAPPDATA/Temp/rinari-desktop-smoke \
//   cargo run --example engine_smoke
// Turn execution needs a configured provider; without one the engine must
// answer turn.start with a clean error envelope (also asserted here).
use std::sync::Arc;
use std::time::Duration;

use rinari_code_lib::engine::{protocol::EngineEvent, EngineSupervisor};
use serde_json::json;

fn show(label: &str, value: &serde_json::Value) {
    println!("{label} {value}");
}

fn main() {
    let supervisor = EngineSupervisor::new();
    supervisor.set_sink(Arc::new(|event: EngineEvent| {
        match serde_json::to_string(&event) {
            Ok(line) => println!("EVT {line}"),
            Err(error) => println!("EVT <unserializable: {error}>"),
        }
    }));

    let status = supervisor.start().expect("engine start");
    println!(
        "STATUS state={:?} engine={:?} protocol={:?} detail={:?}",
        status.state, status.engine_version, status.protocol_version, status.detail
    );
    assert_eq!(format!("{:?}", status.state), "Ready");

    let info = supervisor
        .request("engine.info", None)
        .expect("engine.info");
    show("INFO", &info);

    let sessions = supervisor.session_list(None).expect("session.list");
    show("SESSIONS", &sessions);

    // The engine refuses session.create without a configured provider/model.
    // That config gate is correct behavior; assert its machine code and stop
    // the smoke there. Full turn streaming runs in CLI pytest with injected
    // fake models until provider CRUD lands (Phase 3).
    let session_id = match supervisor.session_create(None, true, Some("desktop smoke".to_string()))
    {
        Ok(created) => {
            show("CREATED", &created);
            created
                .get("session_id")
                .and_then(|v| v.as_str())
                .expect("created.session_id")
                .to_string()
        }
        Err(error) => {
            assert_eq!(error.code, "AUTHENTICATION_REQUIRED", "unexpected gate");
            println!(
                "CONFIG-GATE-OK code={} message={}",
                error.code, error.message
            );
            let status = supervisor.shutdown();
            println!("SHUTDOWN state={:?}", status.state);
            println!("SMOKE-OK (config gate)");
            return;
        }
    };

    let snapshot = supervisor.snapshot_get().expect("runtime.snapshot.get");
    show(
        "SNAPSHOT-KEYS",
        &json!(snapshot
            .as_object()
            .map(|o| o.keys().cloned().collect::<Vec<_>>())
            .unwrap_or_default()),
    );

    // No provider in the smoke home: expect a clean error, not a hang.
    match supervisor.turn_start(&session_id, "di hola") {
        Ok(accept) => {
            show("TURN-ACCEPT", &accept);
            std::thread::sleep(Duration::from_secs(5));
        }
        Err(error) => println!("TURN-ERROR code={} message={}", error.code, error.message),
    }

    let status = supervisor.shutdown();
    println!("SHUTDOWN state={:?}", status.state);
    println!("SMOKE-OK");
}
