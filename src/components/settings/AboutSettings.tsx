import { useEffect, useState } from 'react'
import Logo from '../Logo'
import { useI18n } from '../../i18n'
import { engineApi, type EngineStatus } from '../../services/engine'
import { Section } from './parts'

/** Settings > Acerca de: identidad y versiones visibles (Code/engine/protocolo). */
export default function AboutSettings({ version }: { version: string }) {
  const { t } = useI18n()
  const [status, setStatus] = useState<EngineStatus | null>(null)

  useEffect(() => {
    let alive = true
    void engineApi
      .status()
      .then((result) => {
        if (alive) setStatus(result)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

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
        <div className="space-y-1 font-mono text-xs text-[var(--text-muted)]">
          <div className="flex items-center justify-between">
            <span>rinari-code</span>
            <span>{version}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>rinari-engine</span>
            <span>{status?.engine_version ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>rinari-engine-protocol</span>
            <span>{status?.protocol_version ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>bundled soul</span>
            <span>rinari-default 3.0</span>
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
