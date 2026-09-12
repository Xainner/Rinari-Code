// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import ProcessesPanel from './ProcessesPanel'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn() }))
afterEach(() => { cleanup(); vi.clearAllMocks() })

it('shows a managed server, its output, and sends stop with session ownership', async () => {
  const row = { id: 'process:proc_001', kind: 'process', command: 'npm run dev', cwd: 'C:/Site', running: true, can_stop: true }
  vi.mocked(invoke).mockImplementation(async (command) => {
    if (command === 'workspace_process_list') return { processes: [row], truncated: false }
    if (command === 'workspace_process_read') return { process: row, stdout: 'Servidor listo\n', stderr: 'aviso', truncated: false }
    if (command === 'workspace_process_stop') { row.running = false; row.can_stop = false; return { running: false } }
    throw new Error('Unexpected command')
  })
  render(<ProcessesPanel sessionId="s1" />)
  fireEvent.click(screen.getByText('Procesos'))
  expect(await screen.findByText('Servidor listo')).toBeTruthy()
  expect(screen.getByText('aviso')).toBeTruthy()
  fireEvent.click(screen.getByText('Detener'))
  await waitFor(() => expect(invoke).toHaveBeenCalledWith('workspace_process_stop', { session_id: 's1', id: 'process:proc_001' }))
  await waitFor(() => expect(screen.queryByText('Detener')).toBeNull())
})

it('keeps the panel available when there are no processes', async () => {
  vi.mocked(invoke).mockResolvedValue({ processes: [], truncated: false })
  render(<ProcessesPanel sessionId="s2" />)
  fireEvent.click(screen.getByText('Procesos'))
  expect(await screen.findByText(/No hay procesos registrados/)).toBeTruthy()
})
