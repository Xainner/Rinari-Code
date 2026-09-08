import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type EngineState =
  | "stopped"
  | "starting"
  | "handshaking"
  | "ready"
  | "degraded"
  | "restarting"
  | "failed";

const STATE_LABEL: Record<EngineState, string> = {
  stopped: "Detenido",
  starting: "Iniciando",
  handshaking: "Handshake",
  ready: "Listo",
  degraded: "Degradado",
  restarting: "Reiniciando",
  failed: "Fallo",
};

function App() {
  const [engine, setEngine] = useState<EngineState>("stopped");
  const [probe, setProbe] = useState<string>("");

  useEffect(() => {
    invoke<EngineState>("engine_status")
      .then(setEngine)
      .catch(() => setEngine("failed"));
  }, []);

  async function runProbe() {
    setProbe("...");
    try {
      setProbe(await invoke<string>("engine_spawn_test"));
    } catch (e) {
      setProbe(`error: ${String(e)}`);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b px-4 py-2">
        <span className="font-display text-sm font-bold tracking-wide">
          RINARI CODE
        </span>
        <span className="text-xs text-(--text-muted)">
          Motor Rinari{" "}
          <span className="ml-1 rounded-full border px-2 py-0.5">
            {STATE_LABEL[engine]}
          </span>
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-56 shrink-0 border-r bg-(--bg-sidebar) p-3">
          <p className="text-xs font-semibold tracking-wider text-(--text-subtle)">
            SESIONES
          </p>
          <p className="mt-2 text-xs text-(--text-muted)">
            Sin sesiones. El motor real se conecta en Phase 1.
          </p>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <h1 className="font-display text-2xl font-bold">
            Bienvenido a Rinari Code
          </h1>
          <p className="max-w-md text-sm text-(--text-muted)">
            Esqueleto desktop Phase 0. La sonda verifica que Rust puede
            lanzar un proceso hijo y leer su stdout.
          </p>
          <button
            type="button"
            onClick={runProbe}
            className="rounded-lg border bg-(--bg-elevated) px-4 py-2 text-sm hover:bg-(--bg-hover)"
          >
            Probar sidecar
          </button>
          {probe !== "" && (
            <code className="rounded-md border bg-(--bg-subtle) px-3 py-1 font-mono text-xs">
              {probe}
            </code>
          )}
        </main>
      </div>

      <footer className="border-t px-4 py-1.5 text-xs text-(--text-subtle)">
        Rinari Code v0.1.0 · Phase 0 · protocolo pendiente
      </footer>
    </div>
  );
}

export default App;
