// @vitest-environment node
import sessionCommands from '../../src-tauri/src/commands/sessions.rs?raw'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn().mockResolvedValue({}) }))
import { invoke } from '@tauri-apps/api/core'
import { engineApi } from './engine'

describe('session bridge argument contract', () => {
  it('preserves project identity and permission across the Tauri boundary', async () => {
    await engineApi.createSession({ project_id: 'project-123', permission_profile: 'workspace' })
    expect(invoke).toHaveBeenCalledWith('session_create', expect.objectContaining({
      project_id: 'project-123', permission_profile: 'workspace', chat: false,
    }))
    // Tauri defaults to camelCase: optional snake_case arguments otherwise vanish silently.
    const rust = sessionCommands.replace(/\r\n/g, '\n')
    for (const command of ['session_create', 'session_list']) {
      expect(rust).toContain(`#[tauri::command(rename_all = "snake_case")]\npub(crate) async fn ${command}(`)
    }
  })
})
