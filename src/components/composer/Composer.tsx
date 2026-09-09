import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Box, Brain, Check, FileText, Paperclip, Shield, Square, X } from 'lucide-react'
import { open } from '@tauri-apps/plugin-dialog'
import { useI18n } from '../../i18n'
import { useComposerStore } from '../../stores/composer'
import { useUIStore } from '../../stores/ui'
import type { ModelSummary } from '../../services/engine'
import type { AttachmentRef } from '../../types'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'

export type ComposerPlacement = 'centered' | 'bottom'

interface ComposerProps {
  placement: ComposerPlacement
  onSend: (text: string, attachments?: AttachmentRef[]) => Promise<boolean>
  isStreaming: boolean
  onStop: () => void
  models: ModelSummary[]
  activeAlias: string | null
  onUseModel: (model: ModelSummary) => void
  onDiscoverModels: () => void
  onOpenProviders: () => void
  sessionMode: string | null
  onModeChange: (mode: string) => void
  reasoningEffort: 'off' | 'low' | 'medium' | 'high'
  onReasoningChange: (effort: 'off' | 'low' | 'medium' | 'high') => void
  permissionProfile: 'read-only' | 'workspace' | 'full-access'
  effectivePermissionProfile: 'read-only' | 'workspace' | 'full-access'
  onPermissionChange: (profile: string) => void
  onSearchFiles: (query: string) => Promise<{ root: string; files: Array<{ path: string; relative_path: string; name: string }> }>
}

const MODES = ['plan', 'build', 'review'] as const
const REASONING_LEVELS = ['off', 'low', 'medium', 'high'] as const

/**
 * Composer: una sola unidad visual (textarea + toolbar con modelo).
 * El borrador vive en el store y sobrevive al cambio centered ↔ bottom.
 * Los adjuntos nativos y las referencias @ se conservan como rutas hasta que
 * el motor los valida para el turno.
 */
