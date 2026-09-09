<p align="center">
  <img src="docs/assets/readme-banner.png" alt="Rinari Code" width="100%" />
</p>

<h1 align="center">Rinari Code</h1>

<p align="center">
  <strong>Rinari, made visible.</strong><br />
  A native desktop workspace for the Rinari agent harness.
</p>

<p align="center">
  <a href="https://github.com/Xainner/Rinari-Code/actions/workflows/code-ci.yml"><img src="https://github.com/Xainner/Rinari-Code/actions/workflows/code-ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/Xainner/Rinari-Code/releases"><img src="https://img.shields.io/github/v/release/Xainner/Rinari-Code?display_name=tag&sort=semver" alt="Latest release" /></a>
  <img src="https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white" alt="Tauri 2" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=111827" alt="React 19" />
</p>

Rinari Code is the desktop interface for [Rinari CLI](https://github.com/Xainner/Rinari-CLI). It is not another agent harness and it does not duplicate Rinari's runtime in TypeScript or Rust. Sessions, model routing, tools, policies, approvals, agents, MCP, plugins, context, verification, artifacts, and persistent state remain owned by the Rinari Engine. This repository owns the native desktop experience that makes that system visible and controllable.

## What works today

- Persistent conversations backed by Rinari Engine sessions, with streamed responses and history.
- Inline execution activity for each assistant turn: model calls, tool calls, elapsed time, results, failures, approvals, and cancellation.
- PLAN, BUILD, and REVIEW modes with effective access controls enforced by the engine.
- Per-chat permission profiles: read-only, workspace, or full access.
- Provider configuration, connection checks, model discovery, model selection, and reasoning-effort controls.
- Native multi-file attachments plus `@` search for text and code inside the workspace.
- Project views for changes, tasks, verification, checkpoints, artifacts, context, and usage.
- Agent, Soul, MCP, plugin, tool-policy, profile, appearance, and terminal settings.
- Native engine supervision, restart recovery, single-instance handling, updater integration, and the `rinari code` desktop handoff.
- English and Spanish interfaces, keyboard navigation, command palette, themes, and reduced-motion support.

Rinari Code displays observable execution state. It does not expose or invent private model chain-of-thought.

## Architecture

```text
React 19 + TypeScript
        │ typed Tauri commands and events
        ▼
Rust / Tauri 2 desktop host
        │ versioned NDJSON over stdin/stdout
        ▼
Rinari Engine (Python, from Rinari-CLI)
```

The desktop host supervises one long-lived engine process. Protocol events drive the UI, while `runtime.snapshot.get` can reconstruct active sessions after a reload or engine restart. Provider credentials remain engine-owned and are never stored in browser storage.

## Development

### Requirements

- Node.js 20 or newer
- Rust stable
- Python 3.11 or newer
- A compatible checkout or installation of [Rinari CLI](https://github.com/Xainner/Rinari-CLI)
- Windows WebView2 when developing on Windows

Install the frontend dependencies:

```bash
npm ci
```

If Rinari CLI is checked out next to the parent `Apps` directory, start the desktop app on PowerShell with:

```powershell
$env:RINARI_ENGINE_BIN = "uv"
$env:RINARI_ENGINE_ARGS = "run rinari"
$env:RINARI_ENGINE_CWD = "../../Rinari-CLI"
npm run tauri dev
```

If `rinari` is already available on `PATH`:

run `npm run tauri dev` directly; the host resolves `rinari` from `PATH`.

Without an override, the host also checks configured development paths and packaged engine resources.

## Quality checks

```bash
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
```

Create the Windows installer with:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/package-engine.ps1 -CliRepo ../../Rinari-CLI
npm run tauri build
```

The packaging workflow builds the compatible Rinari Engine bundle and then produces the Tauri installer.

## Project status

Rinari Code is under active development. The engine protocol and the desktop workflow are usable, but interfaces and packaging details may still evolve before a stable v1 release. See [Releases](https://github.com/Xainner/Rinari-Code/releases) for published builds.

Design decisions and maintenance notes live in [`docs/`](docs/).

## Related project

- [Rinari CLI](https://github.com/Xainner/Rinari-CLI) — the canonical Rinari engine and terminal client.
