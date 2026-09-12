import { useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { openUrl } from '@tauri-apps/plugin-opener'
import { LoaderCircle, Square, SquareTerminal, X } from 'lucide-react'
import type { ManagedProcess, ProcessOutput } from '../../types/protocol.generated'

export default function ProcessesPanel({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<ManagedProcess[]>([])
  const [selected, setSelected] = useState('')
  const [output, setOutput] = useState<ProcessOutput | null>(null)
  const [error, setError] = useState('')
  const [stopping, setStopping] = useState('')
  const [refresh, setRefresh] = useState(0)
  const log = useRef<HTMLDivElement>(null)
  const follow = useRef(true)
  const [atEnd, setAtEnd] = useState(true)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    async function poll() {
      try {
        const result = await invoke<{ processes: ManagedProcess[]; truncated: boolean }>('workspace_process_list', { session_id: sessionId })
        if (cancelled) return
        setRows(result.processes)
        setError(result.truncated ? 'Se muestran los primeros 100 procesos.' : '')
        const current = result.processes.find(row => row.id === selected)
        if (open && !current) {
          setOutput(null)
          setSelected(result.processes[0]?.id ?? '')
        } else if (open && current) {
          const data = await invoke<ProcessOutput>('workspace_process_read', { session_id: sessionId, id: current.id })
          if (!cancelled) setOutput(data)
        }
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason))
      } finally {
        if (!cancelled) timer = setTimeout(poll, 1500)
      }
    }
    void poll()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [sessionId, selected, open, refresh])

  useEffect(() => {
    if (follow.current && log.current) log.current.scrollTop = log.current.scrollHeight
  }, [output])

  async function stop(id: string) {
    setStopping(id)
    try {
      const result = await invoke<{ running: boolean }>('workspace_process_stop', { session_id: sessionId, id })
      if (result.running) setError('El proceso sigue activo. Puedes volver a intentar detenerlo.')
      setRefresh(value => value + 1)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally { setStopping('') }
  }

  const active = rows.filter(row => row.running).length
  if (!open) return <button onClick={() => setOpen(true)} className="fixed bottom-4 left-4 z-40 lg:left-72 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text)]"><SquareTerminal size={14} />Procesos{active > 0 && <span className="rounded-full bg-[var(--accent)] px-1.5 text-white">{active}</span>}</button>

  return <section aria-label="Procesos de la sesión" className="fixed bottom-4 left-4 right-4 z-50 flex h-[42vh] min-h-60 max-h-[80vh] resize-y flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text)] shadow-2xl lg:left-72">
    <header className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2 text-sm"><SquareTerminal size={15} /><strong>Procesos</strong><span className="text-xs text-[var(--text-muted)]">{active} activos · Esta sesión</span><button className="ml-auto" aria-label="Cerrar procesos" onClick={() => setOpen(false)}><X size={16} /></button></header>
    {error && <p role="alert" className="px-3 py-1 text-xs text-amber-400">{error}</p>}
    <div className="flex min-h-0 flex-1">
      <div className="w-1/3 min-w-40 overflow-auto border-r border-[var(--border)] p-2">
        {rows.length === 0 && <p className="p-2 text-xs text-[var(--text-muted)]">No hay procesos registrados. Los servidores iniciados en segundo plano aparecerán aquí.</p>}
        {rows.map(row => <button key={row.id} aria-pressed={selected === row.id} onClick={() => { setSelected(row.id); setOutput(null); follow.current = true; setAtEnd(true) }} className={`mb-1 block w-full rounded-lg p-2 text-left text-xs ${selected === row.id ? 'bg-[var(--bg-hover)]' : ''}`}>
          <span className="flex items-center gap-2">{row.running && <LoaderCircle size={12} className="shrink-0 animate-spin motion-reduce:animate-none" />}<span className="truncate font-mono" title={row.command}>{row.command}</span></span>
          <span className="mt-1 block text-[var(--text-muted)]">{row.running ? 'En ejecución' : row.exit_code != null ? `Finalizado · código ${row.exit_code}` : 'Sin proceso propio'}{row.pid ? ` · PID ${row.pid}` : ''}</span>
        </button>)}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        {output && <>
          <div className="flex items-start gap-2 border-b border-[var(--border)] p-2 text-xs">
            <div className="min-w-0 flex-1"><p className="break-all font-mono">{output.process.command}</p><p className="break-all text-[var(--text-muted)]">{output.process.cwd}</p>{output.process.url && /^https?:\/\//i.test(output.process.url) && <button className="underline" onClick={() => void openUrl(output.process.url!).catch(reason => setError(String(reason)))}>{output.process.url}</button>}</div>
            {output.process.can_stop && <button disabled={!!stopping} onClick={() => void stop(output.process.id)} className="flex shrink-0 items-center gap-1 rounded border border-red-400/40 px-2 py-1 text-red-400 disabled:opacity-50"><Square size={11} />{stopping ? 'Deteniendo…' : 'Detener'}</button>}
          </div>
          <div ref={log} onScroll={() => { const el = log.current!; follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 30; setAtEnd(follow.current) }} className="min-h-0 flex-1 overflow-auto p-3 font-mono text-xs">
            <pre className="whitespace-pre-wrap break-all">{output.stdout || (!output.stderr ? 'Sin salida todavía.' : '')}</pre>
            {output.stderr && <><p className="mt-3 text-amber-400">stderr</p><pre className="whitespace-pre-wrap break-all text-amber-300">{output.stderr}</pre></>}
            {output.truncated && <p className="mt-2 text-amber-400">Salida recortada al límite de visualización.</p>}
          </div>
          {!atEnd && <button className="p-1 text-xs underline" onClick={() => { follow.current = true; setAtEnd(true); if (log.current) log.current.scrollTop = log.current.scrollHeight }}>Ir al final</button>}
        </>}
      </div>
    </div>
  </section>
}