export default function Composer({
  placement,
  onSend,
  isStreaming,
  onStop,
  models,
  activeAlias,
  onUseModel,
  onDiscoverModels,
  onOpenProviders,
  sessionMode,
  onModeChange,
  reasoningEffort,
  onReasoningChange,
  permissionProfile,
  effectivePermissionProfile,
  onPermissionChange,
  onSearchFiles,
}: ComposerProps) {
  const { t } = useI18n()
  const text = useComposerStore((s) => s.text)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [attachments, setAttachments] = useState<AttachmentRef[]>([])
  const [fileMatches, setFileMatches] = useState<Array<{ path: string; relative_path: string; name: string }>>([])
  const mention = text.match(/(?:^|\s)@([^\s]*)$/)?.[1] ?? null

  useEffect(() => {
    if (mention === null) {
      setFileMatches([])
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      void onSearchFiles(mention).then((result) => {
        if (!cancelled) setFileMatches(result.files.slice(0, 12))
      }).catch(() => {
        if (!cancelled) setFileMatches([])
      })
    }, 120)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [mention, onSearchFiles])

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
    if (isStreaming || isSubmitting || (!content.trim() && attachments.length === 0)) return
    useComposerStore.getState().clear()
    autosize()
    textareaRef.current?.focus()
    setIsSubmitting(true)
    try {
      const outgoing = attachments
      const ok = await onSend(content.trim() || 'Revisa los archivos adjuntos.', outgoing)
      if (ok) setAttachments([])
      if (!ok && useComposerStore.getState().text === '') {
        useComposerStore.getState().setText(content)
        requestAnimationFrame(autosize)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const canSend = !!text.trim() || attachments.length > 0

  function addAttachment(item: AttachmentRef) {
    setAttachments((current) => current.some((file) => file.path === item.path) ? current : [...current, item].slice(0, 8))
  }

  async function chooseFiles() {
    const selected = await open({ multiple: true, directory: false, title: 'Adjuntar archivos de texto o código' })
    const paths = typeof selected === 'string' ? [selected] : selected ?? []
    for (const path of paths) {
      addAttachment({
        id: `att_${Date.now().toString(36)}_${path}`,
        path,
        name: path.split(/[/\\]/).pop() ?? path,
        source: 'native',
      })
    }
  }

  function chooseWorkspaceFile(file: { path: string; relative_path: string; name: string }) {
    addAttachment({ id: `att_${Date.now().toString(36)}_${file.path}`, path: file.path, name: file.relative_path, source: 'workspace' })
    useComposerStore.getState().setText(text.replace(/(?:^|\s)@[^\s]*$/, (match) => `${match.startsWith(' ') ? ' ' : ''}@${file.relative_path} `))
    setFileMatches([])
    requestAnimationFrame(autosize)
  }

  return (
    <div className="relative">
      <div className="rounded-[26px] border border-[var(--border)] bg-[var(--bg-elevated)] p-2.5 shadow-[0_8px_30px_rgba(0,0,0,0.24)] transition-colors focus-within:border-[var(--accent-2)]/50">
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5 px-1">
            {attachments.map((file) => (
              <span key={file.path} className="inline-flex max-w-[240px] items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] px-2 py-1 text-[11px] text-[var(--text-muted)]">
                <FileText size={12} className="shrink-0" />
                <span className="truncate">{file.name}</span>
                <button type="button" aria-label={`Quitar ${file.name}`} onClick={() => setAttachments((current) => current.filter((item) => item.path !== file.path))} className="cursor-pointer rounded p-0.5 hover:bg-[var(--bg-hover)]"><X size={11} /></button>
              </span>
            ))}
          </div>
        )}
        {fileMatches.length > 0 && (
          <div className="absolute right-2 bottom-full left-2 z-30 mb-2 max-h-64 overflow-auto rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-1.5 shadow-xl">
            {fileMatches.map((file) => (
              <button key={file.path} type="button" onClick={() => chooseWorkspaceFile(file)} className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text)]">
                <FileText size={13} /><span className="truncate">{file.relative_path}</span>
              </button>
            ))}
          </div>
        )}
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
          className="composer-textarea block max-h-[240px] min-h-13 w-full resize-none border-0 bg-transparent text-[15px] leading-relaxed text-[var(--text)] outline-none placeholder:text-[var(--text-subtle)] focus:outline-none focus-visible:outline-none"
        />
        <div className="mt-1 flex items-center gap-1.5">
          <button type="button" onClick={() => void chooseFiles()} disabled={isStreaming} aria-label="Adjuntar archivos" title="Adjuntar archivos" className="flex size-8 cursor-pointer items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text)] disabled:opacity-40">
            <Paperclip size={15} />
          </button>
          <div
            role="group"
            aria-label={t('mode.change')}
            className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--bg-subtle)] p-0.5"
          >
            {MODES.map((mode) => {
              const current = (sessionMode ?? 'build').toLowerCase()
              const selected = current === mode
              return (
                <button
                  key={mode}
                  type="button"
                  disabled={sessionMode === null || isStreaming}
                  onClick={() => onModeChange(mode)}
                  aria-pressed={selected}
                  title={t(`mode.${mode}` as 'mode.plan')}
                  className={`rounded-full px-2.5 py-1 font-mono text-[10px] tracking-wide transition-all disabled:opacity-40 ${
                    selected
                      ? 'bg-[var(--accent)] font-bold text-white'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  {t(`mode.${mode}` as 'mode.plan')}
                </button>
              )
            })}
          </div>
          <Popover onOpenChange={(open) => { if (open) onDiscoverModels() }}>
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={isStreaming}
                title={t('composer.chooseModel')}
                className="inline-flex max-w-[220px] items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:border-[var(--accent)]/40 hover:text-[var(--text)] disabled:opacity-40"
              >
                <Box size={13} aria-hidden="true" className="shrink-0" />
                <span className="truncate">{activeAlias ?? t('composer.noModel')}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="flex min-h-0 w-64 flex-col overflow-hidden p-1.5"
              style={{
                maxHeight: 'min(32rem, var(--radix-popover-content-available-height))',
              }}
            >
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5">
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
                    onClick={() => onUseModel(model)}
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
              </div>
              {models.length > 0 && (
                <div className="shrink-0 border-t border-[var(--border)] pt-1">
                  <button
                    type="button"
                    onClick={onOpenProviders}
                    className="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-xs text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
                  >
                    {t('composer.manageModels')}
                  </button>
                </div>
              )}
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" disabled={isStreaming} title="Permisos de este chat" className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:border-[var(--accent)]/40 hover:text-[var(--text)] disabled:opacity-40">
                <Shield size={13} />
                <span>{effectivePermissionProfile === 'read-only' ? 'Solo lectura' : effectivePermissionProfile === 'full-access' ? 'Acceso completo' : 'Workspace'}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-1.5">
              {sessionMode !== 'build' && <p className="px-2.5 py-2 text-[11px] text-[var(--text-subtle)]">PLAN y REVIEW siempre usan solo lectura.</p>}
              {([
                ['read-only', 'Solo lectura', 'Inspección sin modificar archivos.'],
                ['workspace', 'Workspace', 'Puede trabajar dentro del proyecto.'],
                ['full-access', 'Acceso completo', 'Permite acciones fuera del workspace según política.'],
              ] as const).map(([value, label, description]) => (
                <button key={value} type="button" disabled={sessionMode !== 'build'} onClick={() => onPermissionChange(value)} className="flex w-full cursor-pointer items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[var(--bg-hover)] disabled:cursor-default disabled:opacity-40">
                  <span className="min-w-0 flex-1"><span className="block text-[13px] text-[var(--text)]">{label}</span><span className="block text-[11px] text-[var(--text-subtle)]">{description}</span></span>
                  {permissionProfile === value && <Check size={14} className="mt-0.5 text-[var(--accent-2)]" />}
                </button>
              ))}
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={isStreaming}
                title={t('composer.thinkingMenu')}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:border-[var(--accent)]/40 hover:text-[var(--text)] disabled:opacity-40"
              >
                <Brain size={13} aria-hidden="true" />
                <span>{t(`thinking.${reasoningEffort}` as 'thinking.high')}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="max-h-[min(70vh,32rem)] w-72 overflow-y-auto p-1.5"
            >
              <p className="px-2.5 pt-1.5 pb-1 text-[10px] font-semibold tracking-wider text-[var(--text-subtle)] uppercase">
                {t('composer.thinkingMenu')}
              </p>
              {REASONING_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => onReasoningChange(level)}
                  className="flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[var(--bg-hover)]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-[var(--text)]">
                      {t(`thinking.${level}` as 'thinking.high')}
                    </span>
                    <span className="block text-[11px] leading-snug text-[var(--text-subtle)]">
                      {t(`thinking.desc${level === 'off' ? 'Off' : level[0].toUpperCase() + level.slice(1)}` as 'thinking.descHigh')}
                    </span>
                  </span>
                  {reasoningEffort === level && (
                    <Check size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--accent-2)]" />
                  )}
                </button>
              ))}
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
              disabled={!canSend || isSubmitting}
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
