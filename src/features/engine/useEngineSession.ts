import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  commandMessage,
  engineApi,
  onEngineEvent,
  type EngineEventMsg,
  type EngineStatus,
  type SessionSummary,
} from '../../services/engine'
import type { ChatMessage, PendingApproval } from '../../types'

let msgKey = 0
function nextMsgId(): string {
  msgKey += 1
  return `msg_${Date.now().toString(36)}_${msgKey}`
}

/**
 * Sesión de chat contra el engine: estado, sesiones, hilos de mensajes por
 * sesión (solo memoria de esta corrida; el historial persistente llega con
 * session.get en Fase 4), aprobaciones y streaming de deltas.
 */
export function useEngineSession() {
  const [status, setStatus] = useState<EngineStatus | null>(null)
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [activeSession, setActiveSession] = useState<string>('')
  const [threads, setThreads] = useState<Record<string, ChatMessage[]>>({})
  const [approvals, setApprovals] = useState<PendingApproval[]>([])
  const [busy, setBusy] = useState<boolean>(false)
  /** turn_id -> id de mensaje assistant que acumula sus deltas. */
  const turnMsg = useRef(new Map<string, string>())

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
      setActiveSession(result.session.id)
      return result.session.id
    } catch (err) {
      toast.error(commandMessage(err))
      return null
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
  }
}

export type EngineSession = ReturnType<typeof useEngineSession>
