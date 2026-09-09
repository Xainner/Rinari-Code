import type { ProjectSummary, SessionSummary } from '../../services/engine'

/**
 * Modelo puro para el sidebar: agrupa sesiones bajo su proyecto por
 * `project_id` (identidad, nunca path matcheado a mano salvo fallback a
 * `project_root` para sesiones que lo traen sin id). Sin React: testeable.
 */
export interface ProjectSection {
  project: ProjectSummary
  sessions: SessionSummary[]
}

export interface WorkspaceModel {
  /** Una sección por proyecto reciente (aunque no tenga sesiones). */
  sections: ProjectSection[]
  /** CHATs + sesiones sin proyecto resoluble. */
  chats: SessionSummary[]
}

/** Nombre de display: última parte de la ruta. Solo presentación. */
export function projectDisplayName(root: string): string {
  const base = root.split(/[/\\]/).filter(Boolean).pop()
  return base && base.length > 0 ? base : root
}

export function buildWorkspaceModel(
  sessions: SessionSummary[],
  projects: ProjectSummary[],
): WorkspaceModel {
  const byId = new Map(projects.map((p) => [p.id, p] as const))
  const byRoot = new Map(projects.map((p) => [p.root, p] as const))
  const buckets = new Map<string, SessionSummary[]>()
  const chats: SessionSummary[] = []

  for (const session of sessions) {
    let projectId: string | null = null
    if (session.project_id && byId.has(session.project_id)) {
      projectId = session.project_id
    } else if (session.project_root && byRoot.has(session.project_root)) {
      projectId = byRoot.get(session.project_root)!.id
    }
    if (session.kind === 'PROJECT' && projectId) {
      const bucket = buckets.get(projectId) ?? []
      bucket.push(session)
      buckets.set(projectId, bucket)
    } else {
      chats.push(session)
    }
  }

  return {
    sections: projects.map((project) => ({
      project,
      sessions: buckets.get(project.id) ?? [],
    })),
    chats,
  }
}
