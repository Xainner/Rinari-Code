// Tema/acento/movimiento antes del primer paint (sin flash). Default: system.
// Archivo externo (no inline) para que el CSP pueda fijar script-src 'self'.
try {
  var t = localStorage.getItem('rinari.theme') || 'system'
  if (t !== 'light' && t !== 'dark') t = 'system'
  var dark =
    t === 'dark' ||
    (t === 'system' &&
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
  var resolved = dark ? 'dark' : 'light'
  document.documentElement.dataset.theme = resolved
  document.documentElement.style.colorScheme = resolved
} catch (e) {
  document.documentElement.dataset.theme = 'dark'
}
// Acento y movimiento antes del primer paint (sin flash).
try {
  var a = localStorage.getItem('rinari.accent') || 'nebula'
  if (['nebula', 'cyan', 'fuchsia', 'blue', 'green', 'orange'].indexOf(a) < 0) a = 'nebula'
  document.documentElement.dataset.accent = a
  if (localStorage.getItem('rinari.reduceMotion') === '1') {
    document.documentElement.dataset.motion = 'reduced'
  }
} catch (e2) {}
