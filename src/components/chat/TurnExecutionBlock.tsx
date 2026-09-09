import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, ChevronDown, Circle, LoaderCircle, ShieldAlert, Terminal, XCircle } from 'lucide-react'
import type { PendingApproval, ToolActivity, TurnExecution, TurnStopReason } from '../../types'
import { useI18n } from '../../i18n'

interface Props {
  execution: TurnExecution
  approvals: PendingApproval[]
  onResolveApproval: (id: string, decision: string) => void
  onContinue?: () => void
}

const terminalStatuses = new Set(['completed', 'cancelled', 'failed', 'stopped'])

function seconds(execution: TurnExecution, now: number): string {
  const end = execution.completedAt ?? now
  return `${Math.max(0, (end - execution.startedAt) / 1000).toFixed(1)} s`
}

function statusLabel(execution: TurnExecution): string {
  if (execution.status === 'thinking' && execution.preparationStage) {
    return {
      runtime: 'Preparando turno…',
      model: 'Preparando modelo…',
      agents: 'Preparando agentes…',
      tools: 'Preparando herramientas…',
      context: 'Preparando contexto…',
      ready: 'Iniciando turno…',
      session_lock: 'Iniciando turno…',
    }[execution.preparationStage] ?? 'Preparando turno…'
  }
  return {
    thinking: 'Pensando…',
    executing: 'Ejecutando…',
    approval: 'Esperando permiso',
    cancelling: 'Cancelando…',
    cancelled: 'Cancelado',
    failed: 'Falló',
    stopped: 'Detenido',
    completed: 'Completado',
  }[execution.status]
}

function formatWall(totalS: number): string {
  if (totalS >= 3600) return `${Math.floor(totalS / 3600)}h ${Math.floor((totalS % 3600) / 60)}m`
  if (totalS >= 60) return `${Math.floor(totalS / 60)}m ${Math.floor(totalS % 60)}s`
  return `${Math.floor(totalS)}s`
}

function stopUsage(reason: TurnStopReason): string | null {
  const parts: string[] = []
  if (reason.modelCalls != null) parts.push(`Model calls: ${reason.modelCalls}`)
  if (reason.toolCalls != null) parts.push(`Tool calls: ${reason.toolCalls}`)
  if (reason.wallTimeS != null) parts.push(`Runtime: ${formatWall(reason.wallTimeS)}`)
  return parts.length > 0 ? parts.join(' · ') : null
}

function toolIcon(tool: ToolActivity) {
  if (tool.status === 'running') return <LoaderCircle size={14} className="animate-spin text-[var(--accent-2)]" />
  if (tool.status === 'done') return <CheckCircle2 size={14} className="text-emerald-500" />
  if (tool.status === 'failed' || tool.status === 'cancelled') return <XCircle size={14} className="text-rose-400" />
  return <Circle size={12} className="text-[var(--text-subtle)]" />
}

