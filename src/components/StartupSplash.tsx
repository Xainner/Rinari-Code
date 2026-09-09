import { motion } from 'framer-motion'
import { RotateCcw } from 'lucide-react'
import { useI18n } from '../i18n'
import Logo from './Logo'

export default function StartupSplash({
  failed,
  detail,
  onRetry,
}: {
  failed: boolean
  detail?: string | null
  onRetry: () => void
}) {
  const { t } = useI18n()
  return (
    <main className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-[var(--bg-app)]">
      <motion.div
        aria-hidden="true"
        className="absolute size-[420px] rounded-full bg-[var(--accent)]/15 blur-3xl"
        animate={{ scale: [0.9, 1.08, 0.9], opacity: [0.45, 0.8, 0.45] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="relative flex flex-col items-center text-center">
        <motion.div
          animate={failed ? undefined : { y: [0, -7, 0], rotate: [0, -1.5, 0, 1.5, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Logo size={104} radius="rounded-3xl" />
        </motion.div>
        <h1 className="font-display mt-5 text-2xl font-bold tracking-tight text-[var(--text)]">
          Rinari Code
        </h1>
        {failed ? (
          <>
            <p className="mt-2 max-w-sm text-sm text-red-300">{detail || t('startup.failed')}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2 text-sm text-[var(--text)] transition-colors hover:border-[var(--accent)]/50"
            >
              <RotateCcw size={14} aria-hidden="true" />
              {t('startup.retry')}
            </button>
          </>
        ) : (
          <div role="status" aria-live="polite" className="mt-2 flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <span>{t('startup.loading')}</span>
            <span className="flex gap-1" aria-hidden="true">
              {[0, 1, 2].map((dot) => (
                <motion.span
                  key={dot}
                  className="size-1 rounded-full bg-[var(--accent-2)]"
                  animate={{ y: [0, -4, 0], opacity: [0.35, 1, 0.35] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: dot * 0.13 }}
                />
              ))}
            </span>
          </div>
        )}
      </div>
    </main>
  )
}
