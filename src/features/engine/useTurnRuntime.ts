import { useCallback, useEffect, useReducer, useRef } from 'react'
import { toast } from 'sonner'
import {
  TRIGGERS_SESSION_REFRESH,
  createInitialTurnRuntime,
  engineEventToAction,
  turnRuntimeReducer,
} from './turnRuntime'
import {
  commandMessage,
  engineApi,
  onEngineEvent,
  type EngineEventMsg,
} from '../../services/engine'

/**
 * TurnRuntime: reducer vivo de ejecución. Suscribe eventos del engine,
 * despacha al reducer y expone reconciliación (snapshot), cancelación y
 * aprobaciones. No conoce sesiones, catálogo ni conexión.
 */
export function useTurnRuntime(options: { onSessionsChanged: () => void }) {
  const [state, dispatch] = useReducer(turnRuntimeReducer, undefined, createInitialTurnRuntime)

  // El callback siempre fresco sin resuscribir el listener (StrictMode-safe).
  const changedRef = useRef(options.onSessionsChanged)
  useEffect(() => {
    changedRef.current = options.onSessionsChanged
  })

  useEffect(() => {
    let unlisten: (() => void) | undefined
    let disposed = false
    void onEngineEvent((event: EngineEventMsg) => {
      const action = engineEventToAction(event)
      if (action) dispatch(action)
      if (TRIGGERS_SESSION_REFRESH.has(event.event)) changedRef.current()
    }).then((stop) => {
      // React StrictMode puede disponer este efecto antes de que listen()
      // resuelva: hay que cerrar esa suscripción tardía o cada delta se ve doble.
      if (disposed) stop()
      else unlisten = stop
    })
    return () => {
      disposed = true
      unlisten?.()
    }
  }, [])

  const restoreSnapshot = useCallback(async (): Promise<void> => {
    try {
      const result = await engineApi.snapshot()
      dispatch({ type: 'snapshot/restored', snapshot: result.snapshot, now: Date.now() })
    } catch {
      // El snapshot es metadata de recuperación; los eventos vivos mandan.
    }
  }, [])

  const cancelTurn = useCallback(
    async (sessionId: string): Promise<void> => {
      if (sessionId === '') return
      // Optimista permitido: "cancelling". El terminal solo lo confirma el engine.
      dispatch({ type: 'turn/cancelling', sessionId })
      // Sin terminal, reconciliar contra el snapshot en vez de inventar `cancelled`.
      window.setTimeout(() => {
        void restoreSnapshot()
      }, 8000)
      try {
        await engineApi.cancelTurn(sessionId)
      } catch (err) {
        toast.error(commandMessage(err))
        void restoreSnapshot()
      }
    },
    [restoreSnapshot],
  )

  const resolveApproval = useCallback(async (approvalId: string, decision: string): Promise<void> => {
    dispatch({ type: 'approval/resolving', approvalId })
    try {
      const result = await engineApi.resolveApproval(approvalId, decision)
      if (result.status !== 'resolved') {
        dispatch({ type: 'approval/settled', approvalId, turnId: '', sessionId: '' })
      }
    } catch (err) {
      toast.error(commandMessage(err))
      dispatch({ type: 'approval/pending', approvalId })
    }
  }, [])

  return {
    threads: state.threads,
    executions: state.executions,
    busySessions: state.busySessions,
    approvals: state.approvals,
    dispatch,
    restoreSnapshot,
    cancelTurn,
    resolveApproval,
  }
}

export type TurnRuntime = ReturnType<typeof useTurnRuntime>
