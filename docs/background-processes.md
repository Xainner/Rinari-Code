# Background processes

Open **Procesos** at the bottom left of a conversation. Its badge counts active
resources in that session. Select a row to inspect its command, working directory,
PID when available, state, stdout and stderr. **Detener** stops the selected owned
resource; closing the panel only hides the panel.

The panel includes `shell.exec` with `background=true`, `process.start`, engine
PTYs and HTML/development previews. Externally supplied preview URLs are labeled
as having no owned process and do not offer a server stop button.

Process registries survive turns within the same engine session. Switching chats
or reloading Code does not lose them. Closing the session or shutting down the
engine stops its managed background processes. This is not process recovery after
an engine crash, nor an OS task manager: arbitrary PIDs and manually detached
processes are not adopted.

For servers, the agent should use a managed background tool rather than shell
detachment (`Start-Process`, `nohup`, `&`). Native process tools remain the engine
authority; neither React nor Rust starts or terminates a process directly.

The view polls while mounted, reads logs only when expanded, bounds output per
stream, preserves the model's existing output cursors and maintains a separate
recent-output window. Autoscroll follows the bottom only while the user is there.

Protocol: `workspace.process.list`, `workspace.process.read`,
`workspace.process.stop`; capability `desktop_processes_v1`. IDs are resolved
against the requested session before reading output or stopping a resource.
Generated TypeScript and Rust definitions come from the engine schema.

Restart `npm run tauri -- dev` after updating the bundled engine and Rust bridge.
Previously detached servers must be restarted through a managed tool to appear.
