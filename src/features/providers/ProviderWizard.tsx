import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  commandMessage,
  engineApi,
  type ProviderHealth,
} from '../../services/engine'
import { useI18n } from '../../i18n'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'
import ProviderForm, { initialForm, type ProviderFormData } from './ProviderForm'
import ModelCatalog from './ModelCatalog'
import { PROVIDER_PRESETS } from './presets'

type Step = 'preset' | 'fields' | 'testing' | 'models' | 'done'

/**
 * Alta guiada de proveedor (primer arranque y botón Agregar).
 * Crea → prueba → descubre → guarda aliases → termina con modelo activo.
 * El secreto viaja solo en memoria hacia el engine.
 */
export default function ProviderWizard({
  open,
  onClose,
}: {
  open: boolean
  onClose: (finished: boolean) => void
}) {
  const { t } = useI18n()
  const [step, setStep] = useState<Step>('preset')
  const [form, setForm] = useState<ProviderFormData>(() => initialForm())
  const [createdAlias, setCreatedAlias] = useState<string | null>(null)
  const [health, setHealth] = useState<ProviderHealth | null>(null)
  const [error, setError] = useState('')
  const [working, setWorking] = useState(false)

  function reset() {
    setStep('preset')
    setForm(initialForm())
    setCreatedAlias(null)
    setHealth(null)
    setError('')
    setWorking(false)
  }

  // Secuencia crear → probar al entrar al paso testing.
  useEffect(() => {
    if (!open || step !== 'testing' || createdAlias) return
    let cancelled = false
    async function run() {
      setWorking(true)
      setError('')
      try {
        const alias = form.alias.trim()
        await engineApi.providerCreate({
          alias,
          provider_type: form.preset.provider_type,
          auth_method: form.auth,
          endpoint: form.endpoint.trim() === '' ? undefined : form.endpoint.trim(),
          account_hint:
            form.account_hint.trim() === '' ? undefined : form.account_hint.trim(),
          secret: form.secret === '' ? undefined : form.secret,
          secret_env: form.secret_env === '' ? undefined : form.secret_env,
        })
        if (cancelled) return
        setCreatedAlias(alias)
        toast.success(t('wizard.saved'))
        const result = await engineApi.providerTest(alias)
        if (cancelled) return
        setHealth(result)
        if (result.connected) {
          toast.success(t('providers.healthOk', { n: result.models_discovered }))
          setStep('models')
        }
      } catch (err) {
        if (!cancelled) setError(commandMessage(err))
      } finally {
        if (!cancelled) setWorking(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step])

  async function retryTest() {
    if (!createdAlias) return
    setWorking(true)
    setError('')
    try {
      const result = await engineApi.providerTest(createdAlias)
      setHealth(result)
      if (result.connected) {
        toast.success(t('providers.healthOk', { n: result.models_discovered }))
        setStep('models')
      }
    } catch (err) {
      setError(commandMessage(err))
    } finally {
      setWorking(false)
    }
  }

  async function deleteAndBack() {
    if (!createdAlias) {
      setStep('fields')
      return
    }
    try {
      const list = await engineApi.providerList()
      const target = list.providers.find((p) => p.alias === createdAlias)
      if (target) {
        const other = list.providers.find((p) => p.alias !== createdAlias)
        await engineApi.providerRemove(
          createdAlias,
          target.active ? other?.alias : undefined,
        )
      }
    } catch (err) {
      toast.error(commandMessage(err))
    }
    setCreatedAlias(null)
    setHealth(null)
    setStep('fields')
  }

  async function finish() {
    if (!createdAlias) return
    try {
      const listed = await engineApi.modelList(createdAlias)
      const active = listed.models.find((m) => m.active)
      if (!active) {
        toast.error(t('providers.savedHint'))
        return
      }
      setStep('done')
    } catch (err) {
      toast.error(commandMessage(err))
    }
  }

  function close(finished: boolean) {
    reset()
    onClose(finished)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) close(false)
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('wizard.title')}</DialogTitle>
        </DialogHeader>

        {step === 'preset' && (
          <div className="space-y-3">
            <p className="text-sm text-[var(--text-muted)]">{t('wizard.welcome')}</p>
            <div className="grid gap-2">
              {PROVIDER_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setForm((prev) => ({
                      ...prev,
                      preset,
                      alias: preset.id,
                      endpoint: preset.endpoint,
                      auth: preset.auth,
                    }))
                    setStep('fields')
                  }}
                  className="flex items-center gap-3 rounded-xl border border-[var(--border)] px-3 py-2.5 text-left transition-all hover:border-[var(--accent)]/50 active:scale-[0.99]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-[var(--text)]">
                      {t(preset.nameKey)}
                    </span>
                    <span className="block truncate text-xs text-[var(--text-subtle)]">
                      {t(preset.descKey)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => close(false)}
                className="rounded-xl px-3 py-1.5 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
              >
                {t('wizard.later')}
              </button>
            </div>
          </div>
        )}

        {step === 'fields' && (
          <div className="space-y-4">
            <ProviderForm form={form} setForm={setForm} allowPresetChange isEdit={false} />
            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep('preset')}
                className="rounded-xl border border-[var(--border)] px-3 py-1.5 text-sm transition-colors hover:bg-[var(--bg-hover)]"
              >
                {t('wizard.back')}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (form.alias.trim() === '') return
                  if (
                    form.auth === 'api-key' &&
                    form.secret === '' &&
                    form.secret_env === ''
                  ) {
                    toast.error(t('providers.noCredential'))
                    return
                  }
                  setCreatedAlias(null)
                  setHealth(null)
                  setStep('testing')
                }}
                className="rounded-xl bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white transition-all hover:brightness-110"
              >
                {t('wizard.next')}
              </button>
            </div>
          </div>
        )}

        {step === 'testing' && (
          <div className="space-y-3">
            <p className="text-sm text-[var(--text-muted)]">
              {working ? t('providers.testing') : (health ? t('providers.healthFail', { detail: health.detail }) : '')}
            </p>
            {error !== '' && <p className="text-sm text-red-400">{error}</p>}
            {health && !health.connected && !working && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void retryTest()}
                  className="rounded-xl border border-[var(--border)] px-3 py-1.5 text-sm transition-colors hover:bg-[var(--bg-hover)]"
                >
                  {t('providers.retry')}
                </button>
                <button
                  type="button"
                  onClick={() => setStep('fields')}
                  className="rounded-xl border border-[var(--border)] px-3 py-1.5 text-sm transition-colors hover:bg-[var(--bg-hover)]"
                >
                  {t('providers.edit')}
                </button>
                <button
                  type="button"
                  onClick={() => void deleteAndBack()}
                  className="rounded-xl border border-[var(--border)] px-3 py-1.5 text-sm text-red-400 transition-colors hover:bg-[var(--bg-hover)]"
                >
                  {t('providers.delete')}
                </button>
              </div>
            )}
          </div>
        )}

        {step === 'models' && createdAlias && (
          <div className="space-y-4">
            <ModelCatalog providerAlias={createdAlias} onChanged={() => {}} />
            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep('fields')}
                className="rounded-xl border border-[var(--border)] px-3 py-1.5 text-sm transition-colors hover:bg-[var(--bg-hover)]"
              >
                {t('wizard.back')}
              </button>
              <button
                type="button"
                onClick={() => void finish()}
                className="rounded-xl bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white transition-all hover:brightness-110"
              >
                {t('wizard.next')}
              </button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-muted)]">{t('wizard.ready')}</p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => close(true)}
                className="rounded-xl bg-[var(--accent)] px-4 py-1.5 text-sm font-semibold text-white transition-all hover:brightness-110"
              >
                {t('wizard.finish')}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
