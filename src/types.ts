/** Shared UI types. Engine-owned domain types live in services/engine.ts. */

export type Language = 'es' | 'en'

export type Role = 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: Role
  content: string
  createdAt: number
}

export type SessionKind = 'chat' | 'project'

export interface PendingApproval {
  approval_id: string
  session_id: string | null
  capability: string
  target: string | null
  risk: string
  description: string
}
