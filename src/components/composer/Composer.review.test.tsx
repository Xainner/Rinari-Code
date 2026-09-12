// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import { useComposerStore } from '../../stores/composer'
import type { AttachmentRef } from '../../types'
import type { ModelSummary } from '../../services/engine'
import Composer from './Composer'

beforeEach(() => useComposerStore.setState({ sessionKey: 'draft', text: 'Revisa esto', attachments: [], draftsBySession: {} }))
afterEach(cleanup)

function mount(onSend = vi.fn().mockResolvedValue(true), attachment?: AttachmentRef, vision = true) {
  if (attachment) useComposerStore.getState().addAttachment(attachment)
  render(<I18nProvider lang="es"><Composer placement="bottom" onSend={onSend} isStreaming={false}
    onStop={vi.fn()} models={[]} activeAlias="Modelo" activeModel={{ capabilities: { vision } } as unknown as ModelSummary}
    onUseModel={vi.fn()} onDiscoverModels={vi.fn()} onOpenProviders={vi.fn()} sessionMode="build"
    onModeChange={vi.fn()} reasoningEffort="off" onReasoningChange={vi.fn()} permissionProfile="workspace"
    effectivePermissionProfile="workspace" permissionProfilesV2 onPermissionChange={vi.fn()}
    onSearchFiles={async () => ({ root: '/', files: [] })} /></I18nProvider>)
  return onSend
}

it('restores the text and keeps prepared attachments when transport rejects', async () => {
  const attachment = { id: 'one', path: '/nota.txt', name: 'nota.txt', source: 'workspace', kind: 'text', status: 'ready' } as AttachmentRef
  const send = mount(vi.fn().mockRejectedValue(new Error('transport unavailable')), attachment)
  await userEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }))
  await waitFor(() => expect(send).toHaveBeenCalledOnce())
  await waitFor(() => expect(useComposerStore.getState().text).toBe('Revisa esto'))
  expect(useComposerStore.getState().attachments[0].status).toBe('ready')
})

it('does not submit while an attachment is preparing', async () => {
  const send = mount(undefined, { id: 'pending', path: '/doc.pdf', name: 'doc.pdf', source: 'workspace', kind: 'pdf', status: 'preparing' })
  await userEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }))
  expect(send).not.toHaveBeenCalled()
})

it('does not send selected PDF visual pages to a model without vision', async () => {
  const send = mount(undefined, { id: 'pdf', path: '/doc.pdf', name: 'doc.pdf', source: 'workspace', kind: 'pdf', status: 'ready', visualPages: [1] }, false)
  await userEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }))
  expect(send).not.toHaveBeenCalled()
})
