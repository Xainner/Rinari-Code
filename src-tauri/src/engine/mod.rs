// Rinari Engine supervision — desktop side of Engine Protocol v1.
// Owns the engine process lifecycle only: locate, spawn, handshake,
// route requests, forward events, restart. Harness logic lives in Python.

pub mod protocol;
pub mod supervisor;
pub mod transport;

pub use supervisor::{CommandError, EngineStatus, EngineSupervisor, EventSink};
