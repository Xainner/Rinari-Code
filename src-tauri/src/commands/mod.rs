//! Tauri command bridge: thin typed handlers per domain. Path per call:
//! Tauri command → EngineSupervisor → EngineTransport → Engine Protocol.
//! No harness logic here; every handler delegates to the supervisor.

pub mod agents;
pub mod ecosystem;
pub mod engine;
pub mod models;
pub mod projects;
pub mod providers;
pub mod sessions;
pub mod souls;
pub mod workflow;
pub mod workspace;
