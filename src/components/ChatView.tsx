import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Virtualizer, type VirtualizerHandle } from 'virtua'
import type { AttachmentRef, ChatMessage, PendingApproval, TurnExecution } from '../types'
import type { ModelSummary } from '../services/engine'
import { useI18n, type I18nKey } from '../i18n'
import { useComposerStore } from '../stores/composer'
import { useUIStore } from '../stores/ui'
import Composer from './composer/Composer'
import Logo from './Logo'
import MessageBubble from './MessageBubble'
import ScrollToBottom from './chat/ScrollToBottom'
import TurnExecutionBlock from './chat/TurnExecutionBlock'

interface ChatViewProps {
  messages: ChatMessage[]
  isStreaming: boolean
  engineReady: boolean
  onSend: (text: string, attachments?: AttachmentRef[]) => Promise<boolean>
  onStop: () => void
  onOpenProviders: () => void
  models: ModelSummary[]
  activeAlias: string | null
  onUseModel: (model: ModelSummary) => void
  onDiscoverModels: () => void
  executions: Record<string, TurnExecution>
  approvals: PendingApproval[]
  onResolveApproval: (id: string, decision: string) => void
  historyNote: { total: number; hasMore: boolean } | null
  sessionMode: string | null
  onModeChange: (mode: string) => void
  reasoningEffort: 'off' | 'low' | 'medium' | 'high'
  onReasoningChange: (effort: 'off' | 'low' | 'medium' | 'high') => void
  permissionProfile: 'read-only' | 'workspace' | 'full-access'
  effectivePermissionProfile: 'read-only' | 'workspace' | 'full-access'
  onPermissionChange: (profile: string) => void
  onSearchFiles: (query: string) => Promise<{ root: string; files: Array<{ path: string; relative_path: string; name: string }> }>
}

const SUGGESTIONS: I18nKey[] = [
  'chat.suggestion1',
  'chat.suggestion2',
  'chat.suggestion3',
  'chat.suggestion4',
]

