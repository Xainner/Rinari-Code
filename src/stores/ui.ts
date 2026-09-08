import { create } from 'zustand'
import { applyTheme, getStoredTheme, storeTheme, type Theme } from '../lib/theme'
import {
  applyAccent,
  applyReduceMotion,
  getStoredAccent,
  getStoredReduceMotion,
  storeAccent,
  storeReduceMotion,
  type Accent,
} from '../lib/appearance'
import type { Language } from '../types'

export type View = 'chat' | 'settings' | 'engine' | 'workspace'

/** Secciones de Ajustes. Las marcadas con * llegan en fases posteriores. */
export type SettingsSection =
  | 'general'
  | 'appearance'
  | 'providers'
  | 'models'
  | 'agents'
  | 'soul'
  | 'mcp'
  | 'plugins'
  | 'terminal'
  | 'advanced'
  | 'about'

function readBool(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key)
    if (v === null) return fallback
    return v === '1'
  } catch {
    return fallback
  }
}

function writeBool(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? '1' : '0')
  } catch {
    /* ignore */
  }
}

function readLang(): Language {
  try {
    return localStorage.getItem('rinari.lang') === 'en' ? 'en' : 'es'
  } catch {
    return 'es'
  }
}

function readCollapsed(): boolean {
  return readBool('rinari.sidebarCollapsed', false)
}

interface UIState {
  view: View
  settingsSection: SettingsSection
  lang: Language
  sidebarOpen: boolean
  /** Rail colapsado en desktop (solo iconos). Persistido. */
  sidebarCollapsed: boolean
  paletteOpen: boolean
  theme: Theme
  accent: Accent
  reduceMotion: boolean
  /** Preferencias de chat. Persistidas. */
  enterToSend: boolean
  autoFollow: boolean
  showSuggestions: boolean
  goChat: () => void
  goEngine: () => void
  goWorkspace: () => void
  goSettings: (section?: SettingsSection) => void
  setSettingsSection: (section: SettingsSection) => void
  setLang: (lang: Language) => void
  setSidebarOpen: (open: boolean) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebarCollapsed: () => void
  setPaletteOpen: (open: boolean) => void
  togglePalette: () => void
  setTheme: (theme: Theme) => void
  setAccent: (accent: Accent) => void
  setReduceMotion: (reduce: boolean) => void
  setEnterToSend: (on: boolean) => void
  setAutoFollow: (on: boolean) => void
  setShowSuggestions: (on: boolean) => void
}

const initialAccent = typeof window === 'undefined' ? 'nebula' : getStoredAccent()
const initialMotion = typeof window === 'undefined' ? false : getStoredReduceMotion()
if (typeof window !== 'undefined') {
  applyAccent(initialAccent)
  applyReduceMotion(initialMotion)
}

/** Estado de shell (vista, sidebar, paleta, tema, prefs). Lo caliente (sesiones, streaming) sigue en los servicios. */
export const useUIStore = create<UIState>((set) => ({
  view: 'chat',
  settingsSection: 'general',
  lang: typeof window === 'undefined' ? 'es' : readLang(),
  sidebarOpen: false,
  sidebarCollapsed: typeof window === 'undefined' ? false : readCollapsed(),
  paletteOpen: false,
  theme: typeof window === 'undefined' ? 'system' : getStoredTheme(),
  accent: initialAccent,
  reduceMotion: initialMotion,
  enterToSend: typeof window === 'undefined' ? true : readBool('rinari.enterToSend', true),
  autoFollow: typeof window === 'undefined' ? true : readBool('rinari.autoFollow', true),
  showSuggestions:
    typeof window === 'undefined' ? true : readBool('rinari.showSuggestions', true),
  goChat: () => set({ view: 'chat', sidebarOpen: false }),
  goEngine: () => set({ view: 'engine', sidebarOpen: false }),
  goWorkspace: () => set({ view: 'workspace', sidebarOpen: false }),
  goSettings: (section = 'general') =>
    set({ view: 'settings', sidebarOpen: false, settingsSection: section }),
  setSettingsSection: (settingsSection) => set({ settingsSection }),
  setLang: (lang) => {
    try {
      localStorage.setItem('rinari.lang', lang)
    } catch {
      /* ignore */
    }
    set({ lang })
  },
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSidebarCollapsed: (collapsed) => {
    writeBool('rinari.sidebarCollapsed', collapsed)
    set({ sidebarCollapsed: collapsed })
  },
  toggleSidebarCollapsed: () =>
    set((s) => {
      writeBool('rinari.sidebarCollapsed', !s.sidebarCollapsed)
      return { sidebarCollapsed: !s.sidebarCollapsed }
    }),
  setPaletteOpen: (open) => set({ paletteOpen: open }),
  togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),
  setTheme: (theme) => {
    storeTheme(theme)
    applyTheme(theme)
    set({ theme })
  },
  setAccent: (accent) => {
    storeAccent(accent)
    applyAccent(accent)
    set({ accent })
  },
  setReduceMotion: (reduce) => {
    storeReduceMotion(reduce)
    applyReduceMotion(reduce)
    set({ reduceMotion: reduce })
  },
  setEnterToSend: (on) => {
    writeBool('rinari.enterToSend', on)
    set({ enterToSend: on })
  },
  setAutoFollow: (on) => {
    writeBool('rinari.autoFollow', on)
    set({ autoFollow: on })
  },
  setShowSuggestions: (on) => {
    writeBool('rinari.showSuggestions', on)
    set({ showSuggestions: on })
  },
}))
