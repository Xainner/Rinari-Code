# Deuda explícita — Rinari Code

Ledger vivo de recortes deliberados y deuda conocida. Estados: `OPEN`,
`PARTIAL`, `DONE`, `WONTFIX`. No son bugs: son decisiones de alcance con
criterio de aceptación anotado.

## Ciclo archivo 3 — Project workspace + session lifecycle (2026-09-09) — DONE

Del doc `fixes/RINARI_PROJECT_WORKSPACE_AND_SESSION_LIFECYCLE.md`, parte
Code (el engine ya absorbió 01–05: project.*, close/delete, export,
effort, capabilities, soul, intelligence, branch, PTY).

- **Modelo workspace puro** — `DONE`. `buildWorkspaceModel` agrupa por
  `project_id` (fallback `project_root`), nunca path matcheado a mano
  para identidad; orden del engine preservado; 4 tests.
- **Sidebar por secciones** — `DONE`. PROJECTS (todas las recientes,
  aunque vacías) / CHATS / CERRADAS colapsable; menú ⋯ por fila con
  Cerrar + Eliminar; rail colapsado conserva new/search/project/engine/
  settings; drawer móvil siempre expandido.
- **Close/delete** — `DONE`. Cerrar oculta (reabrir restaura);
  Eliminar pide confirmación con cascada opt-in y toast con
  contabilidad del engine (cola/checkpoints/artefactos).
- **ProjectHome** — `DONE`. Nombre/root engine-owned, Git vivo
  (rama·dirty/limpio/no-git/carpeta-ausente), sesiones del proyecto,
  inteligencia perezosa (caché por root).
- **Header con git** — `DONE`. Pastilla proyecto → rama·cambios,
  clic abre el home; ausente se rotula, nunca se esconde.
- **Handoff por project.open** — `DONE`. `rinari code [path]`,
  evento `rinari-open-request` y botón carpeta usan `project.open`
  (deduplicación del engine); adiós al match local + create paralelo.
- **Recorte deliberado:** sin sesión activa de proyecto no hay home
  vacío con terminal integrado ni onboarding de git-init: abrir
  carpeta registra sin inicializar (regla CLI-07). Sin drag&drop de
  carpetas al sidebar (el diálogo nativo cubre el flujo).
- **Pendiente engine:** nada — `project.intelligence` ya existe en
  esta rama CLI; si el engine Semantic falla, el panel muestra error,
  no silencio.

## Ciclo archivo 2 — Turn Governor, lado Code (2026-09-09) — DONE

Del doc `fixes/RINARI_AUTOMATIC_TURN_GOVERNOR.md`, parte implementable sin
engine (el governor, `turn.stopped` y eventos `governor.*` son trabajo
CLI fases 1-5). Owner: runtime/Code.

- **Sin selector de budget** — `DONE` (ya cumplido: el composer nunca lo
  tuvo; verificado por inspección).
- **Usage informativo** — `DONE` (ya cumplido: `InsightPanel` muestra
  llamadas/tokens sin countdowns ni límites).
- **`turn.stopped` forward-compatible** — `DONE`. Estado terminal
  `stopped` + `stopReason` en reducer/mapper/tests; UI de emergencia
  (motivo + uso + Continuar/Ver actividad); `Continue` = borrador para
  turno nuevo en la misma sesión, nunca resucitar el meter.
- **Progreso de tareas largas** — `DONE` (ya cumplido: Activity muestra
  herramientas/duración, sin "X llamadas restantes").
- **Pendiente engine (proponer en CLI):** emisión de `turn.stopped` +
  `governor.progress/nudge/compact/consolidate/stop` + `usage.updated` +
  bloque `runtime` en snapshot. Sin eso, la UI de emergencia queda
  cableada y testeada pero inactiva.

## Ciclo de estabilización (2026-09-09) — DONE

Salidas del review `fixes/RINARI_CODE_STABILIZATION_REVIEW.md` (carpeta
local, no versionada). Owner: estabilización Code.

- **Arranque por subsistemas** — `DONE`. El shell abre con engine `ready`;
  sesiones y catálogo degradan con banner + retry local. Nunca más splash
  atrapado por fallo de catálogo.
- **Cancelación reconciliada** — `DONE`. Sin `cancelled` inventado: estado
  `cancelling` optimista + reconciliación con `runtime.snapshot.get`.
  Reducer + tests en `src/features/engine/`.
- **Historia determinista** — `DONE`. `historyToMessages` conserva `seq` y
  `created_at`, sin mensajes sintéticos `Used tools:`. Tool calls viven en
  Activity.
- **Engine pineado** — `DONE`. `engine-manifest.json` (SHA exacto);
  release clona ese SHA; `package-engine.ps1` falla si no coincide y el
  smoke exige `desktop_turn_runtime_v3`; About muestra el pin.
- **Split de `useEngineSession`** — `DONE`. Reducer `turnRuntime` +
  `useTurnRuntime` / `useEngineConnection` / `useSessionList` /
  `useCatalog`; `useEngineSession` compone con la misma forma de retorno.
- **Contrato de protocolo** — `DONE`. `Method` (enum + macro, fuente única,
  `request()` lo exige); comandos Tauri partidos en `commands/` por
  dominio; test de totalidad de eventos en TS.
- **CSP habilitado** — `DONE`. `csp` estricto en prod (`script-src 'self'`,
  sin remotos salvo Google Fonts declarado) + `devCsp` para HMR;
  `theme-init.js` externalizado. Verificar visual en `tauri dev` tras
  cada cambio de assets (nota 2026-09-09: pendiente confirmación en dev).
