import type { ReactNode } from 'react'
import { Drawer } from 'vaul'
import { useUIStore } from '../../stores/ui'
import { cn } from '../../lib/utils'

interface AppShellProps {
  sidebar: ReactNode
  header: ReactNode
  children: ReactNode
  banner?: ReactNode
}

/**
 * Shell: sidebar 260px desktop / rail 72px colapsado / Sheet móvil,
 * header contextual de 52px y contenido centrado.
 */
export default function AppShell({ sidebar, header, children, banner }: AppShellProps) {
  const mobileOpen = useUIStore((s) => s.sidebarOpen)
  const setMobileOpen = useUIStore((s) => s.setSidebarOpen)
  const collapsed = useUIStore((s) => s.sidebarCollapsed)

  return (
    <div className="relative flex h-dvh overflow-hidden bg-[var(--bg-app)] text-[var(--text)]">
      <aside
        className={cn(
          'hidden shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-sidebar)] lg:flex',
          collapsed ? 'w-[72px]' : 'w-65',
        )}
        aria-label="Rinari Code"
      >
        {sidebar}
      </aside>

      <Drawer.Root open={mobileOpen} onOpenChange={setMobileOpen} direction="left">
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" />
          <Drawer.Content
            aria-label="Rinari Code"
            className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-[var(--border)] bg-[var(--bg-sidebar)] outline-none lg:hidden"
          >
            {sidebar}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      <div className="flex min-w-0 flex-1 flex-col">
        {header}
        {banner}
        <main className="relative min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  )
}
