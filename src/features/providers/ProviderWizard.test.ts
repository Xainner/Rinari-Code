// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import { clearWizardDraft, loadWizardDraft, saveWizardDraft } from './ProviderWizard'
import { initialForm } from './ProviderForm'

describe('ProviderWizard persisted draft', () => {
  beforeEach(() => localStorage.clear())

  it('restores retry identity without persisting credentials', () => {
    saveWizardDraft({
      step: 'testing',
      form: { ...initialForm(), alias: 'xainner', secret: 'never-store-this' },
      createdAlias: 'xainner',
      createdType: 'openai-compatible',
      createdAuth: 'api-key',
    })
    expect(localStorage.getItem('rinari.provider-wizard.v1')).not.toContain('never-store-this')
    const restored = loadWizardDraft()
    expect(restored?.step).toBe('testing')
    expect(restored?.createdAlias).toBe('xainner')
    expect(restored?.form.secret).toBe('')
  })

  it('clears completed setup and ignores malformed state', () => {
    localStorage.setItem('rinari.provider-wizard.v1', '{bad json')
    expect(loadWizardDraft()).toBeNull()
    clearWizardDraft()
    expect(localStorage.getItem('rinari.provider-wizard.v1')).toBeNull()
  })
})
