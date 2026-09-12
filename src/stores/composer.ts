import { create } from 'zustand'
import type { AttachmentRef } from '../types'

interface Draft {
  text: string
  attachments: AttachmentRef[]
}

interface ComposerState {
  sessionKey: string
  switchSession: (sessionKey: string) => void
  moveDraft: (fromSessionKey: string, toSessionKey: string) => void
  draftsBySession: Record<string, Draft>
  text: string
  setText: (text: string) => void
  clear: () => void
  attachments: AttachmentRef[]
  addAttachment: (attachment: AttachmentRef) => void
  updateAttachment: (path: string, patch: Partial<AttachmentRef>) => void
  removeAttachment: (path: string) => void
  clearAttachments: () => void
  updateAttachmentById: (id: string, patch: Partial<AttachmentRef>) => void
  replaceAttachmentById: (id: string, attachments: AttachmentRef[]) => void
  removeAttachmentsById: (ids: string[]) => void
  restoreSubmission: (sessionKey: string, attachmentIds: string[], text: string) => void
}

const STORAGE_KEY = 'rinari.composer.drafts.v1'

function safeDraftAttachment(attachment: AttachmentRef): AttachmentRef {
  const previewUrl = attachment.previewUrl?.startsWith('data:') ? undefined : attachment.previewUrl
  return {
    ...attachment,
    previewUrl,
    data_url: undefined,
    status: attachment.status === 'preparing' ? 'error' : attachment.status,
    error: attachment.status === 'preparing'
      ? 'La preparacion se interrumpio; vuelve a intentar o adjunta el archivo de nuevo.'
      : attachment.error,
  }
}

function loadDrafts(): Record<string, Draft> {
  if (typeof window === 'undefined') return {}
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, Partial<Draft>>
    return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [
      key,
      {
        text: typeof value?.text === 'string' ? value.text : '',
        attachments: Array.isArray(value?.attachments)
          ? value.attachments.map((item) => safeDraftAttachment(item as AttachmentRef))
          : [],
      },
    ]))
  } catch {
    return {}
  }
}

function persistDrafts(drafts: Record<string, Draft>) {
  if (typeof window === 'undefined') return
  try {
    const serializable = Object.fromEntries(
      Object.entries(drafts).map(([key, value]) => [
        key,
        {
          text: value.text,
          attachments: value.attachments.map(safeDraftAttachment),
        },
      ]),
    )
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable))
  } catch {
    // A full storage quota must not block chat.
  }
}

const initialDrafts = loadDrafts()
const initialDraft = initialDrafts.draft ?? { text: '', attachments: [] }

function attachmentSession(
  state: Pick<ComposerState, 'sessionKey' | 'attachments' | 'draftsBySession'>,
  id: string,
): string | undefined {
  if (state.attachments.some((item) => item.id === id)) return state.sessionKey
  return Object.entries(state.draftsBySession).find(([, draft]) =>
    draft.attachments.some((item) => item.id === id),
  )?.[0]
}

function updateSessionDraft(
  state: ComposerState,
  sessionKey: string,
  draft: Draft,
): Partial<ComposerState> {
  return {
    ...(state.sessionKey === sessionKey ? draft : {}),
    draftsBySession: { ...state.draftsBySession, [sessionKey]: draft },
  }
}

