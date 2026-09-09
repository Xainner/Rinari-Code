import { GitBranch, Menu, PanelLeft } from 'lucide-react'
import { projectDisplayName } from '../../features/projects/workspaceModel'
import { useI18n } from '../../i18n'

export interface HeaderGit {
  branch: string | null
  dirty: boolean
  changed: number
}

interface ChatHeaderProps {
  /** null = sin sesión activa. */
  title: string | null
  kind: string | null
  mode: string | null
  projectRoot: string | null
  projectName: string | null
  /** null = aún cargando o no aplica; missing = carpeta ausente. */
  git: HeaderGit | null
  gitMissing: boolean
  onOpenProject: (() => void) | null
  onOpenMobileSidebar: () => void
  onExpandSidebar: () => void
  sidebarCollapsed: boolean
}

/** Header mínimo y contextual: toggles + título + proyecto/git + kind/modo. */
export default function ChatHeader({
  title,
  kind,
  mode,
  projectRoot,
  projectName,
  git,
  gitMissing,
  onOpenProject,
  onOpenMobileSidebar,
  onExpandSidebar,
  sidebarCollapsed,
}: ChatHeaderProps) {
  const { t } = useI18n()
  return (
    <header className="flex h-13 shrink-0 items-center gap-2 border-b border-[var(--border)] px-3">
      <button
        type="button"
        onClick={onOpenMobileSidebar}
        aria-label={t('chat.openMenu')}
        className="rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text)] lg:hidden"
      >
        <Menu size={19} />
      </button>
      {sidebarCollapsed && (
        <button
          type="button"
          onClick={onExpandSidebar}
          aria-label={t('shell.expand')}
          title={t('shell.expand')}
          className="hidden rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text)] lg:block"
        >
          <PanelLeft size={18} />
        </button>
      )}
      {title && (
        <p
          title={title}
          className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--text)]"
        >
          {title}
        </p>
      )}
      {projectName && (
        <button
          type="button"
          onClick={onOpenProject ?? undefined}
          disabled={onOpenProject === null}
          title={onOpenProject ? `${t('header.openProject')}: ${projectRoot ?? ''}` : (projectRoot ?? '')}
          className="flex max-w-55 shrink-0 items-center gap-1.5 rounded-md border border-[var(--border)] px-1.5 py-0.5 text-[11px] text-[var(--text-muted)] transition-colors hover:border-[var(--accent)]/50 hover:text-[var(--text)] disabled:cursor-default disabled:hover:border-[var(--border)] disabled:hover:text-[var(--text-muted)]"
        >
          <GitBranch size={11} aria-hidden="true" className="shrink-0" />
          <span className="truncate font-medium">{projectDisplayName(projectName)}</span>
          {gitMissing ? (
            <span className="shrink-0 text-amber-500">· {t('project.gitMissing')}</span>
          ) : git?.branch ? (
            <span className="shrink-0 font-mono text-[var(--text-subtle)]">
              · {git.branch}
              {git.dirty ? ` · ${git.changed}` : ''}
            </span>
          ) : (
            <span className="shrink-0 text-[var(--text-subtle)]">· {t('header.noGit')}</span>
          )}
        </button>
      )}
      {(kind ?? mode) && (
        <span className="shrink-0 rounded-md border border-[var(--border)] px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-[var(--text-subtle)]">
          {[kind, mode].filter(Boolean).join(' · ')}
        </span>
      )}
    </header>
  )
}