export default function TurnExecutionBlock({ execution, approvals, onResolveApproval, onContinue }: Props) {
  const { t } = useI18n()
  const [now, setNow] = useState(Date.now())
  const [open, setOpen] = useState(!terminalStatuses.has(execution.status))
  const active = !terminalStatuses.has(execution.status)
  const wasActive = useRef(active)
  useEffect(() => {
    if (!active) return
    const timer = window.setInterval(() => setNow(Date.now()), 100)
    return () => window.clearInterval(timer)
  }, [active])
  useEffect(() => {
    if (active) setOpen(true)
    else if (wasActive.current) setOpen(false)
    wasActive.current = active
  }, [active])
  const title = statusLabel(execution)
  const visibleApprovals = useMemo(
    () => approvals.filter((item) => item.turn_id === execution.turnId),
    [approvals, execution.turnId],
  )

  return (
    <section className="mb-3 max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--bg-subtle)]/70" aria-live="polite">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full cursor-pointer items-start gap-2 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-[var(--bg-hover)]/50"
        aria-expanded={open}
      >
        {active ? <LoaderCircle size={16} className="mt-0.5 animate-spin text-[var(--accent-2)]" /> : execution.status === 'completed' ? <CheckCircle2 size={16} className="mt-0.5 text-emerald-500" /> : execution.status === 'stopped' ? <ShieldAlert size={16} className="mt-0.5 text-amber-400" /> : <XCircle size={16} className="mt-0.5 text-rose-400" />}
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium text-[var(--text)]">{title}</span>
          <span className="mt-0.5 block font-mono text-[10px] text-[var(--text-subtle)]">{seconds(execution, now)}</span>
          {execution.governor && (
            <span className="mt-1 block font-mono text-[10px] text-[var(--text-subtle)]">
              Progreso: {execution.governor.progress ?? execution.governor.action ?? 'activo'}
              {execution.governor.usage?.model_calls != null ? ` · modelo ${execution.governor.usage.model_calls}` : ''}
              {execution.governor.usage?.tool_calls != null ? ` · herramientas ${execution.governor.usage.tool_calls}` : ''}
            </span>
          )}
          {execution.error && <span className="mt-1 block text-[11px] font-normal text-rose-400">{execution.error}</span>}
        </span>
        <ChevronDown size={15} className={`mt-1 text-[var(--text-subtle)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {execution.status === 'stopped' && execution.stopReason && (
        <div className="border-t border-[var(--border)] px-3 py-2.5">
          <p className="text-xs text-[var(--text-muted)]">{execution.stopReason.message}</p>
          {stopUsage(execution.stopReason) && (
            <p className="mt-1 font-mono text-[10px] text-[var(--text-subtle)]">
              {stopUsage(execution.stopReason)}
            </p>
          )}
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => onContinue?.()}
              className="cursor-pointer rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[11px] font-semibold text-white transition-all hover:brightness-110"
            >
              {t('turn.continue')}
            </button>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="cursor-pointer rounded-lg border border-[var(--border)] px-3 py-1.5 text-[11px] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
            >
              {t('turn.reviewActivity')}
            </button>
          </div>
        </div>
      )}

      {open && (execution.tools.length > 0 || visibleApprovals.length > 0) && (
        <div className="space-y-2 border-t border-[var(--border)] px-3 py-2.5">
          {execution.tools.map((tool) => (
            <div key={tool.id} className="flex items-start gap-2 text-xs">
              <span className="mt-0.5 shrink-0">{toolIcon(tool)}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[var(--text-muted)]">
                  <span className="text-[var(--text)]">{tool.tool === 'shell.exec' ? 'Ejecutando comando' : tool.tool}</span>
                  <span className="font-mono text-[10px] text-[var(--text-subtle)]"> · {tool.tool}</span>
                  {tool.durationMs != null && <span className="font-mono text-[10px] text-[var(--text-subtle)]"> · {(tool.durationMs / 1000).toFixed(1)} s</span>}
                </p>
                {tool.detail && <details className="mt-1"><summary className="cursor-pointer text-[10px] text-[var(--text-subtle)]">Detalles</summary><pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-black/20 p-2 font-mono text-[10px] text-[var(--text-muted)]">{tool.detail}</pre></details>}
                {tool.error && <p className="mt-1 text-[11px] text-rose-400">{tool.error}</p>}
              </div>
            </div>
          ))}

          {visibleApprovals.map((approval) => (
            <div key={approval.approval_id} className="rounded-xl border border-amber-400/25 bg-amber-400/5 p-3">
              <div className="flex items-start gap-2">
                <ShieldAlert size={15} className="mt-0.5 shrink-0 text-amber-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-[var(--text)]">Se requiere permiso</p>
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">{approval.description}</p>
                  {approval.target && <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-black/20 p-2 font-mono text-[10px] text-[var(--text-muted)]"><Terminal size={11} className="mr-1 inline" />{approval.target}</pre>}
                  <p className="mt-1 font-mono text-[9px] uppercase text-amber-400/80">Riesgo: {approval.risk || 'medium'}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {[
                  ['deny', 'Denegar'],
                  ['allow_once', 'Permitir una vez'],
                  ['allow_session', 'Permitir durante este chat'],
                ].map(([decision, label]) => (
                  <button
                    key={decision}
                    type="button"
                    disabled={approval.status !== 'pending'}
                    onClick={() => onResolveApproval(approval.approval_id, decision)}
                    className="cursor-pointer rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[11px] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text)] disabled:cursor-default disabled:opacity-40"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
