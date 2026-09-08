import { create } from 'zustand'

interface ComposerState {
  text: string
  setText: (text: string) => void
  clear: () => void
}

/**
 * Borrador del composer en store (no en el componente): sobrevive a
 * remontajes del layout. Adjuntos y contexto explícito llegan en Fase 4.
 */
export const useComposerStore = create<ComposerState>((set) => ({
  text: '',
  setText: (text) => set({ text }),
  clear: () => set({ text: '' }),
}))
