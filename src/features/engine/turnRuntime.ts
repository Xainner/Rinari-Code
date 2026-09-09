import type { ChatMessage, PendingApproval, ToolActivity, TurnExecution, TurnStopReason } from '../../types'
import type { EngineEventMsg } from '../../services/engine'

/**
 * TurnRuntime: todo el estado vivo de ejecución (hilos, ejecuciones,
 * sesiones ocupadas, aprobaciones) reducido desde eventos del engine con
 * un único reducer determinista. Sin React, sin Tauri, testeable.
 *
 * Regla de verdad: los estados terminales (completed / cancelled / failed)
 * solo nacen de eventos autoritativos del engine o de la reconciliación
 * con `snapshot/restored`. Nada aquí inventa ejecución.
 */

/** Eventos de engine que obligan a refrescar la lista de sesiones. */
export const TRIGGERS_SESSION_REFRESH: ReadonlySet<string> = new Set([
  'turn.completed',
  'turn.stopped',
  'session.mode.changed',
  'session.model.changed',
])

/**
 * Eventos conocidos que no producen acción de runtime:
 * - model.completed: sin estado asociado;
 * - session.mode/model.changed: solo refrescan la lista de sesiones.
 */
export const KNOWN_RUNTIME_NOOPS: ReadonlySet<string> = new Set([
  'model.completed',
  'session.mode.changed',
  'session.model.changed',
])

export type ToolRuntimeEventName =
  | 'tool.requested'
  | 'tool.started'
  | 'tool.completed'
  | 'tool.failed'
  | 'tool.cancelled'

const TOOL_STATUS: Record<ToolRuntimeEventName, ToolActivity['status']> = {
  'tool.requested': 'requested',
  'tool.started': 'running',
  'tool.completed': 'done',
  'tool.failed': 'failed',
  'tool.cancelled': 'cancelled',
}

export interface TurnRuntimeState {
  threads: Record<string, ChatMessage[]>
  executions: Record<string, TurnExecution>
  busySessions: Set<string>
  approvals: PendingApproval[]
}

export type TurnRuntimeAction =
  | { type: 'turn/started'; turnId: string; sessionId: string; now: number }
  | { type: 'model/started'; turnId: string; sessionId: string }
  | { type: 'turn/preparing'; turnId: string; sessionId: string; stage: string }
  | { type: 'model/failed'; turnId: string; sessionId: string }
  | { type: 'content/delta'; turnId: string; sessionId: string; delta: string; now: number }
  | { type: 'turn/completed'; turnId: string; sessionId: string; content: string; now: number }
  | { type: 'turn/cancelled'; turnId: string; sessionId: string; now: number }
  | { type: 'turn/failed'; turnId: string; sessionId: string; error: string; now: number }
  | { type: 'turn/stopped'; turnId: string; sessionId: string; reason: TurnStopReason; now: number }
  | { type: 'approval/requested'; approval: PendingApproval }
  | { type: 'approval/resolving'; approvalId: string }
  | { type: 'approval/pending'; approvalId: string }
  | { type: 'approval/settled'; approvalId: string; turnId: string; sessionId: string }
  | {
      type: 'tool/event'
      event: ToolRuntimeEventName
      sessionId: string
      turnId: string
      toolId: string
      tool: string
      detail: string
      durationMs?: number
      error?: string
    }
  | { type: 'turn/cancelling'; sessionId: string }
  | { type: 'turn/message-sent'; sessionId: string; message: ChatMessage }
  | { type: 'turn/busy-set'; sessionId: string; busy: boolean }
  | { type: 'turn/started-ack'; turnId: string; sessionId: string; now: number }
  | { type: 'history/loaded'; sessionId: string; messages: ChatMessage[] }
  | { type: 'snapshot/restored'; snapshot: unknown; now: number }

export function createInitialTurnRuntime(): TurnRuntimeState {
  return { threads: {}, executions: {}, busySessions: new Set(), approvals: [] }
}

let msgKey = 0
/** Ids para mensajes creados por la UI (los vivos derivan de `live_<turnId>`). */
export function createMessageId(): string {
  msgKey += 1
  return `msg_${Date.now().toString(36)}_${msgKey}`
}

function liveMessageId(turnId: string): string {
  return `live_${turnId}`
}

function withBusy(busySessions: Set<string>, sessionId: string, busy: boolean): Set<string> {
  if (sessionId === '') return busySessions
  const next = new Set(busySessions)
  if (busy) next.add(sessionId)
  else next.delete(sessionId)
  return next
}

