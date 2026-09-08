# ADR 0001 — Empaquetado del motor Python

- Estado: propuesto (spike Phase 0 pendiente de resultado)
- Fecha: 2026-09-08
- Contexto: AGENTS.md §45

## Opciones

1. **Runtime Python empaquetado + paquete Rinari instalado**
   (`python/` + `rinari` vía uv/pip dentro del bundle).
2. **Motor congelado** (estilo PyInstaller/Nuitka, un solo ejecutable).

## Restricción determinante

Rinari soporta plugins Python de usuario/proyecto con carga dinámica
(`src/rinari/plugins`), subprocesos MCP y contrato de imports documentado.
Cualquier estrategia que rompa ese contrato queda descartada aunque el
binario sea más pequeño.

## Criterios de aceptación del spike (§45)

- Los plugins Python de usuario/proyecto siguen cargando.
- Los subprocesos MCP arrancan.
- El runtime del navegador encuentra sus dependencias.
- Los assets Souls empaquetados están disponibles.
- `~/.rinari` sigue compatible con Rinari CLI.
- El motor se puede actualizar de forma segura.
- Rutas predecibles en Windows/macOS/Linux.

## Recomendación inicial

Opción 1, con principio de release **Estrategia A** (§46): el motor viaja
con la app y se actualiza con ella. Override avanzado por variable de
entorno/ruta a otro ejecutable solo para desarrollo.

## Implicaciones para plugins (verificado en el engine real)

`src/rinari/plugins/loader.py` (`RInari-CLI`) carga plugins de usuario y de
proyecto con `importlib.util.spec_from_file_location` + `exec_module` sobre
archivos `.py` arbitrarios fuera del paquete, y ejecuta su `contribute(api)`.

Consecuencias:

- Un motor congelado (opción 2) sigue pudiendo ejecutar `exec_module` sobre
  fuente `.py`, pero rompe el contrato en la práctica: dependencias de
  terceros que el plugin importe deben existir dentro del bundle congelado,
  y cualquier suposición de paths del paquete deja de valer. Cada plugin con
  dependencias se vuelve un caso especial de empaquetado.
- La opción 1 preserva la semántica 1:1: mismo intérprete, mismo `sys.path`,
  mismas reglas de resolución que en CLI. El plugin no distingue si lo
  invocó la terminal o el desktop.

Veredicto: la opción 1 es la única compatible con el contrato actual de
plugins sin trabajo adicional por plugin.

## Descubrimiento del motor (sidecar)

- Empaquetado: `<bundle>/python -m rinari engine --stdio` (el paquete ya
  expone `__main__.py`; el subcomando `engine --stdio` llega en Phase 1).
- Desarrollo/override: Python del entorno o `uv run rinari engine --stdio`,
  solo mediante configuración explícita. Nunca se usa un motor externo por
  defecto.

## Resultado del spike

Probado en Windows: el host Rust lanza un proceso hijo y captura su stdout
(`cargo test`: `engine::supervisor::tests::test_sidecar_echoes_and_releases`).
La matriz completa con el motor real (§45) queda pendiente de Phase 1, cuando
exista el transporte `engine --stdio` contra el que ejecutar `~/.rinari`
compatible, plugins, MCP y Soul empaquetados.
