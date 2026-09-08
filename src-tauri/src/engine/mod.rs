// Rinari Engine supervision — Phase 0 placeholder.
// Owns the desktop-side engine process lifecycle only:
// locate, spawn, handshake, route, restart, snapshot-reconnect.
// It never implements harness logic (sessions, tools, policy live in Python).

pub mod supervisor;

pub use supervisor::{EngineState, EngineSupervisor};
