// Rinari Agent library root: the engine client (protocol, transport,
// supervisor) lives here and is intentionally Tauri-free, so unit tests
// never link the Tauri/WebView runtime. Background: test binaries get no
// SxS manifest, so importing comctl32-v6-only symbols (e.g.
// TaskDialogIndirect via wry) kills them at load with
// STATUS_ENTRYPOINT_NOT_FOUND. All Tauri commands, plugins and run()
// live in main.rs (bin target, never unit-tested).
pub mod engine;
pub mod identity;
