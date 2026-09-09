import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export type EngineState =
  | "stopped"
  | "starting"
  | "handshaking"
  | "ready"
  | "degraded"
  | "restarting"
  | "failed";

export interface EngineStatus {
  state: EngineState;
  engine_version: string | null;
  protocol_version: number | null;
  detail: string | null;
}

export interface CommandError {
  code: string;
  message: string;
}

export interface EngineEventMsg {
  type: string;
  event: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>;
}

export interface SessionSummary {
  id: string;
  kind: string;
  title: string | null;
  mode: string;
  state: string;
  updated_at: string;
  project_root: string | null;
  current_cwd: string | null;
  provider_id: string;
  model_id: string;
  permission_profile: 'read-only' | 'workspace' | 'full-access';
  effective_permission_profile: 'read-only' | 'workspace' | 'full-access';
}

export interface AttachmentInput {
  id: string;
  path: string;
  name: string;
  mime_type?: string;
  size?: number;
  source: 'native' | 'workspace';
}

export interface HistoryMessage {
  id: string;
  seq: number;
  role: string;
  content: string | null;
  tool_calls: Array<{ id: string; name: string; arguments: string }> | null;
  tool_call_id: string | null;
  name: string | null;
  created_at: string;
}

export interface ProviderSummary {
  id: string;
  alias: string;
  type: string;
  auth_method: string;
  account_hint: string | null;
  endpoint: string | null;
  settings: Record<string, unknown>;
  status_connected: boolean | null;
  status_checked_at: string | null;
  default_model_id: string | null;
  last_used_model_id: string | null;
  active: boolean;
  has_credential: boolean;
}

export interface ModelSummary {
  id: string;
  alias: string;
  provider_id: string;
  provider: string | null;
  provider_model_id: string;
  capabilities: Record<string, unknown> | null;
  availability: string;
  settings: Record<string, unknown>;
  active: boolean;
  /** False for a live provider-catalog entry not persisted locally yet. */
  saved?: boolean;
}

export interface DiscoveredModel {
  provider_model_id: string;
  capabilities: Record<string, unknown> | null;
  availability: string;
}

export interface ProviderHealth {
  connected: boolean;
  detail: string;
  models_discovered: number;
  models: DiscoveredModel[];
}

export interface DiscoveryCandidate {
  source: string;
  name: string;
  detail: string;
  provider_type: string;
  endpoint: string | null;
}

export interface TaskItem {
  id: string;
  title: string;
  status: string;
  [key: string]: unknown;
}

export interface ChangedFile {
  path: string;
  staged: string | null;
  unstaged: string | null;
}

export interface AgentAssignment {
  model: string | null;
  fallback: string | null;
  enabled: boolean;
}

export interface AgentView {
  name: string;
  description: string;
  profile: string;
  provenance: string;
  tool_allowlist: string[];
  budget: { max_model_calls: number; max_tool_calls: number; max_wall_time_s: number };
  assignment: AgentAssignment;
}

