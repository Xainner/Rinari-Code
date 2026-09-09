//! Engine Protocol v1 method inventory: the single source of truth for
//! protocol method names on the desktop side.
//!
//! [`EngineSupervisor::request`](super::supervisor::EngineSupervisor::request)
//! takes [`Method`], so a new protocol call without extending the inventory
//! below is a compile error — method strings cannot silently drift between
//! wrappers. The Python engine remains the protocol owner; this inventory
//! only pins the exact names this desktop release speaks (see
//! `engine-manifest.json`).

/// Capability gate: the desktop refuses engines without it (see handshake).
pub const REQUIRED_CAPABILITY: &str = "desktop_turn_runtime_v3";

macro_rules! define_methods {
    ($( $variant:ident => $name:literal ),* $(,)?) => {
        /// Every Engine Protocol v1 method this release may invoke.
        #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
        pub enum Method {
            $( $variant ),*
        }

        impl Method {
            /// Exact wire name. Breaking changes here require a protocol
            /// version decision.
            pub fn as_str(self) -> &'static str {
                match self {
                    $( Method::$variant => $name ),*
                }
            }

            /// Whole inventory, generated from the same list: cannot rot.
            pub const ALL: &'static [Method] = &[ $( Method::$variant ),* ];
        }
    };
}

define_methods! {
    EngineInfo => "engine.info",
    SessionList => "session.list",
    SessionCreate => "session.create",
    SessionOpen => "session.open",
    SessionRename => "session.rename",
    SessionArchive => "session.archive",
    SessionRestore => "session.restore",
    SessionFork => "session.fork",
    SessionHistory => "session.history",
    SessionEvents => "session.events",
    SessionClose => "session.close",
    SessionDelete => "session.delete",
    SessionModeSet => "session.mode.set",
    SessionModelSet => "session.model.set",
    SessionPermissionSet => "session.permission.set",
    SessionPermissionGet => "session.permission.get",
    SessionTurnStart => "session.turn.start",
    SessionTurnCancel => "session.turn.cancel",
    SessionQueueAdd => "session.queue.add",
    SessionQueueList => "session.queue.list",
    SessionQueueClear => "session.queue.clear",
    WorkspaceFileSearch => "workspace.file.search",
    TaskTree => "task.tree",
    TaskGet => "task.get",
    VerificationLatest => "verification.latest",
    VerificationPlan => "verification.plan",
    CheckpointList => "checkpoint.list",
    CheckpointShow => "checkpoint.show",
    CheckpointRestore => "checkpoint.restore",
    ProjectChanges => "project.changes",
    ProjectDiff => "project.diff",
    AgentList => "agent.list",
    AgentConfigGet => "agent.config.get",
    AgentConfigSet => "agent.config.set",
    SoulList => "soul.list",
    SoulGet => "soul.get",
    SoulCreate => "soul.create",
    SoulUpdate => "soul.update",
    SoulRemove => "soul.remove",
    SoulActivate => "soul.activate",
    McpList => "mcp.list",
    McpGet => "mcp.get",
    McpCreate => "mcp.create",
    McpRemove => "mcp.remove",
    McpEnable => "mcp.enable",
    McpDisable => "mcp.disable",
    McpTest => "mcp.test",
    PluginList => "plugin.list",
    PluginGet => "plugin.get",
    PluginEnable => "plugin.enable",
    PluginDisable => "plugin.disable",
    PluginDiagnostics => "plugin.diagnostics",
    ToolList => "tool.list",
    PolicyGet => "policy.get",
    ProjectListRecent => "project.list_recent",
    ProjectList => "project.list",
    ProjectGet => "project.get",
    ProjectAdd => "project.add",
    ProjectUpdate => "project.update",
    ProjectRemove => "project.remove",
    ProjectOpen => "project.open",
    ProjectStatus => "project.status",
    ProjectIntelligence => "project.intelligence",
    ArtifactList => "artifact.list",
    ArtifactRead => "artifact.read",
    ContextGet => "context.get",
    UsageGet => "usage.get",
    ProfileBundleList => "profile_bundle.list",
    ProfileBundleGet => "profile_bundle.get",
    ProfileBundleCreate => "profile_bundle.create",
    ProfileBundleRemove => "profile_bundle.remove",
    ProfileBundleApply => "profile_bundle.apply",
    ApprovalResolve => "approval.resolve",
    RuntimeSnapshotGet => "runtime.snapshot.get",
    ProviderList => "provider.list",
    ProviderCreate => "provider.create",
    ProviderGet => "provider.get",
    ProviderUpdate => "provider.update",
    ProviderRemove => "provider.remove",
    ProviderTest => "provider.test",
    ProviderDiscover => "provider.discover",
    ProviderUse => "provider.use",
    ModelList => "model.list",
    ModelGet => "model.get",
    ModelAdd => "model.add",
    ModelAlias => "model.alias",
    ModelRemove => "model.remove",
    ModelUse => "model.use",
    ModelDiscover => "model.discover",
    ModelDiscoveryStart => "model.discovery.start",
    ModelRefresh => "model.refresh",
    ModelTest => "model.test",
}

#[cfg(test)]
mod tests {
    use super::Method;

    #[test]
    fn wire_names_are_unique_dotted_namespaces() {
        let mut names: Vec<&str> = Method::ALL.iter().map(|method| method.as_str()).collect();
        names.sort_unstable();
        names.dedup();
        assert_eq!(names.len(), Method::ALL.len(), "duplicate wire names");
        for name in names {
            assert!(!name.is_empty());
            assert!(!name.contains(' '));
            assert!(
                name.contains('.'),
                "{name} must be a dotted protocol method"
            );
        }
    }
}
