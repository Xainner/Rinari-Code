import { useEffect, useState } from 'react'
import { Brain, Check, Copy } from 'lucide-react'
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
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!message.pending) return
    const startedAt = Date.now()
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [message.pending])

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[var(--accent)]/15 px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap text-[var(--text)]">
          {message.content}
        </div>
      </div>
    )
  }

  if (message.pending) {
    return (
      <div role="status" aria-live="polite" className="flex min-h-10 items-start gap-2 text-sm text-[var(--text-muted)]">
        <Brain size={16} aria-hidden="true" className="mt-0.5 animate-pulse text-[var(--accent-2)]" />
        <div className="flex flex-col">
          <span className="flex items-center gap-2">
            <span>{t('reasoning.thinking')}</span>
            <span className="flex items-center gap-1" aria-hidden="true">
              {[0, 1, 2].map((dot) => (
                <span
                  key={dot}
                  className="size-1 animate-bounce rounded-full bg-[var(--accent-2)]"
                  style={{ animationDelay: `${dot * 140}ms` }}
                />
              ))}
            </span>
          </span>
          <span className="mt-0.5 text-[10px] leading-none tabular-nums text-[var(--text-subtle)]">
            {t('reasoning.time', { s: elapsed })}
          </span>
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
