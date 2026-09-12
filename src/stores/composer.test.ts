// @vitest-environment jsdom
import { beforeEach, expect, it } from 'vitest'
import type { AttachmentRef } from '../types'
import { useComposerStore } from './composer'

const pending: AttachmentRef = {
  id: 'attachment-one',
  path: 'C:/one.pdf',
  name: 'one.pdf',
  source: 'native',
  status: 'preparing',
}

beforeEach(() => {
  window.localStorage.clear()
  useComposerStore.setState({
    sessionKey: 'session-a',
    text: 'inspect',
    attachments: [pending],
    draftsBySession: {
      'session-a': { text: 'inspect', attachments: [pending] },
      'session-b': { text: 'other', attachments: [] },
    },
  })
})

it('applies a late preparation result to its owning draft after a session switch', () => {
  useComposerStore.getState().switchSession('session-b')
  useComposerStore.getState().replaceAttachmentById(pending.id, [
    { ...pending, id: 'prepared-one', status: 'ready', uri: 'artifact://prepared' },
  ])

  expect(useComposerStore.getState().attachments).toEqual([])
  expect(useComposerStore.getState().draftsBySession['session-a'].attachments[0]).toMatchObject({
    id: 'prepared-one',
    status: 'ready',
  })
})

it('moves a start-screen draft into the session created for preparation', () => {
  useComposerStore.getState().moveDraft('session-a', 'session-created')

  const state = useComposerStore.getState()
  expect(state.sessionKey).toBe('session-created')
  expect(state.text).toBe('inspect')
  expect(state.attachments).toEqual([pending])
  expect(state.draftsBySession['session-a']).toBeUndefined()
})

it('does not resurrect an attachment removed while preparation is in flight', () => {
  useComposerStore.getState().removeAttachmentsById([pending.id])
  useComposerStore.getState().replaceAttachmentById(pending.id, [
    { ...pending, status: 'ready', uri: 'artifact://late' },
  ])

  expect(useComposerStore.getState().attachments).toEqual([])
})

it('restores failed submission text in the draft that still owns its attachment', () => {
  useComposerStore.getState().switchSession('session-b')
  useComposerStore.getState().restoreSubmission('session-a', [pending.id], 'inspect')

  expect(useComposerStore.getState().text).toBe('other')
  expect(useComposerStore.getState().draftsBySession['session-a'].text).toBe('inspect')
})
