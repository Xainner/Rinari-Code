# Rinari Code

Desktop client for the Rinari agent harness (Tauri 2 + React 19 + Rust).

```
Rinari Engine  → intelligence / harness / state / execution (Python, Rinari-CLI repo)
Rinari CLI     → terminal client
Rinari Code    → desktop client (this repo)
```

Rule: this repo never reimplements harness logic. It presents engine state
through the versioned Engine Protocol (`rinari engine --stdio`).

## Status

Phase 0 (AGENTS.md): product skeleton and packaging spike.

## Development

```bash
npm install
npm run build        # frontend only (tsc + vite)
npm run tauri dev    # full desktop app (compiles Rust on first run)
```

## Tests

```bash
npm run build                    # frontend typecheck + build
cargo test -p rinari-code        # Rust unit tests (supervisor, sidecar spike)
```

## Docs

- `AGENTS.md` — master implementation work plan (source of truth).
- `AGENTS_Tauri_Rust_Master_Expanded.md` — desktop stack toolbox.
- `docs/adr/` — architecture decision records.