- **Failure UX de engine** — `DONE`. Splash de fallo con Reintentar +
  `<details>` técnico (state + detail); auto-start intacto, sin botón
  permanente de "Start Engine".

## Fase 5 — Project workspace reducido

- **Estado:** `OPEN` — **Última revisión:** 2026-09-09
- **Owner:** workspace/Code (bloqueado en engine/CLI).
- **Recorte:** sin start screen, recent projects, dashboard ni Project
  Intelligence. Solo badges CHAT/PROJECT + carpeta en sesiones PROJECT.
- **Causa:** `ProjectService` en Rinari-CLI no expone
  `project.list_recent/open/status` ni inteligencia en el protocolo.
- **Criterio para saldar:** exponerlos en el Engine Protocol y recién
  entonces construir UI. No escanear repos ni BD propia en React/Rust.

## Fase 4 — Sin cerrar/eliminar sesión

- **Estado:** `OPEN` — **Última revisión:** 2026-09-09
- **Owner:** sesiones (diseño engine primero).
- **Causa:** solo existe estado `active`; sin close/archive/delete en
  `SessionService` ni semántica de cascada (tasks/artifacts/checkpoints).
- **Criterio para saldar:** estados + cascada en el engine, protocolo, y
  recién UI.

## Fase 4 — Adjuntos/contexto explícito y prompt queue

- **Estado:** `PARTIAL` — **Última revisión:** 2026-09-09
- **Owner:** composer/Code.
- **Detalle:** `queue.add/list/clear` y `attachments` en `turn.start` ya
  existen en protocolo + puente; falta UI (chips, adjuntos, cola visible).
- **Criterio para saldar:** composer con chips/adjuntos + QueueBar
  conectada al protocolo, tras estabilizar chat/sesiones/modos.

## Fase 7 — Sin effort/reasoning por agente

- **Estado:** `OPEN` — **Última revisión:** 2026-09-09
- **Owner:** modelos/engine.
- **Causa:** `reasoning_effort` existe en tipos pero sin plomería por
  llamada; guardar un campo sin efecto sería deshonesto.
- **Criterio para saldar:** plomear effort en router/llamadas del engine
  primero; recién protocolo + UI.

## Fase 8 — Scopes proyecto/sesión de Soul

- **Estado:** `OPEN` — **Última revisión:** 2026-09-09
- **Owner:** soul/engine.
- **Detalle:** solo activación global; sin override proyecto/sesión, sin
  sliders ni intensidad.
- **Criterio para saldar:** migración `soul_id` en sessions + override
  proyecto tras diseño de trust; sliders solo con síntesis estructurada.

## Fase 10 — PTY del engine y export de artefactos

- **Estado:** `OPEN` — **Última revisión:** 2026-09-09
- **Owner:** terminal/engine.
- **Causa:** PTYs viven dentro de tool calls; exponerlos exige registry
  engine-owned + eventos `pty.output`. Export escribe fuera del store.
- **Criterio para saldar:** `pty.start/write/resize/terminate` en engine +
  xterm; export con diálogo nativo y validación de paths.

## Fase 11 — Branching de sesión

- **Estado:** `OPEN` — **Última revisión:** 2026-09-09
- **Owner:** sesiones/engine.
- **Causa:** exige `session.branch` con fork real de tasks/contexto/
  checkpoints; copiar mensajes visibles mentiría.
- **Criterio para saldar:** semántica engine primero, UI después.

## Fase 12 — Release hardening

- **Estado:** `PARTIAL` — **Última revisión:** 2026-09-09
- **Owner:** distribución.
- **Hecho:** CI (build + `fmt`/`clippy`/`test` en 3 OS + tests frontend),
  clippy `-D warnings` limpio, About con 5 versiones (Code/engine/
  protocolo/soul/pin), engine pineado por SHA, CSP habilitado, updater
  cableado, revisión de secretos, empaquetado Windows verificado.
- **Queda fuera:** firma de código del bundle, smoke en máquina limpia,
  suite E2E con provider real, scripts macOS/Linux + firma.
- **Criterio para saldar:** pipeline con firma + updater + smoke limpio
  antes de cualquier distribución.

## Transversales

- **Chunk JS ~858 KB (index)** — `OPEN` (2026-09-09). Code-splitting cuando
  se sumen paneles pesados (Tasks, Verification, Soul). No antes.
- **`uv.lock` del CLI suma `keyring`** — `OPEN` (2026-09-09). Verificado en
  CI del engine, no en empaquetado desktop.
- **E2E real contra `rinari engine --stdio`** — `OPEN` (2026-09-09, en
  curso). Usuario probando en `tauri dev` con credencial real.
- **Google Fonts remoto permitido en CSP** — `OPEN` (2026-09-09). Owner:
  apariencia/Code. `index.css` importa de `fonts.googleapis.com`; el CSP lo
  declara explícitamente. Ideal: self-hostear woff2 + `@font-face` local y
  cerrar esa excepción (offline total, cero dependencia remota).
- **Provider Wizard sin máquina de estados draft/persisted** — `DONE`
  (2026-09-09). Modelo `draft → persisted → healthy / unhealthy`:
  re-entrar a testing actualiza (`provider.update`), tipo/auth
  incompatibles recrean, alias preexistente se adopta (cubre doble
  corrida de StrictMode), reintentar solo prueba, eliminar resetea.
