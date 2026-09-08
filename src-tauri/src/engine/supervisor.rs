//! Minimal engine supervisor for the Phase 0 packaging spike.
//!
//! State machine (AGENTS.md §11):
//! Stopped → Starting → Handshaking → Ready ⇄ Degraded → Restarting → Failed
//!
//! Phase 0 scope: state tracking plus a test-sidecar spawn that proves the
//! desktop host can launch a child process and stream its stdout back.
//! The real NDJSON protocol transport lands in Phase 1.

use serde::Serialize;
use std::io::Read;
use std::process::{Child, Command, Stdio};

/// Desktop-visible engine lifecycle state.
/// Unconstructed variants belong to the Phase 1 protocol transport.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[allow(dead_code)]
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

impl Default for EngineState {
    fn default() -> Self {
        Self::Stopped
    }
}

/// Owns the engine child process lifecycle. No harness logic here.
#[derive(Debug, Default)]
pub struct EngineSupervisor {
    state: EngineState,
}

impl EngineSupervisor {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn status(&self) -> EngineState {
        self.state
    }

    /// Phase 0 spike: spawn a trivial sidecar, capture its stdout, verify the
    /// host↔child pipe works. Returns the trimmed stdout on success.
    pub fn spawn_test_sidecar(&mut self) -> Result<String, String> {
        self.state = EngineState::Starting;
        let mut child = test_command().map_err(|e| self.fail(e.to_string()))?;
        let mut out = String::new();
        if let Some(stdout) = child.stdout.as_mut() {
            stdout
                .read_to_string(&mut out)
                .map_err(|e| self.fail(e.to_string()))?;
        }
        let status = child.wait().map_err(|e| self.fail(e.to_string()))?;
        if !status.success() {
            return Err(self.fail(format!("test sidecar exited with {status}")));
        }
        self.state = EngineState::Stopped;
        Ok(out.trim_end().to_string())
    }

    fn fail(&mut self, message: String) -> String {
        self.state = EngineState::Failed;
        message
    }
}

#[cfg(windows)]
fn test_command() -> std::io::Result<Child> {
    Command::new("cmd")
        .args(["/C", "echo rinari-engine-test"])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
}

#[cfg(not(windows))]
fn test_command() -> std::io::Result<Child> {
    Command::new("sh")
        .args(["-c", "echo rinari-engine-test"])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn initial_state_is_stopped() {
        assert_eq!(EngineSupervisor::new().status(), EngineState::Stopped);
    }

    #[test]
    fn test_sidecar_echoes_and_releases() {
        let mut supervisor = EngineSupervisor::new();
        let out = supervisor
            .spawn_test_sidecar()
            .expect("test sidecar must run and exit 0");
        assert_eq!(out, "rinari-engine-test");
        assert_eq!(supervisor.status(), EngineState::Stopped);
    }
}
