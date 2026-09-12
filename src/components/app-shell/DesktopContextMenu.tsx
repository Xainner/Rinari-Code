import { useEffect } from 'react'
import { Menu, type MenuOptions } from '@tauri-apps/api/menu'
import { LogicalPosition } from '@tauri-apps/api/dpi'
import { isTauri } from '@tauri-apps/api/core'
import { toast } from 'sonner'
import { copyText } from '../../lib/clipboard'
import { dispatchAction } from '../../services/actions'

export default function DesktopContextMenu() {
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (event.defaultPrevented || !isTauri()) return
      event.preventDefault()
      const target = event.target instanceof Element ? event.target : null
      const editable = target?.closest(
        'input,textarea,[contenteditable="true"]',
      ) as HTMLElement | null
      const link = target?.closest('a') as HTMLAnchorElement | null
      const selection = window.getSelection()?.toString() ?? ''
      const items: NonNullable<MenuOptions['items']> = []
      if (editable) {
        editable.focus()
        items.push(
          {
            text: 'Deshacer',
            action: () => {
              editable.focus()
              document.execCommand('undo')
            },
          },
          {
            text: 'Rehacer',
            action: () => {
              editable.focus()
              document.execCommand('redo')
            },
          },
          { item: 'Cut', text: 'Cortar' },
          { item: 'Copy', text: 'Copiar' },
          { item: 'Paste', text: 'Pegar' },
          { item: 'SelectAll', text: 'Seleccionar todo' },
        )
      } else {
        if (selection)
          items.push({
            text: 'Copiar',
            action: () => {
              void copyText(selection)
            },
          })
        if (link)
          items.push(
            {
              text: link.dataset.filePath ? 'Abrir archivo' : 'Abrir enlace',
              action: () => link.click(),
            },
            {
              text: 'Copiar dirección',
              action: () => {
                void copyText(link.dataset.filePath ?? link.href)
              },
            },
          )
        if (!items.length)
          items.push(
            { text: 'Nueva conversación', action: () => dispatchAction('new-chat') },
            { text: 'Configuración', action: () => dispatchAction('settings') },
          )
      }
      void Menu.new({ items })
        .then(async (menu) => {
          try {
            await menu.popup(new LogicalPosition(event.clientX, event.clientY))
          } finally {
            await menu.close()
          }
        })
        .catch((error) => toast.error(String(error)))
    }
    window.addEventListener('contextmenu', handler)
    return () => window.removeEventListener('contextmenu', handler)
  }, [])
  return null
}
