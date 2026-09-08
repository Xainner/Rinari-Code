import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { commandMessage, engineApi, type TaskItem } from '../../services/engine'
import { useI18n } from '../../i18n'

/** Tareas del proyecto: árbol por profundidad + detalle con evidencia. */
export default function TasksPanel({ path }: { path: string }) {
  const { t } = useI18n()
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [depths, setDepths] = useState<Record<string, number>>({})
  const [detail, setDetail] = useState<TaskItem | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const tree = await engineApi.taskTree(path)
      setTasks(tree.tasks)
      setDepths(tree.depths)
    } catch (err) {
      toast.error(commandMessage(err))
    }
  }, [path])

  useEffect(() => {
    setDetail(null)
    setOpenId(null)
    void reload()
  }, [reload])

  async function openTask(id: string) {
    if (openId === id) {
      setOpenId(null)
      setDetail(null)
      return
    }
    try {
      const result = await engineApi.taskGet(path, id)
      setDetail(result.task)
      setOpenId(id)
    } catch (err) {
      toast.error(commandMessage(err))
    }
  }

  function field(label: string, value: unknown) {
    if (value === null || value === undefined || value === '') return null
    return (
      <div>
        <p className="text-[11px] font-semibold tracking-wide text-[var(--text-subtle)] uppercase">
          {label}
        </p>
        <p className="mt-0.5 text-[13px] whitespace-pre-wrap text-[var(--text)]">
          {typeof value === 'string' ? value : JSON.stringify(value)}
        </p>
      </div>
    )
  }

  if (tasks.length === 0) {
    return <p className="text-sm text-[var(--text-subtle)]">{t('workspace.tasksEmpty')}</p>
  }

  return (
    <div className="space-y-1.5">
      {tasks.map((task) => {
        const depth = Math.min(depths[task.id] ?? 0, 6)
        const isOpen = openId === task.id
        return (
          <div
            key={task.id}
            className="overflow-hidden rounded-xl border border-[var(--border)]"
          >
            <button
              type="button"
              onClick={() => void openTask(task.id)}
              className="flex w-full items-center gap-2 bg-[var(--bg-subtle)] px-3 py-2 text-left transition-colors hover:bg-[var(--bg-hover)]"
            >
              <span
                aria-hidden="true"
                className={`size-2 shrink-0 rounded-full ${
                  task.status === 'done'
                    ? 'bg-emerald-500/80'
                    : task.status === 'in_progress'
                      ? 'bg-[var(--accent-2)]'
                      : 'bg-[var(--text-subtle)]'
                }`}
              />
              <span
                className="min-w-0 flex-1 truncate text-sm text-[var(--text)]"
                style={{ paddingLeft: depth * 14 }}
              >
                {task.title}
              </span>
              <span className="shrink-0 font-mono text-[10px] text-[var(--text-subtle)]">
                {task.status}
              </span>
            </button>
            {isOpen && detail && (
              <div className="space-y-2 border-t border-[var(--border)] px-3 py-2.5">
                {field(t('workspace.taskStatus'), detail.status)}
                {field(t('workspace.taskAcceptance'), detail['acceptance'])}
                {field(t('workspace.taskEvidence'), detail['evidence'])}
                {field(t('workspace.taskBlockers'), detail['blockers'])}
                {field(t('workspace.taskDoneWhen'), detail['done_when'])}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
