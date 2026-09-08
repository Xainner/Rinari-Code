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
  createSession: (options?: { cwd?: string; chat?: boolean; title?: string }) =>
    invoke<{ session: SessionSummary; created: boolean }>("session_create", {
      cwd: options?.cwd ?? null,
      chat: options?.chat ?? false,
      title: options?.title ?? null,
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
  startTurn: (sessionId: string, message: string) =>
    invoke<{ status: string; turn_id: string; session_id: string }>("turn_start", {
      session_id: sessionId,
      message,
    }),
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
