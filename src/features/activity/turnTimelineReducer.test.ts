import { describe, expect, it } from 'vitest'
import { buildChatStream } from './buildChatStream'
import { createInitialTimelineState, engineEventAction, turnTimelineReducer } from './turnTimelineReducer'

const NOW = 1_700_000_000_000
const event = (name: string, payload: Record<string, unknown>) => engineEventAction({ type: 'event', event: name, payload }, NOW)!

describe('narrative activity timeline', () => {
  it('retains the mode of the turn independently of later session changes', () => {
    let state = turnTimelineReducer(createInitialTimelineState(), event('turn.started', { turn_id: 'plan', session_id: 's1', mode: 'plan' }))
    state = turnTimelineReducer(state, event('turn.completed', { turn_id: 'plan', session_id: 's1' }))
    state = turnTimelineReducer(state, event('turn.started', { turn_id: 'build', session_id: 's1', mode: 'build' }))
    expect(state.timelines.plan.mode).toBe('plan')
    expect(state.timelines.build.mode).toBe('build')
  })
  it('merges model deltas and completion into one logical call', () => {
    let state = createInitialTimelineState()
    state = turnTimelineReducer(state, event('turn.started', { turn_id: 't1', session_id: 's1' }))
    state = turnTimelineReducer(state, event('model.started', { turn_id: 't1', session_id: 's1', model_call_id: 'm1', activity_seq: 1 }))
    state = turnTimelineReducer(state, event('model.content.delta', { turn_id: 't1', session_id: 's1', model_call_id: 'm1', activity_seq: 1, delta: 'Ho' }))
    state = turnTimelineReducer(state, event('model.content.completed', { turn_id: 't1', session_id: 's1', model_call_id: 'm1', activity_seq: 1, content: 'Hola', output_kind: 'final' }))
    expect(state.timelines.t1.items).toHaveLength(1)
    expect(state.timelines.t1.items[0]).toMatchObject({ type: 'model', content: 'Hola', outputKind: 'final' })
  })

  it('keeps separate tool calls ordered and settles the turn', () => {
    let state = createInitialTimelineState()
    state = turnTimelineReducer(state, event('turn.started', { turn_id: 't1', session_id: 's1' }))
    state = turnTimelineReducer(state, event('tool.started', { turn_id: 't1', session_id: 's1', tool_call_id: 'b', tool: 'shell.exec', activity_seq: 3 }))
    state = turnTimelineReducer(state, event('tool.completed', { turn_id: 't1', session_id: 's1', tool_call_id: 'a', tool: 'file.read', activity_seq: 2 }))
    state = turnTimelineReducer(state, event('turn.completed', { turn_id: 't1', session_id: 's1' }))
    expect(state.timelines.t1.items.map((item) => item.id)).toEqual(['tool:a', 'tool:b'])
    expect(state.timelines.t1.status).toBe('completed')
    expect(state.busySessions.has('s1')).toBe(false)
  })

  it('updates approval in place and disables it after resolution', () => {
    let state = createInitialTimelineState()
    state = turnTimelineReducer(state, event('approval.requested', { turn_id: 't1', session_id: 's1', approval_id: 'p1', activity_seq: 1, capability: 'shell.exec' }))
    state = turnTimelineReducer(state, event('approval.resolved', { turn_id: 't1', session_id: 's1', approval_id: 'p1', activity_seq: 1, decision: 'allow_once' }))
    expect(state.timelines.t1.items).toHaveLength(1)
    expect(state.timelines.t1.items[0]).toMatchObject({ type: 'approval', status: 'allowed' })
    expect(state.approvals).toHaveLength(0)
  })

  it('preserves non-reusable approval choices from the engine', () => {
    const state = turnTimelineReducer(createInitialTimelineState(), event('approval.requested', {
      turn_id: 't1', session_id: 's1', approval_id: 'p1', activity_seq: 1,
      capability: 'fs.write', choices: ['deny', 'allow_once'],
      rule_id: 'sensitive_file_write', reusable: false,
    }))
    expect(state.timelines.t1.items[0]).toMatchObject({
      type: 'approval', choices: ['deny', 'allow_once'],
      ruleId: 'sensitive_file_write', reusable: false,
    })
  })

  it('deduplicates changeset lifecycle and retains its persisted files', () => {
    let state = createInitialTimelineState()
    state = turnTimelineReducer(state, event('turn.changes.completed', {
      turn_id: 't1', session_id: 's1', id: 'chg1', activity_seq: 4,
      additions: 2, deletions: 1, undoable: true, attribution_complete: true,
      warnings: [], files: [{ path: 'a.ts', absolute_path: '/repo/a.ts', kind: 'modified', ownership: 'agent', confidence: 'exact', binary: false, sensitive: false, diff: '+x', diff_truncated: false, undoable: true }],
    }))
    state = turnTimelineReducer(state, event('turn.changes.undo.completed', {
      turn_id: 't1', session_id: 's1', changeset_id: 'chg1', activity_seq: 8,
      status: 'undone', applied: ['a.ts'], skipped: [], conflicts: [],
    }))
    expect(state.timelines.t1.items).toHaveLength(1)
    expect(state.timelines.t1.items[0]).toMatchObject({
      type: 'changeset', changesetId: 'chg1', status: 'undone',
      additions: 2, files: [{ path: 'a.ts' }],
    })
  })

  it('deduplicates history messages covered by a timeline', () => {
    const timeline = { turnId: 't1', sessionId: 's1', status: 'completed' as const, startedAt: NOW, completedAt: NOW + 1, userMessage: 'Hola', items: [] }
    const rows = buildChatStream([
      { id: 'u', role: 'user', content: 'Hola', createdAt: NOW, turnId: 't1' },
      { id: 'a', role: 'assistant', content: 'Hola', createdAt: NOW + 1, turnId: 't1' },
    ], { t1: timeline }, 's1')
    expect(rows).toHaveLength(1)
    expect(rows[0].kind).toBe('timeline')
  })

  it('reconciles a snapshot into the live model row without repeating content', () => {
    let state = createInitialTimelineState()
    state = turnTimelineReducer(state, event('model.content.delta', { turn_id: 't1', session_id: 's1', model_call_id: 'm1', activity_seq: 1, delta: 'Hola' }))
    state = turnTimelineReducer(state, {
      type: 'snapshot/restored',
      now: NOW + 1,
      snapshot: { active_turns: [{ turn_id: 't1', session_id: 's1', started_at: NOW, items: [{ event: 'model.content.delta', turn_id: 't1', session_id: 's1', model_call_id: 'm1', activity_seq: 1, content: 'Hola', delta: 'Hola' }] }] },
    })
    expect(state.timelines.t1.items).toHaveLength(1)
    expect(state.timelines.t1.items[0]).toMatchObject({ content: 'Hola' })
  })

  it('lets persisted terminal history settle a live timeline', () => {
    let state = createInitialTimelineState()
    state = turnTimelineReducer(state, event('turn.started', { turn_id: 't1', session_id: 's1' }))
    state = turnTimelineReducer(state, { type: 'timeline/loaded', sessionId: 's1', turns: [{ turn_id: 't1', session_id: 's1', turn_index: 0, status: 'completed', started_at: new Date(NOW).toISOString(), completed_at: new Date(NOW + 2).toISOString(), user_message: 'Hola', items: [], final_response: 'Hola' }] })
    expect(state.timelines.t1.status).toBe('completed')
    expect(state.timelines.t1.items).toHaveLength(1)
  })
})
