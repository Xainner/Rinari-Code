import { useEffect, useRef, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import { open as openFolderDialog } from '@tauri-apps/plugin-dialog'
import { toast } from 'sonner'
import { I18nProvider, translate, type I18nKey } from './i18n'
import { engineApi } from './services/engine'
import { checkForUpdates, installUpdateAndRelaunch } from './services/updates'
import { useUIStore } from './stores/ui'
import { useEngineSession } from './features/engine/useEngineSession'
import AppShell from './components/app-shell/AppShell'
import AppSidebar from './components/app-shell/AppSidebar'
import ChatHeader from './components/app-shell/ChatHeader'
import ChatView from './components/ChatView'
import CommandPalette from './components/CommandPalette'
import EngineConsole from './features/engine/EngineConsole'
import SettingsView from './features/settings/SettingsView'
import WorkspaceView from './features/workspace/WorkspaceView'
import ProjectHome from './features/projects/ProjectHome'
import ProviderWizard from './features/providers/ProviderWizard'
import StartupSplash from './components/StartupSplash'

const APP_VERSION = '0.1.1'

function App() {
  const view = useUIStore((s) => s.view)
  const lang = useUIStore((s) => s.lang)
  const setLang = useUIStore((s) => s.setLang)
  const theme = useUIStore((s) => s.theme)
  const setTheme = useUIStore((s) => s.setTheme)
  const paletteOpen = useUIStore((s) => s.paletteOpen)
  const setPaletteOpen = useUIStore((s) => s.setPaletteOpen)
  const togglePalette = useUIStore((s) => s.togglePalette)
  const goChat = useUIStore((s) => s.goChat)
  const goEngine = useUIStore((s) => s.goEngine)
  const goWorkspace = useUIStore((s) => s.goWorkspace)
  const goProject = useUIStore((s) => s.goProject)
  const projectRoot = useUIStore((s) => s.projectRoot)
  const goSettings = useUIStore((s) => s.goSettings)
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggleSidebarCollapsed = useUIStore((s) => s.toggleSidebarCollapsed)
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen)

  const session = useEngineSession()
  const activeRecord =
    session.sessions.find((s) => s.id === session.activeSession) ?? null
  const activeTitle = activeRecord?.title ?? null

  // Handoff `rinari code [path] [--session]`: misma sesión/proyecto.
  // Con path: project.open registra/deduplica y devuelve la sesión
  // recomendada del engine (nunca se inventa una paralela en Code).
  async function handleOpenProjectPath(path: string): Promise<boolean> {
    const opened = await session.openProject(path)
    if (!opened) return false
    await session.refreshSessions()
    await session.refreshProjects()
    await session.selectSession(opened.session.id)
    return true
  }

  async function handleDeleteSession(id: string, cascade: boolean): Promise<void> {
    const result = await session.deleteSession(id, cascade)
    if (!result) return
    const c = result.cascade
    if (cascade && c.queue_dropped + c.checkpoints_removed + c.artifacts_removed > 0) {
      toast.success(
        translate(lang, 'sidebar.deletedCascade', {
          queue: c.queue_dropped,
          checkpoints: c.checkpoints_removed,
          artifacts: c.artifacts_removed,
        }),
      )
    } else {
      toast.success(translate(lang, 'sidebar.deleted'))
    }
    void session.refreshProjects()
  }

  useEffect(() => {
    async function handleOpen(request: { project: string | null; session: string | null }) {
      try {
        if (request.session) {
          await session.selectSession(request.session)
          goChat()
          return
        }
        if (request.project) {
          if (await handleOpenProjectPath(request.project)) goChat()
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err))
      }
    }
    let unlisten: (() => void) | undefined
    void engineApi
      .initialOpenRequest()
      .then((request) => {
        if (request.project || request.session) void handleOpen(request)
      })
      .catch(() => {})
    void listen<{ project: string | null; session: string | null }>(
      'rinari-open-request',
      (wrapper) => void handleOpen(wrapper.payload),
    ).then((stop) => {
      unlisten = stop
    })
    return () => unlisten?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // El motor arranca solo al abrir la app: Rinari nunca parece "apagado".
  // El footer + EngineConsole conservan el estado real y el reintento.
  const autoStarted = useRef(false)
  useEffect(() => {
    if (!autoStarted.current) {
      autoStarted.current = true
      void session.startEngine()
      // Auto-update silencioso estilo Hermes: solo avisa si hay versión.
      // App vive fuera del I18nProvider: se usa translate() con el idioma actual.
      const tr = (key: I18nKey, vars?: Record<string, string | number>) =>
        translate(lang, key, vars)
      void checkForUpdates()
        .then((found) => {
          if (!found) return
          toast(tr('update.available', { v: found.version }), {
            action: {
              label: tr('update.install'),
              onClick: () => {
                toast.loading(tr('update.installing'))
                void installUpdateAndRelaunch().catch((err: unknown) =>
                  toast.error(
                    tr('update.failed', {
                      detail: err instanceof Error ? err.message : String(err),
                    }),
                  ),
                )
              },
            },
          })
        })
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Alta guiada: motor listo, catálogo sano y sin proveedores → wizard una vez.
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardSnoozed, setWizardSnoozed] = useState(false)
  useEffect(() => {
    if (
      session.ready &&
      session.catalogLoaded &&
      !session.catalogError &&
      session.providers.length === 0 &&
      !wizardSnoozed
    ) {
      setWizardOpen(true)
    }
  }, [session.ready, session.catalogLoaded, session.catalogError, session.providers.length, wizardSnoozed])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        togglePalette()
      }
      if (mod && e.key === ',') {
        e.preventDefault()
        goSettings()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePalette, goSettings])

  // El shell abre cuando el engine está usable. Sesiones y catálogo son
  // subsistemas independientes: si fallan, se degradan con retry local.
  const startupReady = session.ready
  if (!startupReady) {
    return (
      <I18nProvider lang={lang}>
        <StartupSplash
          failed={session.status?.state === 'failed' || session.status?.state === 'degraded'}
          detail={session.status?.detail}
          state={session.status?.state ?? null}
          onRetry={() => void session.restartEngine()}
        />
      </I18nProvider>
    )
  }

  const degradedDetail = session.sessionsError ?? session.catalogError
  const degradedKey =
    session.sessionsError !== null ? 'startup.sessionsDegraded' : 'startup.catalogDegraded'

  return (
    <I18nProvider lang={lang}>
      <AppShell
        banner={degradedDetail !== null && (
          <div
            role="alert"
            className="flex items-center gap-3 border-b border-amber-400/30 bg-amber-400/10 px-4 py-1.5 text-xs text-[var(--text)]"
          >
            <span className="min-w-0 flex-1 truncate">
              {translate(lang, degradedKey, { detail: degradedDetail ?? '' })}
            </span>
            <button
              type="button"
              onClick={() => {
                void session.refreshSessions()
                void session.refreshCatalog()
              }}
              className="shrink-0 rounded-full border border-[var(--border)] px-3 py-0.5 transition-colors hover:border-[var(--accent)]/50"
            >
              {translate(lang, 'startup.retry')}
            </button>
          </div>
        )}
        sidebar={
          <AppSidebar
            collapsed={sidebarCollapsed}
            onToggleCollapse={toggleSidebarCollapsed}
            onSearch={() => setPaletteOpen(true)}
            onOpenSettings={() => goSettings()}
            onOpenEngine={goEngine}
            onOpenProjectHome={
              session.activeProjectRoot ? () => goProject(session.activeProjectRoot as string) : null
            }
            onNewChat={() => void session.createSession().then(() => goChat())}
            onOpenFolder={() =>
              void openFolderDialog({ directory: true }).then((picked) => {
                if (typeof picked === 'string') void handleOpenProjectPath(picked).then((ok) => ok && goChat())
              })
            }
            sessions={session.sessions}
            closedSessions={session.closedSessions}
            projects={session.projects}
            activeId={session.activeSession}
            onSelectSession={(id) => {
              void session.selectSession(id)
              goChat()
            }}
            onOpenProject={(root) => goProject(root)}
            onCloseSession={(id) => void session.closeSession(id)}
            onDeleteSession={(id, cascade) => void handleDeleteSession(id, cascade)}
            approvals={session.approvals}
          />
        }
        header={
          view === 'chat' ? (
            <ChatHeader
              title={activeTitle}
              kind={activeRecord?.kind ?? null}
              mode={activeRecord?.mode ?? null}
              projectRoot={session.activeProjectRoot}
              projectName={session.activeProjectRoot}
              git={
                session.activeGitStatus?.status.available
                  ? {
                      branch: session.activeGitStatus.status.branch,
                      dirty: session.activeGitStatus.status.dirty,
                      changed: session.activeGitStatus.status.files.length,
                    }
                  : null
              }
              gitMissing={session.activeGitError !== null}
              onOpenProject={
                session.activeProjectRoot
                  ? () => goProject(session.activeProjectRoot as string)
                  : null
              }
              onOpenMobileSidebar={() => setSidebarOpen(true)}
              onExpandSidebar={toggleSidebarCollapsed}
              sidebarCollapsed={sidebarCollapsed}
            />
          ) : (
            <></>
          )
        }
      >
        {view === 'chat' && (
          <ChatView
            messages={session.messages}
            isStreaming={session.busy}
            engineReady={session.ready}
            onSend={session.send}
            onStop={() => void session.cancelTurn()}
            onOpenProviders={() => goSettings('providers')}
            models={session.models}
            activeAlias={session.activeModel?.alias ?? null}
            onUseModel={(model) => void session.useModel(model)}
            sessionMode={activeRecord?.mode ?? null}
            onModeChange={(mode) => void session.setMode(mode)}
            reasoningEffort={session.reasoningEffort}
            onReasoningChange={session.setReasoningEffort}
            executions={session.executions}
            approvals={session.approvals}
            onResolveApproval={(id, decision) => void session.resolveApproval(id, decision)}
            permissionProfile={activeRecord?.permission_profile ?? 'workspace'}
            effectivePermissionProfile={activeRecord?.effective_permission_profile ?? 'workspace'}
            onPermissionChange={(profile) => void session.setPermission(profile)}
            onSearchFiles={session.searchFiles}
            historyNote={
              session.activeSession !== ''
                ? (session.historyInfo[session.activeSession] ?? null)
                : null
            }
          />
        )}
        {view === 'engine' && <EngineConsole session={session} />}
        {view === 'workspace' && (
          <WorkspaceView session={activeRecord} onBack={goChat} />
        )}
        {view === 'project' && projectRoot !== null && (
          <ProjectHome
            root={projectRoot}
            project={session.projects.find((p) => p.root === projectRoot) ?? null}
            sessions={session.sessions.filter((s) => {
              const projectId = session.projects.find((p) => p.root === projectRoot)?.id ?? null
              return (projectId !== null && s.project_id === projectId) || s.project_root === projectRoot
            })}
            activeId={session.activeSession}
            status={session.projectStatusByRoot[projectRoot] ?? null}
            statusError={session.projectStatusErrorByRoot[projectRoot] ?? null}
            intel={session.projectIntelByRoot[projectRoot] ?? null}
            onBack={goChat}
            onSelectSession={(id) => {
              void session.selectSession(id)
              goChat()
            }}
            onNewSession={() =>
              void engineApi
                .createSession({ cwd: projectRoot })
                .then(async (created) => {
                  await session.refreshSessions()
                  await session.selectSession(created.session.id)
                  goChat()
                })
                .catch((err: unknown) =>
                  toast.error(err instanceof Error ? err.message : String(err)),
                )
            }
            onEnsure={() => {
              void session.loadProjectStatus(projectRoot)
              if (!session.projectIntelByRoot[projectRoot]) {
                void session.loadProjectIntelligence(projectRoot)
              }
            }}
          />
        )}
        {view === 'settings' && (
          <SettingsView
            appVersion={APP_VERSION}
            providers={session.providers}
            models={session.models}
            activeSessionId={session.activeSession || null}
            onCatalogChanged={() => void session.refreshCatalog()}
          />
        )}
      </AppShell>

      <ProviderWizard
        open={wizardOpen}
        onClose={(finished) => {
          setWizardOpen(false)
          if (finished) {
            void session.refreshCatalog().then(() => session.refreshSessions())
          } else {
            setWizardSnoozed(true)
          }
        }}
      />

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        sessions={session.sessions}
        activeId={session.activeSession || null}
        onSelectSession={(id) => {
          void session.selectSession(id)
          goChat()
        }}
        onNewSession={() => void session.createSession().then(() => goChat())}
        onOpenSettings={(section) => goSettings(section)}
        onOpenEngine={goEngine}
        onOpenWorkspace={goWorkspace}
        onEngineRestart={() => void session.restartEngine()}
        theme={theme}
        onThemeChange={setTheme}
        lang={lang}
        onLanguageChange={setLang}
      />
    </I18nProvider>
  )
}

export default App
