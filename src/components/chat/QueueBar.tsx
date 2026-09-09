import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { commandMessage, engineApi } from '../../services/engine'
import { useI18n } from '../../i18n'

/**
 * Cola de prompts de la sesión: visible mientras un turno corre.
 * Encolar preserva turnos y aprobaciones (lo impone el engine).
 */
export default function QueueBar({
  sessionId,
  refreshKey,
}: {
  sessionId: string | null
  refreshKey: boolean
}) {
  const { t } = useI18n()
  const [queue, setQueue] = useState<string[]>([])
  const [draft, setDraft] = useState('')

  const reload = useCallback(async () => {
    if (!sessionId) {
      setQueue([])
      return
    }
    try {
      const result = await engineApi.queueList(sessionId)
      setQueue(result.queue)
    } catch {
      // La cola es post-core: si el engine no la soporta, no rompe el chat.
    }
  }, [sessionId])

  useEffect(() => {
    void reload()
  }, [reload, refreshKey])

  async function add() {
    if (!sessionId || draft.trim() === '') return
    try {
      await engineApi.queueAdd(sessionId, draft.trim())
      setDraft('')
      await reload()
    } catch (err) {
      toast.error(commandMessage(err))
    }
  }

  async function clear() {
    if (!sessionId) return
    try {
      await engineApi.queueClear(sessionId)
      await reload()
    } catch (err) {
      toast.error(commandMessage(err))
    }
  }

  if (!sessionId || (!refreshKey && queue.length === 0)) return null

  return (
    <div className="px-4 pb-1">
      {queue.length > 0 && (
        <div className="mx-auto mb-1 w-full max-w-2xl space-y-1">
          {queue.map((message, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] px-2.5 py-1 text-xs text-[var(--text-muted)]"
            >
              <span className="font-mono text-[var(--accent-2)]">{i + 1}.</span>
              <span className="min-w-0 flex-1 truncate">{message}</span>
            </div>
          ))}
          <button
            type="button"
            onClick={() => void clear()}
            className="text-[11px] text-[var(--text-subtle)] hover:text-[var(--text)]"
          >
            {t('queue.clear')}
          </button>
        </div>
      )}
      {refreshKey && (
        <div className="mx-auto flex w-full max-w-2xl gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void add()
            }}
            placeholder={t('queue.placeholder')}
            className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] px-2.5 py-1 text-xs outline-none placeholder:text-[var(--text-subtle)] focus:border-[var(--accent)]"
          />
          <button
            type="button"
            onClick={() => void add()}
            disabled={draft.trim() === ''}
            className="shrink-0 rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-40"
          >
            {t('queue.enqueue')}
          </button>
        </div>
      )}
    </div>
  )
}
