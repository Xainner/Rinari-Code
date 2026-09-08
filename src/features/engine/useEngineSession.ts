import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
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
import type { ChatMessage, PendingApproval, ToolActivity } from '../../types'

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
  const [status, setStatus] = useState<EngineStatus | null>(null)
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [activeSession, setActiveSession] = useState<string>('')
  const [threads, setThreads] = useState<Record<string, ChatMessage[]>>({})
  const [approvals, setApprovals] = useState<PendingApproval[]>([])
  const [busy, setBusy] = useState<boolean>(false)
  const [providers, setProviders] = useState<ProviderSummary[]>([])
  const [models, setModels] = useState<ModelSummary[]>([])
  /** tool.* por sesión, últimas 30. */
  const [activity, setActivity] = useState<Record<string, ToolActivity[]>>({})
  /** Total/has_more del historial cargado por sesión. */
  const [historyInfo, setHistoryInfo] = useState<
    Record<string, { total: number; hasMore: boolean }>
  >({})
  /** turn_id -> id de mensaje assistant que acumula sus deltas. */
  const turnMsg = useRef(new Map<string, string>())
  /** Sesiones con historial ya cargado o hilo vivo (no recargar encima). */
  const historyLoaded = useRef(new Set<string>())

  const messages = activeSession !== '' ? (threads[activeSession] ?? []) : []

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
        })
      }
      const target = msgId
      setThreads((prev) => ({
        ...prev,
        [sessionId]: (prev[sessionId] ?? []).map((m) =>
          m.id === target ? { ...m, content: m.content + delta } : m,
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
      setSessions(result.sessions)
      setActiveSession((current) => {
        if (current !== '' && result.sessions.some((s) => s.id === current)) return current
        return result.sessions[0]?.id ?? ''
      })
    } catch (err) {
      toast.error(commandMessage(err))
    }
  }, [])

  const refreshCatalog = useCallback(async () => {
    try {
      const [p, m] = await Promise.all([engineApi.providerList(), engineApi.modelList()])
      setProviders(p.providers)
      setModels(m.models)
    } catch (err) {
      toast.error(commandMessage(err))
    }
  }, [])

  useEffect(() => {
    if (status?.state === 'ready') void refreshCatalog()
  }, [status?.state, refreshCatalog])

  useEffect(() => {
    void refreshStatus()
    let unlisten: (() => void) | undefined
    void onEngineEvent((event: EngineEventMsg) => {
      const payload = (event.payload ?? {}) as Record<string, unknown>
      const str = (v: unknown): string => (typeof v === 'string' ? v : '')
      switch (event.event) {
        case 'turn.started':
          setBusy(true)
          break
        case 'model.content.delta':
          appendDelta(str(payload.turn_id), str(payload.session_id), str(payload.delta))
          break
        case 'turn.completed':
          turnMsg.current.delete(str(payload.turn_id))
          setBusy(false)
          void refreshSessions()
          break
        case 'turn.cancelled':
          turnMsg.current.delete(str(payload.turn_id))
          setBusy(false)
          break
        case 'turn.failed': {
          const turnId = str(payload.turn_id)
          turnMsg.current.delete(turnId)
          setBusy(false)
          appendMessage(str(payload.session_id), {
            id: nextMsgId(),
            role: 'assistant',
            content: `Error: ${commandMessage(payload.error)}`,
            createdAt: Date.now(),
          })
          break
        }
        case 'approval.requested':
          setApprovals((prev) => [
            ...prev.filter((a) => a.approval_id !== payload.approval_id),
            {
              approval_id: str(payload.approval_id),
              session_id: (payload.session_id as string | null) ?? null,
              capability: str(payload.capability ?? payload.tool),
              target: (payload.target as string | null) ?? null,
              risk: str(payload.risk),
              description: str(payload.description),
            },
          ])
          break
        case 'approval.resolved':
        case 'approval.expired':
          setApprovals((prev) =>
            prev.filter((a) => a.approval_id !== payload.approval_id),
          )
          break
        case 'tool.started':
        case 'tool.completed': {
          const sessionId = str(payload.session_id)
          const tool = str(payload.tool)
          if (sessionId === '' || tool === '') break
          setActivity((prev) => {
            const list = [...(prev[sessionId] ?? [])]
            let next: ToolActivity[]
            if (event.event === 'tool.started') {
              next = [...list, { tool, status: 'running' as const }]
            } else {
              const idx = list
                .map((a) => a.tool === tool && a.status === 'running')
                .lastIndexOf(true)
              next =
                idx < 0
                  ? [...list, { tool, status: 'done' as const }]
                  : list.map((a, i) =>
                      i === idx ? { ...a, status: 'done' as const } : a,
                    )
            }
            return { ...prev, [sessionId]: next.slice(-30) }
          })
          break
        }
        default:
          break
      }
    }).then((stop) => {
      unlisten = stop
    })
    return () => unlisten?.()
  }, [refreshStatus, refreshSessions, appendDelta, appendMessage])

  async function startEngine(): Promise<void> {
    try {
      const next = await engineApi.start()
      setStatus(next)
      if (next.state === 'ready') await refreshSessions()
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
      if (next.state === 'ready') await refreshSessions()
    } catch (err) {
      toast.error(commandMessage(err))
      await refreshStatus()
    }
  }

  async function createSession(): Promise<string | null> {
    try {
      const result = await engineApi.createSession({ chat: true })
      await refreshSessions()
      historyLoaded.current.add(result.session.id)
      setActiveSession(result.session.id)
      return result.session.id
    } catch (err) {
      toast.error(commandMessage(err))
      return null
    }
  }

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
    if (historyLoaded.current.has(id)) return
    historyLoaded.current.add(id)
    try {
      const history = await engineApi.sessionHistory(id)
      setHistoryInfo((prev) => ({
        ...prev,
        [id]: { total: history.total, hasMore: history.has_more },
      }))
      const messages = historyToMessages(history.messages)
      setThreads((prev) => {
        if ((prev[id]?.length ?? 0) > 0) return prev
        return { ...prev, [id]: messages }
      })
    } catch (err) {
      historyLoaded.current.delete(id)
      toast.error(commandMessage(err))
    }
  }

  /** Envía: crea sesión si no hay activa, añade el mensaje y abre el turno. */
  async function send(text: string): Promise<boolean> {
    const trimmed = text.trim()
    if (trimmed === '' || busy) return false
    let sessionId = activeSession
    if (sessionId === '') {
      const created = await createSession()
      if (!created) return false
      sessionId = created
    }
    appendMessage(sessionId, {
      id: nextMsgId(),
      role: 'user',
      content: trimmed,
      createdAt: Date.now(),
    })
    setBusy(true)
    try {
      await engineApi.startTurn(sessionId, trimmed)
      return true
    } catch (err) {
      toast.error(commandMessage(err))
      setBusy(false)
      return false
    }
  }

  async function cancelTurn(): Promise<void> {
    if (activeSession === '') return
    try {
      await engineApi.cancelTurn(activeSession)
    } catch (err) {
      toast.error(commandMessage(err))
    }
  }

  async function resolveApproval(approvalId: string, decision: string): Promise<void> {
    try {
      await engineApi.resolveApproval(approvalId, decision)
    } catch (err) {
      toast.error(commandMessage(err))
    }
  }

  async function useModel(alias: string): Promise<void> {
    try {
      await engineApi.modelUse(alias)
      await refreshCatalog()
    } catch (err) {
      toast.error(commandMessage(err))
    }
  }

  return {
    status,
    sessions,
    activeSession,
    setActiveSession,
    messages,
    approvals,
    busy,
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
    activeModel: models.find((m) => m.active) ?? null,
    refreshCatalog,
    useModel,
    selectSession,
    activity,
    historyInfo,
  }
}

export type EngineSession = ReturnType<typeof useEngineSession>