function withExecution(
  executions: Record<string, TurnExecution>,
  turnId: string,
  sessionId: string,
  now: number,
  update: (current: TurnExecution) => TurnExecution,
): Record<string, TurnExecution> {
  if (!turnId) return executions
  const current: TurnExecution = executions[turnId] ?? {
    turnId,
    sessionId,
    status: 'thinking',
    startedAt: now,
    tools: [],
  }
  return { ...executions, [turnId]: update(current) }
}

/** Placeholder assistant ligado al turno; el bloque de ejecución lo posee. */
function ensurePlaceholder(
  threads: Record<string, ChatMessage[]>,
  sessionId: string,
  turnId: string,
  now: number,
): Record<string, ChatMessage[]> {
  if (!turnId || !sessionId) return threads
  const thread = threads[sessionId] ?? []
  if (thread.some((m) => m.turnId === turnId)) return threads
  const message: ChatMessage = {
    id: liveMessageId(turnId),
    role: 'assistant',
    content: '',
    createdAt: now,
    pending: true,
    turnId,
  }
  return { ...threads, [sessionId]: [...thread, message] }
}

function finishTurnMessages(
  threads: Record<string, ChatMessage[]>,
  turnId: string,
  sessionId: string,
  finalContent = '',
): Record<string, ChatMessage[]> {
  if (!turnId || !sessionId) return threads
  const thread = threads[sessionId] ?? []
  return {
    ...threads,
    [sessionId]: thread.map((message) =>
      message.turnId === turnId
        ? {
            ...message,
            // Algunos providers completan con un payload final en vez de
            // deltas: el texto autoritativo gana al contenido streameado.
            content: finalContent || message.content,
            pending: false,
          }
        : message,
    ),
  }
}

function settleTools(
  tools: ToolActivity[],
  status: ToolActivity['status'],
): ToolActivity[] {
  return tools.map((tool) =>
    tool.status === 'running' || tool.status === 'requested' ? { ...tool, status } : tool,
  )
}

function withoutTurnApprovals(approvals: PendingApproval[], turnId: string): PendingApproval[] {
  if (!turnId) return approvals
  return approvals.filter((item) => item.turn_id !== turnId)
}