export default function ChatView({
  messages,
  isStreaming,
  engineReady,
  onSend,
  onStop,
  onOpenProviders,
  models,
  activeAlias,
  onUseModel,
  onDiscoverModels,
  executions,
  approvals,
  onResolveApproval,
  historyNote,
  sessionMode,
  onModeChange,
  reasoningEffort,
  onReasoningChange,
  permissionProfile,
  effectivePermissionProfile,
  onPermissionChange,
  onSearchFiles,
}: ChatViewProps) {
  const { t } = useI18n()
  const autoFollow = useUIStore((s) => s.autoFollow)
  const showSuggestions = useUIStore((s) => s.showSuggestions)
  const scrollRef = useRef<HTMLDivElement>(null)
  const virtRef = useRef<VirtualizerHandle>(null)
  const [atBottom, setAtBottom] = useState(true)
  const hasDraft = useComposerStore((s) => s.text.trim().length > 0)
  const setDraft = useComposerStore((s) => s.setText)

  // Continuar tras un stop de emergencia: turno nuevo en la misma sesión.
  // Solo pre-rellena el borrador; el usuario decide y envía.
  const handleContinue = useCallback(() => {
    setDraft(t('turn.continueDraft'))
  }, [setDraft, t])

  const empty = messages.length === 0
  // `turn.started` creates the assistant placeholder linked to its execution.
  // A second UI-only placeholder produced duplicate "Pensando" rows and could
  // outlive a terminal event, so the protocol-backed message is the sole source.
  const visibleMessages: ChatMessage[] = messages

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80)
  }

  useEffect(() => {
    // Autoscroll inteligente: solo sigue si el usuario ya estaba abajo
    // y la preferencia está activa.
    if (autoFollow && atBottom && visibleMessages.length > 0) {
      virtRef.current?.scrollToIndex(visibleMessages.length - 1, { align: 'end' })
    }
  }, [messages, isStreaming, atBottom, autoFollow, visibleMessages.length])

  const composer = (
    <Composer
      placement={empty ? 'centered' : 'bottom'}
      onSend={onSend}
      isStreaming={isStreaming}
      onStop={onStop}
      models={models}
      activeAlias={activeAlias}
      onUseModel={onUseModel}
      onDiscoverModels={onDiscoverModels}
      sessionMode={sessionMode}
      onModeChange={onModeChange}
      reasoningEffort={reasoningEffort}
      onReasoningChange={onReasoningChange}
      onOpenProviders={onOpenProviders}
      permissionProfile={permissionProfile}
      effectivePermissionProfile={effectivePermissionProfile}
      onPermissionChange={onPermissionChange}
      onSearchFiles={onSearchFiles}
    />
  )

  return (
    <div className="relative flex h-full flex-col">
      {empty ? (
        <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="flex w-full max-w-2xl flex-col items-center"
            style={{ marginTop: '-6vh' }}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute rounded-full blur-3xl"
              style={{
                width: 320,
                height: 200,
                background: 'radial-gradient(closest-side, rgba(139,92,246,0.16), transparent)',
              }}
            />
            <Logo size={96} radius="rounded-3xl" className="relative" />
            <h2 className="relative mt-4 text-center text-3xl font-bold tracking-tight text-[var(--text)]">
              {t('chat.emptyTitle')}
            </h2>
            <p className="relative mt-1.5 text-center text-sm text-[var(--text-muted)]">
              {engineReady ? t('chat.emptySubtitle') : t('chat.connecting')}
            </p>
            <motion.div
              layout
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="relative mt-6 w-full"
            >
              {composer}
            </motion.div>
            {showSuggestions && (
              <div
                className={`mt-4 flex flex-wrap justify-center gap-2 transition-opacity duration-200 ${hasDraft ? 'pointer-events-none opacity-30' : 'opacity-100'}`}
              >
                {SUGGESTIONS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => void onSend(t(k))}
                    className="h-11 rounded-full border border-[var(--border)] bg-[var(--bg-subtle)] px-4 text-[13px] text-[var(--text-muted)] transition-all hover:border-[var(--accent)]/40 hover:text-[var(--text)] active:scale-[0.98]"
                  >
                    {t(k)}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto" onScroll={handleScroll}>
            {historyNote?.hasMore && (
              <p className="mx-auto max-w-3xl px-4 pt-4 text-center text-[11px] text-[var(--text-subtle)]">
                {t('history.hasMore', { n: historyNote.total })}
              </p>
            )}
            <Virtualizer ref={virtRef} scrollRef={scrollRef} data={visibleMessages} bufferSize={800}>
              {(m, index) => (
                <div
                  key={m.id}
                  className={`mx-auto max-w-3xl px-4 ${index === 0 ? 'pt-6' : 'pt-3'} pb-3`}
                >
                  {m.turnId && executions[m.turnId] && (
                    <TurnExecutionBlock
                      execution={executions[m.turnId]}
                      approvals={approvals}
                      onResolveApproval={onResolveApproval}
                      onContinue={handleContinue}
                    />
                  )}
                  {(m.content !== '' || !m.turnId || !executions[m.turnId]) && (
                    <MessageBubble
                      message={
                        m.turnId && executions[m.turnId]
                          ? { ...m, pending: false }
                          : m
                      }
                    />
                  )}
                </div>
              )}
            </Virtualizer>
          </div>
          <div className="shrink-0 border-t border-[var(--border)] px-4 pt-3 pb-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="mx-auto max-w-3xl"
            >
              {composer}
            </motion.div>
          </div>
          <ScrollToBottom
            visible={!atBottom && messages.length > 0}
            onClick={() => {
              setAtBottom(true)
              if (visibleMessages.length > 0) {
                requestAnimationFrame(() => {
                  virtRef.current?.scrollToIndex(visibleMessages.length - 1, { align: 'end' })
                })
              }
            }}
          />
        </>
      )}
    </div>
  )
}
