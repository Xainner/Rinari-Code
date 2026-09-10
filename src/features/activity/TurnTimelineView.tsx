import {
  Bot,
  Check,
  ChevronDown,
  CircleAlert,
  FileSearch,
  FileText,
  GitBranch,
  ListTree,
  LoaderCircle,
  Pencil,
  ShieldAlert,
  Sparkles,
  SquareTerminal,
  TestTube2,
} from 'lucide-react'
import { useI18n } from '../../i18n'
import { useUIStore } from '../../stores/ui'
import type { ChatMessage } from '../../types'
import Markdown from '../../components/Markdown'
import MessageBubble from '../../components/MessageBubble'
import { formatTool, toolCategory } from './formatActivity'
import type { TimelineItem, TurnTimeline } from './types'

type DisplayItem = TimelineItem | { id: string; type: 'tool-group'; items: Extract<TimelineItem, { type: 'tool' }>[] }

interface Props {
  timeline: TurnTimeline
  user?: ChatMessage
  now: number
  onResolveApproval: (id: string, decision: string) => void
  onContinue: () => void
}

const ICONS = {
  read: FileText,
  search: FileSearch,
  list: ListTree,
  edit: Pencil,
  test: TestTube2,
  git: GitBranch,
  command: SquareTerminal,
}

function elapsed(ms: number): string {
  const seconds = Math.max(0, ms) / 1000
  return seconds < 10 ? `${seconds.toFixed(1)} s` : `${Math.round(seconds)} s`
}

function groupAdjacent(items: TimelineItem[]): DisplayItem[] {
  const output: DisplayItem[] = []
  for (const item of items) {
    const category = item.type === 'tool' ? toolCategory(item.tool) : null
    const groupable = category === 'read' || category === 'search' || category === 'list'
    const previous = output.at(-1)
    if (item.type === 'tool' && groupable && previous?.type === 'tool-group') {
      const last = previous.items.at(-1)!
      if (last.modelCallId === item.modelCallId && toolCategory(last.tool) === category && item.occurredAt - last.occurredAt <= 2000) {
        previous.items.push(item)
        continue
      }
    }
    if (item.type === 'tool' && groupable) {
      const prior = output.at(-1)
      if (prior?.type === 'tool') {
        const priorCategory = toolCategory(prior.tool)
        if (priorCategory === category && prior.modelCallId === item.modelCallId && item.occurredAt - prior.occurredAt <= 2000) {
          output.splice(-1, 1, { id: `group:${prior.id}`, type: 'tool-group', items: [prior, item] })
          continue
        }
      }
    }
    output.push(item)
  }
  return output
}

function ToolGroupRow({ items }: { items: Extract<TimelineItem, { type: 'tool' }>[] }) {
  const { lang } = useI18n()
  const category = toolCategory(items[0].tool)
  const Icon = ICONS[category]
  const label = lang === 'es'
    ? category === 'read' ? `Leyó ${items.length} archivos` : category === 'search' ? `Hizo ${items.length} búsquedas` : `Listó archivos ${items.length} veces`
    : category === 'read' ? `Read ${items.length} files` : category === 'search' ? `Ran ${items.length} searches` : `Listed files ${items.length} times`
  return (
    <details className="group/activity py-1 text-[13px] text-[var(--text-muted)]">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50">
        <Icon size={13} className="text-[var(--text-subtle)]" />
        <span>{label}</span>
        <ChevronDown size={12} className="ml-auto transition-transform group-open/activity:rotate-180" />
      </summary>
      <div className="mt-1 space-y-0.5 border-l border-[var(--border)] pl-4">
        {items.map((item) => <div key={item.id} className="text-[11px] text-[var(--text-subtle)]">{formatTool(item, lang)}</div>)}
      </div>
    </details>
  )
}

