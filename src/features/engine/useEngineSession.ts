import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useI18n } from '../../i18n'
import {
  commandMessage,
  engineApi,
  onEngineEvent,
  type EngineEventMsg,
  type EngineStatus,
  type HistoryMessage,
  type ModelSummary,
  type ProviderSummary,
  type SessionSummary,
} from '../../services/engine'
import type { AttachmentRef, ChatMessage, PendingApproval, ToolActivity, TurnExecution } from '../../types'

let msgKey = 0
function nextMsgId(): string {
  msgKey += 1
  return `msg_${Date.now().toString(36)}_${msgKey}`
}

/** Filas persistidas → mensajes UI. Solo user/assistant con contenido útil. */
function historyToMessages(rows: HistoryMessage[]): ChatMessage[] {
  const out: ChatMessage[] = []
  for (const row of rows) {
    if (row.role !== 'user' && row.role !== 'assistant') continue
    let content = row.content ?? ''
    if (content === '' && row.tool_calls && row.tool_calls.length > 0) {
      const names = [...new Set(row.tool_calls.map((t) => t.name))].join(', ')
      content = `Used tools: ${names}`
    }
    if (content === '') continue
    out.push({ id: `h${row.seq}`, role: row.role, content, createdAt: Date.now() })
  }
  return out
}

/**
 * Sesión de chat contra el engine: estado, sesiones, hilos de mensajes por
 * sesión, historial persistente (session.history al seleccionar), actividad
 * de herramientas, aprobaciones y streaming de deltas.
 */
