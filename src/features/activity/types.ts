import type { ChatMessage, PendingApproval, TurnStopReason } from '../../types'
import type { TimelineTurn } from '../../services/engine'

export type TimelineStatus =
  | 'running'
  | 'approval'
  | 'cancelling'
  | 'completed'
  | 'cancelled'
  | 'failed'
  | 'stopped'

interface TimelineItemBase {
  id: string
  type: 'model' | 'tool' | 'approval' | 'agent' | 'context' | 'verification' | 'system'
  activitySeq: number
  occurredAt: number
}

export interface ModelTimelineItem extends TimelineItemBase {
  type: 'model'
  modelCallId: string
  status: 'thinking' | 'streaming' | 'completed' | 'failed'
  content: string
  outputKind?: 'progress' | 'final'
  model?: string
  durationMs?: number
}

export interface ToolTimelineItem extends TimelineItemBase {
  type: 'tool'
  toolCallId: string
  tool: string
  modelCallId?: string
  status: 'requested' | 'running' | 'completed' | 'failed' | 'cancelled'
  arguments?: string
  result?: string
  error?: string
  durationMs?: number
}

export interface ApprovalTimelineItem extends TimelineItemBase {
  type: 'approval'
  approvalId: string
  status: 'pending' | 'resolving' | 'allowed' | 'denied' | 'expired'
  capability: string
  target?: string
  risk: string
  description: string
  decision?: string
}

export interface AgentTimelineItem extends TimelineItemBase {
  type: 'agent'
  agentId: string
  phase: 'started' | 'terminal'
  status: 'running' | 'completed' | 'failed'
  agent: string
  objective?: string
}

export interface ContextTimelineItem extends TimelineItemBase {
  type: 'context'
  status: 'running' | 'completed' | 'skipped'
  pressure?: number
}

export interface VerificationTimelineItem extends TimelineItemBase {
  type: 'verification'
  status: 'running' | 'completed' | 'failed'
  outcome?: string
  detail?: string
}

export interface SystemTimelineItem extends TimelineItemBase {
  type: 'system'
  kind: 'turn_preparing' | 'governor' | 'terminal'
  status?: string
  label?: string
}

export type TimelineItem =
  | ModelTimelineItem
  | ToolTimelineItem
  | ApprovalTimelineItem
  | AgentTimelineItem
  | ContextTimelineItem
  | VerificationTimelineItem
  | SystemTimelineItem

export interface TurnTimeline {
  turnId: string
  sessionId: string
  turnIndex?: number
  status: TimelineStatus
  startedAt: number
  completedAt?: number
  userMessage: string
  items: TimelineItem[]
  stopReason?: TurnStopReason
  error?: string
}

export interface TurnTimelineState {
  threads: Record<string, ChatMessage[]>
  timelines: Record<string, TurnTimeline>
  busySessions: Set<string>
  approvals: PendingApproval[]
}

export type PersistedTimelineTurn = TimelineTurn
