import { expect, it } from 'vitest'
import { createInitialTimelineState, engineEventAction, turnTimelineReducer } from './turnTimelineReducer'

const identifiers = { session_id: 'session', turn_id: 'turn', tool_call_id: 'command', tool: 'shell.exec', activity_seq: 1 }
const event = (name: string, payload: Record<string, unknown>) => engineEventAction({ type: 'event', event: name, payload: { ...identifiers, ...payload } }, 1000)!

it('does not reopen completed commands when an old output fragment is replayed', () => {
  let state = createInitialTimelineState()
  const delta = event('tool.output.delta', { stream: 'stdout', stream_seq: 1, offset_start: 0, offset_end: 3, delta: '😀ñ\n' })
  state = turnTimelineReducer(state, delta)
  state = turnTimelineReducer(state, event('tool.completed', { presentation: { kind: 'command', status: 'success', exit_code: 0, stdout: '😀ñ\n', stderr: '' } }))
  state = turnTimelineReducer(state, delta)
  expect(state.timelines.turn.items[0]).toMatchObject({ status: 'completed', presentation: { stdout: '😀ñ\n' } })
})

it('bounds the live output window before completion', () => {
  let state = createInitialTimelineState()
  for (let index = 0; index < 10; index++) {
    state = turnTimelineReducer(state, event('tool.output.delta', { stream: 'stdout', stream_seq: index + 1,
      offset_start: index * 8000, offset_end: (index + 1) * 8000, delta: 'x'.repeat(8000) }))
  }
  const item = state.timelines.turn.items[0]
  expect(item.type).toBe('tool')
  if (item.type !== 'tool') throw new Error('Missing tool')
  expect(item.presentation?.stdout?.length).toBeLessThanOrEqual(64000)
  expect(item.presentation?.truncated).toBe(true)
})

it('deduplicates a repeated Unicode fragment while streaming', () => {
  let state = createInitialTimelineState()
  const delta = event('tool.output.delta', { stream: 'stdout', stream_seq: 1, offset_start: 0, offset_end: 3, delta: '😀ñ\n' })
  state = turnTimelineReducer(state, delta)
  state = turnTimelineReducer(state, delta)
  expect(state.timelines.turn.items[0]).toMatchObject({ presentation: { stdout: '😀ñ\n' } })
})

it('keeps the hard capture limit distinct from the visible output window', () => {
  let state = createInitialTimelineState()
  state = turnTimelineReducer(state, event('tool.completed', {
    presentation: {
      kind: 'command',
      status: 'success',
      stdout: 'visible tail',
      truncated: true,
      capture_truncated: true,
    },
  }))
  const item = state.timelines.turn.items[0]
  expect(item.type).toBe('tool')
  if (item.type !== 'tool') throw new Error('Missing tool')
  expect(item.presentation).toMatchObject({ truncated: true, capture_truncated: true })
})
