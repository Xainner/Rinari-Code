import { useMemo, useState } from 'react'
import {
  ChevronDown,
  Cpu,
  FolderGit2,
  FolderOpen,
  MessageSquare,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings2,
} from 'lucide-react'
import type { ProjectSummary, SessionSummary } from '../../services/engine'
import type { PendingApproval } from '../../types'
import { buildWorkspaceModel, projectDisplayName } from '../../features/projects/workspaceModel'
import { useI18n } from '../../i18n'
import { useUIStore } from '../../stores/ui'
import { cn } from '../../lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { Switch } from '../ui/switch'

export interface AppSidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  onSearch: () => void
  onOpenSettings: () => void
  onOpenEngine: () => void
  /** Home del proyecto de la sesión activa; null si no hay. */
  onOpenProjectHome: (() => void) | null
  onNewChat: () => void
  /** Abrir carpeta con el diálogo nativo (registra proyecto en el engine). */
  onOpenFolder: () => void
  sessions: SessionSummary[]
  closedSessions: SessionSummary[]
  projects: ProjectSummary[]
  activeId: string
  onSelectSession: (id: string) => void
  /** Ir al home del proyecto (vista workspace). */
  onOpenProject: (root: string) => void
  onCloseSession: (id: string) => void
  onDeleteSession: (id: string, cascade: boolean) => void
  approvals: PendingApproval[]
}

function sessionLabel(session: SessionSummary, fallback: string): string {
  return session.title || fallback
}

function RailButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex size-10 items-center justify-center rounded-xl text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
    >
      {children}
    </button>
  )
}

