import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Copy, ExternalLink, FileText, X } from 'lucide-react'
import { openUrl } from '@tauri-apps/plugin-opener'
import { toast } from 'sonner'
import { desktopApi, type FilePreview } from '../../services/desktop'
import { commandMessage, engineApi } from '../../services/engine'
import { copyText } from '../../lib/clipboard'
import Markdown, { CodeBlock } from '../../components/Markdown'
import HtmlPreview from './HtmlPreview'

type OpenFile = (path: string, turnId?: string) => void
const FileContext = createContext<OpenFile | null>(null)
export const FileTurnContext = createContext<string | undefined>(undefined)

export function localFileTarget(href: string): string | null {
  if (/^(https?:|mailto:|#)/i.test(href)) return null
  if (
    /^[a-z][a-z0-9+.-]*:/i.test(href) &&
    !/^(artifact:|file:|[a-z]:[\\/])/i.test(href)
  )
    return null
  let path = href
  try {
    path = decodeURIComponent(path)
  } catch {
    /* retain literal path */
  }
  if (/^file:/i.test(path)) {
    path = path.replace(/^file:\/\//i, '')
    if (/^\/[a-z]:[\\/]/i.test(path)) path = path.slice(1)
  }
  return path.replace(/:(\d+)(?::\d+)?$/, '')
}

export function fileUrlTransform(url: string): string {
  if (/^(https?:|mailto:|#)/i.test(url) || localFileTarget(url) !== null)
    return url
  return ''
}

export function FileLink({
  href = '',
  children,
}: {
  href?: string
  children?: ReactNode
}) {
  const open = useContext(FileContext)
  const turnId = useContext(FileTurnContext)
  const target = localFileTarget(href)
  return (
    <a
      href={href}
      data-file-path={target ?? undefined}
      onClick={(e) => {
        if (target !== null && open) {
          e.preventDefault()
          open(target, turnId)
        } else if (/^(https?:|mailto:)/i.test(href)) {
          e.preventDefault()
          void openUrl(href).catch((error) =>
            toast.error(commandMessage(error)),
          )
        }
      }}
    >
      {children}
    </a>
  )
}

type Tab = {
  key: string
  sessionId: string
  turnId?: string
  target: string
  file?: FilePreview
  error?: string
}
export default function FileWorkspace({
  sessionId,
  children,
}: {
  sessionId: string
  children: ReactNode
}) {
  const [tabs, setTabs] = useState<Tab[]>([])
  const [active, setActive] = useState('')
  const [visible, setVisible] = useState(false)
  const [source, setSource] = useState(false)
  const [width, setWidth] = useState(() => {
    try {
      return Math.max(
        280,
        Math.min(
          800,
          Number(localStorage.getItem('rinari.files.width')) || 440,
        ),
      )
    } catch {
      return 440
    }
  })
  const container = useRef<HTMLDivElement>(null)
  const currentTabs = tabs.filter((tab) => tab.sessionId === sessionId)
  const selected =
    currentTabs.find((tab) => tab.key === active) ?? currentTabs.at(-1)
  useEffect(() => {
    const toggle = () => setVisible((v) => !v)
    window.addEventListener('rinari-files-toggle', toggle)
    return () => window.removeEventListener('rinari-files-toggle', toggle)
  }, [])
  async function open(target: string, turnId?: string) {
    const key = JSON.stringify([sessionId, turnId, target])
    setVisible(true)
    setActive(key)
    setTabs((current) =>
      current.some((t) => t.key === key)
        ? current
        : [...current, { key, sessionId, turnId, target }],
    )
    try {
      let file: FilePreview
      if (target.startsWith('artifact://')) {
        const result = await engineApi.artifactRead(target, 512 * 1024)
        if (result.truncated) throw new Error('La vista previa supera 512 KiB.')
        file = {
          path: target,
          name: target.split('/').at(-1) || 'Artifact',
          content: result.text,
          language: target.split('.').at(-1) || '',
          size: result.text.length,
        }
      } else file = await desktopApi.readFile(sessionId, target, turnId)
      setTabs((current) =>
        current.map((tab) =>
          tab.key === key ? { ...tab, file, error: undefined } : tab,
        ),
      )
    } catch (error) {
      setTabs((current) =>
        current.map((tab) =>
          tab.key === key ? { ...tab, error: commandMessage(error) } : tab,
        ),
      )
    }
  }
  return (
    <FileContext.Provider value={(path, turnId) => void open(path, turnId)}>
      <div ref={container} className="flex h-full min-w-0">
        <div className="min-w-0 flex-1">{children}</div>
        {visible && (
          <>
            <div
              role="separator"
              aria-label="Ancho del visor"
              aria-orientation="vertical"
              aria-valuenow={width}
              tabIndex={0}
              className="w-1 shrink-0 cursor-col-resize bg-[var(--border)] hover:bg-[var(--accent)]"
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                  e.preventDefault()
                  setWidth((w) =>
                    Math.max(
                      280,
                      Math.min(800, w + (e.key === 'ArrowLeft' ? 20 : -20)),
                    ),
                  )
                }
              }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId)
              }}
              onPointerMove={(e) => {
                if (
                  e.currentTarget.hasPointerCapture(e.pointerId) &&
                  container.current
                )
                  setWidth(
                    Math.max(
                      280,
                      Math.min(
                        container.current.clientWidth * 0.7,
                        container.current.getBoundingClientRect().right -
                          e.clientX,
                      ),
                    ),
                  )
              }}
              onPointerUp={(e) => {
                e.currentTarget.releasePointerCapture(e.pointerId)
                try {
                  localStorage.setItem('rinari.files.width', String(width))
                } catch {
                  /* optional preference */
                }
              }}
            />
            <aside
              aria-label="Visor de archivos"
              style={{ width, maxWidth: '70%' }}
              className="flex min-w-0 shrink-0 flex-col bg-[var(--bg-app)] text-sm"
            >
              <div className="flex items-center border-b border-[var(--border)]">
                <div
                  role="tablist"
                  aria-label="Archivos abiertos"
                  className="flex flex-1 overflow-x-auto"
                >
                  {currentTabs.map((tab) => (
                    <div
                      key={tab.key}
                      className={`flex shrink-0 items-center border-r border-[var(--border)] ${selected?.key === tab.key ? 'bg-[var(--bg-hover)]' : ''}`}
                    >
                      <button
                        role="tab"
                        aria-selected={selected?.key === tab.key}
                        onClick={() => setActive(tab.key)}
                        className="flex items-center gap-2 px-3 py-3"
                      >
                        <FileText size={14} />
                        {tab.file?.name ?? tab.target.split(/[\\/]/).at(-1)}
                      </button>
                      <button
                        aria-label={`Cerrar ${tab.file?.name ?? tab.target}`}
                        onClick={() =>
                          setTabs((current) =>
                            current.filter((t) => t.key !== tab.key),
                          )
                        }
                        className="pr-2"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  aria-label="Cerrar visor"
                  onClick={() => setVisible(false)}
                  className="p-3"
                >
                  <X size={16} />
                </button>
              </div>
              {selected ? (
                <>
                  <div className="flex items-center gap-2 border-b border-[var(--border)] p-2">
                    <span
                      title={selected.file?.path ?? selected.target}
                      className="min-w-0 flex-1 truncate text-xs text-[var(--text-muted)]"
                    >
                      {selected.file?.path ?? selected.target}
                    </span>
                    <button
                      aria-label="Copiar ruta"
                      onClick={() =>
                        void copyText(selected.file?.path ?? selected.target)
                      }
                    >
                      <Copy size={14} />
                    </button>
                    {selected.file &&
                      !selected.target.startsWith('artifact:') &&
                      !['html', 'htm'].includes(selected.file.language) && (
                        <button
                          aria-label="Abrir externamente"
                          onClick={() =>
                            void desktopApi
                              .openFile(
                                selected.sessionId,
                                selected.file!.path,
                                selected.turnId,
                              )
                              .catch((error) =>
                                toast.error(commandMessage(error)),
                              )
                          }
                        >
                          <ExternalLink size={14} />
                        </button>
                      )}
                  </div>
                  {selected.file?.language === 'md' && (
                    <button
                      className="self-start px-3 py-2 text-xs"
                      onClick={() => setSource((v) => !v)}
                    >
                      {source ? 'Vista previa' : 'Ver fuente'}
                    </button>
                  )}
                  <div
                    role="tabpanel"
                    className={`min-h-0 flex-1 overflow-auto ${selected.file && ['html', 'htm'].includes(selected.file.language) && !selected.target.startsWith('artifact:') ? '' : 'p-4'}`}
                  >
                    {selected.error ? (
                      <p role="alert">{selected.error}</p>
                    ) : selected.file &&
                      ['html', 'htm'].includes(selected.file.language) &&
                      !selected.target.startsWith('artifact:') ? (
                      <HtmlPreview
                        key={selected.key}
                        sessionId={selected.sessionId}
                        turnId={selected.turnId}
                        file={selected.file}
                      />
                    ) : selected.file ? (
                      <FileTurnContext.Provider value={selected.turnId}>
                        <FileContext.Provider
                          value={(path) => {
                            const nested =
                              !/^(?:[a-z]:[\\/]|\/|artifact:)/i.test(path)
                                ? `${selected.file!.path.replace(/[\\/][^\\/]*$/, '')}/${path}`
                                : path
                            void open(nested, selected.turnId)
                          }}
                        >
                          {selected.file.language === 'md' && !source ? (
                            <Markdown>{selected.file.content}</Markdown>
                          ) : (
                            <CodeBlock
                              code={selected.file.content}
                              language={selected.file.language}
                            />
                          )}
                        </FileContext.Provider>
                      </FileTurnContext.Provider>
                    ) : (
                      <p role="status">Cargando archivo…</p>
                    )}
                  </div>
                </>
              ) : (
                <p className="p-4 text-[var(--text-muted)]">
                  Abre un archivo desde la conversación.
                </p>
              )}
            </aside>
          </>
        )}
      </div>
    </FileContext.Provider>
  )
}
