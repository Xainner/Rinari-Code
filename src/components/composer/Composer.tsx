import { useEffect, useRef } from 'react'
import { ArrowUp, Box, Check, Square } from 'lucide-react'
import { useI18n } from '../../i18n'
import { useComposerStore } from '../../stores/composer'
import { useUIStore } from '../../stores/ui'
import type { ModelSummary } from '../../services/engine'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'

export type ComposerPlacement = 'centered' | 'bottom'

interface ComposerProps {
  placement: ComposerPlacement
  onSend: (text: string) => Promise<boolean>
  isStreaming: boolean
  onStop: () => void
  models: ModelSummary[]
  activeAlias: string | null
  onUseModel: (alias: string) => void
  onOpenProviders: () => void
}

/**
 * Composer: una sola unidad visual (textarea + toolbar con modelo).
 * El borrador vive en el store y sobrevive al cambio centered ↔ bottom.
 * Adjuntos y contexto explícito llegan en Fase 4.
 */
export default function Composer({
  placement,
  onSend,
  isStreaming,
  onStop,
  models,
  activeAlias,
  onUseModel,
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
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                title={t('composer.chooseModel')}
                className="inline-flex max-w-[220px] items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:border-[var(--accent)]/40 hover:text-[var(--text)]"
              >
                <Box size={13} aria-hidden="true" className="shrink-0" />
                <span className="truncate">{activeAlias ?? t('composer.noModel')}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-1.5">
              {models.length === 0 && (
                <button
                  type="button"
                  onClick={onOpenProviders}
                  className="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
                >
                  {t('composer.noModelsSetup')}
                </button>
              )}
              {models.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => onUseModel(model.alias)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[var(--bg-hover)]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-[var(--text)]">
                      {model.alias}
                    </span>
                    <span className="block truncate font-mono text-[11px] text-[var(--text-subtle)]">
                      {model.provider ?? ''} · {model.provider_model_id}
                    </span>
                  </span>
                  {model.active && (
                    <Check size={14} aria-hidden="true" className="shrink-0 text-[var(--accent-2)]" />
                  )}
                </button>
              ))}
              {models.length > 0 && (
                <button
                  type="button"
                  onClick={onOpenProviders}
                  className="mt-1 flex w-full items-center rounded-lg border-t border-[var(--border)] px-2.5 py-2 text-left text-xs text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
                >
                  {t('composer.manageModels')}
                </button>
              )}
            </PopoverContent>
          </Popover>
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
