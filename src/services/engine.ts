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
  startTurn: (sessionId: string, message: string) =>
    invoke<{ status: string; turn_id: string; session_id: string }>("turn_start", {
      sessionId,
      message,
    }),
  cancelTurn: (sessionId: string) =>
    invoke<{ status: string; turn_id: string; session_id: string }>("turn_cancel", {
      sessionId,
    }),
  resolveApproval: (approvalId: string, decision: string) =>
    invoke<{ status: string; approval_id: string; decision: string }>("approval_resolve", {
      approvalId,
      decision,
    }),
  snapshot: () => invoke<{ snapshot: unknown }>("snapshot_get"),
};

export function onEngineEvent(callback: (event: EngineEventMsg) => void): Promise<UnlistenFn> {
  return listen<EngineEventMsg>(ENGINE_EVENT, (wrapper) => callback(wrapper.payload));
}
