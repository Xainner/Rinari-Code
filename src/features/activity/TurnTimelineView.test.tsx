// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import type { TurnTimeline } from './types'
import TurnTimelineView from './TurnTimelineView'

const base: TurnTimeline = {
  turnId: 't1', sessionId: 's1', status: 'running', startedAt: 1_000,
  userMessage: 'Hola', items: [],
}

afterEach(cleanup)

function view(timeline: TurnTimeline, now: number, resolve = vi.fn()) {
  return render(<I18nProvider lang="es"><TurnTimelineView timeline={timeline} now={now} onResolveApproval={resolve} onContinue={vi.fn()} /></I18nProvider>)
}

describe('TurnTimelineView', () => {
  it('debounces thinking and keeps ordinary chat free of completion cards', () => {
    const rendered = view(base, 1_299)
    expect(screen.queryByText('Pensando…')).toBeNull()
    rendered.rerender(<I18nProvider lang="es"><TurnTimelineView timeline={base} now={1_301} onResolveApproval={vi.fn()} onContinue={vi.fn()} /></I18nProvider>)
    expect(screen.getByText('Pensando…')).toBeTruthy()
    rendered.rerender(<I18nProvider lang="es"><TurnTimelineView timeline={{ ...base, status: 'completed', completedAt: 2_000, items: [{ id: 'model:m1', type: 'model', activitySeq: 1, occurredAt: 2_000, modelCallId: 'm1', status: 'completed', content: 'Hola', outputKind: 'final' }] }} now={2_000} onResolveApproval={vi.fn()} onContinue={vi.fn()} /></I18nProvider>)
    expect(screen.getAllByText('Hola')).toHaveLength(2)
    expect(screen.queryByText(/acciones/)).toBeNull()
    expect(screen.queryByText('Completado')).toBeNull()
  })

  it('resolves an approval from its chronological row', async () => {
    const resolve = vi.fn()
    view({ ...base, status: 'approval', items: [{ id: 'approval:p1', type: 'approval', activitySeq: 1, occurredAt: 1_100, approvalId: 'p1', status: 'pending', capability: 'shell.exec', risk: 'high', description: 'Ejecutar comando' }] }, 1_200, resolve)
    await userEvent.click(screen.getByRole('button', { name: 'Permitir una vez' }))
    expect(resolve).toHaveBeenCalledWith('p1', 'allow_once')
  })

  it('shows cancelling immediately and disables pending approval controls', () => {
    view({ ...base, status: 'cancelling', items: [{ id: 'approval:p1', type: 'approval', activitySeq: 1, occurredAt: 1_100, approvalId: 'p1', status: 'resolving', capability: 'shell.exec', risk: 'high', description: 'Ejecutar comando' }] }, 1_101)
    expect(screen.getByText('Cancelando…')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Permitir una vez' }).hasAttribute('disabled')).toBe(true)
  })
})
