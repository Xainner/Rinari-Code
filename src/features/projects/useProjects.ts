import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  commandMessage,
  engineApi,
  type ProjectIntelligence,
  type ProjectStatus,
  type ProjectSummary,
} from '../../services/engine'

/**
 * Projects: proyectos recientes del engine, apertura, estado Git vivo e
 * inteligencia. Identidad y metadata siempre engine-owned; aquí solo
 * cachés de lectura (status/intelligence por root) + mutación delegada.
 */
export function useProjects(options: { engineReady: boolean }) {
  const { engineReady } = options
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [projectsError, setProjectsError] = useState<string | null>(null)
  const [statusByRoot, setStatusByRoot] = useState<Record<string, ProjectStatus>>({})
  const [statusErrorByRoot, setStatusErrorByRoot] = useState<Record<string, string>>({})
  const [intelByRoot, setIntelByRoot] = useState<Record<string, ProjectIntelligence>>({})

  const refreshProjects = useCallback(async (): Promise<void> => {
    try {
      const result = await engineApi.projectRecents()
      setProjects(result.projects)
      setProjectsError(null)
    } catch (err) {
      setProjectsError(commandMessage(err))
      toast.error(commandMessage(err))
    }
  }, [])

  useEffect(() => {
    if (engineReady) void refreshProjects()
  }, [engineReady, refreshProjects])

  /** Registra (sin inicializar) y devuelve proyecto + sesión recomendada. */
  const openProject = useCallback(async (path: string) => {
    try {
      return await engineApi.projectOpen(path)
    } catch (err) {
      toast.error(commandMessage(err))
      return null
    }
  }, [])

  const loadStatus = useCallback(async (root: string): Promise<void> => {
    if (!root) return
    try {
      const status = await engineApi.projectStatus(root)
      setStatusByRoot((prev) => ({ ...prev, [root]: status }))
      setStatusErrorByRoot((prev) => {
        const next = { ...prev }
        delete next[root]
        return next
      })
    } catch (err) {
      // Carpeta ausente o ilegible: se representa, no se esconde.
      setStatusErrorByRoot((prev) => ({ ...prev, [root]: commandMessage(err) }))
    }
  }, [])

  const loadIntelligence = useCallback(async (root: string): Promise<void> => {
    if (!root) return
    try {
      const intel = await engineApi.projectIntelligence(root)
      setIntelByRoot((prev) => ({ ...prev, [root]: intel }))
    } catch (err) {
      toast.error(commandMessage(err))
    }
  }, [])

  return {
    projects,
    projectsError,
    refreshProjects,
    openProject,
    statusByRoot,
    statusErrorByRoot,
    loadStatus,
    intelByRoot,
    loadIntelligence,
  }
}

export type Projects = ReturnType<typeof useProjects>
