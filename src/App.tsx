import { useEffect } from 'react'
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
  const goSettings = useUIStore((s) => s.goSettings)
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggleSidebarCollapsed = useUIStore((s) => s.toggleSidebarCollapsed)
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen)

  const session = useEngineSession()
  const activeTitle =
    session.sessions.find((s) => s.id === session.activeSession)?.title ?? null

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
              session.setActiveSession(id)
              goChat()
            }}
            onNewSession={() => void session.createSession().then(() => goChat())}
            onOpenSettings={() => goSettings()}
            onOpenEngine={goEngine}
            onStartEngine={() => void session.startEngine()}
            onResolveApproval={(id, decision) => void session.resolveApproval(id, decision)}
          />
        }
        header={
          view === 'chat' ? (
            <ChatHeader
              title={activeTitle}
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
          />
        )}
        {view === 'engine' && <EngineConsole session={session} />}
        {view === 'settings' && <SettingsView appVersion={APP_VERSION} />}
      </AppShell>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        sessions={session.sessions}
        activeId={session.activeSession || null}
        onSelectSession={(id) => {
          session.setActiveSession(id)
          goChat()
        }}
        onNewSession={() => void session.createSession().then(() => goChat())}
        onOpenSettings={(section) => goSettings(section)}
        onOpenEngine={goEngine}
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