export function useEngineSession() {
  const { t } = useI18n()
  const [status, setStatus] = useState<EngineStatus | null>(null)
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [activeSession, setActiveSession] = useState<string>('')
  const [threads, setThreads] = useState<Record<string, ChatMessage[]>>({})
  const [approvals, setApprovals] = useState<PendingApproval[]>([])
  /** Session ids with an accepted/running turn. Keeps other sessions from
   * leaking their Stop/queue state into the chat currently on screen. */
  const [busySessions, setBusySessions] = useState<Set<string>>(() => new Set())
  const [reasoningEffort, setReasoningEffort] = useState<'off' | 'low' | 'medium' | 'high'>('off')
  const [providers, setProviders] = useState<ProviderSummary[]>([])
  const [models, setModels] = useState<ModelSummary[]>([])
  const [catalogLoaded, setCatalogLoaded] = useState(false)
  const [sessionsLoaded, setSessionsLoaded] = useState(false)
  /** Estado observable por turn_id; nunca se empareja por nombre de herramienta. */
  const [executions, setExecutions] = useState<Record<string, TurnExecution>>({})
  /** Total/has_more del historial cargado por sesión. */
  const [historyInfo, setHistoryInfo] = useState<
    Record<string, { total: number; hasMore: boolean }>
  >({})
  /** turn_id -> id de mensaje assistant que acumula sus deltas. */
  const turnMsg = useRef(new Map<string, string>())
  /** Sesiones con historial ya cargado o hilo vivo (no recargar encima). */
  const historyLoaded = useRef(new Set<string>())

  const messages = activeSession !== '' ? (threads[activeSession] ?? []) : []
  const busy = activeSession !== '' && busySessions.has(activeSession)

  const setSessionBusy = useCallback((sessionId: string, value: boolean) => {
    if (sessionId === '') return
    setBusySessions((current) => {
      const next = new Set(current)
      if (value) next.add(sessionId)
      else next.delete(sessionId)
      return next
    })
  }, [])

  const appendMessage = useCallback((sessionId: string, message: ChatMessage) => {
    setThreads((prev) => ({
      ...prev,
      [sessionId]: [...(prev[sessionId] ?? []), message],
    }))
  }, [])

  const appendDelta = useCallback(
    (turnId: string, sessionId: string, delta: string) => {
      if (delta === '') return
      let msgId = turnMsg.current.get(turnId)
      if (!msgId) {
        msgId = nextMsgId()
        turnMsg.current.set(turnId, msgId)
        appendMessage(sessionId, {
          id: msgId,
          role: 'assistant',
          content: '',
          createdAt: Date.now(),
          turnId,
        })
      }
      const target = msgId
      setThreads((prev) => ({
        ...prev,
        [sessionId]: (prev[sessionId] ?? []).map((m) =>
          // The execution block owns the waiting state. As soon as provider
          // content arrives this row becomes the actual streamed answer;
          // leaving `pending` set rendered a second, later-starting timer.
          m.id === target ? { ...m, content: m.content + delta, pending: false } : m,
        ),
      }))
    },
    [appendMessage],
  )

  const refreshStatus = useCallback(async () => {
    try {
      setStatus(await engineApi.status())
    } catch (err) {
      toast.error(commandMessage(err))
    }
  }, [])

  const refreshSessions = useCallback(async () => {
    try {
      const result = await engineApi.sessions()
      const normalized = result.sessions.map((item) => item.mode === 'ask' ? { ...item, mode: 'build' } : item)
      setSessions(normalized)
      for (const item of result.sessions.filter((session) => session.mode === 'ask')) {
        void engineApi.setSessionMode(item.id, 'build').catch(() => {})
      }
      setActiveSession((current) => {
        if (current !== '' && normalized.some((s) => s.id === current)) return current
        return normalized[0]?.id ?? ''
      })
    } catch (err) {
      toast.error(commandMessage(err))
    } finally {
      setSessionsLoaded(true)
    }
  }, [])

  const updateExecution = useCallback(
    (turnId: string, update: (current: TurnExecution) => TurnExecution, sessionId = '') => {
      if (!turnId) return
      setExecutions((current) => {
        const base = current[turnId] ?? {
          turnId,
          sessionId,
          status: 'thinking' as const,
          startedAt: Date.now(),
          tools: [],
        }
        return { ...current, [turnId]: update(base) }
      })
    },
    [],
  )

  const finishTurnMessage = useCallback((turnId: string, sessionId: string, finalContent = '') => {
    setThreads((current) => ({
      ...current,
      [sessionId]: (current[sessionId] ?? []).map((message) =>
        message.turnId === turnId
          ? {
              ...message,
              // Some OpenAI-compatible providers complete with one final
              // payload instead of emitting content deltas. Prefer that
              // authoritative final text, falling back to streamed content.
              content: finalContent || message.content,
              pending: false,
            }
          : message,
      ),
    }))
  }, [])

  const refreshCatalog = useCallback(async () => {
    try {
      const [p, m] = await Promise.all([engineApi.providerList(), engineApi.modelList()])
      // The primary picker is a provider catalog, not merely the small set
      // previously saved in SQLite. Discovery failures stay scoped to that
      // provider so one stale credential cannot hide every other model.
      const discovered = await Promise.all(
        p.providers.map(async (provider) => {
          try {
            const result = await engineApi.modelDiscover(provider.alias)
            return (result.providers[provider.alias] ?? []).map<ModelSummary>((model) => ({
              id: `catalog:${provider.id}:${model.provider_model_id}`,
              alias: model.provider_model_id,
              provider_id: provider.id,
              provider: provider.alias,
              provider_model_id: model.provider_model_id,
              capabilities: model.capabilities,
              availability: model.availability,
              settings: {},
              active: false,
              saved: false,
            }))
          } catch {
            return []
          }
        }),
      )
      const savedKeys = new Set(m.models.map((model) => `${model.provider_id}\0${model.provider_model_id}`))
      const catalogModels = discovered
        .flat()
        .filter((model) => !savedKeys.has(`${model.provider_id}\0${model.provider_model_id}`))
      setProviders(p.providers)
      setModels([...m.models.map((model) => ({ ...model, saved: true })), ...catalogModels])
      setCatalogLoaded(true)
    } catch (err) {
      toast.error(commandMessage(err))
    }
  }, [])

  const restoreRuntimeSnapshot = useCallback(async () => {
    try {
      const result = await engineApi.snapshot()
      const snapshot = result.snapshot as {
        active_turns?: Array<Record<string, unknown>>
        pending_approvals?: Array<Record<string, unknown>>
      }
      const restored: Record<string, TurnExecution> = {}
      const busyIds = new Set<string>()
      for (const raw of snapshot.active_turns ?? []) {
        const turnId = typeof raw.turn_id === 'string' ? raw.turn_id : ''
        const sessionId = typeof raw.session_id === 'string' ? raw.session_id : ''
        if (!turnId || !sessionId) continue
        busyIds.add(sessionId)
        const tools: ToolActivity[] = []
        for (const item of Array.isArray(raw.activities) ? raw.activities as Array<Record<string, unknown>> : []) {
          if (typeof item.tool_call_id !== 'string' || typeof item.tool !== 'string') continue
          const eventName = typeof item.event === 'string' ? item.event : 'tool.started'
          const status: ToolActivity['status'] = eventName === 'tool.completed' ? 'done' : eventName === 'tool.failed' ? 'failed' : eventName === 'tool.cancelled' ? 'cancelled' : eventName === 'tool.requested' ? 'requested' : 'running'
          tools.push({
            id: item.tool_call_id,
            tool: item.tool,
            status,
            detail: typeof item.arguments === 'string' ? item.arguments : undefined,
            durationMs: typeof item.duration_ms === 'number' ? item.duration_ms : undefined,
          })
        }
        restored[turnId] = {
          turnId,
          sessionId,
          status: raw.status === 'cancelling' ? 'cancelling' : tools.some((item) => item.status === 'running') ? 'executing' : 'thinking',
          startedAt: typeof raw.started_at === 'number' ? raw.started_at * 1000 : Date.now(),
          preparationStage: typeof raw.preparation_stage === 'string' ? raw.preparation_stage : undefined,
          tools,
        }
      }
      setExecutions((current) => {
        const reconciled = Object.fromEntries(
          Object.entries(current).map(([turnId, execution]) => {
            if (execution.completedAt || restored[turnId]) return [turnId, execution]
            return [turnId, { ...execution, status: 'failed', completedAt: Date.now() }]
          }),
        ) as Record<string, TurnExecution>
        return { ...reconciled, ...restored }
      })
      setBusySessions(busyIds)
      setThreads((current) => {
        const next = { ...current }
        for (const execution of Object.values(restored)) {
          if ((next[execution.sessionId] ?? []).some((message) => message.turnId === execution.turnId)) continue
          const msgId = nextMsgId()
          turnMsg.current.set(execution.turnId, msgId)
          next[execution.sessionId] = [
            ...(next[execution.sessionId] ?? []),
            { id: msgId, role: 'assistant', content: '', createdAt: execution.startedAt, pending: true, turnId: execution.turnId },
          ]
        }
        return next
      })
      const restoredApprovals: PendingApproval[] = (snapshot.pending_approvals ?? []).map((raw) => ({
        approval_id: typeof raw.approval_id === 'string' ? raw.approval_id : '',
        session_id: typeof raw.session_id === 'string' ? raw.session_id : null,
        turn_id: typeof raw.turn_id === 'string' ? raw.turn_id : null,
        capability: typeof raw.capability === 'string' ? raw.capability : '',
        target: typeof raw.target === 'string' ? raw.target : null,
        risk: typeof raw.risk === 'string' ? raw.risk : '',
        description: typeof raw.description === 'string' ? raw.description : '',
        status: 'pending' as const,
      })).filter((item) => item.approval_id !== '')
      setApprovals(restoredApprovals)
    } catch {
      // A snapshot is recovery metadata; live events remain authoritative.
    }
  }, [])

  useEffect(() => {
    if (status?.state === 'ready') void refreshCatalog()
  }, [status?.state, refreshCatalog])

  useEffect(() => {
    void refreshStatus()
    let unlisten: (() => void) | undefined
    let disposed = false
    void onEngineEvent((event: EngineEventMsg) => {
      const payload = (event.payload ?? {}) as Record<string, unknown>
      const str = (v: unknown): string => (typeof v === 'string' ? v : '')
      switch (event.event) {
        case 'turn.started': {
          const turnId = str(payload.turn_id)
          const sessionId = str(payload.session_id)
          setSessionBusy(sessionId, true)
          if (!turnMsg.current.has(turnId)) {
            const msgId = nextMsgId()
            turnMsg.current.set(turnId, msgId)
            appendMessage(sessionId, {
              id: msgId,
              role: 'assistant',
              content: '',
              createdAt: Date.now(),
              pending: true,
              turnId,
            })
          }
          updateExecution(turnId, (current) => ({ ...current, sessionId, status: 'thinking' }), sessionId)
          break
        }
        case 'model.started':
          updateExecution(str(payload.turn_id), (current) => ({
            ...current,
            status: 'thinking',
            preparationStage: undefined,
          }), str(payload.session_id))
          break
        case 'turn.preparing':
          updateExecution(str(payload.turn_id), (current) => ({
            ...current,
            status: current.status === 'cancelling' ? current.status : 'thinking',
            preparationStage: str(payload.stage),
          }), str(payload.session_id))
          break
        case 'model.completed':
          break
        case 'model.failed':
          updateExecution(str(payload.turn_id), (current) => ({
            ...current,
            status: current.status === 'cancelling' ? current.status : 'failed',
          }), str(payload.session_id))
          break
        case 'model.content.delta':
          appendDelta(str(payload.turn_id), str(payload.session_id), str(payload.delta))
          break
        case 'turn.completed': {
          const turnId = str(payload.turn_id)
          const sessionId = str(payload.session_id)
          turnMsg.current.delete(turnId)
          finishTurnMessage(turnId, sessionId, str(payload.content))
          setSessionBusy(sessionId, false)
          updateExecution(turnId, (current) => ({
            ...current,
            status: 'completed',
            completedAt: Date.now(),
            tools: current.tools.map((tool) =>
              tool.status === 'running' || tool.status === 'requested' ? { ...tool, status: 'done' } : tool,
            ),
          }), sessionId)
          setApprovals((current) => current.filter((item) => item.turn_id !== turnId))
          void refreshSessions()
          break
        }
        case 'turn.cancelled': {
          const turnId = str(payload.turn_id)
          const sessionId = str(payload.session_id)
          turnMsg.current.delete(turnId)
          finishTurnMessage(turnId, sessionId)
          setSessionBusy(sessionId, false)
          updateExecution(turnId, (current) => ({
            ...current,
            status: 'cancelled',
            completedAt: Date.now(),
            tools: current.tools.map((tool) =>
              tool.status === 'running' || tool.status === 'requested' ? { ...tool, status: 'cancelled' } : tool,
            ),
          }), sessionId)
          setApprovals((current) => current.filter((item) => item.turn_id !== turnId))
          break
        }
        case 'turn.failed': {
          const turnId = str(payload.turn_id)
          const error = payload.error as Record<string, unknown> | null
          turnMsg.current.delete(turnId)
          finishTurnMessage(turnId, str(payload.session_id))
          setSessionBusy(str(payload.session_id), false)
          updateExecution(turnId, (current) => ({
            ...current,
            status: 'failed',
            completedAt: Date.now(),
            error: error ? str(error.message) : 'El turno falló.',
            tools: current.tools.map((tool) =>
              tool.status === 'running' || tool.status === 'requested' ? { ...tool, status: 'failed' } : tool,
            ),
          }), str(payload.session_id))
          setApprovals((current) => current.filter((item) => item.turn_id !== turnId))
          break
        }
        case 'session.mode.changed':
        case 'session.model.changed':
          void refreshSessions()
          break
        case 'approval.requested':
          setApprovals((prev) => [
            ...prev.filter((a) => a.approval_id !== payload.approval_id),
            {
              approval_id: str(payload.approval_id),
              session_id: (payload.session_id as string | null) ?? null,
              turn_id: (payload.turn_id as string | null) ?? null,
              capability: str(payload.capability ?? payload.tool),
              target: (payload.target as string | null) ?? null,
              risk: str(payload.risk),
              description: str(payload.description),
              status: 'pending',
            },
          ])
          updateExecution(str(payload.turn_id), (current) => ({ ...current, status: 'approval' }), str(payload.session_id))
          break
        case 'approval.resolved':
        case 'approval.expired':
          setApprovals((prev) =>
            prev.filter((a) => a.approval_id !== payload.approval_id),
          )
          updateExecution(str(payload.turn_id), (current) => ({
            ...current,
            status: current.status === 'approval' ? 'thinking' : current.status,
          }), str(payload.session_id))
          break
        case 'tool.requested':
        case 'tool.started':
        case 'tool.completed':
        case 'tool.failed':
        case 'tool.cancelled': {
          const sessionId = str(payload.session_id)
          const turnId = str(payload.turn_id)
          const toolId = str(payload.tool_call_id)
          const tool = str(payload.tool)
          if (!sessionId || !turnId || !toolId || !tool) break
          const statuses: Record<string, ToolActivity['status']> = {
            'tool.requested': 'requested',
            'tool.started': 'running',
            'tool.completed': 'done',
            'tool.failed': 'failed',
            'tool.cancelled': 'cancelled',
          }
          const error = payload.error as Record<string, unknown> | null
          updateExecution(turnId, (current) => {
            const nextTool: ToolActivity = {
              id: toolId,
              tool,
              status: statuses[event.event],
              detail: str(payload.arguments ?? payload.result),
              durationMs: typeof payload.duration_ms === 'number' ? payload.duration_ms : undefined,
              error: error ? str(error.message) : undefined,
            }
            const exists = current.tools.some((item) => item.id === toolId)
            return {
              ...current,
              status: event.event === 'tool.started' && current.status !== 'cancelling'
                && !current.completedAt ? 'executing' : current.status,
              tools: exists
                ? current.tools.map((item) => item.id === toolId ? { ...item, ...nextTool } : item)
                : [...current.tools, nextTool],
            }
          }, sessionId)
          break
        }
        default:
          break
      }
    }).then((stop) => {
      // React StrictMode can dispose this effect before listen() resolves.
      // Tear down that late subscription immediately or every delta is seen twice.
      if (disposed) stop()
      else unlisten = stop
    })
    return () => {
      disposed = true
      unlisten?.()
    }
  }, [refreshStatus, refreshSessions, appendDelta, appendMessage, finishTurnMessage, setSessionBusy, updateExecution])

  async function startEngine(): Promise<void> {
    try {
      const next = await engineApi.start()
      setStatus(next)
      if (next.state === 'ready') {
        await refreshSessions()
        await restoreRuntimeSnapshot()
      }
    } catch (err) {
      toast.error(commandMessage(err))
      await refreshStatus()
    }
  }

  async function shutdownEngine(): Promise<void> {
    try {
      setStatus(await engineApi.shutdown())
    } catch (err) {
      toast.error(commandMessage(err))
    }
  }

  async function restartEngine(): Promise<void> {
    try {
      const next = await engineApi.restart()
      setStatus(next)
      if (next.state === 'ready') {
        await refreshSessions()
        await restoreRuntimeSnapshot()
      }
    } catch (err) {
      toast.error(commandMessage(err))
      await refreshStatus()
    }
  }

  async function createSession(): Promise<string | null> {
    try {
      const result = await engineApi.createSession({ chat: true, mode: 'build', permission_profile: 'workspace' })
      await refreshSessions()
      historyLoaded.current.add(result.session.id)
      setActiveSession(result.session.id)
      return result.session.id
    } catch (err) {
      toast.error(commandMessage(err))
      return null
    }
  }

  const loadSessionHistory = useCallback(async (id: string): Promise<void> => {
    if (historyLoaded.current.has(id)) return
    historyLoaded.current.add(id)
    try {
      const history = await engineApi.sessionHistory(id)
      setHistoryInfo((prev) => ({
        ...prev,
        [id]: { total: history.total, hasMore: history.has_more },
      }))
      const persisted = historyToMessages(history.messages)
      setThreads((prev) => {
        // Live protocol messages always win over a later history fetch.
        if ((prev[id]?.length ?? 0) > 0) return prev
        return { ...prev, [id]: persisted }
      })
    } catch (err) {
      historyLoaded.current.delete(id)
      toast.error(commandMessage(err))
    }
  }, [])

  useEffect(() => {
    if (status?.state !== 'ready' || activeSession === '') return
    void loadSessionHistory(activeSession)
  }, [status?.state, activeSession, loadSessionHistory])

  /** Selecciona sesión: reconcile (open) + historial persistente una vez. */
  async function selectSession(id: string): Promise<void> {
    setActiveSession(id)
    try {
      const opened = await engineApi.openSession(id)
      for (const warning of opened.warnings ?? []) toast.warning(warning)
    } catch (err) {
      toast.error(commandMessage(err))
      return
    }
    await loadSessionHistory(id)
  }

  /** Envía: crea sesión si no hay activa, añade el mensaje y abre el turno. */
  async function send(text: string, attachments: AttachmentRef[] = []): Promise<boolean> {
    const trimmed = text.trim()
    if (trimmed === '' || busy) return false
    let sessionId = activeSession
    if (sessionId === '') {
      const created = await createSession()
      if (!created) return false
      sessionId = created
    }
    if (!sessionId) {
      toast.error(t('chat.noSession'))
      return false
    }
    appendMessage(sessionId, {
      id: nextMsgId(),
      role: 'user',
      content: trimmed,
      createdAt: Date.now(),
    })
    setSessionBusy(sessionId, true)
    try {
      const started = await engineApi.startTurn(
        sessionId,
        trimmed,
        reasoningEffort === 'off' ? null : reasoningEffort,
        attachments,
      )
      updateExecution(started.turn_id, (current) => ({ ...current, sessionId, status: 'thinking' }), sessionId)
      return true
    } catch (err) {
      toast.error(commandMessage(err))
      setSessionBusy(sessionId, false)
      return false
    }
  }

  async function cancelTurn(): Promise<void> {
    if (activeSession === '') return
    const sessionId = activeSession
    const active = Object.values(executions).find((item) => item.sessionId === sessionId && !item.completedAt)
    if (active) updateExecution(active.turnId, (current) => ({ ...current, status: 'cancelling' }), sessionId)
    setApprovals((current) => current.filter((item) => item.session_id !== sessionId))
    // A missing terminal event must never strand the composer in Stop mode.
    // The engine normally confirms in milliseconds; this is recovery only.
    window.setTimeout(() => {
      setSessionBusy(sessionId, false)
      if (active) {
        updateExecution(active.turnId, (current) => {
          if (current.completedAt) return current
          return {
            ...current,
            status: 'cancelled',
            completedAt: Date.now(),
            tools: current.tools.map((tool) =>
              tool.status === 'running' || tool.status === 'requested'
                ? { ...tool, status: 'cancelled' }
                : tool,
            ),
          }
        }, sessionId)
      }
    }, 3000)
    try {
      await engineApi.cancelTurn(sessionId)
    } catch (err) {
      toast.error(commandMessage(err))
      setSessionBusy(sessionId, false)
      if (active) {
        updateExecution(active.turnId, (current) => ({
          ...current,
          status: 'cancelled',
          completedAt: Date.now(),
          tools: current.tools.map((tool) =>
            tool.status === 'running' || tool.status === 'requested'
              ? { ...tool, status: 'cancelled' }
              : tool,
          ),
        }), sessionId)
      }
    }
  }

  async function resolveApproval(approvalId: string, decision: string): Promise<void> {
    setApprovals((current) => current.map((item) => item.approval_id === approvalId ? { ...item, status: 'resolving' } : item))
    try {
      const result = await engineApi.resolveApproval(approvalId, decision)
      if (result.status !== 'resolved') {
        setApprovals((current) => current.filter((item) => item.approval_id !== approvalId))
      }
    } catch (err) {
      toast.error(commandMessage(err))
      setApprovals((current) => current.map((item) =>
        item.approval_id === approvalId ? { ...item, status: 'pending' } : item,
      ))
    }
  }

  async function useModel(model: ModelSummary): Promise<void> {
    try {
      let selected = model
      if (model.saved === false) {
        if (!model.provider) throw new Error('Provider missing for discovered model')
        const added = await engineApi.modelAdd({
          provider: model.provider,
          provider_model_id: model.provider_model_id,
          alias: model.provider_model_id,
        })
        selected = added.model
      }
      await engineApi.modelUse(selected.alias, selected.provider ?? undefined)
      if (activeSession) {
        await engineApi.setSessionModel(activeSession, selected.id, selected.provider ?? undefined)
      }
      await refreshCatalog()
      await refreshSessions()
    } catch (err) {
      toast.error(commandMessage(err))
    }
  }

  /** Cambia PLAN/BUILD/REVIEW. Misma sesión, tareas y contexto intactos. */
  async function setMode(mode: string): Promise<void> {
    if (activeSession === '') return
    try {
      await engineApi.setSessionMode(activeSession, mode)
      await refreshSessions()
    } catch (err) {
      toast.error(commandMessage(err))
    }
  }

  async function setPermission(profile: string): Promise<void> {
    if (activeSession === '') return
    try {
      await engineApi.setSessionPermission(activeSession, profile)
      await refreshSessions()
    } catch (err) {
      toast.error(commandMessage(err))
    }
  }

  const searchFiles = useCallback(
    (query: string) => activeSession
      ? engineApi.searchWorkspaceFiles(activeSession, query)
      : Promise.resolve({ root: '', files: [] }),
    [activeSession],
  )

  return {
    status,
    sessions,
    activeSession,
    setActiveSession,
    messages,
    approvals,
    busy,
    reasoningEffort,
    setReasoningEffort,
    ready: status?.state === 'ready',
    refreshStatus,
    refreshSessions,
    startEngine,
    shutdownEngine,
    restartEngine,
    createSession,
    send,
    cancelTurn,
    resolveApproval,
    providers,
    models,
    catalogLoaded,
    sessionsLoaded,
    activeModel: models.find((model) =>
      model.id === sessions.find((session) => session.id === activeSession)?.model_id
    ) ?? models.find((model) => model.active) ?? null,
    refreshCatalog,
    useModel,
    selectSession,
    setMode,
    executions,
    setPermission,
    searchFiles,
    historyInfo,
  }
}

export type EngineSession = ReturnType<typeof useEngineSession>
