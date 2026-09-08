/**
 * Heurística pura: ¿el texto trae mates ($…$ o $$…$$)?
 * Ignora \$ escapados y $ al final de línea típicos de precios ("cuesta $").
 */
export function containsMath(text: string): boolean {
  const stripped = text.replace(/\\$/g, '')
  return /\$\$[^$]+\$\$/.test(stripped) || /(^|[^\w$])\$[^\s$][^$\n]*\$/.test(stripped)
}
