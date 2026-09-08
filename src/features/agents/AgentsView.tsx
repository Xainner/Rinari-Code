import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  commandMessage,
  engineApi,
  type AgentView,
  type ModelSummary,
  type SessionEvent,
} from '../../services/engine'
import { useI18n } from '../../i18n'
import { Section } from '../../components/settings/parts'

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/**
 * Ajustes > Agentes: registry built-in con asignación de modelo por agente
 * (modelo, fallback, enabled) + subagentes vivos de la sesión activa
 * (derivados de session.events: SubagentStart sin Stop).
 */
export default function AgentsView({
  models,
  activeSessionId,
  onChanged,
}: {
  models: ModelSummary[]
  activeSessionId: string | null
  onChanged: () => void
}) {
  const { t } = useI18n()
  const [agents, setAgents] = useState<AgentView[]>([])
  const [live, setLive] = useState<SessionEvent[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const result = await engineApi.agentList()
      setAgents(result.agents)
    } catch (err) {
      toast.error(commandMessage(err))
    }
  }, [])

  const reloadLive = useCallback(async () => {
    if (!activeSessionId) {
      setLive([])
      return
    }
    try {
      const result = await engineApi.sessionEvents(activeSessionId, undefined, 100)
      setLive(
        result.events.filter(
          (e) => e.type === 'SubagentStart' || e.type === 'SubagentStop',
        ),
      )
    } catch {
      /* la vista de config no depende de los eventos vivos */
    }
  }, [activeSessionId])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    void reloadLive()
    const timer = setInterval(() => void reloadLive(), 4000)
    return () => clearInterval(timer)
  }, [reloadLive])

  async function assign(name: string, patch: { model?: string; fallback?: string; enabled?: boolean }) {
    setBusy(name)
    try {
      await engineApi.agentConfigSet({ agent: name, ...patch })
      await reload()
      onChanged()
    } catch (err) {
      toast.error(commandMessage(err))
    } finally {
      setBusy(null)
    }
  }

  async function reset(name: string) {
    setBusy(name)
    try {
      await engineApi.agentConfigSet({ agent: name, clear: true })
      await reload()
      onChanged()
    } catch (err) {
      toast.error(commandMessage(err))
    } finally {
      setBusy(null)
    }
  }

  // Último estado por agent_id: Start sin Stop posterior = corriendo.
  const running = new Map<string, string>()
  for (const event of live) {
    const payload = event.payload as Record<string, unknown>
    const id = str(payload['agent_id'])
    if (id === '') continue
    if (event.type === 'SubagentStop') running.delete(id)
    else running.set(id, str(payload['agent']))
  }

  const modelOptions = models.map((m) => m.alias)

  return (
    <div className="space-y-4">
      {running.size > 0 && (
        <Section title={t('agents.live')}>
          <ul className="space-y-1">
            {[...running.entries()].map(([id, name]) => (
              <li
                key={id}
                className="flex items-center gap-2 font-mono text-[12px] text-[var(--text-muted)]"
              >
                <span aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-[var(--accent-2)]" />
                <span className="truncate">
                  {name} · {id}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {agents.map((agent) => (
        <Section key={agent.name} title={agent.name}>
          <p className="text-sm text-[var(--text-muted)]">{agent.description}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-[var(--text-subtle)]">
            <span>{agent.profile}</span>
            <span>{agent.provenance}</span>
            <span>
              {t('agents.budget', { n: agent.budget.max_tool_calls })}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
                {t('agents.model')}
              </span>
              <select
                value={agent.assignment.model ?? ''}
                disabled={busy !== null}
                onChange={(e) =>
                  void assign(agent.name, { model: e.target.value || undefined })
                }
                className="w-full rounded-xl border border-white/10 bg-[var(--bg-subtle)] px-2.5 py-1.5 text-sm"
              >
                <option value="">{t('agents.inherit')}</option>
                {modelOptions.map((alias) => (
                  <option key={alias} value={alias}>
                    {alias}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
                {t('agents.fallback')}
              </span>
              <select
                value={agent.assignment.fallback ?? ''}
                disabled={busy !== null}
                onChange={(e) =>
                  void assign(agent.name, { fallback: e.target.value || undefined })
                }
                className="w-full rounded-xl border border-white/10 bg-[var(--bg-subtle)] px-2.5 py-1.5 text-sm"
              >
                <option value="">{t('agents.inherit')}</option>
                {modelOptions.map((alias) => (
                  <option key={alias} value={alias}>
                    {alias}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={agent.assignment.enabled}
              disabled={busy !== null}
              onClick={() => void assign(agent.name, { enabled: !agent.assignment.enabled })}
              className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
                agent.assignment.enabled ? 'bg-[var(--accent)]' : 'bg-[var(--bg-hover)]'
              }`}
            >
              <span
                aria-hidden="true"
                className={`absolute top-0.5 size-4 rounded-full bg-white transition-all ${
                  agent.assignment.enabled ? 'left-[18px]' : 'left-0.5'
                }`}
              />
            </button>
            <span className="text-xs text-[var(--text-muted)]">{t('agents.enabled')}</span>
            <span className="flex-1" />
            {(agent.assignment.model !== null ||
              agent.assignment.fallback !== null ||
              !agent.assignment.enabled) && (
              <button
                type="button"
                onClick={() => void reset(agent.name)}
                disabled={busy !== null}
                className="rounded-lg border border-[var(--border)] px-2 py-0.5 text-xs transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-40"
              >
                {t('agents.reset')}
              </button>
            )}
          </div>
        </Section>
      ))}
    </div>
  )
}
