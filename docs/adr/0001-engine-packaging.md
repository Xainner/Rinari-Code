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

## Resultado del spike

Pendiente: ejecutar la matriz de criterios en Windows primero y una
plataforma POSIX después, y registrar aquí el veredicto.
