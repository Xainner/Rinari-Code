import { useI18n } from '../../i18n'
import { Section } from '../../components/settings/parts'

/**
 * Ajustes > Terminal: el engine v1 no expone sesiones PTY propias
 * (los PTY viven dentro de los tool calls). Sin puente genérico de shell
 * desde el frontend — la terminal integrada espera al engine.
 */
export default function TerminalView() {
  const { t } = useI18n()
  return (
    <div className="space-y-4">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        {t('terminal.title')}
      </h2>
      <Section title={t('terminal.status')}>
        <p className="text-sm text-[var(--text-muted)]">{t('terminal.unavailable')}</p>
      </Section>
    </div>
  )
}
