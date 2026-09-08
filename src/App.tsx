import { useCallback, useEffect, useRef, useState } from "react";
import {
  commandMessage,
  engineApi,
  onEngineEvent,
  type EngineEventMsg,
  type EngineStatus,
  type SessionSummary,
} from "./services/engine";

interface PendingApproval {
  approval_id: string;
  session_id: string | null;
  capability: string;
  target: string | null;
  risk: string;
  description: string;
}

interface TurnLine {
  key: number;
  text: string;
  kind: "delta" | "info" | "error";
}

const STATE_LABEL: Record<EngineStatus["state"], string> = {
  stopped: "Detenido",
  starting: "Iniciando",
  handshaking: "Handshake",
  ready: "Listo",
  degraded: "Degradado",
  restarting: "Reiniciando",
  failed: "Fallo",
};

let lineKey = 0;

function App() {
  const [status, setStatus] = useState<EngineStatus | null>(null);
  const [error, setError] = useState<string>("");
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeSession, setActiveSession] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [lines, setLines] = useState<TurnLine[]>([]);
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [busy, setBusy] = useState<boolean>(false);
  const linesRef = useRef<HTMLDivElement>(null);

  const refreshStatus = useCallback(async () => {
    try {
      setStatus(await engineApi.status());
    } catch (err) {
      setError(commandMessage(err));
    }
  }, []);

  const refreshSessions = useCallback(async () => {
    try {
      const result = await engineApi.sessions();
      setSessions(result.sessions);
      setActiveSession((current) => {
        if (current && result.sessions.some((s) => s.id === current)) return current;
        return result.sessions[0]?.id ?? "";
      });
    } catch (err) {
      setError(commandMessage(err));
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
    let unlisten: (() => void) | undefined;
    void onEngineEvent((event: EngineEventMsg) => {
      const payload = event.payload ?? {};
      switch (event.event) {
        case "turn.started":
          setLines((prev) => [...prev, { key: lineKey++, text: `Turno ${payload.turn_id} iniciado.`, kind: "info" }]);
          break;
        case "model.content.delta":
          setLines((prev) => [...prev, { key: lineKey++, text: String(payload.delta ?? ""), kind: "delta" }]);
          break;
        case "tool.started":
        case "tool.completed":
          setLines((prev) => [...prev, { key: lineKey++, text: `[${event.event}] ${String(payload.tool ?? "")}`, kind: "info" }]);
          break;
        case "turn.completed":
          setLines((prev) => [...prev, { key: lineKey++, text: `Completado (${String(payload.kind ?? "")}).`, kind: "info" }]);
          setBusy(false);
          void refreshSessions();
          break;
        case "turn.cancelled":
          setLines((prev) => [...prev, { key: lineKey++, text: "Turno cancelado.", kind: "info" }]);
          setBusy(false);
          break;
        case "turn.failed":
          setLines((prev) => [...prev, { key: lineKey++, text: `Fallo: ${commandMessage(payload.error)}`, kind: "error" }]);
          setBusy(false);
          break;
        case "approval.requested":
          setApprovals((prev) => [
            ...prev.filter((a) => a.approval_id !== payload.approval_id),
            {
              approval_id: String(payload.approval_id ?? ""),
              session_id: (payload.session_id as string | null) ?? null,
              capability: String(payload.capability ?? payload.tool ?? ""),
              target: (payload.target as string | null) ?? null,
              risk: String(payload.risk ?? ""),
              description: String(payload.description ?? ""),
            },
          ]);
          break;
        case "approval.resolved":
        case "approval.expired":
          setApprovals((prev) => prev.filter((a) => a.approval_id !== payload.approval_id));
          break;
        default:
          break;
      }
    }).then((stop) => {
      unlisten = stop;
    });
    return () => unlisten?.();
  }, [refreshStatus, refreshSessions]);

  useEffect(() => {
    linesRef.current?.scrollTo({ top: linesRef.current.scrollHeight });
  }, [lines]);

  async function startEngine() {
    setError("");
    try {
      const next = await engineApi.start();
      setStatus(next);
      if (next.state === "ready") await refreshSessions();
    } catch (err) {
      setError(commandMessage(err));
      await refreshStatus();
    }
  }

  async function createSession() {
    setError("");
    try {
      const result = await engineApi.createSession({ chat: true });
      await refreshSessions();
      setActiveSession(result.session.id);
    } catch (err) {
      setError(commandMessage(err));
    }
  }

  async function sendTurn() {
    if (!activeSession || !message.trim() || busy) return;
    setError("");
    setBusy(true);
    try {
      await engineApi.startTurn(activeSession, message.trim());
      setMessage("");
    } catch (err) {
      setError(commandMessage(err));
      setBusy(false);
    }
  }

  async function cancelTurn() {
    if (!activeSession) return;
    try {
      await engineApi.cancelTurn(activeSession);
    } catch (err) {
      setError(commandMessage(err));
    }
  }

  async function resolveApproval(approvalId: string, decision: string) {
    try {
      await engineApi.resolveApproval(approvalId, decision);
    } catch (err) {
      setError(commandMessage(err));
    }
  }

  const ready = status?.state === "ready";

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b px-4 py-2">
        <span className="font-display text-sm font-bold tracking-wide">RINARI CODE</span>
        <span className="flex items-center gap-2 text-xs text-(--text-muted)">
          {status && (
            <>
              Motor Rinari
              <span className="rounded-full border px-2 py-0.5">{STATE_LABEL[status.state]}</span>
              {status.engine_version && <span>v{status.engine_version}</span>}
            </>
          )}
          {!ready && (
            <button
              type="button"
              onClick={startEngine}
              className="rounded-lg border bg-(--bg-elevated) px-3 py-1 text-xs hover:bg-(--bg-hover)"
            >
              Iniciar motor
            </button>
          )}
        </span>
      </header>

      {error !== "" && (
        <div className="border-b border-(--danger) px-4 py-2 text-xs text-(--danger)">{error}</div>
      )}

      {status?.state === "failed" && status.detail && (
        <div className="border-b px-4 py-2 text-xs text-(--text-muted)">
          Detalle: {status.detail} (revisa RINARI_ENGINE_BIN / RINARI_ENGINE_ARGS)
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-64 shrink-0 flex-col border-r bg-(--bg-sidebar) p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold tracking-wider text-(--text-subtle)">SESIONES</p>
            <button
              type="button"
              onClick={createSession}
              disabled={!ready}
              className="rounded-md border px-2 py-0.5 text-xs hover:bg-(--bg-hover) disabled:opacity-40"
            >
              + Nueva
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
            {sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => setActiveSession(session.id)}
                className={`rounded-lg border px-2 py-1.5 text-left text-xs ${
                  session.id === activeSession ? "bg-(--bg-elevated)" : "hover:bg-(--bg-hover)"
                }`}
              >
                <span className="block truncate font-medium">{session.title ?? session.id}</span>
                <span className="text-(--text-subtle)">
                  {session.kind} · {session.mode} · {session.id.slice(0, 12)}
                </span>
              </button>
            ))}
            {ready && sessions.length === 0 && (
              <p className="text-xs text-(--text-muted)">Sin sesiones todavía.</p>
            )}
            {!ready && <p className="text-xs text-(--text-muted)">Inicia el motor para ver sesiones.</p>}
          </div>

          {approvals.length > 0 && (
            <div className="mt-3 border-t pt-2">
              <p className="mb-1 text-xs font-semibold tracking-wider text-(--text-subtle)">
                APROBACIONES ({approvals.length})
              </p>
              {approvals.map((approval) => (
                <div key={approval.approval_id} className="mb-2 rounded-lg border p-2 text-xs">
                  <p className="font-mono">{approval.capability}</p>
                  {approval.target && <p className="truncate text-(--text-muted)">{approval.target}</p>}
                  <div className="mt-1 flex gap-1">
                    <button
                      type="button"
                      onClick={() => resolveApproval(approval.approval_id, "deny")}
                      className="rounded border px-2 py-0.5 hover:bg-(--bg-hover)"
                    >
                      Denegar
                    </button>
                    <button
                      type="button"
                      onClick={() => resolveApproval(approval.approval_id, "allow_once")}
                      className="rounded border px-2 py-0.5 hover:bg-(--bg-hover)"
                    >
                      Una vez
                    </button>
                    <button
                      type="button"
                      onClick={() => resolveApproval(approval.approval_id, "allow_session")}
                      className="rounded border px-2 py-0.5 hover:bg-(--bg-hover)"
                    >
                      Sesión
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <div ref={linesRef} className="min-h-0 flex-1 overflow-y-auto p-4">
            {lines.length === 0 && (
              <p className="text-sm text-(--text-muted)">
                {ready
                  ? "Elige una sesión y envía un mensaje para iniciar un turno."
                  : "Inicia el motor para conectar con Rinari."}
              </p>
            )}
            {lines.map((line) => (
              <p
                key={line.key}
                className={`mb-1 whitespace-pre-wrap text-sm ${
                  line.kind === "error"
                    ? "text-(--danger)"
                    : line.kind === "info"
                      ? "text-(--text-subtle)"
                      : "text-(--text)"
                }`}
              >
                {line.text}
              </p>
            ))}
          </div>
          <div className="flex gap-2 border-t p-3">
            <input
              value={message}
              onChange={(e) => setMessage(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendTurn();
                }
              }}
              placeholder={ready ? "Escribe un mensaje…" : "Motor detenido"}
              disabled={!ready || busy}
              className="min-w-0 flex-1 rounded-lg border bg-(--bg-elevated) px-3 py-2 text-sm outline-none placeholder:text-(--text-subtle) disabled:opacity-40"
            />
            {busy ? (
              <button
                type="button"
                onClick={cancelTurn}
                className="rounded-lg border px-4 py-2 text-sm hover:bg-(--bg-hover)"
              >
                Detener
              </button>
            ) : (
              <button
                type="button"
                onClick={sendTurn}
                disabled={!ready || !activeSession || !message.trim()}
                className="rounded-lg border bg-(--bg-elevated) px-4 py-2 text-sm hover:bg-(--bg-hover) disabled:opacity-40"
              >
                Enviar
              </button>
            )}
          </div>
        </main>
      </div>

      <footer className="border-t px-4 py-1.5 text-xs text-(--text-subtle)">
        Rinari Code v0.1.0 · Engine Protocol v1
        {status?.protocol_version ? ` · protocolo ${status.protocol_version}` : ""}
      </footer>
    </div>
  );
}

export default App;
