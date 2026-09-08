import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Virtualizer, type VirtualizerHandle } from 'virtua'
import type { ChatMessage } from '../types'
import type { ModelSummary } from '../services/engine'
import { useI18n, type I18nKey } from '../i18n'
import { useComposerStore } from '../stores/composer'
import { useUIStore } from '../stores/ui'
import Composer from './composer/Composer'
import Logo from './Logo'
import MessageBubble from './MessageBubble'
import ScrollToBottom from './chat/ScrollToBottom'

interface ChatViewProps {
  messages: ChatMessage[]
  isStreaming: boolean
  engineReady: boolean
  onSend: (text: string) => Promise<boolean>
  onStop: () => void
  onOpenProviders: () => void
  models: ModelSummary[]
  activeAlias: string | null
  onUseModel: (alias: string) => void
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
}: ChatViewProps) {
  const { t } = useI18n()
  const autoFollow = useUIStore((s) => s.autoFollow)
  const showSuggestions = useUIStore((s) => s.showSuggestions)
  const scrollRef = useRef<HTMLDivElement>(null)
  const virtRef = useRef<VirtualizerHandle>(null)
  const [atBottom, setAtBottom] = useState(true)
  const hasDraft = useComposerStore((s) => s.text.trim().length > 0)

  const empty = messages.length === 0

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80)
  }

  useEffect(() => {
    // Autoscroll inteligente: solo sigue si el usuario ya estaba abajo
    // y la preferencia está activa.
    if (autoFollow && atBottom && messages.length > 0) {
      virtRef.current?.scrollToIndex(messages.length - 1, { align: 'end' })
    }
  }, [messages, isStreaming, atBottom, autoFollow])

  const composer = (
    <Composer
      placement={empty ? 'centered' : 'bottom'}
      onSend={onSend}
      isStreaming={isStreaming}
      onStop={onStop}
      models={models}
      activeAlias={activeAlias}
      onUseModel={onUseModel}
      onOpenProviders={onOpenProviders}
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
            <Logo size={48} radius="rounded-2xl" className="relative" />
            <h2 className="relative mt-4 text-center text-3xl font-bold tracking-tight text-[var(--text)]">
              {t('chat.emptyTitle')}
            </h2>
            <p className="relative mt-1.5 text-center text-sm text-[var(--text-muted)]">
              {engineReady ? t('chat.emptySubtitle') : t('engine.start')}
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
            <Virtualizer ref={virtRef} scrollRef={scrollRef} data={messages} bufferSize={800}>
              {(m, index) => (
                <div
                  key={m.id}
                  className={`mx-auto max-w-3xl px-4 ${index === 0 ? 'pt-6' : 'pt-3'} pb-3`}
                >
                  <MessageBubble message={m} />
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
              if (messages.length > 0) {
                requestAnimationFrame(() => {
                  virtRef.current?.scrollToIndex(messages.length - 1, { align: 'end' })
                })
              }
            }}
          />
        </>
      )}
    </div>
  )
}
