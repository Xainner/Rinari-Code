import React from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "sonner";
import App from "./App";
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
    <Toaster position="bottom-right" />
  </React.StrictMode>,
);

// Ventana dev distinguible de la instalada (mismo identificador/app).
if (import.meta.env.DEV) {
  document.title = 'Rinari Agent (DEV)'
}
