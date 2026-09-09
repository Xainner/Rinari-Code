# Releases y auto-update (estilo Hermes)

Rinari Code se auto-actualiza desde GitHub Releases (Estrategia A: el
instalador trae Code + engine empaquetado; un update trae ambos).

## Cómo publicar una versión

1. Subir versión en 4 lugares (deben coincidir):
   - `package.json` → `version`
   - `src-tauri/tauri.conf.json` → `version`
   - `src-tauri/Cargo.toml` → `version`
   - `src/App.tsx` → `APP_VERSION`
2. Commit + push a `main`.
3. Tag y push del tag: `git tag v0.1.1 && git push origin v0.1.1`
   (el workflow valida que el tag coincida con `package.json`).
4. GitHub Actions construye el instalador Windows + `latest.json`
   firmado y deja el release en **draft**.
5. Revisar el draft, publicar. A partir de ahí las apps instaladas
   avisan solas (toast al abrir + botón en Ajustes → Acerca de).

## Claves de firma (updater)

- Privada: `C:/Users/Xainner/.tauri/rinari-code.key` (SOLO en esta
  máquina, jamás al repo).
- Password: `C:/Users/Xainner/.tauri/rinari-code.key.pw`.
- Pública: en `tauri.conf.json` → `plugins.updater.pubkey`.
- Secretos del repo (ya configurados con `gh secret set`):
  `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
- Si se pierde la privada, las apps ya instaladas NO aceptarán más
  updates: hay que reinstalar a mano. Hacer backup.

## Notas

- Endpoint del updater:
  `https://github.com/Xainner/Rinari-Code/releases/latest/download/latest.json`
  (requiere repo público).
- Sin releases publicados, `check()` falla en silencio: la app sigue
  normal, sin toasts.
- Matriz actual: solo Windows. Ampliar a macOS/Linux cuando se necesite
  (el sidecar Python empaquetado es por plataforma).
- `v0.1.1`: primera versión con updater + blindaje snake/camel en
  `turn_start/turn_cancel/queue_*/provider_create` (instaladores 0.1.0
  con la misma versión no siempre reemplazaban archivos en MSI, de ahí
  los errores `missing required key sessionId/providerType` con frontend
  viejo).
