import { useEffect, useRef } from 'react'
import { ArrowUp, Box, Square } from 'lucide-react'
import { useI18n } from '../../i18n'
import { useComposerStore } from '../../stores/composer'
import { useUIStore } from '../../stores/ui'

export type ComposerPlacement = 'centered' | 'bottom'

interface ComposerProps {
  placement: ComposerPlacement
  onSend: (text: string) => Promise<boolean>
  isStreaming: boolean
  onStop: () => void
  onOpenProviders: () => void
}

/**
 * Composer: una sola unidad visual (textarea + toolbar).
 * El borrador vive en el store y sobrevive al cambio centered ↔ bottom.
 * Adjuntos, modelo y esfuerzo llegan en Fases 3–4.
 */
export default function Composer({
  placement,
  onSend,
  isStreaming,
  onStop,
  onOpenProviders,
}: ComposerProps) {
  const { t } = useI18n()
  const text = useComposerStore((s) => s.text)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    function focus() {
      textareaRef.current?.focus()
    }
    window.addEventListener('rinari:focus-composer', focus)
    return () => window.removeEventListener('rinari:focus-composer', focus)
  }, [])

  useEffect(() => {
    textareaRef.current?.focus()
  }, [placement])

  function autosize() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`
  }

  async function handleSend() {
    const content = useComposerStore.getState().text
    if (isStreaming || !content.trim()) return
    const ok = await onSend(content)
    if (!ok) return
    useComposerStore.getState().clear()
    autosize()
    textareaRef.current?.focus()
  }

  const canSend = !!text.trim()

  return (
    <div className="relative">
      <div className="rounded-[26px] border border-[var(--border)] bg-[var(--bg-elevated)] p-2.5 shadow-[0_8px_30px_rgba(0,0,0,0.24)] transition-colors focus-within:border-[var(--accent-2)]/50">
        <textarea
          ref={textareaRef}
          value={text}
          rows={placement === 'centered' ? 2 : 1}
          aria-label={t('composer.message')}
          placeholder={isStreaming ? t('composer.placeholderStreaming') : t('composer.placeholder')}
          onChange={(e) => {
            useComposerStore.getState().setText(e.target.value)
            autosize()
          }}
          onKeyDown={(e) => {
            const sendWithEnter = useUIStore.getState().enterToSend
            const mod = e.ctrlKey || e.metaKey
            if (
              e.key === 'Enter' &&
              !e.nativeEvent.isComposing &&
              (sendWithEnter ? !e.shiftKey : mod)
            ) {
              e.preventDefault()
              void handleSend()
            }
          }}
          className="block max-h-[240px] min-h-13 w-full resize-none bg-transparent text-[15px] leading-relaxed text-[var(--text)] placeholder:text-[var(--text-subtle)] focus:outline-none"
        />
        <div className="mt-1 flex items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenProviders}
            title={t('composer.manageModels')}
            className="inline-flex max-w-[220px] items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:border-[var(--accent)]/40 hover:text-[var(--text)]"
          >
            <Box size={13} aria-hidden="true" className="shrink-0" />
            <span className="truncate">{t('composer.noModel')}</span>
          </button>
          <span className="flex-1" />
          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              aria-label={t('composer.stop')}
              title={t('composer.stop')}
              className="flex size-9 items-center justify-center rounded-full bg-[var(--text)] text-[var(--bg-app)] transition-transform hover:scale-105 active:scale-95"
            >
              <Square size={14} aria-hidden="true" fill="currentColor" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={!canSend}
              aria-label={t('composer.send')}
              title={t('composer.send')}
              className="flex size-9 items-center justify-center rounded-full bg-[var(--accent)] text-white transition-all hover:brightness-110 active:scale-95 disabled:opacity-30 disabled:hover:brightness-100"
            >
              <ArrowUp size={17} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      <p className="mt-1.5 px-1 text-center text-[11px] text-[var(--text-subtle)]">
        {t('composer.hint')}
      </p>
    </div>
  )
}
