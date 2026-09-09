// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import type { ProjectSummary, SessionSummary } from '../../services/engine'
import { AppSidebar, type AppSidebarProps } from './AppSidebar'

const now = '2026-09-09T00:00:00Z'
afterEach(cleanup)

function project(id: string, name: string, archived = false): ProjectSummary {
  return {
    id,
    root: `/repo/${id}`,
    canonical_root: `/repo/${id}`,
    name,
    description: `${name} description`,
    pinned: false,
    archived,
    git_fingerprint: null,
    created_at: now,
    updated_at: now,
    last_opened_at: now,
    active_session_id: null,
  }
}

function session(
  id: string,
  title: string,
  projectId: string | null = null,
  state: SessionSummary['state'] = 'active',
): SessionSummary {
  return {
    id,
    kind: projectId ? 'PROJECT' : 'CHAT',
    title,
    mode: 'build',
    state,
    updated_at: now,
    project_id: projectId,
    project_root: projectId ? `/repo/${projectId}` : null,
    current_cwd: null,
    git_branch: null,
    last_active_at: now,
    provider_id: 'provider',
    model_id: 'model',
    permission_profile: 'workspace',
    effective_permission_profile: 'workspace',
  }
}

function renderSidebar(overrides: Partial<AppSidebarProps> = {}) {
  const props: AppSidebarProps = {
    collapsed: false,
    onToggleCollapse: vi.fn(),
    onSearch: vi.fn(),
    onOpenSettings: vi.fn(),
    onOpenEngine: vi.fn(),
    onOpenProjectHome: null,
    onNewChat: vi.fn(),
    onOpenFolder: vi.fn(),
    sessions: [session('project-session', 'Fix governor', 'project'), session('chat', 'Research')],
    closedSessions: [],
    archivedSessions: [],
    projects: [project('project', 'Rinari CLI')],
    archivedProjects: [project('old', 'Old project', true)],
    activeId: 'chat',
    onSelectSession: vi.fn(),
    onOpenProject: vi.fn(),
    onCloseSession: vi.fn(),
    onRenameSession: vi.fn(),
    onArchiveSession: vi.fn(),
    onRestoreSession: vi.fn(),
    onForkSession: vi.fn(),
    onDeleteSession: vi.fn(),
    onUpdateProject: vi.fn(),
    onArchiveProject: vi.fn(),
    approvals: [],
    ...overrides,
  }
  render(<I18nProvider lang="es"><AppSidebar {...props} /></I18nProvider>)
  return props
}

describe('AppSidebar project and session lifecycle', () => {
  it('separates project sessions from standalone chats and searches both', async () => {
    renderSidebar()
    expect(screen.getByText('Rinari CLI')).toBeTruthy()
    expect(screen.getByText('Fix governor')).toBeTruthy()
    expect(screen.getByText('Research')).toBeTruthy()

    const search = screen.getByPlaceholderText('Buscar proyectos y sesiones…')
    await userEvent.type(search, 'governor')
    expect(screen.getByText('Fix governor')).toBeTruthy()
    expect(screen.queryByText('Research')).toBeNull()
  })

  it('restores archived projects through the engine callback', async () => {
    const props = renderSidebar()
    await userEvent.click(screen.getByRole('button', { name: /Proyectos archivados/ }))
    expect(screen.getByText('Old project')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Restaurar proyecto' }))
    expect(props.onUpdateProject).toHaveBeenCalledWith('old', { archived: false })
  })

  it('keeps archived sessions distinct from merely closed sessions', async () => {
    const props = renderSidebar({
      archivedProjects: [],
      archivedSessions: [session('archived', 'Archived investigation', null, 'archived')],
      closedSessions: [session('closed', 'Closed draft', null, 'closed')],
    })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Sesiones archivadas/ }))
    expect(screen.getByText('Archived investigation')).toBeTruthy()
    await user.click(screen.getAllByRole('button', { name: 'Opciones de sesión' }).at(-1)!)
    await user.click(screen.getByRole('menuitem', { name: /Restaurar/ }))
    expect(props.onRestoreSession).toHaveBeenCalledWith('archived')
  })

  it('exposes fork, archive and rename instead of hiding engine lifecycle actions', async () => {
    const props = renderSidebar({ archivedProjects: [] })
    const user = userEvent.setup()
    const options = () => screen.getAllByRole('button', { name: 'Opciones de sesión' })[0]

    await user.click(options())
    await user.click(screen.getByRole('menuitem', { name: /Bifurcar/ }))
    expect(props.onForkSession).toHaveBeenCalledWith('project-session')

    await user.click(options())
    await user.click(screen.getByRole('menuitem', { name: /Archivar/ }))
    expect(props.onArchiveSession).toHaveBeenCalledWith('project-session')

    await user.click(options())
    await user.click(screen.getByRole('menuitem', { name: /Renombrar/ }))
    const title = screen.getByRole('textbox', { name: 'Renombrar' })
    await user.clear(title)
    await user.type(title, 'Governor complete')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(props.onRenameSession).toHaveBeenCalledWith('project-session', 'Governor complete')
  })
})