function ActivityRow({ item, onResolveApproval }: { item: Exclude<TimelineItem, { type: 'model' }>; onResolveApproval: (id: string, decision: string) => void }) {
  const { lang } = useI18n()
  const technical = useUIStore((state) => state.showTechnicalActivityNames)
  if (item.type === 'tool') {
    const category = toolCategory(item.tool)
    const Icon = ICONS[category]
    const running = item.status === 'requested' || item.status === 'running'
    const failed = item.status === 'failed' || item.status === 'cancelled'
    return (
      <details className="group/activity py-1 text-[13px] text-[var(--text-muted)]">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50">
          {running ? <LoaderCircle size={13} className="animate-spin text-[var(--accent-2)] motion-reduce:animate-none" /> : failed ? <CircleAlert size={13} className="text-red-400" /> : <Icon size={13} className="text-[var(--text-subtle)]" />}
          <span>{formatTool(item, lang)}</span>
          {technical && <span className="font-mono text-[10px] text-[var(--text-subtle)]">{item.tool}</span>}
          {item.durationMs !== undefined && <span className="ml-auto text-[10px] tabular-nums text-[var(--text-subtle)]">{elapsed(item.durationMs)}</span>}
          <ChevronDown size={12} className="transition-transform group-open/activity:rotate-180" />
        </summary>
        {(item.arguments || item.result || item.error) && (
          <pre className="mt-1.5 max-h-44 overflow-auto whitespace-pre-wrap rounded-lg bg-[var(--bg-subtle)] p-2 font-mono text-[11px] text-[var(--text-subtle)]">{item.error || item.result || item.arguments}</pre>
        )}
      </details>
    )
  }
  if (item.type === 'approval') {
    const pending = item.status === 'pending'
    const resolving = item.status === 'resolving'
    const status = item.status === 'allowed' ? (lang === 'es' ? 'Concedido' : 'Allowed') : item.status === 'denied' ? (lang === 'es' ? 'Denegado' : 'Denied') : item.status === 'expired' ? (lang === 'es' ? 'Expirado' : 'Expired') : ''
    return (
      <div className="my-2 border-l-2 border-amber-400/50 py-1 pl-3 text-[13px]">
        <div className="flex items-center gap-2 text-[var(--text)]"><ShieldAlert size={14} className="text-amber-400" />{item.description || item.capability}<span className="rounded-full bg-amber-400/10 px-1.5 py-0.5 text-[10px] uppercase text-amber-300">{item.risk}</span></div>
        {item.target && <div className="mt-1 font-mono text-[11px] text-[var(--text-subtle)]">{item.target}</div>}
        {(pending || resolving) ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <ApprovalActions item={item} disabled={resolving} onResolve={onResolveApproval} />
          </div>
        ) : <div className="mt-1 text-[11px] text-[var(--text-muted)]">{status}</div>}
      </div>
    )
  }
  if (item.type === 'system') return null
  const labels = item.type === 'agent'
    ? (item.status === 'running' ? `${lang === 'es' ? 'Inició agente' : 'Started agent'} · ${item.agent}` : `${lang === 'es' ? 'Finalizó agente' : 'Agent finished'} · ${item.agent}`)
    : item.type === 'context'
      ? (item.status === 'running' ? (lang === 'es' ? 'Compactando contexto…' : 'Compacting context…') : (lang === 'es' ? 'Contexto compactado' : 'Context compacted'))
      : item.type === 'verification'
        ? (item.status === 'running' ? (lang === 'es' ? 'Verificando…' : 'Verifying…') : item.status === 'failed' ? (lang === 'es' ? 'La verificación falló' : 'Verification failed') : (lang === 'es' ? 'Verificación completada' : 'Verification completed'))
        : ''
  if (!labels) return null
  const Icon = item.type === 'agent' ? Bot : item.type === 'verification' ? Check : Sparkles
  return <div className="flex items-center gap-2 py-1 text-[13px] text-[var(--text-muted)]"><Icon size={13} className="text-[var(--text-subtle)]" />{labels}</div>
}

function ApprovalActions({ item, disabled, onResolve }: { item: Extract<TimelineItem, { type: 'approval' }>; disabled: boolean; onResolve: (id: string, decision: string) => void }) {
  const { lang } = useI18n()
  const choices = [
    ['deny', lang === 'es' ? 'Denegar' : 'Deny'],
    ['allow_once', lang === 'es' ? 'Permitir una vez' : 'Allow once'],
    ['allow_session', lang === 'es' ? 'Permitir en este chat' : 'Allow in this chat'],
  ]
  return choices.map(([decision, label]) => <button key={decision} type="button" disabled={disabled} onClick={() => onResolve(item.approvalId, decision)} className="min-h-9 rounded-lg border border-[var(--border)] px-3 text-xs text-[var(--text-muted)] transition-colors hover:border-[var(--accent)]/50 hover:text-[var(--text)] disabled:opacity-50">{label}</button>)
}

