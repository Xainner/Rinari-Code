import { useEffect, useRef, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import { toast } from 'sonner'
import { I18nProvider } from './i18n'
import { engineApi } from './services/engine'
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
import ProviderWizard from './features/providers/ProviderWizard'

const APP_VERSION = '0.1.0'

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
  const goSettings = useUIStore((s) => s.goSettings)
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggleSidebarCollapsed = useUIStore((s) => s.toggleSidebarCollapsed)
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen)

  const session = useEngineSession()
  const activeRecord =
    session.sessions.find((s) => s.id === session.activeSession) ?? null
  const activeTitle = activeRecord?.title ?? null

  // Handoff `rinari code [path] [--session]`: misma sesión/proyecto.
  useEffect(() => {
    async function handleOpen(request: { project: string | null; session: string | null }) {
      try {
        if (request.session) {
          await session.selectSession(request.session)
          goChat()
          return
        }
        if (request.project) {
          const match = session.sessions.find(
            (s) => s.project_root === request.project || s.current_cwd === request.project,
          )
          if (match) {
            await session.selectSession(match.id)
          } else {
            const created = await engineApi.createSession({ cwd: request.project ?? undefined })
            await session.selectSession(created.session.id)
          }
          goChat()
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Alta guiada: motor listo y sin proveedores → abrir el wizard una vez.
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardSnoozed, setWizardSnoozed] = useState(false)
  useEffect(() => {
    if (session.ready && session.providers.length === 0 && !wizardSnoozed) {
      setWizardOpen(true)
    }
  }, [session.ready, session.providers.length, wizardSnoozed])

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

  return (
    <I18nProvider lang={lang}>
      <AppShell
        sidebar={
          <AppSidebar
            sessions={session.sessions}
            activeId={session.activeSession || null}
            engine={session.status}
            approvals={session.approvals}
            collapsed={sidebarCollapsed}
            onToggleCollapse={toggleSidebarCollapsed}
            onSearch={() => setPaletteOpen(true)}
            onSelectSession={(id) => {
              void session.selectSession(id)
              goChat()
            }}
            onNewSession={() => void session.createSession().then(() => goChat())}
            onOpenSettings={() => goSettings()}
            onOpenEngine={goEngine}
            onOpenWorkspace={goWorkspace}
            onResolveApproval={(id, decision) => void session.resolveApproval(id, decision)}
          />
        }
        header={
          view === 'chat' ? (
            <ChatHeader
              title={activeTitle}
              kind={activeRecord?.kind ?? null}
              mode={activeRecord?.mode ?? null}
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
            sessionId={session.activeSession || null}
            messages={session.messages}
            isStreaming={session.busy}
            engineReady={session.ready}
            onSend={session.send}
            onStop={() => void session.cancelTurn()}
            onOpenProviders={() => goSettings('providers')}
            models={session.models}
            activeAlias={session.activeModel?.alias ?? null}
            onUseModel={(alias) => void session.useModel(alias)}
            sessionMode={activeRecord?.mode ?? null}
            onModeChange={(mode) => void session.setMode(mode)}
            activity={
              session.activeSession !== ''
                ? (session.activity[session.activeSession] ?? [])
                : []
            }
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
