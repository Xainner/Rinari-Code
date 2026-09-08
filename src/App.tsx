import { useEffect, useState } from 'react'
import { I18nProvider } from './i18n'
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
            onStartEngine={() => void session.startEngine()}
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
        onEngineStart={() => void session.startEngine()}
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
