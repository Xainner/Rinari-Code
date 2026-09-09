import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import {
  commandMessage,
  engineApi,
  type ModelSummary,
  type ProviderSummary,
} from '../../services/engine'

/**
 * CatalogState: proveedores y modelos. Degradado independiente — un fallo
 * aquí nunca bloquea el shell; la sección se reintenta por separado.
 */
export function useCatalog() {
  const [providers, setProviders] = useState<ProviderSummary[]>([])
  const [models, setModels] = useState<ModelSummary[]>([])
  const [catalogLoaded, setCatalogLoaded] = useState(false)
  const [catalogError, setCatalogError] = useState<string | null>(null)

  const refreshCatalog = useCallback(async (): Promise<void> => {
    try {
      const [p, m] = await Promise.all([engineApi.providerList(), engineApi.modelList()])
      // El picker primario es un catálogo de provider, no solo lo guardado
      // en SQLite. Los fallos de discovery quedan acotados a ese provider
      // para que una credencial rancia no oculte todos los demás modelos.
      const discovered = await Promise.all(
        p.providers.map(async (provider) => {
          try {
            const result = await engineApi.modelDiscover(provider.alias)
            return (result.providers[provider.alias] ?? []).map<ModelSummary>((model) => ({
              id: `catalog:${provider.id}:${model.provider_model_id}`,
              alias: model.provider_model_id,
              provider_id: provider.id,
              provider: provider.alias,
              provider_model_id: model.provider_model_id,
              capabilities: model.capabilities,
              availability: model.availability,
              settings: {},
              active: false,
              saved: false,
            }))
          } catch {
            return []
          }
        }),
      )
      const savedKeys = new Set(
        m.models.map((model) => `${model.provider_id}\0${model.provider_model_id}`),
      )
      const catalogModels = discovered
        .flat()
        .filter((model) => !savedKeys.has(`${model.provider_id}\0${model.provider_model_id}`))
      setProviders(p.providers)
      setModels([...m.models.map((model) => ({ ...model, saved: true })), ...catalogModels])
      setCatalogError(null)
    } catch (err) {
      // Catálogo degradado, nunca bloqueo del shell: el engine sigue usable
      // y la sección se puede reintentar de forma independiente.
      setCatalogError(commandMessage(err))
      toast.error(commandMessage(err))
    } finally {
      setCatalogLoaded(true)
    }
  }, [])

  return {
    providers,
    models,
    catalogLoaded,
    catalogError,
    refreshCatalog,
  }
}

export type Catalog = ReturnType<typeof useCatalog>
