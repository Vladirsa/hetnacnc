// Traducción español -> inglés con el diccionario de src/i18n/en.ts.
// La usan el servidor (i18n/servidor.ts), los componentes (<T>, useT) y el
// traductor del navegador (components/hetna/Traductor.tsx), para que los tres
// den exactamente el mismo resultado.
export type Diccionario = Record<string, string>
export type Reglas = [RegExp, string][]

/** Devuelve el texto en inglés, o null si no hay traducción. Respeta los espacios de alrededor. */
export function traducirTexto(texto: string, dic: Diccionario, reglas: Reglas): string | null {
  const limpio = texto.trim()
  if (!limpio) return null
  const directo = dic[limpio]
  if (directo !== undefined) return directo === limpio ? null : texto.replace(limpio, directo)
  for (const [re, reemplazo] of reglas) {
    if (re.test(limpio)) return texto.replace(limpio, limpio.replace(re, reemplazo))
  }
  // Títulos tipo "Corte láser | HETNA CNC": se traduce cada parte por separado
  if (limpio.includes(" | ")) {
    const partes = limpio.split(" | ")
    const nuevas = partes.map((p) => dic[p] ?? p)
    if (nuevas.some((p, i) => p !== partes[i])) return texto.replace(limpio, nuevas.join(" | "))
  }
  return null
}

/** Función t(): el texto en inglés si existe; si no, el original. */
export const crearT = (dic: Diccionario, reglas: Reglas) => (texto: string) =>
  typeof texto === "string" ? traducirTexto(texto, dic, reglas) ?? texto : texto

export const sinTraducir = (texto: string) => texto
