import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { commandMessage, engineApi, type ChangedFile } from '../../services/engine'
import { useI18n } from '../../i18n'

/** Cambios del worktree: estado git + archivos + diff unificado por archivo. */
export default function ChangesPanel({
  path,
  onFiles,
}: {
  path: string
  onFiles: (files: string[]) => void
}) {
  const { t } = useI18n()
  const [branch, setBranch] = useState<string | null>(null)
  const [available, setAvailable] = useState(true)
  const [dirty, setDirty] = useState(false)
  const [files, setFiles] = useState<ChangedFile[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [diff, setDiff] = useState<string | null>(null)
  const [truncated, setTruncated] = useState(false)
  const [loadingDiff, setLoadingDiff] = useState(false)

  const reload = useCallback(async () => {
    try {
      const result = await engineApi.projectChanges(path)
      setAvailable(result.available)
      setBranch(result.branch)
      setDirty(result.dirty)
      setFiles(result.files)
      onFiles(result.files.map((f) => f.path))
    } catch (err) {
      toast.error(commandMessage(err))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path])

  useEffect(() => {
    setSelected(null)
    setDiff(null)
    void reload()
  }, [reload])

  async function openDiff(file: string) {
    if (selected === file && diff !== null) {
      setSelected(null)
      setDiff(null)
      return
    }
    setSelected(file)
    setLoadingDiff(true)
    try {
      const result = await engineApi.projectDiff(path, file)
      setDiff(result.binary ? '' : result.diff)
      setTruncated(result.truncated)
    } catch (err) {
      toast.error(commandMessage(err))
      setSelected(null)
    } finally {
      setLoadingDiff(false)
    }
  }

  if (!available) {
    return <p className="text-sm text-[var(--text-subtle)]">{t('workspace.noGit')}</p>
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-xs text-[var(--text-subtle)]">
        {branch && <span className="font-mono">{branch}</span>}
        <span>{dirty ? t('workspace.dirty') : t('workspace.clean')}</span>
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => void reload()}
          className="rounded-lg border border-[var(--border)] px-2 py-0.5 font-semibold transition-colors hover:bg-[var(--bg-hover)]"
        >
          {t('workspace.refresh')}
        </button>
      </div>
      {files.length === 0 && (
        <p className="text-sm text-[var(--text-subtle)]">{t('workspace.clean')}</p>
      )}
      {files.map((file) => (
        <div
          key={file.path}
          className="overflow-hidden rounded-xl border border-[var(--border)]"
        >
          <button
            type="button"
            onClick={() => void openDiff(file.path)}
            className="flex w-full items-center gap-2 bg-[var(--bg-subtle)] px-3 py-2 text-left transition-colors hover:bg-[var(--bg-hover)]"
          >
            <span className="font-mono text-[11px] text-[var(--accent-2)]">
              {[file.staged, file.unstaged].filter(Boolean).join('')}
            </span>
            <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-[var(--text)]">
              {file.path}
            </span>
          </button>
          {selected === file.path && (
            <div className="border-t border-[var(--border)]">
              {loadingDiff ? (
                <p className="px-3 py-2 text-xs text-[var(--text-subtle)]">
                  {t('workspace.loadingDiff')}
                </p>
              ) : (
                <>
                  <pre className="max-h-96 overflow-auto px-3 py-2 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-[var(--text-muted)]">
                    {diff}
                  </pre>
                  {truncated && (
                    <p className="border-t border-[var(--border)] px-3 py-1.5 text-[11px] text-[var(--text-subtle)]">
                      {t('workspace.truncated')}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
