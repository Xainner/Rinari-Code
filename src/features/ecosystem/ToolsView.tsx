import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  commandMessage,
  engineApi,
  type NativeTool,
} from '../../services/engine'
import { useI18n } from '../../i18n'
import { Section } from '../../components/settings/parts'

/**
 * Ajustes > Tools: centro de herramientas y permisos. Solo lectura del
 * policy real del engine (modo→perfil) + catálogo de tools nativas.
 * No hay presets que compilen a policy en v1: la UI no inventa semántica.
 */
export default function ToolsView() {
  const { t } = useI18n()
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')
  const [tools, setTools] = useState<NativeTool[]>([])

  const reload = useCallback(async () => {
    try {
      const [policy, catalog] = await Promise.all([
        engineApi.policyGet(),
        engineApi.toolList(),
      ])
      setMapping(policy.mode_profile)
      setNote(policy.note)
      setTools(catalog.tools)
    } catch (err) {
      toast.error(commandMessage(err))
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return (
    <div className="space-y-4">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">
        {t('tools.title')}
      </h2>

      <Section title={t('tools.policy')}>
        <div className="space-y-1 text-sm">
          {Object.entries(mapping).map(([mode, profile]) => (
            <div key={mode} className="flex items-center justify-between">
              <span className="font-semibold uppercase text-[var(--text)]">{mode}</span>
              <span className="font-mono text-xs text-[var(--text-muted)]">{profile}</span>
            </div>
          ))}
        </div>
        {note !== '' && (
          <p className="text-xs text-[var(--text-subtle)]">{note}</p>
        )}
      </Section>

      <Section title={t('tools.catalog', { n: String(tools.length) })}>
        <div className="max-h-96 space-y-1 overflow-auto">
          {tools.map((tool) => (
            <div
              key={tool.name}
              className="flex items-baseline justify-between gap-3 rounded-lg px-2 py-1 hover:bg-[var(--bg-hover)]"
              title={tool.description}
            >
              <span className="font-mono text-xs text-[var(--text)]">{tool.name}</span>
              <span className="shrink-0 font-mono text-[11px] text-[var(--text-subtle)]">
                {tool.risk}
              </span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}