export function turnRuntimeReducer(
  state: TurnRuntimeState,
  action: TurnRuntimeAction,
): TurnRuntimeState {
  switch (action.type) {
    case 'turn/started':
      return {
        ...state,
        threads: ensurePlaceholder(state.threads, action.sessionId, action.turnId, action.now),
        executions: withExecution(state.executions, action.turnId, action.sessionId, action.now, (current) => ({
          ...current,
          sessionId: action.sessionId,
          status: 'thinking',
        })),
        busySessions: withBusy(state.busySessions, action.sessionId, true),
      }

    case 'model/started':
      return {
        ...state,
        executions: withExecution(state.executions, action.turnId, action.sessionId, Date.now(), (current) => ({
          ...current,
          status: 'thinking',
          preparationStage: undefined,
        })),
      }

    case 'turn/preparing':
      return {
        ...state,
        executions: withExecution(state.executions, action.turnId, action.sessionId, Date.now(), (current) => ({
          ...current,
          status: current.status === 'cancelling' ? current.status : 'thinking',
          preparationStage: action.stage,
        })),
      }

    case 'model/failed':
      return {
        ...state,
        executions: withExecution(state.executions, action.turnId, action.sessionId, Date.now(), (current) => ({
          ...current,
          status: current.status === 'cancelling' ? current.status : 'failed',
        })),
      }

    case 'content/delta': {
      if (action.delta === '' || !action.turnId || !action.sessionId) return state
      const threads = ensurePlaceholder(state.threads, action.sessionId, action.turnId, action.now)
      const target = liveMessageId(action.turnId)
      const thread = threads[action.sessionId] ?? []
      return {
        ...state,
        // Al llegar contenido, la fila deja de ser espera: evita un segundo
        // timer de "Pensando" con inicio tardío.
        threads: {
          ...threads,
          [action.sessionId]: thread.map((m) =>
            m.id === target ? { ...m, content: m.content + action.delta, pending: false } : m,
          ),
        },
      }
    }

    case 'turn/completed':
      return {
        ...state,
        threads: finishTurnMessages(state.threads, action.turnId, action.sessionId, action.content),
        executions: withExecution(state.executions, action.turnId, action.sessionId, action.now, (current) => ({
          ...current,
          status: 'completed',
          completedAt: action.now,
          tools: settleTools(current.tools, 'done'),
        })),
        busySessions: withBusy(state.busySessions, action.sessionId, false),
        approvals: withoutTurnApprovals(state.approvals, action.turnId),
      }

    case 'turn/cancelled':
      return {
        ...state,
        threads: finishTurnMessages(state.threads, action.turnId, action.sessionId),
        executions: withExecution(state.executions, action.turnId, action.sessionId, action.now, (current) => ({
          ...current,
          status: 'cancelled',
          completedAt: action.now,
          tools: settleTools(current.tools, 'cancelled'),
        })),
        busySessions: withBusy(state.busySessions, action.sessionId, false),
        approvals: withoutTurnApprovals(state.approvals, action.turnId),
      }

    case 'turn/failed':
      return {
        ...state,
        threads: finishTurnMessages(state.threads, action.turnId, action.sessionId),
        executions: withExecution(state.executions, action.turnId, action.sessionId, action.now, (current) => ({
          ...current,
          status: 'failed',
          completedAt: action.now,
          error: action.error,
          tools: settleTools(current.tools, 'failed'),
        })),
        busySessions: withBusy(state.busySessions, action.sessionId, false),
        approvals: withoutTurnApprovals(state.approvals, action.turnId),
      }

    case 'turn/stopped':
      // Safeguard de emergencia: terminal, pero NO es completed ni failed.
      // Las herramientas quedan con su último estado conocido (no se inventa
      // desenlace) y el composer se libera: continuar = turno nuevo.
      return {
        ...state,
        threads: finishTurnMessages(state.threads, action.turnId, action.sessionId),
        executions: withExecution(state.executions, action.turnId, action.sessionId, action.now, (current) => ({
          ...current,
          status: 'stopped',
          completedAt: action.now,
          stopReason: action.reason,
        })),
        busySessions: withBusy(state.busySessions, action.sessionId, false),
        approvals: withoutTurnApprovals(state.approvals, action.turnId),
      }

    case 'approval/requested':
      return {
        ...state,
        approvals: [
          ...state.approvals.filter((a) => a.approval_id !== action.approval.approval_id),
          action.approval,
        ],
        executions: withExecution(
          state.executions,
          action.approval.turn_id ?? '',
          action.approval.session_id ?? '',
          Date.now(),
          (current) => ({ ...current, status: 'approval' }),
        ),
      }

    case 'approval/resolving':
      return {
        ...state,
        approvals: state.approvals.map((item) =>
          item.approval_id === action.approvalId ? { ...item, status: 'resolving' } : item,
        ),
      }

    case 'approval/pending':
      return {
        ...state,
        approvals: state.approvals.map((item) =>
          item.approval_id === action.approvalId ? { ...item, status: 'pending' } : item,
        ),
      }

    case 'approval/settled': {
      const approvals = state.approvals.filter((a) => a.approval_id !== action.approvalId)
      // `resolved` con estado distinto lo confirma el engine; `expired`
      // siempre retira. El estado vuelve a thinking solo desde approval.
      return {
        ...state,
        approvals,
        executions: withExecution(state.executions, action.turnId, action.sessionId, Date.now(), (current) => ({
          ...current,
          status: current.status === 'approval' ? 'thinking' : current.status,
        })),
      }
    }

    case 'tool/event': {
      const { sessionId, turnId, toolId, tool } = action
      if (!sessionId || !turnId || !toolId || !tool) return state
      const nextTool: ToolActivity = {
        id: toolId,
        tool,
        status: TOOL_STATUS[action.event],
        detail: action.detail,
        durationMs: action.durationMs,
        error: action.error,
      }
      return {
        ...state,
        executions: withExecution(state.executions, turnId, sessionId, Date.now(), (current) => {
          const exists = current.tools.some((item) => item.id === toolId)
          return {
            ...current,
            status:
              action.event === 'tool.started' && current.status !== 'cancelling' && !current.completedAt
                ? 'executing'
                : current.status,
            tools: exists
              ? current.tools.map((item) => (item.id === toolId ? { ...item, ...nextTool } : item))
              : [...current.tools, nextTool],
          }
        }),
      }
    }

    case 'turn/cancelling': {
      // Solo el evento terminal del engine cierra el turno. Aquí solo se
      // marca la intención optimista; la reconciliación llega por snapshot.
      const active = Object.values(state.executions).find(
        (item) => item.sessionId === action.sessionId && !item.completedAt,
      )
      if (!active) return state
      return {
        ...state,
        executions: withExecution(state.executions, active.turnId, action.sessionId, Date.now(), (current) => ({
          ...current,
          status: 'cancelling',
        })),
      }
    }

    case 'turn/message-sent':
      return {
        ...state,
        threads: {
          ...state.threads,
          [action.sessionId]: [...(state.threads[action.sessionId] ?? []), action.message],
        },
      }

    case 'turn/busy-set':
      return { ...state, busySessions: withBusy(state.busySessions, action.sessionId, action.busy) }

    case 'turn/started-ack':
      return {
        ...state,
        executions: withExecution(state.executions, action.turnId, action.sessionId, action.now, (current) => ({
          ...current,
          sessionId: action.sessionId,
          status: 'thinking',
        })),
      }

    case 'history/loaded': {
      // Lo vivo siempre gana a un historial que llega tarde.
      if ((state.threads[action.sessionId]?.length ?? 0) > 0) return state
      return { ...state, threads: { ...state.threads, [action.sessionId]: action.messages } }
    }

    case 'snapshot/restored':
      return restoreFromSnapshot(state, action.snapshot, action.now)

    default:
      return state
  }
}