export function AppSidebar({
  collapsed,
  onToggleCollapse,
  onSearch,
  onOpenSettings,
  onOpenEngine,
  onOpenProjectHome,
  onNewChat,
  onOpenFolder,
  sessions,
  closedSessions,
  projects,
  activeId,
  onSelectSession,
  onOpenProject,
  onCloseSession,
  onDeleteSession,
  approvals,
}: AppSidebarProps) {
  const { t } = useI18n()
  // El mismo nodo vive en el aside desktop y en el drawer móvil: en el
  // drawer siempre se muestra expandido.
  const mobileOpen = useUIStore((s) => s.sidebarOpen)
  const rail = collapsed && !mobileOpen
  const [showClosed, setShowClosed] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<SessionSummary | null>(null)
  const [cascade, setCascade] = useState(false)

  const model = useMemo(() => buildWorkspaceModel(sessions, projects), [sessions, projects])

  const confirmDelete = () => {
    if (!deleteTarget) return
    onDeleteSession(deleteTarget.id, cascade)
    setDeleteTarget(null)
    setCascade(false)
  }

  const row = (session: SessionSummary, opts?: { closed?: boolean }) => {
    const active = session.id === activeId
    return (
      <li key={session.id} className="group relative">
        <div
          className={cn(
            'flex w-full items-center gap-1 rounded-xl pr-1 pl-2.5 transition-colors',
            active ? 'bg-[var(--bg-hover)]' : 'hover:bg-[var(--bg-hover)]/60',
          )}
        >
          <button
            type="button"
            onClick={() => onSelectSession(session.id)}
            className="flex min-w-0 flex-1 items-center gap-2.5 py-2 text-left"
          >
            {active && (
              <span
                aria-hidden="true"
                className="absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-[var(--accent)]"
              />
            )}
            <MessageSquare
              size={14}
              aria-hidden="true"
              className="shrink-0 text-[var(--text-subtle)]"
            />
            <span
              className={cn(
                'block min-w-0 flex-1 truncate text-sm',
                active ? 'font-semibold text-[var(--text)]' : 'text-[var(--text-muted)]',
              )}
            >
              {sessionLabel(session, t('sidebar.newChat'))}
            </span>
          </button>
          {!opts?.closed && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={t('sidebar.sessionOptions')}
                  onClick={(e) => e.stopPropagation()}
                  className="rounded-md p-1 text-[var(--text-subtle)] opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 hover:bg-[var(--bg-active)] hover:text-[var(--text)]"
                >
                  <MoreHorizontal size={14} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onSelect={() => onCloseSession(session.id)}>
                  {t('sidebar.close')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    setCascade(false)
                    setDeleteTarget(session)
                  }}
                  className="text-red-500 focus:text-red-500"
                >
                  {t('sidebar.delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </li>
    )
  }

  if (rail) {
    return (
      <div className="flex h-full w-full flex-col items-center gap-1 px-2 pt-4 pb-3">
        <RailButton label={t('sidebar.newChat')} onClick={onNewChat}>
          <Plus size={17} />
        </RailButton>
        <RailButton label={t('sidebar.commands')} onClick={onSearch}>
          <Search size={17} />
        </RailButton>
        {onOpenProjectHome && (
          <RailButton label={t('sidebar.projects')} onClick={onOpenProjectHome}>
            <FolderGit2 size={17} />
          </RailButton>
        )}
        <RailButton label={t('nav.engine')} onClick={onOpenEngine}>
          <Cpu size={17} />
        </RailButton>
        <div className="flex-1" />
        <RailButton label={t('nav.settings')} onClick={onOpenSettings}>
          <Settings2 size={17} />
        </RailButton>
        <RailButton label={t('shell.expand')} onClick={onToggleCollapse}>
          <PanelLeftOpen size={17} />
        </RailButton>
      </div>
    )
  }

  return (
    <div className="flex h-full w-full flex-col gap-4 overflow-hidden px-3 pt-4 pb-3 lg:w-64">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onNewChat}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-[var(--bg-hover)] px-3 py-2 text-sm font-semibold text-[var(--text)] transition-colors hover:bg-[var(--bg-active)]"
        >
          <Plus size={15} aria-hidden="true" />
          <span className="truncate">{t('sidebar.newChat')}</span>
        </button>
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={t('shell.collapse')}
          title={t('shell.collapse')}
          className="hidden shrink-0 rounded-xl p-2 text-[var(--text-subtle)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text)] lg:block"
        >
          <PanelLeftClose size={15} />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-0.5">
        <section aria-label={t('sidebar.projects')}>
          <div className="mb-1 flex items-center justify-between pl-2">
            <p className="text-[11px] font-semibold tracking-widest text-[var(--text-subtle)] uppercase">
              {t('sidebar.projects')}
            </p>
            <button
              type="button"
              onClick={onOpenFolder}
              aria-label={t('sidebar.openFolder')}
              title={t('sidebar.openFolder')}
              className="rounded-md p-1 text-[var(--text-subtle)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
            >
              <FolderOpen size={13} />
            </button>
          </div>
          {model.sections.length === 0 && (
            <p className="px-2 text-xs text-[var(--text-subtle)]">{t('sidebar.noProjects')}</p>
          )}
          <ul className="space-y-2.5">
            {model.sections.map(({ project, sessions: items }) => (
              <li key={project.id}>
                <button
                  type="button"
                  onClick={() => onOpenProject(project.root)}
                  title={project.root}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left transition-colors hover:bg-[var(--bg-hover)]/60"
                >
                  <FolderGit2 size={13} aria-hidden="true" className="shrink-0 text-[var(--text-subtle)]" />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--text)]">
                    {projectDisplayName(project.root)}
                  </span>
                  {items.length > 0 && (
                    <span className="shrink-0 rounded-md border border-[var(--border)] px-1 font-mono text-[10px] text-[var(--text-subtle)]">
                      {items.length}
                    </span>
                  )}
                </button>
                {items.length > 0 && (
                  <ul className="mt-0.5 ml-3.5 space-y-0.5 border-l border-[var(--border)] pl-1">
                    {items.map((session) => row(session))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section aria-label={t('sidebar.chats')}>
          <p className="mb-1 px-2 text-[11px] font-semibold tracking-widest text-[var(--text-subtle)] uppercase">
            {t('sidebar.chats')}
          </p>
          <ul className="space-y-0.5">
            {model.chats.map((session) => row(session))}
            {model.chats.length === 0 && (
              <li className="px-2 text-xs text-[var(--text-subtle)]">{t('sidebar.emptyChats')}</li>
            )}
          </ul>
        </section>

        {closedSessions.length > 0 && (
          <section aria-label={t('sidebar.closed')}>
            <button
              type="button"
              onClick={() => setShowClosed((v) => !v)}
              aria-expanded={showClosed}
              className="flex w-full items-center gap-1.5 px-2 text-[11px] font-semibold tracking-widest text-[var(--text-subtle)] uppercase transition-colors hover:text-[var(--text-muted)]"
            >
              <ChevronDown
                size={12}
                aria-hidden="true"
                className={cn('transition-transform', !showClosed && '-rotate-90')}
              />
              {t('sidebar.closed')} · {closedSessions.length}
            </button>
            {showClosed && (
              <ul className="mt-1 space-y-0.5">
                {closedSessions.map((session) => row(session, { closed: true }))}
              </ul>
            )}
          </section>
        )}

        {approvals.length > 0 && (
          <div className="mt-3">
            <p className="mb-1 px-2 text-[11px] font-semibold tracking-widest text-[var(--text-subtle)] uppercase">
              {t('sidebar.approvals')} · {approvals.length}
            </p>
            <p className="px-2 text-[11px] leading-relaxed text-[var(--text-subtle)]">
              Responde la solicitud dentro del turno activo.
            </p>
          </div>
        )}
      </div>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('sidebar.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('sidebar.deleteDesc', { title: deleteTarget ? sessionLabel(deleteTarget, t('sidebar.newChat')) : '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-2.5">
            <span className="text-sm text-[var(--text)]">{t('sidebar.deleteCascade')}</span>
            <Switch checked={cascade} onCheckedChange={setCascade} />
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {t('sidebar.deleteConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default AppSidebar
