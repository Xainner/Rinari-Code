import { useI18n } from '../../i18n'
import { useUIStore } from '../../stores/ui'
import type { ModelSummary, ProviderSummary } from '../../services/engine'
import SettingsShell from '../../components/settings/SettingsShell'
import GeneralSettings from '../../components/settings/GeneralSettings'
import AppearanceSettings from '../../components/settings/AppearanceSettings'
import AboutSettings from '../../components/settings/AboutSettings'
import SoonSettings from '../../components/settings/SoonSettings'
import ProvidersView from '../providers/ProvidersView'
import ModelsView from '../providers/ModelsView'
import AgentsView from '../agents/AgentsView'

/** Vista de ajustes: shell + sección activa. Soul/MCP llegan en Fases 8–9. */
export default function SettingsView({
  appVersion,
  providers,
  models,
  activeSessionId,
  onCatalogChanged,
}: {
  appVersion: string
  providers: ProviderSummary[]
  models: ModelSummary[]
  activeSessionId: string | null
  onCatalogChanged: () => void
}) {
  const { lang } = useI18n()
  const section = useUIStore((s) => s.settingsSection)
  const goChat = useUIStore((s) => s.goChat)
  const setLang = useUIStore((s) => s.setLang)
  const setSection = useUIStore((s) => s.setSettingsSection)

  return (
    <SettingsShell onBack={goChat}>
      {section === 'general' && (
        <GeneralSettings language={lang} onLanguageChange={(next) => setLang(next)} />
      )}
      {section === 'appearance' && <AppearanceSettings />}
      {section === 'providers' && (
        <ProvidersView providers={providers} onChanged={onCatalogChanged} />
      )}
      {section === 'models' && (
        <ModelsView
          providers={providers}
          onChanged={onCatalogChanged}
          onAddProvider={() => setSection('providers')}
        />
      )}
      {section === 'agents' && (
        <AgentsView
          models={models}
          activeSessionId={activeSessionId}
          onChanged={onCatalogChanged}
        />
      )}
      {section === 'about' && <AboutSettings version={appVersion} />}
      {!['general', 'appearance', 'providers', 'models', 'agents', 'about'].includes(section) && (
        <SoonSettings />
      )}
    </SettingsShell>
  )
}
