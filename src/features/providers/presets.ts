import type { I18nKey } from '../../i18n'

export type ProviderAuth = 'api-key' | 'none'

export interface ProviderPreset {
  id: string
  nameKey: I18nKey
  descKey: I18nKey
  provider_type: 'openai' | 'anthropic' | 'custom'
  endpoint: string
  auth: ProviderAuth
}

/** Presets de alta. Gemini/OpenRouter/entornos propios entran por `custom`. */
export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'openai',
    nameKey: 'providers.presetOpenAI',
    descKey: 'providers.presetOpenAIDesc',
    provider_type: 'openai',
    endpoint: 'https://api.openai.com/v1',
    auth: 'api-key',
  },
  {
    id: 'anthropic',
    nameKey: 'providers.presetAnthropic',
    descKey: 'providers.presetAnthropicDesc',
    provider_type: 'anthropic',
    endpoint: '',
    auth: 'api-key',
  },
  {
    id: 'ollama',
    nameKey: 'providers.presetOllama',
    descKey: 'providers.presetOllamaDesc',
    provider_type: 'custom',
    endpoint: 'http://127.0.0.1:11434/v1',
    auth: 'none',
  },
  {
    id: 'lmstudio',
    nameKey: 'providers.presetLMStudio',
    descKey: 'providers.presetLMStudioDesc',
    provider_type: 'custom',
    endpoint: 'http://127.0.0.1:1234/v1',
    auth: 'none',
  },
  {
    id: 'custom',
    nameKey: 'providers.presetCustom',
    descKey: 'providers.presetCustomDesc',
    provider_type: 'custom',
    endpoint: '',
    auth: 'api-key',
  },
]