export const useComposerStore = create<ComposerState>((set) => ({
  sessionKey: 'draft',
  switchSession: (sessionKey) => set((state) => {
    const saved = { text: state.text, attachments: state.attachments }
    const next = state.draftsBySession[sessionKey] ?? { text: '', attachments: [] }
    return {
      sessionKey,
      text: next.text,
      attachments: next.attachments,
      draftsBySession: { ...state.draftsBySession, [state.sessionKey]: saved },
    }
  }),
  text: initialDraft.text,
  draftsBySession: initialDrafts,
  setText: (text) => set((state) => ({
    text,
    draftsBySession: { ...state.draftsBySession, [state.sessionKey]: { text, attachments: state.attachments } },
  })),
  clear: () => set((state) => ({
    text: '',
    draftsBySession: { ...state.draftsBySession, [state.sessionKey]: { text: '', attachments: state.attachments } },
  })),
  attachments: initialDraft.attachments,
  addAttachment: (attachment) => set((state) => {
    if (state.attachments.some((item) => item.path === attachment.path && item.name === attachment.name)) return state
    const attachments = [...state.attachments, attachment].slice(0, 8)
    return {
      attachments,
      draftsBySession: { ...state.draftsBySession, [state.sessionKey]: { text: state.text, attachments } },
    }
  }),
  updateAttachment: (path, patch) => set((state) => {
    const attachments = state.attachments.map((item) => item.path === path ? { ...item, ...patch } : item)
    return { attachments, draftsBySession: { ...state.draftsBySession, [state.sessionKey]: { text: state.text, attachments } } }
  }),
  removeAttachment: (path) => set((state) => {
    const attachments = state.attachments.filter((item) => item.path !== path)
    return { attachments, draftsBySession: { ...state.draftsBySession, [state.sessionKey]: { text: state.text, attachments } } }
  }),
  clearAttachments: () => set((state) => ({
    attachments: [],
    draftsBySession: { ...state.draftsBySession, [state.sessionKey]: { text: state.text, attachments: [] } },
  })),
  updateAttachmentById: (id, patch) => set((state) => {
    const sessionKey = attachmentSession(state, id)
    if (!sessionKey) return state
    const draft = sessionKey === state.sessionKey
      ? { text: state.text, attachments: state.attachments }
      : state.draftsBySession[sessionKey]
    return updateSessionDraft(state, sessionKey, {
      ...draft,
      attachments: draft.attachments.map((item) => item.id === id ? { ...item, ...patch } : item),
    })
  }),
  moveDraft: (fromSessionKey, toSessionKey) => set((state) => {
    const source = fromSessionKey === state.sessionKey
      ? { text: state.text, attachments: state.attachments }
      : state.draftsBySession[fromSessionKey] ?? { text: '', attachments: [] }
    const draftsBySession = { ...state.draftsBySession, [toSessionKey]: source }
    delete draftsBySession[fromSessionKey]
    return {
      sessionKey: toSessionKey,
      text: source.text,
      attachments: source.attachments,
      draftsBySession,
    }
  }),
  replaceAttachmentById: (id, replacements) => set((state) => {
    const sessionKey = attachmentSession(state, id)
    // Removal while preparation was in flight wins over its late result.
    if (!sessionKey) return state
    const draft = sessionKey === state.sessionKey
      ? { text: state.text, attachments: state.attachments }
      : state.draftsBySession[sessionKey]
    const index = draft.attachments.findIndex((item) => item.id === id)
    const attachments = [...draft.attachments]
    attachments.splice(index, 1, ...replacements)
    return updateSessionDraft(state, sessionKey, { ...draft, attachments: attachments.slice(0, 8) })
  }),
  removeAttachmentsById: (ids) => set((state) => {
    const wanted = new Set(ids)
    const draftsBySession = Object.fromEntries(Object.entries(state.draftsBySession).map(([key, draft]) => [
      key,
      { ...draft, attachments: draft.attachments.filter((item) => !wanted.has(item.id)) },
    ]))
    const attachments = state.attachments.filter((item) => !wanted.has(item.id))
    draftsBySession[state.sessionKey] = { text: state.text, attachments }
    return { attachments, draftsBySession }
  }),
  restoreSubmission: (fallbackKey, attachmentIds, text) => set((state) => {
    const sessionKey = attachmentIds.map((id) => attachmentSession(state, id)).find(Boolean) ?? fallbackKey
    const draft = sessionKey === state.sessionKey
      ? { text: state.text, attachments: state.attachments }
      : state.draftsBySession[sessionKey] ?? { text: '', attachments: [] }
    // Preserve anything the user typed while the request was in flight.
    if (draft.text) return state
    return updateSessionDraft(state, sessionKey, { ...draft, text })
  }),
}))

useComposerStore.subscribe((state) => persistDrafts(state.draftsBySession))
