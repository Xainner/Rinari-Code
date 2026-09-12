# Preguntas y workspace de escritorio

- «Nueva conversación» crea un chat general con carpeta independiente. El `+`
  de cada proyecto crea una sesión vinculada a ese proyecto.
- «Mover a proyecto…», disponible también con clic derecho, cambia el directorio
  de ejecución futuro y conserva conversación y referencias históricas. El motor
  rechaza el traslado mientras haya actividad o procesos pendientes.
- Las preguntas del motor aparecen sobre el compositor. Se puede elegir una
  opción, escribir otra respuesta, navegar entre preguntas, minimizar y omitir.
  Solo «Enviar respuesta» envía las respuestas. El historial conserva el resultado.
- Los enlaces de archivos y las salidas de `fs.write`/`fs.patch` abren un visor
  lateral con pestañas, Markdown/fuente, resaltado, ruta y apertura externa.
  La lectura es del motor, limitada a 512 KiB y al workspace del turno original.
- El pie del sidebar contiene el menú Rinari Agent. Archivo, Editar, Ver y Ayuda
  son menús nativos de Tauri; los menús contextuales conservan edición y portapapeles.

El motor requiere `desktop_workspace_v1` e `interactive_questions_v1`. El esquema
del motor genera los DTOs TypeScript/Rust. No hay una base de sesiones adicional.

## Validación

Frontend: `npm test`, `npm run build`, `npm run protocol:check`.
Rust: `cargo test --manifest-path src-tauri/Cargo.toml`.
Motor: `uv run pytest tests/unit/test_desktop_interactions.py` y suites de
protocolo, historial, modos, sesiones y bloqueo de turnos.

Las pruebas nuevas cubren preguntas reales a través de AgentLoop, respuesta libre,
omisión, cancelación, duplicados, snapshots, traslado, bloqueo compartido con CLI,
procedencia de archivos, rutas Windows, límites y separación de sesiones.
# Desktop follow-up fixes

External read approvals now extend only the approved tool call's readable roots. Write approvals remain separate. Git timeouts return structured tool errors. The transport enforces UTF-8 and the engine repairs the known legacy default conversation title.

Project headers collapse their sessions. Composer selectors close upon selection and models are grouped by provider. Completed PLAN turns retain their original mode in live events and history and show a plan card; explicit implementation switches the engine to BUILD before sending the continuation. Content resizing also follows the conversation while the user remains at the bottom.
