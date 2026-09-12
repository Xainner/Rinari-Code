// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import BrowserPanel from './BrowserPanel'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn() }))
afterEach(() => { cleanup(); vi.clearAllMocks() })

it('automatically shows the actual engine page and allows minimizing it', async () => {
  vi.mocked(invoke).mockResolvedValue({ state: 'connected', instance: 'b1', url: 'http://127.0.0.1:8123/', image: 'data:image/jpeg;base64,/9j/' })
  render(<BrowserPanel sessionId="s1" />)
  expect(await screen.findByLabelText('Navegador de Rinari')).toBeTruthy()
  expect(screen.getByAltText('Página controlada por el motor de Rinari').getAttribute('src')).toContain('data:image/jpeg')
  expect(invoke).toHaveBeenCalledWith('browser_view_get', { session_id: 's1', target_id: null })
  fireEvent.click(screen.getByLabelText('Cerrar panel del navegador'))
  await waitFor(() => expect(screen.queryByLabelText('Navegador de Rinari')).toBeNull())
  fireEvent.click(screen.getByText('Navegador'))
  expect(screen.getByLabelText('Navegador de Rinari')).toBeTruthy()
})

it('does not announce a disconnected browser as open', async () => {
  vi.mocked(invoke).mockResolvedValue({ state: 'disconnected' })
  render(<BrowserPanel sessionId="s2" />)
  await waitFor(() => expect(invoke).toHaveBeenCalled())
  expect(screen.queryByLabelText('Navegador de Rinari')).toBeNull()
})
