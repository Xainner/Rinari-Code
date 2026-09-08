# Deuda explícita — Rinari Code

Decisiones de alcance tomadas durante la implementación, pendientes de su
fase correspondiente. No son bugs: son recortes deliberados con criterio
de aceptación anotado.

## Fase 5 — Project workspace reducido (2026-09-08)

**Recorte:** el workspace completo de AGENTS.md §13 y Fase 5 (start screen,
recent projects, project dashboard, Project Intelligence) no se implementó.

**Causa:** `ProjectService` en Rinari-CLI solo tiene `upsert/init`; no existe
`project.list_recent/open/status` ni superficie de inteligencia
(lenguajes/frameworks/instrucciones) en el protocolo.

**Lo que sí se hizo:** badges CHAT/PROJECT, subtítulo con carpeta del
proyecto en sesiones PROJECT (derivado de `project_root_snapshot` de
`session.list`), kind/modo en header, selector PLAN/BUILD/REVIEW.

**Criterio para saldar:** exponer `project.list_recent/open/status` en el
Engine Protocol (trabajo del repo CLI) y recién entonces construir start
screen + dashboard + Project Intelligence en Code. No inventar escaneo de
repos ni BD propia en React/Rust para esto.

## Fase 4 — Sin cerrar/eliminar sesión (2026-09-08)

**Recorte:** no hay "cerrar" ni "eliminar" sesión en el desktop.

**Causa:** el dominio solo tiene estado `active`; no existe close/archive/
delete en `SessionService` ni semántica definida (qué pasa con
tasks/artifacts/checkpoints).

**Criterio para saldar:** diseñar cierre/eliminación en el engine primero
(estados + cascada), exponerlo en el protocolo, y recién entonces el UI.

## Fase 4 — Adjuntos/contexto explícito y prompt queue (2026-09-08)
**Recorte:** composer sin adjuntos, sin chips de contexto, sin cola de
prompts.

**Criterio para saldar:** post-core, tras estabilizar chat/sesiones/modos.

## Fase 7 — Sin effort/reasoning por agente (2026-09-08)

**Recorte:** la asignación por agente cubre modelo, fallback y enabled.
No hay override de effort.

**Causa:** la capa de modelos no tiene plomería de effort por modelo
(`reasoning_effort` existe en tipos pero nada lo fija por llamada).
Guardar un campo sin efecto sería deshonesto.

**Criterio para saldar:** plomear effort en el router/llamadas del engine
primero; recién entonces exponerlo en protocolo y UI.

## Fase 8 — Scopes proyecto/sesión de Soul (2026-09-08)

**Recorte:** solo activación global. Sin override por proyecto ni sesión,
sin sliders de personalidad ni intensidad.

**Causa:** el override por sesión exige columna/migración en sessions;
el de proyecto exige diseño con project trust. Los sliders serían
fragmentos de prompt sin síntesis real.

**Criterio para saldar:** migración `soul_id` en sessions + override
proyecto tras diseño de trust; sliders solo con síntesis estructurada.

## Fase 10 — PTY del engine y export de artefactos (2026-09-08)

**Recorte:** sin `pty.*` en el protocolo, sin `artifact.export`, sin xterm.

**Causa:** los PTY viven dentro de los tool calls (PtyRegistry por
proceso); exponerlos exige registry engine-owned + ciclo de vida +
streaming de eventos. El export escribe fuera del store (superficie de
riesgo); el preview acotado cubre v1.

**Criterio para saldar:** registry PTY en el engine con métodos
`pty.start/write/resize/terminate` + eventos `pty.output`; export con
diálogo nativo de destino y validación de paths.

## Fase 11 — Branching de sesión (2026-09-08)

**Recorte:** sin branching conversación/trabajo en v1.

**Causa:** exige semántica de persistencia en el engine (fork de
task graph + contexto + checkpoints); copiar solo mensajes visibles
perdería estado y mentiría.

**Criterio para saldar:** `session.branch` en el engine con fork real de
tasks/contexto/checkpoints; recién entonces UI de ramas.

## Fase 12 — Release hardening (2026-09-08)

**Hecho en v1:** CI (`code-ci.yml`: build frontend + fmt/clippy/test en
3 OS), clippy `-D warnings` limpio, About con las 4 versiones visibles
(Code/engine/protocolo/bundled soul), README actualizado, revisión de
secretos (solo memoria del form → engine; nada en storage/logs),
`cargo fmt --check` verde.

**Queda fuera de v1 (requiere distribución real):** firma de código,
updater, smoke en máquina limpia, suite E2E con provider real,
`tauri dev` visual. Empaquetado Windows del engine verificado (ADR 0001);
faltan scripts macOS/Linux + firma del bundle.

**Criterio para saldar:** pipeline de release con firma + updater +
smoke limpio antes de cualquier distribución.

## Transversales

- Chunk JS de 772 KB (aviso de Vite): code-splitting cuando se sumen
  paneles pesados (Tasks, Verification, Soul). No antes.
- `uv.lock` del CLI suma `keyring`: verificado en CI del engine, no en
  empaquetado desktop (Fase 12 / ADR 0001).
- Flujo real contra `rinari engine --stdio` con provider de verdad: pendiente
  de `tauri dev` + credencial; todo lo verificado hasta ahora es hermético
  (fake) o build estático.
