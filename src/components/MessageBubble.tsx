import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import type { ChatMessage } from '../types'
import { useI18n } from '../i18n'
import { copyText } from '../lib/clipboard'
import Markdown from './Markdown'

/**
 * Burbuja de mensaje: usuario alineado a la derecha, Rinari con Markdown.
 * Edición/regeneración/export llegan con historial de sesión (Fase 4).
 */
export default function MessageBubble({ message }: { message: ChatMessage }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[var(--accent)]/15 px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap text-[var(--text)]">
          {message.content}
        </div>
      </div>
    )
  }

  async function copy() {
    if (await copyText(message.content)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    }
  }

  return (
    <div className="group relative">
      <Markdown>{message.content || '…'}</Markdown>
      <button
        type="button"
        onClick={copy}
        aria-label={t('bubble.copy')}
        title={t('bubble.copy')}
        className="mt-1 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-[var(--text-subtle)] opacity-0 transition-all group-hover:opacity-100 hover:bg-[var(--bg-hover)] hover:text-[var(--text)] focus-visible:opacity-100"
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
        {copied ? t('markdown.copied') : t('bubble.copy')}
      </button>
    </div>
  )
}
