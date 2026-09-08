import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  commandMessage,
  engineApi,
  type McpServer,
} from '../../services/engine'
import { useI18n } from '../../i18n'
import { Section } from '../../components/settings/parts'
import { inputClass, labelClass } from '../../components/settings/parts'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog'

/** Ajustes > MCP: registry, test/reconnect, enable/disable, add/remove. */
export default function McpView({ onChanged }: { onChanged: () => void }) {
  const { t } = useI18n()
  const [servers, setServers] = useState<McpServer[]>([])
  const [testing, setTesting] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [command, setCommand] = useState('')
  const [removing, setRemoving] = useState<McpServer | null>(null)

  const reload = useCallback(async () => {
    try {
      const result = await engineApi.mcpList()
      setServers(result.servers)
    } catch (err) {
      toast.error(commandMessage(err))
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  async function toggle(server: McpServer) {
    try {
      await engineApi.mcpSetEnabled(server.name, !server.enabled)
      await reload()
      onChanged()
    } catch (err) {
      toast.error(commandMessage(err))
    }
  }

  async function test(server: McpServer) {
    setTesting(server.name)
    setTestResult(null)
    try {
      const result = await engineApi.mcpTest(server.name)
      const test = result.test
      setTestResult(
        test.ok
          ? t('mcp.testOk', { n: String(test.tools ?? 0) })
          : t('mcp.testFail', { error: test.error ?? 'UNKNOWN', message: test.message ?? '' }),
      )
      await reload()
    } catch (err) {
      toast.error(commandMessage(err))
    } finally {
      setTesting(null)
    }
  }

  async function add() {
    const parts = command.split(/\s+/).filter((p) => p !== '')
    if (name.trim() === '' || parts.length === 0) return
    try {
      await engineApi.mcpCreate(name.trim(), parts)
      setName('')
      setCommand('')
      await reload()
      onChanged()
    } catch (err) {
      toast.error(commandMessage(err))
    }
  }

  async function remove() {
    if (!removing) return
    try {
      await engineApi.mcpRemove(removing.name)
      setRemoving(null)
      await reload()
      onChanged()
    } catch (err) {
      toast.error(commandMessage(err))
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="font-display text-lg font-bold text-[var(--text)]">{t('mcp.title')}</h2>

      {servers.map((server) => (
        <Section
          key={server.name}
          title={`${server.name} · ${server.connected ? t('mcp.connected') : t('mcp.disconnected')}`}
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-subtle)]">
            <span className="font-mono">{server.command}</span>
            <span>{server.scope}</span>
            <span>{server.enabled ? t('mcp.enabled') : t('mcp.disabled')}</span>
          </div>
          {testing === server.name && testResult && (
            <p className="text-sm text-[var(--text-muted)]">{testResult}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void toggle(server)}
              className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-[var(--bg-hover)]"
            >
              {server.enabled ? t('mcp.disable') : t('mcp.enable')}
            </button>
            <button
              type="button"
              onClick={() => void test(server)}
              disabled={testing !== null}
              className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-40"
            >
              {t('mcp.test')}
            </button>
            <button
              type="button"
              onClick={() => setRemoving(server)}
              className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs text-red-400 transition-colors hover:bg-[var(--bg-hover)]"
            >
              {t('mcp.remove')}
            </button>
          </div>
        </Section>
      ))}

      <Section title={t('mcp.add')}>
        <div>
          <label className={labelClass} htmlFor="mcp-name">{t('mcp.nameLabel')}</label>
          <input
            id="mcp-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="mcp-command">{t('mcp.commandLabel')}</label>
          <input
            id="mcp-command"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="npx -y @modelcontextprotocol/server-github"
            className={`${inputClass} font-mono`}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <div>
          <button
            type="button"
            onClick={() => void add()}
            className="rounded-xl bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white transition-all hover:brightness-110"
          >
            {t('mcp.add')}
          </button>
        </div>
      </Section>

      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('mcp.remove')}</AlertDialogTitle>
            <AlertDialogDescription>
              {removing && t('mcp.confirmRemove', { name: removing.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('providers.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void remove()}>
              {t('mcp.remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
