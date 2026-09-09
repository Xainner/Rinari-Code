import { useCallback, useEffect, useRef, useState, type Dispatch } from 'react'
import { toast } from 'sonner'
import { commandMessage, engineApi, type SessionDeleteResult, type SessionSummary } from '../../services/engine'
import { historyToMessages } from './history'
import type { TurnRuntimeAction } from './turnRuntime'

/**
 * SessionController: lista de sesiones, sesión activa, historial persistente
 * y mutación de sesión (modo, permiso, crear, seleccionar). Reporta su error
 * por separado para que el shell degrade sin atraparse en el splash.
 */
export function useSessionList(options: {
  dispatch: Dispatch<TurnRuntimeAction>
  engineReady: boolean
}) {
  const { dispatch, engineReady } = options
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [activeSession, setActiveSession] = useState<string>('')
  const [sessionsLoaded, setSessionsLoaded] = useState(false)
  const [sessionsError, setSessionsError] = useState<string | null>(null)
  /** Cerradas: ocultas del listado; abrir una la restaura. */
  const [closedSessions, setClosedSessions] = useState<SessionSummary[]>([])
  /** Total/has_more del historial cargado por sesión. */
  const [historyInfo, setHistoryInfo] = useState<Record<string, { total: number; hasMore: boolean }>>({})
  /** Sesiones con historial ya cargado o hilo vivo (no recargar encima). */
  const historyLoaded = useRef(new Set<string>())

  const refreshSessions = useCallback(async (): Promise<void> => {
    try {
      const result = await engineApi.sessions(undefined, true)
      const normalized = result.sessions.filter((item) => item.state === 'active')
      setSessions(normalized)
      setClosedSessions(result.sessions.filter((item) => item.state !== 'active'))
      setSessionsError(null)
      setActiveSession((current) => {
        if (current !== '' && normalized.some((s) => s.id === current)) return current
        return normalized[0]?.id ?? ''
      })
    } catch (err) {
      setSessionsError(commandMessage(err))
      toast.error(commandMessage(err))
    } finally {
      setSessionsLoaded(true)
    }
  }, [])

  const loadSessionHistory = useCallback(
    async (id: string): Promise<void> => {
      if (historyLoaded.current.has(id)) return
      historyLoaded.current.add(id)
      try {
        const history = await engineApi.sessionHistory(id)
        setHistoryInfo((prev) => ({
          ...prev,
          [id]: { total: history.total, hasMore: history.has_more },
        }))
        const persisted = historyToMessages(history.messages)
        // Lo vivo siempre gana a un fetch de historial que llega tarde.
        dispatch({ type: 'history/loaded', sessionId: id, messages: persisted })
      } catch (err) {
        historyLoaded.current.delete(id)
        toast.error(commandMessage(err))
      }
    },
    [dispatch],
  )

  useEffect(() => {
    if (!engineReady || activeSession === '') return
    void loadSessionHistory(activeSession)
  }, [engineReady, activeSession, loadSessionHistory])

  /** Selecciona sesión: reconcile (open) + historial persistente una vez. */
  const selectSession = useCallback(
    async (id: string): Promise<void> => {
      const previous = activeSession
      setActiveSession(id)
      try {
        const opened = await engineApi.openSession(id)
        for (const warning of opened.warnings ?? []) toast.warning(warning)
      } catch (err) {
        setActiveSession(previous)
        toast.error(commandMessage(err))
        return
      }
      await loadSessionHistory(id)
    },
    [activeSession, loadSessionHistory],
  )

  const createSession = useCallback(async (): Promise<string | null> => {
    try {
      const result = await engineApi.createSession({
        chat: true,
        mode: 'build',
        permission_profile: 'workspace',
      })
      setSessions((current) => [result.session, ...current.filter((item) => item.id !== result.session.id)])
      historyLoaded.current.add(result.session.id)
      setActiveSession(result.session.id)
      void refreshSessions()
      return result.session.id
    } catch (err) {
      toast.error(commandMessage(err))
      return null
    }
  }, [refreshSessions])

  /** Cierra: oculta del listado; volver a abrirla la restaura. */
  const closeSession = useCallback(
    async (id: string): Promise<void> => {
      try {
        await engineApi.closeSession(id)
        await refreshSessions()
      } catch (err) {
        toast.error(commandMessage(err))
      }
    },
    [refreshSessions],
  )

  const renameSession = useCallback(async (id: string, title: string): Promise<void> => {
    try {
      await engineApi.renameSession(id, title)
      await refreshSessions()
    } catch (err) {
      toast.error(commandMessage(err))
    }
  }, [refreshSessions])

  const archiveSession = useCallback(async (id: string): Promise<void> => {
    try {
      await engineApi.archiveSession(id)
      await refreshSessions()
    } catch (err) {
      toast.error(commandMessage(err))
    }
  }, [refreshSessions])

  const forkSession = useCallback(async (id: string): Promise<string | null> => {
    try {
      const result = await engineApi.forkSession(id)
      await refreshSessions()
      setActiveSession(result.session.id)
      return result.session.id
    } catch (err) {
      toast.error(commandMessage(err))
      return null
    }
  }, [refreshSessions])

  /** Eliminación permanente con cascada explícita del engine. */
  const deleteSession = useCallback(
    async (id: string, cascade: boolean): Promise<SessionDeleteResult | null> => {
      try {
        const result = await engineApi.deleteSession(id, cascade)
        await refreshSessions()
        return result
      } catch (err) {
        toast.error(commandMessage(err))
        return null
      }
    },
    [refreshSessions],
  )

  /** Cambia PLAN/BUILD/REVIEW. Misma sesión, tareas y contexto intactos. */
  const setMode = useCallback(
    async (mode: string): Promise<void> => {
      if (activeSession === '') return
      try {
        await engineApi.setSessionMode(activeSession, mode)
        await refreshSessions()
      } catch (err) {
        toast.error(commandMessage(err))
      }
    },
    [activeSession, refreshSessions],
  )

  const setPermission = useCallback(
    async (profile: string): Promise<void> => {
      if (activeSession === '') return
      try {
        await engineApi.setSessionPermission(activeSession, profile)
        await refreshSessions()
      } catch (err) {
        toast.error(commandMessage(err))
      }
    },
    [activeSession, refreshSessions],
  )

  const searchFiles = useCallback(
    (query: string) =>
      activeSession
        ? engineApi.searchWorkspaceFiles(activeSession, query)
        : Promise.resolve({ root: '', files: [] }),
    [activeSession],
  )

  return {
    sessions,
    activeSession,
    setActiveSession,
    sessionsLoaded,
    sessionsError,
    historyInfo,
    closedSessions,
    refreshSessions,
    loadSessionHistory,
    selectSession,
    createSession,
    closeSession,
    renameSession,
    archiveSession,
    forkSession,
    deleteSession,
    setMode,
    setPermission,
    searchFiles,
  }
}

export type SessionList = ReturnType<typeof useSessionList>
