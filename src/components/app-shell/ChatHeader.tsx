import { Menu, PanelLeft } from 'lucide-react'
import { useI18n } from '../../i18n'

interface ChatHeaderProps {
  /** null = sin sesión activa. */
  title: string | null
  kind: string | null
  mode: string | null
  onOpenMobileSidebar: () => void
  onExpandSidebar: () => void
  sidebarCollapsed: boolean
}

/** Header mínimo y contextual: toggles + título + kind/modo de la sesión. */
export default function ChatHeader({
  title,
  kind,
  mode,
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
      {(kind ?? mode) && (
        <span className="shrink-0 rounded-md border border-[var(--border)] px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-[var(--text-subtle)]">
          {[kind, mode].filter(Boolean).join(' · ')}
        </span>
      )}
    </header>
  )
}