export interface SessionEvent {
  id: string;
  seq: number;
  type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface SoulSummary {
  id: string;
  name: string;
  version: string;
  description: string;
  source: string;
}

export interface SoulDetail extends SoulSummary {
  identity: string;
}

export interface McpServer {
  name: string;
  transport: string;
  command: string;
  scope: string;
  enabled: boolean;
  connected: boolean;
  updated_at: string | null;
}

export interface McpTest {
  ok: boolean;
  server?: string;
  tools?: number;
  names?: string[];
  error?: string;
  message?: string;
}

export interface PluginInfo {
  name: string;
  version: string;
  source: string;
  scope: string;
  enabled: boolean;
  path: string;
  capabilities: string[];
  diagnostics: Array<{ code: string; message: string }>;
}

export interface NativeTool {
  name: string;
  description: string;
  capabilities: string[] | null;
  permissions: string[] | null;
  risk: string;
  side_effects: string;
  namespace: string;
  always_loaded: boolean;
}

export interface ArtifactSummary {
  uri: string;
  id: string;
  session: string;
  project_root: string;
  namespace: string;
  name: string;
  content_type: string;
  sha256: string;
  byte_count: number;
  summary: string;
  provenance: string;
  retention: string;
  created_at: string;
}

export interface SessionContext {
  session_id: string;
  compacted: boolean;
  compacted_at: string;
  goal: string;
  provider_model: string;
  counts: Record<string, number>;
}

export interface SessionUsage {
  session_id: string | null;
  model_calls: number;
  tokens: { input: number; output: number; cached: number; reasoning: number };
  tool_calls: { total: number; ok: number; error: number };
  cost: number | null;
}

export interface ProfileBundle {
  id: string;
  name: string;
  description: string;
  soul_id: string | null;
  mode: string | null;
  agents: Record<string, { model?: string; fallback?: string }>;
}

export interface ProjectChanges {
  available: boolean;
  branch: string | null;
  head: string | null;
  dirty: boolean;
  files: ChangedFile[];
}

export const ENGINE_EVENT = "rinari-engine-event";

export function isCommandError(value: unknown): value is CommandError {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as CommandError).code === "string"
  );
}

export function commandMessage(error: unknown): string {
  if (isCommandError(error)) return `${error.code}: ${error.message}`;
  return String(error);
}

