import { describe, expect, it } from 'vitest'
import type { ProjectSummary, SessionSummary } from '../../services/engine'
import { buildWorkspaceModel, projectDisplayName } from './workspaceModel'

function session(partial: Partial<SessionSummary> & { id: string }): SessionSummary {
  return {
    kind: 'CHAT',
    title: null,
    mode: 'build',
    state: 'active',
    updated_at: '2026-09-09T00:00:00Z',
    project_id: null,
    project_root: null,
    current_cwd: null,
    git_branch: null,
    last_active_at: '2026-09-09T00:00:00Z',
    provider_id: 'p',
    model_id: 'm',
    permission_profile: 'workspace',
    effective_permission_profile: 'workspace',
    ...partial,
  }
}

function project(partial: Partial<ProjectSummary> & { id: string; root: string }): ProjectSummary {
  return {
    git_fingerprint: null,
    last_opened_at: '2026-09-09T00:00:00Z',
    active_session_id: null,
    ...partial,
  }
}

describe('projectDisplayName', () => {
  it('usa la última parte de la ruta', () => {
    expect(projectDisplayName('C:\\Projects\\Rinari-CLI')).toBe('Rinari-CLI')
    expect(projectDisplayName('/home/u/Rinari-Code')).toBe('Rinari-Code')
    expect(projectDisplayName('/')).toBe('/')
  })
})

describe('buildWorkspaceModel', () => {
  it('agrupa por project_id y separa chats', () => {
    const projects = [project({ id: 'p1', root: '/r/cli' })]
    const sessions = [
      session({ id: 's1', kind: 'PROJECT', project_id: 'p1', title: 'Fix' }),
      session({ id: 's2', kind: 'CHAT', title: 'Research' }),
    ]
    const model = buildWorkspaceModel(sessions, projects)
    expect(model.sections).toHaveLength(1)
    expect(model.sections[0].sessions.map((s) => s.id)).toEqual(['s1'])
    expect(model.chats.map((s) => s.id)).toEqual(['s2'])
  })

  it('resuelve por project_root cuando falta project_id', () => {
    const projects = [project({ id: 'p1', root: '/r/cli' })]
    const sessions = [session({ id: 's1', kind: 'PROJECT', project_root: '/r/cli' })]
    const model = buildWorkspaceModel(sessions, projects)
    expect(model.sections[0].sessions.map((s) => s.id)).toEqual(['s1'])
    expect(model.chats).toHaveLength(0)
  })

  it('muestra proyectos sin sesiones y manda huérfanos a chats', () => {
    const projects = [
      project({ id: 'p1', root: '/r/cli' }),
      project({ id: 'p2', root: '/r/luma' }),
    ]
    const sessions = [session({ id: 's1', kind: 'PROJECT', project_id: 'px' })]
    const model = buildWorkspaceModel(sessions, projects)
    expect(model.sections).toHaveLength(2)
    expect(model.sections[1].sessions).toHaveLength(0)
    expect(model.chats.map((s) => s.id)).toEqual(['s1'])
  })

  it('preserva el orden del engine', () => {
    const projects = [project({ id: 'p1', root: '/r/cli' })]
    const sessions = [
      session({ id: 's2', kind: 'PROJECT', project_id: 'p1' }),
      session({ id: 's1', kind: 'PROJECT', project_id: 'p1' }),
    ]
    const model = buildWorkspaceModel(sessions, projects)
    expect(model.sections[0].sessions.map((s) => s.id)).toEqual(['s2', 's1'])
  })
})
