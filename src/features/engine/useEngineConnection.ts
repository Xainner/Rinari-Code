import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { commandMessage, engineApi, type EngineStatus } from '../../services/engine'

/**
 * EngineConnectionController: estado del engine (stopped/starting/…/failed)
 * más arranque, reinicio y apagado. No toca sesiones, catálogo ni turnos;
 * la composición (refresh + snapshot tras ready) vive en useEngineSession.
 */
export function useEngineConnection() {
  const [status, setStatus] = useState<EngineStatus | null>(null)

  const refreshStatus = useCallback(async (): Promise<void> => {
    try {
      setStatus(await engineApi.status())
    } catch (err) {
      toast.error(commandMessage(err))
    }
  }, [])

  const start = useCallback(async (): Promise<EngineStatus | null> => {
    try {
      const next = await engineApi.start()
      setStatus(next)
      return next
    } catch (err) {
      toast.error(commandMessage(err))
      await refreshStatus()
      return null
    }
  }, [refreshStatus])

  const restart = useCallback(async (): Promise<EngineStatus | null> => {
    try {
      const next = await engineApi.restart()
      setStatus(next)
      return next
    } catch (err) {
      toast.error(commandMessage(err))
      await refreshStatus()
      return null
    }
  }, [refreshStatus])

  const shutdown = useCallback(async (): Promise<void> => {
    try {
      setStatus(await engineApi.shutdown())
    } catch (err) {
      toast.error(commandMessage(err))
    }
  }, [])

  return {
    status,
    ready: status?.state === 'ready',
    refreshStatus,
    start,
    restart,
    shutdown,
  }
}

export type EngineConnection = ReturnType<typeof useEngineConnection>
