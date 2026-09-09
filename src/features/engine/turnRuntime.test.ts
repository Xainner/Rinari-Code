import { describe, expect, it } from 'vitest'
import {
  KNOWN_RUNTIME_NOOPS,
  createInitialTurnRuntime,
  engineEventToAction,
  turnRuntimeReducer,
  type TurnRuntimeState,
} from './turnRuntime'

const NOW = 1_700_000_000_000

function reduce(state: TurnRuntimeState, actions: Parameters<typeof turnRuntimeReducer>[1][]): TurnRuntimeState {
  return actions.reduce(turnRuntimeReducer, state)
}

function liveTurn(): TurnRuntimeState {
  return reduce(createInitialTurnRuntime(), [
    { type: 'turn/started', turnId: 't1', sessionId: 's1', now: NOW },
    { type: 'content/delta', turnId: 't1', sessionId: 's1', delta: 'hola', now: NOW + 1 },
  ])
}

describe('turn lifecycle', () => {
  it('started → delta → completed es determinista', () => {
    const state = reduce(liveTurn(), [
      { type: 'turn/completed', turnId: 't1', sessionId: 's1', content: '', now: NOW + 2 },
    ])
    expect(state.busySessions.has('s1')).toBe(false)
    expect(state.executions.t1.status).toBe('completed')
    expect(state.executions.t1.completedAt).toBe(NOW + 2)
    expect(state.threads.s1).toHaveLength(1)
    expect(state.threads.s1[0].content).toBe('hola')
    expect(state.threads.s1[0].pending).toBe(false)
  })

  it('el contenido final autoritativo gana al streameado', () => {
    const state = reduce(liveTurn(), [
      { type: 'turn/completed', turnId: 't1', sessionId: 's1', content: 'final', now: NOW + 2 },
    ])
    expect(state.threads.s1[0].content).toBe('final')
  })

  it('las herramientas running se asientan al terminal', () => {
    const state = reduce(createInitialTurnRuntime(), [
      { type: 'turn/started', turnId: 't1', sessionId: 's1', now: NOW },
      {
        type: 'tool/event',
        event: 'tool.started',
        sessionId: 's1',
        turnId: 't1',
        toolId: 'c1',
        tool: 'shell',
        detail: 'ls',
      },
      { type: 'turn/failed', turnId: 't1', sessionId: 's1', error: 'boom', now: NOW + 5 },
    ])
    expect(state.executions.t1.status).toBe('failed')
    expect(state.executions.t1.error).toBe('boom')
    expect(state.executions.t1.tools[0].status).toBe('failed')
    expect(state.busySessions.has('s1')).toBe(false)
  })
})

describe('cancelación sin estado inventado', () => {
  it('cancelling no cierra el turno ni libera el composer', () => {
    const state = reduce(liveTurn(), [{ type: 'turn/cancelling', sessionId: 's1' }])
    expect(state.executions.t1.status).toBe('cancelling')
    expect(state.executions.t1.completedAt).toBeUndefined()
    expect(state.busySessions.has('s1')).toBe(true)
  })

  it('el snapshot sin el turno libera busy pero no inventa terminal', () => {
    const cancelling = reduce(liveTurn(), [{ type: 'turn/cancelling', sessionId: 's1' }])
    const state = reduce(cancelling, [
      { type: 'snapshot/restored', snapshot: { active_turns: [], pending_approvals: [] }, now: NOW + 9_000 },
    ])
    // El composer se libera (el engine ya no posee el turno)…
    expect(state.busySessions.has('s1')).toBe(false)
    // …pero el turno ausente del snapshot tras reinicio se marca failed,
    // nunca cancelled inventado.
    expect(state.executions.t1.status).toBe('failed')
    expect(state.executions.t1.completedAt).toBe(NOW + 9_000)
  })

  it('el snapshot con el turno activo mantiene busy', () => {
    const cancelling = reduce(liveTurn(), [{ type: 'turn/cancelling', sessionId: 's1' }])
    const state = reduce(cancelling, [
      {
        type: 'snapshot/restored',
        snapshot: {
          active_turns: [{ turn_id: 't1', session_id: 's1', status: 'cancelling', activities: [] }],
          pending_approvals: [],
        },
        now: NOW + 9_000,
      },
    ])
    expect(state.busySessions.has('s1')).toBe(true)
    expect(state.executions.t1.status).toBe('cancelling')
    expect(state.executions.t1.completedAt).toBeUndefined()
  })

  it('solo el evento autoritativo marca cancelled', () => {
    const state = reduce(liveTurn(), [
      { type: 'turn/cancelling', sessionId: 's1' },
      { type: 'turn/cancelled', turnId: 't1', sessionId: 's1', now: NOW + 3 },
    ])
    expect(state.executions.t1.status).toBe('cancelled')
    expect(state.busySessions.has('s1')).toBe(false)
  })
})

