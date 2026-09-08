import { useI18n } from '../../i18n'
import { useUIStore } from '../../stores/ui'
import SettingsShell from '../../components/settings/SettingsShell'
import GeneralSettings from '../../components/settings/GeneralSettings'
import AppearanceSettings from '../../components/settings/AppearanceSettings'
import AboutSettings from '../../components/settings/AboutSettings'
import SoonSettings from '../../components/settings/SoonSettings'

/** Vista de ajustes: shell + sección activa. Proveedores/modelos/agentes/Soul llegan en Fases 3–8. */
export default function SettingsView({ appVersion }: { appVersion: string }) {
  const { lang } = useI18n()
  const section = useUIStore((s) => s.settingsSection)
  const goChat = useUIStore((s) => s.goChat)
  const setLang = useUIStore((s) => s.setLang)

  return (
    <SettingsShell onBack={goChat}>
      {section === 'general' && (
        <GeneralSettings language={lang} onLanguageChange={(next) => setLang(next)} />
      )}
      {section === 'appearance' && <AppearanceSettings />}
      {section === 'about' && <AboutSettings version={appVersion} />}
      {section !== 'general' && section !== 'appearance' && section !== 'about' && (
        <SoonSettings />
      )}
    </SettingsShell>
  )
}
