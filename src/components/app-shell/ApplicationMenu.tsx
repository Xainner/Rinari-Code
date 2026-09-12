import { ChevronUp, Settings2 } from 'lucide-react'
import { dispatchAction, type DesktopAction } from '../../services/actions'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'

const entries: Array<[DesktopAction, string]> = [
  ['settings', 'Configuración'],
  ['appearance', 'Apariencia'],
  ['engine', 'Estado del motor'],
  ['updates', 'Buscar actualizaciones'],
  ['about', 'Acerca de Rinari Code'],
]
export default function ApplicationMenu({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Menú de Rinari Code"
          className="flex w-full items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-3 text-sm hover:bg-[var(--bg-hover)]"
        >
          <Settings2 size={16} />
          {!collapsed && (
            <>
              <span className="flex-1 text-left font-semibold">Rinari Code</span>
              <ChevronUp size={14} />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-60">
        {entries.map(([action, label]) => (
          <DropdownMenuItem key={action} onSelect={() => dispatchAction(action)}>
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
