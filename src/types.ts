/** Shared UI types. Engine-owned domain types live in services/engine.ts. */

export type Language = 'es' | 'en'

export type Role = 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: Role
  content: string
  createdAt: number
  /** Fallback waiting state when no protocol-backed execution is available. */
  pending?: boolean
  turnId?: string
}

export type SessionKind = 'chat' | 'project'

export interface PendingApproval {
  approval_id: string
  session_id: string | null
  turn_id: string | null
  capability: string
  target: string | null
  risk: string
  description: string
  status?: 'pending' | 'resolving' | 'expired'
}

export interface ToolActivity {
  id: string
  tool: string
  status: 'requested' | 'running' | 'done' | 'failed' | 'cancelled'
  detail?: string
  durationMs?: number
  error?: string
}

export interface TurnStopReason {
  code: string
  message: string
  modelCalls?: number
  toolCalls?: number
  wallTimeS?: number
}

export interface TurnExecution {
  turnId: string
  sessionId: string
  status: 'thinking' | 'executing' | 'approval' | 'cancelling' | 'completed' | 'cancelled' | 'failed' | 'stopped'
  startedAt: number
  completedAt?: number
  preparationStage?: string
  error?: string
  /** Solo en `stopped`: safeguard de emergencia, terminal pero no fallo. */
  stopReason?: TurnStopReason
  governor?: {
    progress?: string
    action?: string
    recoveryAttempts?: number
    usage?: { model_calls?: number; tool_calls?: number; wall_time_s?: number }
  }
  tools: ToolActivity[]
}

export interface AttachmentRef {
  id: string
  path: string
  name: string
  mime_type?: string
  size?: number
  source: 'native' | 'workspace'
}
