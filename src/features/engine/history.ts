import type { ChatMessage } from '../../types'
import type { HistoryMessage } from '../../services/engine'

/** Timestamp persistido → ms. Determinista: si el valor es inválido cae a 0. */
export function historyTimestamp(createdAt: string): number {
  const parsed = Date.parse(createdAt ?? '')
  return Number.isNaN(parsed) ? 0 : parsed
}

/**
 * Filas persistidas → mensajes UI. Solo contenido conversacional real.
 * Los tool calls viven en Activity, nunca como texto sintético de chat;
 * cada mensaje conserva su timestamp y orden persistidos (seq).
 */
export function historyToMessages(rows: HistoryMessage[]): ChatMessage[] {
  const out: ChatMessage[] = []
  const sorted = [...rows].sort((a, b) => a.seq - b.seq)
  for (const row of sorted) {
    if (row.role !== 'user' && row.role !== 'assistant') continue
    const content = row.content ?? ''
    if (content === '') continue
    out.push({ id: `h${row.seq}`, role: row.role, content, createdAt: historyTimestamp(row.created_at) })
  }
  return out
}