export const engineApi = {
  status: () => invoke<EngineStatus>("engine_status"),
  start: () => invoke<EngineStatus>("engine_start"),
  shutdown: () => invoke<EngineStatus>("engine_shutdown"),
  restart: () => invoke<EngineStatus>("engine_restart"),
  sessions: (kind?: string) =>
    invoke<{ sessions: SessionSummary[] }>("session_list", { kind: kind ?? null }),
  createSession: (options?: { cwd?: string; chat?: boolean; title?: string; mode?: string; permission_profile?: string }) =>
    invoke<{ session: SessionSummary; created: boolean }>("session_create", {
      cwd: options?.cwd ?? null,
      chat: options?.chat ?? false,
      title: options?.title ?? null,
      mode: options?.mode ?? 'build',
      permission_profile: options?.permission_profile ?? 'workspace',
    }),
  openSession: (reference: string) =>
    invoke<{ session: SessionSummary; created: boolean; warnings: string[] }>(
      "session_open",
      { reference },
    ),
  sessionHistory: (reference: string, limit?: number) =>
    invoke<{
      session_id: string;
      messages: HistoryMessage[];
      total: number;
      has_more: boolean;
    }>("session_history", { reference, limit: limit ?? null }),
  setSessionMode: (reference: string, mode: string) =>
    invoke<{ session: SessionSummary }>("session_mode_set", { reference, mode }),
  setSessionModel: (reference: string, model: string, provider?: string) =>
    invoke<{ session: SessionSummary; model: ModelSummary }>("session_model_set", {
      reference,
      model,
      provider: provider ?? null,
    }),
  setSessionPermission: (reference: string, permissionProfile: string) =>
    invoke<{ session: SessionSummary }>("session_permission_set", {
      reference,
      permission_profile: permissionProfile,
    }),
  getSessionPermission: (reference: string) =>
    invoke<{ session: SessionSummary }>("session_permission_get", { reference }),
  searchWorkspaceFiles: (sessionId: string, query: string, limit = 30) =>
    invoke<{ root: string; files: Array<{ path: string; relative_path: string; name: string }> }>(
      "workspace_file_search",
      { session_id: sessionId, query, limit },
    ),
  taskTree: (path: string) =>
    invoke<{ tasks: TaskItem[]; depths: Record<string, number> }>("task_tree", {
      path,
    }),
  taskGet: (path: string, task_id: string) =>
    invoke<{ task: TaskItem }>("task_get", { path, task_id }),
  verificationLatest: (path: string, kinds?: string[], limit?: number) =>
    invoke<{ records: Array<Record<string, unknown>> }>("verification_latest", {
      path,
      kinds: kinds ?? null,
      limit: limit ?? null,
    }),
  verificationPlan: (path: string, changed_files: string[]) =>
    invoke<{ plan: Record<string, unknown> }>("verification_plan", {
      path,
      changed_files,
    }),
  checkpointList: (path?: string) =>
    invoke<{ checkpoints: Array<Record<string, unknown>> }>("checkpoint_list", {
      path: path ?? null,
    }),
  checkpointShow: (checkpoint_id: string) =>
    invoke<{ checkpoint: Record<string, unknown> }>("checkpoint_show", {
      checkpoint_id,
    }),
  checkpointRestore: (input: {
    path: string;
    checkpoint_id?: string;
    preview?: boolean;
    allow_mixed?: boolean;
  }) =>
    invoke<{ result: Record<string, unknown> }>("checkpoint_restore", {
      path: input.path,
      checkpoint_id: input.checkpoint_id ?? null,
      preview: input.preview ?? null,
      allow_mixed: input.allow_mixed ?? null,
    }),
  projectChanges: (path: string) =>
    invoke<ProjectChanges>("project_changes", { path }),
  projectDiff: (path: string, file?: string, max_chars?: number) =>
    invoke<{ diff: string; truncated: boolean; binary: boolean; chars: number }>(
      "project_diff",
      { path, file: file ?? null, max_chars: max_chars ?? null },
    ),
  agentList: () => invoke<{ agents: AgentView[] }>("agent_list"),
  agentConfigGet: (agent: string) =>
    invoke<{ agent: AgentView }>("agent_config_get", { agent }),
  agentConfigSet: (input: {
    agent: string;
    model?: string;
    fallback?: string;
    enabled?: boolean;
    clear?: boolean;
  }) =>
    invoke<{ agent: AgentView }>("agent_config_set", {
      agent: input.agent,
      model: input.model ?? null,
      fallback: input.fallback ?? null,
      enabled: input.enabled ?? null,
      clear: input.clear ?? null,
    }),
  sessionEvents: (reference: string, after_seq?: number, limit?: number) =>
    invoke<{ session_id: string; events: SessionEvent[]; has_more: boolean }>(
      "session_events",
      { reference, after_seq: after_seq ?? null, limit: limit ?? null },
    ),
  soulList: () => invoke<{ souls: SoulSummary[]; active_id: string | null }>("soul_list"),
  soulGet: (id: string) => invoke<{ soul: SoulDetail }>("soul_get", { id }),
  soulCreate: (input: {
    id: string;
    name: string;
    identity: string;
    description?: string;
    version?: string;
  }) =>
    invoke<{ soul: SoulDetail }>("soul_create", {
      id: input.id,
      name: input.name,
      identity: input.identity,
      description: input.description ?? null,
      version: input.version ?? null,
    }),
  soulUpdate: (input: {
    id: string;
    name?: string;
    identity?: string;
    description?: string;
    version?: string;
  }) =>
    invoke<{ soul: SoulDetail }>("soul_update", {
      id: input.id,
      name: input.name ?? null,
      identity: input.identity ?? null,
      description: input.description ?? null,
      version: input.version ?? null,
    }),
  soulRemove: (id: string) => invoke<{ removed: { id: string } }>("soul_remove", { id }),
  soulActivate: (id: string) => invoke<{ soul: SoulSummary }>("soul_activate", { id }),
  mcpList: () => invoke<{ servers: McpServer[] }>("mcp_list"),
  mcpCreate: (name: string, command: string[]) =>
    invoke<{ server: McpServer }>("mcp_create", { name, command }),
  mcpRemove: (name: string) => invoke<{ removed: { name: string } }>("mcp_remove", { name }),
  mcpSetEnabled: (name: string, enabled: boolean) =>
    invoke<{ server: McpServer }>("mcp_set_enabled", { name, enabled }),
  mcpTest: (name: string) => invoke<{ test: McpTest }>("mcp_test", { name }),
  pluginList: () => invoke<{ plugins: PluginInfo[] }>("plugin_list"),
  pluginSetEnabled: (name: string, enabled: boolean) =>
    invoke<{ plugin: PluginInfo }>("plugin_set_enabled", { name, enabled }),
  pluginDiagnostics: () =>
    invoke<{ reports: Array<{ name: string; source: string; diagnostics: Array<{ code: string; message: string }> }> }>(
      "plugin_diagnostics",
    ),
  toolList: () => invoke<{ tools: NativeTool[] }>("tool_list"),
  policyGet: () =>
    invoke<{ mode_profile: Record<string, string>; note: string }>("policy_get"),
  artifactList: (session_id?: string) =>
    invoke<{ artifacts: ArtifactSummary[] }>("artifact_list", {
      session_id: session_id ?? null,
    }),
  artifactRead: (uri: string, max_bytes?: number) =>
    invoke<{ artifact: ArtifactSummary; text: string; truncated: boolean; max_bytes: number }>(
      "artifact_read",
      { uri, max_bytes: max_bytes ?? null },
    ),
  contextGet: (reference: string) =>
    invoke<{ context: SessionContext }>("context_get", { reference }),
  usageGet: (reference?: string) =>
    invoke<{ usage: SessionUsage }>("usage_get", { reference: reference ?? null }),
  queueAdd: (session_id: string, message: string) =>
    invoke<{ session_id: string; position: number; pending: number }>("queue_add", {
      session_id,
      message,
    }),
  queueList: (session_id: string) =>
    invoke<{ session_id: string; queue: string[]; pending: number }>("queue_list", {
      session_id,
    }),
  queueClear: (session_id: string) =>
    invoke<{ session_id: string; removed: number }>("queue_clear", { session_id }),
  bundleList: () => invoke<{ profiles: ProfileBundle[] }>("bundle_list"),
  bundleCreate: (input: {
    id: string;
    name: string;
    description?: string;
    soul_id?: string;
    mode?: string;
    agents?: Record<string, { model?: string; fallback?: string }>;
  }) =>
    invoke<{ profile: ProfileBundle }>("bundle_create", {
      id: input.id,
      name: input.name,
      description: input.description ?? null,
      soul_id: input.soul_id ?? null,
      mode: input.mode ?? null,
      agents: input.agents ?? null,
    }),
  bundleRemove: (id: string) => invoke<{ removed: { id: string } }>("bundle_remove", { id }),
  bundleApply: (id: string, session_ref?: string) =>
    invoke<{ applied: Record<string, unknown> }>("bundle_apply", {
      id,
      session_ref: session_ref ?? null,
    }),
  initialOpenRequest: () =>
    invoke<{ project: string | null; session: string | null }>("initial_open_request"),
  startTurn: (sessionId: string, message: string, reasoningEffort?: string | null, attachments: AttachmentInput[] = []) => {
    // Fail-fast con texto inconfundible: si esto salta, el bug está en la
    // UI (nunca debería invocar sin sesión); si salta el mensaje del
    // backend "(app 0.1.1)", el bug está en el puente Tauri.
    if (!sessionId) {
      return Promise.reject(new Error('UI sin sesión (fail-fast frontend)'))
    }
    return invoke<{ status: string; turn_id: string; session_id: string }>("turn_start", {
      session_id: sessionId,
      message,
      reasoning_effort: reasoningEffort ?? null,
      attachments,
    })
  },
  cancelTurn: (sessionId: string) =>
    invoke<{ status: string; turn_id: string; session_id: string }>("turn_cancel", {
      session_id: sessionId,
    }),
  resolveApproval: (approvalId: string, decision: string) =>
    invoke<{ status: string; approval_id: string; decision: string }>("approval_resolve", {
      approval_id: approvalId,
      decision,
    }),
  snapshot: () => invoke<{ snapshot: unknown }>("snapshot_get"),

  providerList: () =>
    invoke<{ providers: ProviderSummary[]; active_alias: string | null }>(
      "provider_list",
    ),
  providerCreate: (input: {
    alias: string;
    provider_type: string;
    auth_method?: string;
    endpoint?: string;
    account_hint?: string;
    secret?: string;
    secret_env?: string;
  }) =>
    invoke<{ provider: ProviderSummary }>("provider_create", {
      alias: input.alias,
      provider_type: input.provider_type,
      auth_method: input.auth_method ?? null,
      endpoint: input.endpoint ?? null,
      account_hint: input.account_hint ?? null,
      secret: input.secret ?? null,
      secret_env: input.secret_env ?? null,
      settings: null,
    }),
  providerGet: (reference: string) =>
    invoke<{ provider: ProviderSummary }>("provider_get", { reference }),
  providerUpdate: (
    reference: string,
    patch: {
      alias?: string;
      endpoint?: string;
      account_hint?: string;
      secret?: string;
      secret_env?: string;
    },
  ) =>
    invoke<{ provider: ProviderSummary }>("provider_update", {
      reference,
      ...patch,
    }),
  providerRemove: (reference: string, switchTo?: string) =>
    invoke<{ removed: { id: string; alias: string } }>("provider_remove", {
      reference,
      switch_to: switchTo ?? null,
      keep_credentials: false,
    }),
  providerTest: (reference: string) =>
    invoke<ProviderHealth>("provider_test", { reference }),
  providerDiscover: () =>
    invoke<{ candidates: DiscoveryCandidate[] }>("provider_discover"),
  providerUse: (reference: string) =>
    invoke<{ provider: ProviderSummary; model: ModelSummary | null }>(
      "provider_use",
      { reference },
    ),

  modelList: (provider?: string) =>
    invoke<{ models: ModelSummary[] }>("model_list", {
      provider: provider ?? null,
    }),
  modelGet: (reference: string, provider?: string) =>
    invoke<{ model: ModelSummary }>("model_get", {
      reference,
      provider: provider ?? null,
    }),
  modelAdd: (input: { provider: string; provider_model_id: string; alias: string }) =>
    invoke<{ model: ModelSummary }>("model_add", {
      provider: input.provider,
      provider_model_id: input.provider_model_id,
      alias: input.alias,
      capabilities: null,
      settings: null,
    }),
  modelAlias: (reference: string, newAlias: string, provider?: string) =>
    invoke<{ model: ModelSummary }>("model_alias", {
      reference,
      new_alias: newAlias,
      provider: provider ?? null,
    }),
  modelRemove: (reference: string, provider?: string) =>
    invoke<{ removed: { id: string; alias: string } }>("model_remove", {
      reference,
      provider: provider ?? null,
    }),
  modelUse: (reference: string, provider?: string) =>
    invoke<{
      model: ModelSummary;
      provider: ProviderSummary;
      switched_provider: boolean;
    }>("model_use", { reference, provider: provider ?? null }),
  modelDiscover: (provider?: string) =>
    invoke<{ providers: Record<string, DiscoveredModel[]> }>("model_discover", {
      provider: provider ?? null,
    }),
  modelRefresh: (provider?: string) =>
    invoke<{
      providers: Record<
        string,
        {
          saved: number;
          still_available: number;
          marked_unavailable: number;
          discovered: number;
          error: string | null;
        }
      >;
    }>("model_refresh", { provider: provider ?? null }),
  modelTest: (reference: string, provider?: string) =>
    invoke<{ ok: boolean; detail: string; model: ModelSummary }>("model_test", {
      reference,
      provider: provider ?? null,
    }),
};

export function onEngineEvent(callback: (event: EngineEventMsg) => void): Promise<UnlistenFn> {
  return listen<EngineEventMsg>(ENGINE_EVENT, (wrapper) => callback(wrapper.payload));
}