export default function TurnTimelineView({ timeline, user, now, onResolveApproval, onContinue }: Props) {
  const { lang } = useI18n()
  const final = [...timeline.items].reverse().find((item) => item.type === 'model' && item.outputKind === 'final' && item.content)
  const visible = timeline.items.filter((item) => item !== final && (item.type !== 'model' || Boolean(item.content)))
  const displayItems = groupAdjacent(visible)
  const significant = visible.filter((item) => item.type !== 'model' && item.type !== 'system')
  const lastActivity = visible.at(-1)?.occurredAt ?? timeline.startedAt
  const actionRunning = visible.some((item) =>
    item.type === 'tool' && (item.status === 'requested' || item.status === 'running') ||
    item.type === 'context' && item.status === 'running' ||
    item.type === 'verification' && item.status === 'running' ||
    item.type === 'agent' && item.status === 'running',
  )
  const initialWait = visible.length === 0 && now - timeline.startedAt >= 300
  const betweenSteps = visible.length > 0 && now - lastActivity >= 1000
  const waiting = timeline.status === 'cancelling' || (!actionRunning && (timeline.status === 'running' || timeline.status === 'approval') && (initialWait || betweenSteps))
  const terminalExceptional = ['failed', 'cancelled', 'stopped'].includes(timeline.status)
  const duration = (timeline.completedAt ?? now) - timeline.startedAt
  const showSummary = Boolean(final) && (significant.length >= 3 || duration >= 10_000 || terminalExceptional)
  const statusLabel = lang === 'es'
    ? ({ completed: 'completado', failed: 'falló', cancelled: 'cancelado', stopped: 'detenido' } as Record<string, string>)[timeline.status] ?? timeline.status
    : timeline.status
  return (
    <div className="space-y-3">
      {user ? <MessageBubble message={user} /> : timeline.userMessage ? <MessageBubble message={{ id: `user-${timeline.turnId}`, role: 'user', content: timeline.userMessage, createdAt: timeline.startedAt, turnId: timeline.turnId }} /> : null}
      <div className="space-y-1 pl-0.5">
        {displayItems.map((item) => item.type === 'tool-group' ? <ToolGroupRow key={item.id} items={item.items} /> : item.type === 'model' ? (
          <div key={item.id} className="py-1 text-[13px] leading-relaxed text-[var(--text-muted)]"><Markdown>{item.content}</Markdown></div>
        ) : <ActivityRow key={item.id} item={item} onResolveApproval={onResolveApproval} />)}
        {waiting && timeline.status !== 'approval' && (
          <div role="status" aria-live="polite" className="flex items-center gap-2 py-1 text-[13px] text-[var(--text-muted)]">
            <LoaderCircle size={13} className="animate-spin text-[var(--accent-2)] motion-reduce:animate-none" />
            <span>{timeline.status === 'cancelling' ? (lang === 'es' ? 'Cancelando…' : 'Cancelling…') : (lang === 'es' ? 'Pensando…' : 'Thinking…')}</span>
            <span className="text-[10px] tabular-nums text-[var(--text-subtle)]">{elapsed(duration)}</span>
          </div>
        )}
        {timeline.status === 'failed' && <div role="alert" className="flex items-center gap-2 py-1 text-[13px] text-red-400"><CircleAlert size={13} />{timeline.error || (lang === 'es' ? 'El turno falló' : 'Turn failed')}</div>}
      </div>
      {final?.type === 'model' && <MessageBubble message={{ id: final.id, role: 'assistant', content: final.content, createdAt: final.occurredAt, turnId: timeline.turnId }} />}
      {showSummary && <div className="flex items-center gap-2 text-[10px] text-[var(--text-subtle)]"><span>{elapsed(duration)}</span><span>·</span><span>{significant.length} {lang === 'es' ? 'acciones' : 'actions'}</span><span>·</span><span>{statusLabel}</span></div>}
      {timeline.status === 'stopped' && <button type="button" onClick={onContinue} className="text-xs text-[var(--accent-2)] hover:underline">{lang === 'es' ? 'Continuar' : 'Continue'}</button>}
    </div>
  )
}
