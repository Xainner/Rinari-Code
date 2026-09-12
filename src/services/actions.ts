export type DesktopAction =
  | 'new-chat'
  | 'open-folder'
  | 'close-session'
  | 'settings'
  | 'appearance'
  | 'engine'
  | 'updates'
  | 'about'
  | 'sidebar'
  | 'files'
  | 'commands'
  | 'undo'
  | 'redo'
export function dispatchAction(action: DesktopAction) {
  window.dispatchEvent(new CustomEvent('rinari-action', { detail: action }))
}
