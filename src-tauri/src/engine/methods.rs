//! Generated Engine Protocol v1 inventory.
//!
//! The Python schema is authoritative. `npm run protocol:generate` refreshes
//! this module, while CI uses `protocol:check` against the engine SHA pinned
//! in `engine-manifest.json`.

include!("protocol_generated.rs");

/// Capability gate: the desktop refuses engines without it (see handshake).
pub const REQUIRED_CAPABILITY: &str = "desktop_turn_runtime_v3";

#[cfg(test)]
mod tests {
    use super::{Method, ENGINE_EVENTS};

    #[test]
    fn generated_wire_names_are_unique_dotted_namespaces() {
        let mut names: Vec<&str> = Method::ALL.iter().map(|method| method.as_str()).collect();
        names.sort_unstable();
        names.dedup();
        assert_eq!(names.len(), Method::ALL.len(), "duplicate wire names");
        assert!(names.iter().all(|name| name.contains('.')));
        assert!(ENGINE_EVENTS.contains(&"governor.compact"));
    }
}
