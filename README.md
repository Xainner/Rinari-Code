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

Phases 0–11 done per AGENTS.md (skeleton, engine protocol client,
Luma design-system migration, providers/models onboarding, sessions,
PLAN/BUILD/REVIEW, workspace, agents, Soul 3.0, ecosystem, observability,
queue/profiles/handoff). Phase 12: hardening in progress.

Engine-side protocol, Soul store, queue, bundles and `rinari code`
live in the Rinari-CLI repo (`feat/engine-protocol-stdio`).

## Development

```bash
npm install
npm run build        # frontend only (tsc + vite)
npm run tauri dev    # full desktop app (compiles Rust on first run)
```

Engine env (dev):

```bash
RINARI_ENGINE_BIN=uv RINARI_ENGINE_ARGS="run rinari" RINARI_ENGINE_CWD=../Rinari-CLI
```

## Tests

```bash
npm run build                    # frontend typecheck + build
cargo fmt --check && cargo clippy --all-targets -- -D warnings
cargo test                       # 11 unit + roundtrip vs fake engine
```

Hermetic desktop tests use `src-tauri/tests/fixtures/fake_engine.py`
(`stream/slow/approval/die` + canned catalogs) — no real provider needed.

## Docs

- `AGENTS.md` — master implementation work plan (source of truth).
- `AGENTS_Tauri_Rust_Master_Expanded.md` — desktop stack toolbox.
- `SOUL.md` — bundled Rinari default soul 3.0 reference.
- `docs/adr/` — architecture decision records.
- `docs/debt.md` — explicit scope cuts per phase, with payoff criteria.
