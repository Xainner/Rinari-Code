// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n'
import type { ProjectStatus, ProjectSummary } from '../../services/engine'
import ProjectHome from './ProjectHome'

const now = '2026-09-09T00:00:00Z'
afterEach(cleanup)
const project: ProjectSummary = {
  id: 'project',
  root: '/repo/project',
  canonical_root: '/repo/project',
  name: 'Rinari',
  description: 'Desktop harness',
  pinned: false,
  archived: false,
  git_fingerprint: null,
  created_at: now,
  updated_at: now,
  last_opened_at: now,
  active_session_id: null,
}
const status: ProjectStatus = {
  project: { root: project.root },
  exists: true,
  status: {
    available: true,
    branch: null,
    head: '0123456789abcdef',
    dirty: true,
    files: [{ path: 'src/App.tsx', staged: null, unstaged: 'M' }],
    detached: true,
    ahead: 2,
    behind: 1,
    error: null,
  },
  active_session_id: null,
}

describe('ProjectHome', () => {
  it('edits engine-owned metadata and renders detached Git truth', async () => {
    const onUpdate = vi.fn().mockResolvedValue(true)
    render(
      <I18nProvider lang="es">
        <ProjectHome
          root={project.root}
          project={project}
          sessions={[]}
          activeId=""
          status={status}
          statusError={null}
          intel={null}
          onBack={vi.fn()}
          onSelectSession={vi.fn()}
          onNewSession={vi.fn()}
          onEnsure={vi.fn()}
          onTrust={vi.fn()}
          onUpdate={onUpdate}
          onArchive={vi.fn()}
        />
      </I18nProvider>,
    )
    expect(screen.getByText(/detached · 01234567/)).toBeTruthy()
    expect(screen.getByText(/Con cambios · 1/)).toBeTruthy()

    const name = screen.getByLabelText('Nombre')
    await userEvent.clear(name)
    await userEvent.type(name, 'Rinari Engine')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(onUpdate).toHaveBeenCalledWith({ name: 'Rinari Engine', description: 'Desktop harness' })
  })
})
