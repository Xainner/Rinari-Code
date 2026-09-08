import type { HighlighterCore } from 'shiki/core'
import type { BundledLanguage } from 'shiki/langs'

/**
 * Shiki 100% lazy: NADA de shiki va en el bundle inicial. Todo (registry,
 * engine, gramáticas) se descarga al aparecer el primer bloque de código.
 * Sin WASM (regex engine), lenguajes curados para no inflar el chunk.
 */
const WANTED: BundledLanguage[] = [
  'javascript',
  'typescript',
  'tsx',
  'jsx',
  'python',
  'bash',
  'json',
  'html',
  'css',
  'sql',
  'yaml',
  'markdown',
]

const LANG_ALIAS: Record<string, BundledLanguage> = {
  js: 'javascript',
  ts: 'typescript',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  md: 'markdown',
  py: 'python',
}

let highlighter: Promise<HighlighterCore> | null = null

function getHighlighter(): Promise<HighlighterCore> {
  if (!highlighter) {
    highlighter = (async () => {
      const [{ createHighlighterCore }, { createJavaScriptRegexEngine }, langsMod, themesMod] =
        await Promise.all([
          import('shiki/core'),
          import('shiki/engine/javascript'),
          import('shiki/langs'),
          import('shiki/themes'),
        ])
      const [themeMod, ...langMods] = await Promise.all([
        themesMod.bundledThemes['github-dark'](),
        ...WANTED.map((name) => langsMod.bundledLanguages[name]()),
      ])
      return createHighlighterCore({
        themes: [themeMod.default],
        langs: langMods.map((m) => m.default),
        engine: createJavaScriptRegexEngine(),
      })
    })()
    highlighter.catch(() => {
      highlighter = null
    })
  }
  return highlighter
}

export async function highlightToHtml(code: string, language: string): Promise<string | null> {
  try {
    const hl = await getHighlighter()
    const normalized = language.toLowerCase()
    const lang = LANG_ALIAS[normalized] ?? (normalized as BundledLanguage)
    if (!hl.getLoadedLanguages().includes(lang)) return null
    return hl.codeToHtml(code, { lang, theme: 'github-dark' })
  } catch {
    return null
  }
}