describe('emergency stop (turn.stopped)', () => {
  const STOPPED = {
    type: 'turn/stopped',
    turnId: 't1',
    sessionId: 's1',
    reason: { code: 'emergency', message: 'safeguard', modelCalls: 500, toolCalls: 1832, wallTimeS: 6120 },
    now: NOW + 10,
  } as const

  it('es terminal pero distinto de completed y failed', () => {
    const state = reduce(liveTurn(), [STOPPED])
    expect(state.executions.t1.status).toBe('stopped')
    expect(state.executions.t1.completedAt).toBe(NOW + 10)
    expect(state.executions.t1.stopReason?.message).toBe('safeguard')
    expect(state.busySessions.has('s1')).toBe(false)
  })

  it('no inventa desenlace de herramientas ni marca verificado', () => {
    const withTool = reduce(createInitialTurnRuntime(), [
      { type: 'turn/started', turnId: 't1', sessionId: 's1', now: NOW },
      {
        type: 'tool/event',
        event: 'tool.started',
        sessionId: 's1',
        turnId: 't1',
        toolId: 'c1',
        tool: 'shell',
        detail: 'ls',
      },
      STOPPED,
    ])
    expect(withTool.executions.t1.tools[0].status).toBe('running')
    expect(withTool.executions.t1.error).toBeUndefined()
  })

  it('limpia aprobaciones del turno', () => {
    const state = reduce(liveTurn(), [
      {
        type: 'approval/requested',
        approval: {
          approval_id: 'a1',
          session_id: 's1',
          turn_id: 't1',
          capability: 'shell',
          target: null,
          risk: 'alto',
          description: 'rm',
          status: 'pending',
        },
      },
      STOPPED,
    ])
    expect(state.approvals).toHaveLength(0)
  })

  it('el mapper extrae reason y usage con defaults honestos', () => {
    expect(
      engineEventToAction(
        {
          type: 'x',
          event: 'turn.stopped',
          payload: {
            turn_id: 't',
            session_id: 's',
            reason: { code: 'wall_time', message: 'límite' },
            usage: { model_calls: 5, tool_calls: 9, wall_time_s: 61 },
          },
        },
        NOW,
      ),
    ).toEqual({
      type: 'turn/stopped',
      turnId: 't',
      sessionId: 's',
      reason: { code: 'wall_time', message: 'límite', modelCalls: 5, toolCalls: 9, wallTimeS: 61 },
      now: NOW,
    })
    const bare = engineEventToAction(
      { type: 'x', event: 'turn.stopped', payload: { turn_id: 't', session_id: 's' } },
      NOW,
    )
    expect(bare).toMatchObject({
      type: 'turn/stopped',
      reason: { code: 'emergency', modelCalls: undefined },
    })
  })
})

describe('aislamiento por sesión', () => {
  it('el terminal de una sesión no toca la otra', () => {
    const state = reduce(createInitialTurnRuntime(), [
      { type: 'turn/started', turnId: 't1', sessionId: 's1', now: NOW },
      { type: 'turn/started', turnId: 't2', sessionId: 's2', now: NOW },
      { type: 'turn/completed', turnId: 't1', sessionId: 's1', content: '', now: NOW + 1 },
    ])
    expect(state.busySessions.has('s1')).toBe(false)
    expect(state.busySessions.has('s2')).toBe(true)
    expect(state.executions.t2.completedAt).toBeUndefined()
  })
})

