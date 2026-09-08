import { Cpu, MessageSquare, PanelLeftClose, Play, Plus, Search, Settings2 } from 'lucide-react'
import type { EngineStatus, SessionSummary } from '../../services/engine'
import { useI18n } from '../../i18n'
import { cn } from '../../lib/utils'
import Logo from '../Logo'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import type { PendingApproval } from '../../types'

interface AppSidebarProps {
  sessions: SessionSummary[]
  activeId: string | null
  engine: EngineStatus | null
  approvals: PendingApproval[]
  collapsed: boolean
  onToggleCollapse: () => void
  onSearch: () => void
  onSelectSession: (id: string) => void
  onNewSession: () => void
  onOpenSettings: () => void
  onOpenEngine: () => void
  onStartEngine: () => void
  onResolveApproval: (id: string, decision: string) => void
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
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          className="flex size-10 items-center justify-center rounded-xl text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

const DOT: Record<string, string> = {
  ready: 'bg-emerald-400',
  degraded: 'bg-amber-400',
  failed: 'bg-red-400',
  starting: 'bg-sky-400 animate-pulse',
  handshaking: 'bg-sky-400 animate-pulse',
  restarting: 'bg-sky-400 animate-pulse',
  stopped: 'bg-[var(--text-subtle)]',
}

function EngineDot({ state }: { state: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('size-2 shrink-0 rounded-full', DOT[state] ?? DOT.stopped)}
    />
  )
}

