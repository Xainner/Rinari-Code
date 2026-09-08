import Logo from '../Logo'
import { useI18n } from '../../i18n'
import { Section } from './parts'

/** Settings > Acerca de: identidad y versión, nada operativo. */
export default function AboutSettings({ version }: { version: string }) {
  const { t } = useI18n()
  return (
    <div className="space-y-6">
      <Section title={t('app.name')}>
        <div className="flex items-center gap-3">
          <Logo size={44} radius="rounded-2xl" />
          <div>
            <p className="font-display text-base font-bold text-[var(--text)]">{t('app.name')}</p>
            <p className="text-xs text-[var(--text-subtle)]">
              {t('settings.admin.statusVersion')}: {version}
            </p>
          </div>
        </div>
        <p className="text-sm text-[var(--text-muted)]">{t('settings.about.body')}</p>
        <p className="text-sm">
          <a
            href="https://github.com/Xainner/Rinari-Code"
            target="_blank"
            rel="noreferrer"
            className="text-[var(--accent-2)] underline underline-offset-2 hover:brightness-110"
          >
            {t('settings.about.repo')}: Xainner/Rinari-Code
          </a>
        </p>
      </Section>
    </div>
  )
}
