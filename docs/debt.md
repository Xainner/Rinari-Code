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

## Transversales

- Chunk JS de 772 KB (aviso de Vite): code-splitting cuando se sumen
  paneles pesados (Tasks, Verification, Soul). No antes.
- `uv.lock` del CLI suma `keyring`: verificado en CI del engine, no en
  empaquetado desktop (Fase 12 / ADR 0001).
- Flujo real contra `rinari engine --stdio` con provider de verdad: pendiente
  de `tauri dev` + credencial; todo lo verificado hasta ahora es hermético
  (fake) o build estático.