interface SnapshotRaw {
  active_turns?: Array<Record<string, unknown>>
  pending_approvals?: Array<Record<string, unknown>>
}

/**
 * Normaliza el snapshot del engine a la misma forma del runtime vivo:
 * turnos activos → ejecuciones + busy + placeholders; aprobaciones
 * pendientes → aprobaciones; ejecuciones vivas ausentes del snapshot se
 * marcan failed (evento terminal perdido, p. ej. tras reinicio).
 */
function restoreFromSnapshot(
  state: TurnRuntimeState,
  raw: unknown,
  now: number,
): TurnRuntimeState {
  const snapshot = (raw ?? {}) as SnapshotRaw
  const restored: Record<string, TurnExecution> = {}
  let busySessions = new Set<string>()
  for (const item of snapshot.active_turns ?? []) {
    const turnId = typeof item.turn_id === 'string' ? item.turn_id : ''
    const sessionId = typeof item.session_id === 'string' ? item.session_id : ''
    if (!turnId || !sessionId) continue
    busySessions = withBusy(busySessions, sessionId, true)
    const tools: ToolActivity[] = []
    const activities = Array.isArray(item.activities)
      ? (item.activities as Array<Record<string, unknown>>)
      : []
    for (const entry of activities) {
      if (typeof entry.tool_call_id !== 'string' || typeof entry.tool !== 'string') continue
      const eventName = typeof entry.event === 'string' ? entry.event : 'tool.started'
      const status: ToolActivity['status'] =
        eventName === 'tool.completed'
          ? 'done'
          : eventName === 'tool.failed'
            ? 'failed'
            : eventName === 'tool.cancelled'
              ? 'cancelled'
              : eventName === 'tool.requested'
                ? 'requested'
                : 'running'
      tools.push({
        id: entry.tool_call_id,
        tool: entry.tool,
        status,
        detail: typeof entry.arguments === 'string' ? entry.arguments : undefined,
        durationMs: typeof entry.duration_ms === 'number' ? entry.duration_ms : undefined,
      })
    }
    restored[turnId] = {
      turnId,
      sessionId,
      status:
        item.status === 'cancelling'
          ? 'cancelling'
          : tools.some((tool) => tool.status === 'running')
            ? 'executing'
            : 'thinking',
      startedAt: typeof item.started_at === 'number' ? item.started_at * 1000 : now,
      preparationStage: typeof item.preparation_stage === 'string' ? item.preparation_stage : undefined,
      tools,
    }
  }

  const executions: Record<string, TurnExecution> = {}
  for (const [turnId, execution] of Object.entries(state.executions)) {
    if (execution.completedAt || restored[turnId]) executions[turnId] = execution
    else executions[turnId] = { ...execution, status: 'failed', completedAt: now }
  }
  Object.assign(executions, restored)

  let threads = state.threads
  for (const execution of Object.values(restored)) {
    if ((threads[execution.sessionId] ?? []).some((message) => message.turnId === execution.turnId)) {
      continue
    }
    threads = ensurePlaceholder(threads, execution.sessionId, execution.turnId, execution.startedAt)
  }

  const approvals: PendingApproval[] = (snapshot.pending_approvals ?? [])
    .map((item) => ({
      approval_id: typeof item.approval_id === 'string' ? item.approval_id : '',
      session_id: typeof item.session_id === 'string' ? item.session_id : null,
      turn_id: typeof item.turn_id === 'string' ? item.turn_id : null,
      capability: typeof item.capability === 'string' ? item.capability : '',
      target: typeof item.target === 'string' ? item.target : null,
      risk: typeof item.risk === 'string' ? item.risk : '',
      description: typeof item.description === 'string' ? item.description : '',
      status: 'pending' as const,
    }))
    .filter((item) => item.approval_id !== '')

  return { threads, executions, busySessions, approvals }
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/**
 * Evento del engine → acción del reducer. `null` cuando el evento no toca
 * el runtime (p. ej. `model.completed` o cambios que solo refrescan
 * sesiones). `now` inyectable para fixtures deterministas.
 */
export function engineEventToAction(event: EngineEventMsg, now: number = Date.now()): TurnRuntimeAction | null {
  const payload = (event.payload ?? {}) as Record<string, unknown>
  switch (event.event) {
    case 'turn.started': {
      const turnId = str(payload.turn_id)
      const sessionId = str(payload.session_id)
      if (!turnId || !sessionId) return null
      return { type: 'turn/started', turnId, sessionId, now }
    }
    case 'model.started':
      return { type: 'model/started', turnId: str(payload.turn_id), sessionId: str(payload.session_id) }
    case 'turn.preparing':
      return {
        type: 'turn/preparing',
        turnId: str(payload.turn_id),
        sessionId: str(payload.session_id),
        stage: str(payload.stage),
      }
    case 'model.completed':
      return null
    case 'model.failed':
      return { type: 'model/failed', turnId: str(payload.turn_id), sessionId: str(payload.session_id) }
    case 'model.content.delta': {
      const delta = str(payload.delta)
      if (delta === '') return null
      return {
        type: 'content/delta',
        turnId: str(payload.turn_id),
        sessionId: str(payload.session_id),
        delta,
        now,
      }
    }
    case 'turn.completed':
      return {
        type: 'turn/completed',
        turnId: str(payload.turn_id),
        sessionId: str(payload.session_id),
        content: str(payload.content),
        now,
      }
    case 'turn.cancelled':
      return {
        type: 'turn/cancelled',
        turnId: str(payload.turn_id),
        sessionId: str(payload.session_id),
        now,
      }
    case 'turn.failed': {
      const error = payload.error as Record<string, unknown> | null
      return {
        type: 'turn/failed',
        turnId: str(payload.turn_id),
        sessionId: str(payload.session_id),
        error: error ? str(error.message) : 'El turno falló.',
        now,
      }
    }
    case 'turn.stopped': {
      const reason = (payload.reason ?? payload) as Record<string, unknown>
      const usage = payload.usage as Record<string, unknown> | null
      const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined)
      return {
        type: 'turn/stopped',
        turnId: str(payload.turn_id),
        sessionId: str(payload.session_id),
        reason: {
          code: str(reason.code ?? reason.reason ?? 'emergency'),
          message: str(reason.message) || 'Rinari detuvo este turno por un safeguard de emergencia.',
          modelCalls: num(usage?.model_calls),
          toolCalls: num(usage?.tool_calls),
          wallTimeS: num(usage?.wall_time_s),
        },
        now,
      }
    }
    case 'approval.requested':
      return {
        type: 'approval/requested',
        approval: {
          approval_id: str(payload.approval_id),
          session_id: (payload.session_id as string | null) ?? null,
          turn_id: (payload.turn_id as string | null) ?? null,
          capability: str(payload.capability ?? payload.tool),
          target: (payload.target as string | null) ?? null,
          risk: str(payload.risk),
          description: str(payload.description),
          status: 'pending',
        },
      }
    case 'approval.resolved':
    case 'approval.expired':
      return {
        type: 'approval/settled',
        approvalId: str(payload.approval_id),
        turnId: str(payload.turn_id),
        sessionId: str(payload.session_id),
      }
    case 'tool.requested':
    case 'tool.started':
    case 'tool.completed':
    case 'tool.failed':
    case 'tool.cancelled': {
      const error = payload.error as Record<string, unknown> | null
      return {
        type: 'tool/event',
        event: event.event as ToolRuntimeEventName,
        sessionId: str(payload.session_id),
        turnId: str(payload.turn_id),
        toolId: str(payload.tool_call_id),
        tool: str(payload.tool),
        detail: str(payload.arguments ?? payload.result),
        durationMs: typeof payload.duration_ms === 'number' ? payload.duration_ms : undefined,
        error: error ? str(error.message) : undefined,
      }
    }
    default:
      return null
  }
}
