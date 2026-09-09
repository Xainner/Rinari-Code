import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import Logo from '../Logo'
import { useI18n } from '../../i18n'
import { engineApi, type EngineStatus } from '../../services/engine'
import { checkForUpdates, installUpdateAndRelaunch } from '../../services/updates'
import { Section } from './parts'

/** Settings > Acerca de: identidad y versiones visibles (Code/engine/protocolo). */
export default function AboutSettings({ version }: { version: string }) {
  const { t } = useI18n()
  const [status, setStatus] = useState<EngineStatus | null>(null)
  const [checking, setChecking] = useState(false)

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

  async function onCheckUpdates() {
    setChecking(true)
    try {
      const found = await checkForUpdates()
      if (!found) {
        toast.success(t('update.none'))
        return
      }
      toast(t('update.available', { v: found.version }), {
        action: {
          label: t('update.install'),
          onClick: () => {
            toast.loading(t('update.installing'))
            void installUpdateAndRelaunch().catch((err: unknown) =>
              toast.error(
                t('update.failed', {
                  detail: err instanceof Error ? err.message : String(err),
                }),
              ),
            )
          },
        },
      })
    } catch (err: unknown) {
      toast.error(
        t('update.failed', {
          detail: err instanceof Error ? err.message : String(err),
        }),
      )
    } finally {
      setChecking(false)
    }
  }

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
        <button
          type="button"
          disabled={checking}
          onClick={() => void onCheckUpdates()}
          className="rounded-xl border border-[var(--border)] px-3 py-1.5 text-sm transition-colors hover:border-[var(--accent-2)] disabled:opacity-50"
        >
          {checking ? t('update.checking') : t('update.check')}
        </button>
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
