import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useI18n } from '../../i18n'
import { commandMessage, engineApi, type ModelSummary } from '../../services/engine'
import type { AttachmentRef } from '../../types'
import { createMessageId } from './turnRuntime'
import { useCatalog } from './useCatalog'
import { useEngineConnection } from './useEngineConnection'
import { useProjects } from '../projects/useProjects'
import { useSessionList } from './useSessionList'
import { useTurnRuntime } from './useTurnRuntime'

/**
 * Composición del estado de engine. Cada dominio vive en su hook:
 * conexión, sesiones, runtime de turnos (reducer) y catálogo. Aquí solo
 * queda la orquestación entre dominios (arranque, envío, modelo) con la
 * misma forma de retorno que consumen App y EngineConsole.
 */
export function useEngineSession() {
  const { t } = useI18n()
  const [reasoningEffort, setReasoningEffort] = useState<'off' | 'low' | 'medium' | 'high'>('off')

  const connection = useEngineConnection()
  // El runtime avisa (turn.completed, mode/model changed) y eso refresca la
  // lista de sesiones. El ref evita la dependencia circular en construcción:
  // sessions necesita dispatch y runtime necesita el refresh de sessions.
  const sessionsChangedRef = useRef<() => void>(() => {})
  const runtime = useTurnRuntime({ onSessionsChanged: () => sessionsChangedRef.current() })
  const sessions = useSessionList({ dispatch: runtime.dispatch, engineReady: connection.ready })
  const projects = useProjects({ engineReady: connection.ready })
  const catalog = useCatalog()

  useEffect(() => {
    sessionsChangedRef.current = sessions.refreshSessions
  }, [sessions.refreshSessions])

  useEffect(() => {
    if (connection.ready) void catalog.refreshCatalog(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection.ready])

  const activeRecord = sessions.sessions.find((session) => session.id === sessions.activeSession)
  const activeProjectRoot =
    activeRecord?.kind === 'PROJECT' ? (activeRecord.project_root ?? null) : null

  /** Git vivo: una consulta deduplicada únicamente cuando cambia la raíz activa. */
  useEffect(() => {
    if (connection.ready && activeProjectRoot) void projects.loadStatus(activeProjectRoot)
  }, [activeProjectRoot, connection.ready, projects.loadStatus])

  async function startEngine(): Promise<void> {
    const next = await connection.start()
    if (next?.state === 'ready') {
      await sessions.refreshSessions()
      await runtime.restoreSnapshot()
    }
  }

  async function restartEngine(): Promise<void> {
    const next = await connection.restart()
    if (next?.state === 'ready') {
      await sessions.refreshSessions()
      await runtime.restoreSnapshot()
    }
  }

  async function shutdownEngine(): Promise<void> {
    await connection.shutdown()
  }

  /** Envía: crea sesión si no hay activa, añade el mensaje y abre el turno. */
  async function send(text: string, attachments: AttachmentRef[] = []): Promise<boolean> {
    const trimmed = text.trim()
    const currentId = sessions.activeSession
    const busy = currentId !== '' && runtime.busySessions.has(currentId)
    if (trimmed === '' || busy) return false
    let sessionId = currentId
    if (sessionId === '') {
      const created = await sessions.createSession()
      if (!created) return false
      sessionId = created
    }
    if (!sessionId) {
      toast.error(t('chat.noSession'))
      return false
    }
    runtime.dispatch({
      type: 'turn/message-sent',
      sessionId,
      message: { id: createMessageId(), role: 'user', content: trimmed, createdAt: Date.now() },
    })
    runtime.dispatch({ type: 'turn/busy-set', sessionId, busy: true })
    try {
      const started = await engineApi.startTurn(
        sessionId,
        trimmed,
        reasoningEffort === 'off' ? null : reasoningEffort,
        attachments,
      )
      runtime.dispatch({ type: 'turn/started-ack', turnId: started.turn_id, sessionId, now: Date.now() })
      return true
    } catch (err) {
      toast.error(commandMessage(err))
      runtime.dispatch({ type: 'turn/busy-set', sessionId, busy: false })
      return false
    }
  }

  async function cancelTurn(): Promise<void> {
    await runtime.cancelTurn(sessions.activeSession)
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
      if (sessions.activeSession) {
        await engineApi.setSessionModel(sessions.activeSession, selected.id, selected.provider ?? undefined)
      }
      await catalog.refreshCatalog()
      await sessions.refreshSessions()
    } catch (err) {
      toast.error(commandMessage(err))
    }
  }

  const messages =
    sessions.activeSession !== '' ? (runtime.threads[sessions.activeSession] ?? []) : []
  const busy = sessions.activeSession !== '' && runtime.busySessions.has(sessions.activeSession)
  const activeGitStatus = activeProjectRoot ? (projects.statusByRoot[activeProjectRoot] ?? null) : null
  const activeGitError = activeProjectRoot
    ? (projects.statusErrorByRoot[activeProjectRoot] ?? null)
    : null

  return {
    status: connection.status,
    sessions: sessions.sessions,
    activeSession: sessions.activeSession,
    setActiveSession: sessions.setActiveSession,
    messages,
    approvals: runtime.approvals,
    busy,
    reasoningEffort,
    setReasoningEffort,
    ready: connection.ready,
    refreshStatus: connection.refreshStatus,
    refreshSessions: sessions.refreshSessions,
    startEngine,
    shutdownEngine,
    restartEngine,
    createSession: sessions.createSession,
    send,
    cancelTurn,
    resolveApproval: runtime.resolveApproval,
    providers: catalog.providers,
    models: catalog.models,
    catalogLoaded: catalog.catalogLoaded,
    sessionsLoaded: sessions.sessionsLoaded,
    sessionsError: sessions.sessionsError,
    catalogError: catalog.catalogError,
    activeModel:
      catalog.models.find(
        (model) => model.id === sessions.sessions.find((session) => session.id === sessions.activeSession)?.model_id,
      ) ??
      catalog.models.find((model) => model.active) ??
      null,
    refreshCatalog: catalog.refreshCatalog,
    discoverCatalog: catalog.discoverCatalog,
    useModel,
    selectSession: sessions.selectSession,
    setMode: sessions.setMode,
    executions: runtime.executions,
    setPermission: sessions.setPermission,
    searchFiles: sessions.searchFiles,
    historyInfo: sessions.historyInfo,
    closedSessions: sessions.closedSessions,
    archivedSessions: sessions.archivedSessions,
    closeSession: sessions.closeSession,
    renameSession: sessions.renameSession,
    archiveSession: sessions.archiveSession,
    restoreSession: sessions.restoreSession,
    forkSession: sessions.forkSession,
    deleteSession: sessions.deleteSession,
    projects: projects.projects,
    archivedProjects: projects.archivedProjects,
    projectsError: projects.projectsError,
    refreshProjects: projects.refreshProjects,
    openProject: projects.openProject,
    updateProject: projects.updateProject,
    removeProject: projects.removeProject,
    loadProjectStatus: projects.loadStatus,
    loadProjectIntelligence: projects.loadIntelligence,
    trustProject: projects.trustProject,
    projectStatusByRoot: projects.statusByRoot,
    projectStatusErrorByRoot: projects.statusErrorByRoot,
    projectIntelByRoot: projects.intelByRoot,
    activeProjectRoot,
    activeGitStatus,
    activeGitError,
  }
}

export type EngineSession = ReturnType<typeof useEngineSession>