/** Sidebar: sesiones del engine, aprobaciones pendientes y estado del motor. Sin cuentas: no hay login. */
export default function AppSidebar({
  sessions,
  activeId,
  engine,
  approvals,
  collapsed,
  onToggleCollapse,
  onSearch,
  onSelectSession,
  onNewSession,
  onOpenSettings,
  onOpenEngine,
  onStartEngine,
  onResolveApproval,
}: AppSidebarProps) {
  const { t } = useI18n()
  const engineState = engine?.state ?? 'stopped'
  const engineLabel = t(`engine.${engineState}` as 'engine.ready')

  if (collapsed) {
    return (
      <div className="flex h-full w-full flex-col items-center gap-1 py-4">
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={t('shell.expand')}
          title={t('shell.expand')}
        >
          <Logo size={36} />
        </button>
        <div className="mt-3 flex flex-col gap-1">
          <RailButton label={t('sidebar.newChat')} onClick={onNewSession}>
            <Plus size={19} />
          </RailButton>
          <RailButton label={t('cmd.searchChats')} onClick={onSearch}>
            <Search size={18} />
          </RailButton>
          <RailButton label={t('nav.engine')} onClick={onOpenEngine}>
            <Cpu size={18} />
          </RailButton>
        </div>
        <div className="mt-auto flex flex-col items-center gap-1">
          <RailButton label={t('nav.settings')} onClick={onOpenSettings}>
            <Settings2 size={18} />
          </RailButton>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2.5">
          <Logo size={36} />
          <span className="text-[17px] font-bold tracking-tight text-[var(--text)]">
            {t('app.name')}
          </span>
        </div>
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={t('shell.collapse')}
          title={t('shell.collapse')}
          className="hidden rounded-lg p-2 text-[var(--text-subtle)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text)] lg:block"
        >
          <PanelLeftClose size={17} />
        </button>
      </div>

      <div className="space-y-1.5 px-3 pb-2">
        <button
          type="button"
          onClick={onNewSession}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2.5 text-sm font-semibold text-[var(--text)] transition-all hover:border-[var(--accent)]/50 active:scale-[0.98]"
        >
          <Plus size={17} className="text-[var(--accent-2)]" />
          {t('sidebar.newChat')}
        </button>
        <button
          type="button"
          onClick={onSearch}
          className="inline-flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
        >
          <Search size={15} />
          {t('cmd.searchChats')}
        </button>
      </div>

      <nav aria-label={t('nav.chats')} className="space-y-0.5 px-3 pb-1">
        <button
          type="button"
          onClick={onOpenEngine}
          className="inline-flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
        >
          <Cpu size={15} />
          {t('nav.engine')}
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          className="inline-flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
        >
          <Settings2 size={15} />
          {t('nav.settings')}
        </button>
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-1">
        <p className="mb-1 px-2 text-[11px] font-semibold tracking-widest text-[var(--text-subtle)] uppercase">
          {t('sidebar.sessions')}
        </p>
        {engineState === 'stopped' || engineState === 'failed' ? (
          <button
            type="button"
            onClick={onStartEngine}
            className="mx-2 mb-2 inline-flex items-center gap-2 rounded-xl border border-dashed border-[var(--border)] px-3 py-2 text-[13px] text-[var(--text-muted)] transition-colors hover:border-[var(--accent)]/50 hover:text-[var(--text)]"
          >
            <Play size={14} />
            {t('engine.start')}
          </button>
        ) : null}
        {sessions.length === 0 && engineState === 'ready' && (
          <p className="px-2 py-6 text-center text-sm whitespace-pre-line text-[var(--text-subtle)]">
            {t('sidebar.noChats')}
          </p>
        )}
        <ul className="space-y-0.5">
          {sessions.map((session) => {
            const active = session.id === activeId
            return (
              <li key={session.id} className="group relative">
                <button
                  type="button"
                  onClick={() => onSelectSession(session.id)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors',
                    active ? 'bg-[var(--bg-hover)]' : 'hover:bg-[var(--bg-hover)]/60',
                  )}
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
                    {session.title || t('sidebar.newChat')}
                  </span>
                  {session.kind === 'PROJECT' && session.project_root && (
                    <span
                      title={session.project_root}
                      className="block max-w-full truncate font-mono text-[10px] text-[var(--text-subtle)]"
                    >
                      {session.project_root.split(/[/\\]/).pop()}
                    </span>
                  )}
                  <span
                    title={session.kind}
                    className="shrink-0 rounded-md border border-[var(--border)] px-1 py-px font-mono text-[9px] tracking-wide text-[var(--text-subtle)]"
                  >
                    {session.kind === 'PROJECT' ? 'PRJ' : 'CHAT'}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        {approvals.length > 0 && (
          <div className="mt-3">
            <p className="mb-1 px-2 text-[11px] font-semibold tracking-widest text-[var(--text-subtle)] uppercase">
              {t('sidebar.approvals')} · {approvals.length}
            </p>
            {approvals.map((approval) => (
              <div
                key={approval.approval_id}
                className="mb-2 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] p-2.5"
              >
                <p className="truncate font-mono text-xs text-[var(--text)]">
                  {approval.capability}
                </p>
                {approval.target && (
                  <p className="truncate text-[11px] text-[var(--text-subtle)]">
                    {approval.target}
                  </p>
                )}
                <div className="mt-1.5 flex gap-1">
                  {(['deny', 'allow_once', 'allow_session'] as const).map((decision) => (
                    <button
                      key={decision}
                      type="button"
                      onClick={() => onResolveApproval(approval.approval_id, decision)}
                      className="rounded-lg border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
                    >
                      {decision === 'deny' ? '✕' : decision === 'allow_once' ? '1×' : '∞'}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-[var(--border)] p-3">
        <button
          type="button"
          onClick={onOpenEngine}
          title={engine?.detail ?? undefined}
          className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors hover:bg-[var(--bg-hover)]"
        >
          <EngineDot state={engineState} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-[var(--text)]">
              {t('engine.title')}
            </span>
            <span className="block text-[11px] text-[var(--text-subtle)]">
              {engineLabel}
              {engine?.engine_version ? ` · v${engine.engine_version}` : ''}
            </span>
          </span>
        </button>
      </div>
    </div>
  )
}
