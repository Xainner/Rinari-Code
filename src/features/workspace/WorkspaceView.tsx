import { useState } from 'react'
import { useI18n } from '../../i18n'
import type { SessionSummary } from '../../services/engine'
import ChangesPanel from './ChangesPanel'
import TasksPanel from './TasksPanel'
import VerificationPanel from './VerificationPanel'
import CheckpointsPanel from './CheckpointsPanel'
import ArtifactsPanel from './ArtifactsPanel'
import InsightPanel from './InsightPanel'

type Tab = 'changes' | 'tasks' | 'verification' | 'checkpoints' | 'artifacts' | 'insight'

const TABS: Tab[] = ['changes', 'tasks', 'verification', 'checkpoints', 'artifacts', 'insight']

/**
 * Vista workspace: cambios, tareas, verificación y checkpoints del proyecto
 * de la sesión activa (project_root, o cwd en CHAT). Solo lectura salvo
 * restaurar checkpoint (con preview + confirmación).
 */
export default function WorkspaceView({
  session,
  onBack,
}: {
  session: SessionSummary | null
  onBack: () => void
}) {
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('changes')
  const [changedFiles, setChangedFiles] = useState<string[]>([])

  const path = session?.project_root ?? session?.current_cwd ?? null

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-4 py-4">
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs transition-colors hover:bg-[var(--bg-hover)]"
        >
          ←
        </button>
        <h2 className="text-sm font-semibold text-[var(--text)]">{t('nav.workspace')}</h2>
        {path && (
          <span title={path} className="min-w-0 flex-1 truncate font-mono text-[11px] text-[var(--text-subtle)]">
            {path}
          </span>
        )}
      </div>

      {path === null && (
        <p className="text-sm text-[var(--text-subtle)]">{t('workspace.noSession')}</p>
      )}

      {path !== null && (
        <>
          <div role="tablist" aria-label={t('nav.workspace')} className="mb-3 flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] p-1">
            {TABS.map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-all ${
                  tab === id
                    ? 'bg-[var(--accent)] text-white'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                }`}
              >
                {t(`workspace.tab.${id}`)}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pb-8">
            {tab === 'changes' && <ChangesPanel path={path} onFiles={setChangedFiles} />}
            {tab === 'tasks' && <TasksPanel path={path} />}
            {tab === 'verification' && (
              <VerificationPanel path={path} changedFiles={changedFiles} />
            )}
            {tab === 'checkpoints' && <CheckpointsPanel path={path} />}
            {tab === 'artifacts' && session && <ArtifactsPanel sessionId={session.id} />}
            {tab === 'insight' && session && <InsightPanel sessionId={session.id} />}
          </div>
        </>
      )}
    </div>
  )
}
