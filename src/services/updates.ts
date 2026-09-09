import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

export interface UpdateAvailable {
  version: string
  body?: string
}

/** Dev (`vite`) o build sin updater: check() lanza; se propaga al llamador. */
export async function checkForUpdates(): Promise<UpdateAvailable | null> {
  const update = await check()
  if (!update) return null
  return { version: update.version, body: update.body ?? undefined }
}

export async function installUpdateAndRelaunch(): Promise<void> {
  const update = await check()
  if (!update) return
  await update.downloadAndInstall()
  await relaunch()
}