describe('historial y aprobaciones', () => {
  it('lo vivo gana a un historial tardío', () => {
    const state = reduce(liveTurn(), [
      {
        type: 'history/loaded',
        sessionId: 's1',
        messages: [{ id: 'h1', role: 'user', content: 'viejo', createdAt: 1 }],
      },
    ])
    expect(state.threads.s1).toHaveLength(1)
    expect(state.threads.s1[0].content).toBe('hola')
  })

  it('approval requested → settled limpia y retoma thinking', () => {
    const state = reduce(liveTurn(), [
      {
        type: 'approval/requested',
        approval: {
          approval_id: 'a1',
          session_id: 's1',
          turn_id: 't1',
          capability: 'shell',
          target: null,
          risk: 'alto',
          description: 'rm',
          status: 'pending',
        },
      },
      { type: 'approval/settled', approvalId: 'a1', turnId: 't1', sessionId: 's1' },
    ])
    expect(state.approvals).toHaveLength(0)
    expect(state.executions.t1.status).toBe('thinking')
  })
})

describe('engineEventToAction', () => {
  it('todo evento conocido mapea a acción o es noop declarado', () => {
    // Inventario del contrato de eventos que el desktop consume (§6.6 del
    // review): si el engine agrega un evento y este test no lo lista, hay
    // que decidir aquí si toca runtime o es noop explícito.
    const known: Array<{ event: string; payload: Record<string, unknown> }> = [
      { event: 'turn.started', payload: { turn_id: 't', session_id: 's' } },
      { event: 'turn.preparing', payload: { turn_id: 't', session_id: 's', stage: 'x' } },
      { event: 'model.started', payload: { turn_id: 't', session_id: 's' } },
      { event: 'model.completed', payload: { turn_id: 't', session_id: 's' } },
      { event: 'model.failed', payload: { turn_id: 't', session_id: 's' } },
      { event: 'model.content.delta', payload: { turn_id: 't', session_id: 's', delta: 'z' } },
      { event: 'turn.completed', payload: { turn_id: 't', session_id: 's', content: 'c' } },
      { event: 'turn.cancelled', payload: { turn_id: 't', session_id: 's' } },
      { event: 'turn.failed', payload: { turn_id: 't', session_id: 's', error: { message: 'e' } } },
      { event: 'turn.stopped', payload: { turn_id: 't', session_id: 's', reason: { code: 'x' } } },
      {
        event: 'approval.requested',
        payload: { approval_id: 'a', session_id: 's', turn_id: 't', capability: 'shell' },
      },
      { event: 'approval.resolved', payload: { approval_id: 'a', turn_id: 't', session_id: 's' } },
      { event: 'approval.expired', payload: { approval_id: 'a', turn_id: 't', session_id: 's' } },
      {
        event: 'tool.started',
        payload: { turn_id: 't', session_id: 's', tool_call_id: 'c', tool: 'shell' },
      },
      {
        event: 'tool.completed',
        payload: { turn_id: 't', session_id: 's', tool_call_id: 'c', tool: 'shell' },
      },
      { event: 'session.mode.changed', payload: {} },
      { event: 'session.model.changed', payload: {} },
    ]
    for (const { event, payload } of known) {
      const action = engineEventToAction({ type: 'x', event, payload }, NOW)
      expect(
        action !== null || KNOWN_RUNTIME_NOOPS.has(event),
        `${event} debe mapear o ser noop declarado`,
      ).toBe(true)
    }
  })
  it('eventos desconocidos y model.completed no tocan el runtime', () => {
    expect(engineEventToAction({ type: 'x', event: 'nope', payload: {} }, NOW)).toBeNull()
    expect(
      engineEventToAction({ type: 'x', event: 'model.completed', payload: {} }, NOW),
    ).toBeNull()
  })

  it('mapea delta y terminal con el now inyectado', () => {
    expect(
      engineEventToAction(
        { type: 'x', event: 'model.content.delta', payload: { turn_id: 't', session_id: 's', delta: 'z' } },
        NOW,
      ),
    ).toEqual({ type: 'content/delta', turnId: 't', sessionId: 's', delta: 'z', now: NOW })
    expect(
      engineEventToAction(
        { type: 'x', event: 'turn.completed', payload: { turn_id: 't', session_id: 's', content: 'c' } },
        NOW,
      ),
    ).toEqual({ type: 'turn/completed', turnId: 't', sessionId: 's', content: 'c', now: NOW })
  })
})
