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
    if (re.test(limpio)) {
      let r = limpio.replace(re, reemplazo)
      // ⟪…⟫ en la regla: esa parte también se traduce (nombres de piezas, ciudades, servicios)
      if (r.includes("⟪")) r = r.replace(/⟪([^⟪⟫]*)⟫/g, (_, x: string) => pieza(x, dic, reglas))
      return texto.replace(limpio, () => r)
    }
  }
  // Títulos tipo "Corte láser | HETNA CNC": se traduce cada parte por separado
  if (limpio.includes(" | ")) {
    const partes = limpio.split(" | ")
    const nuevas = partes.map((p) => dic[p] ?? p)
    if (nuevas.some((p, i) => p !== partes[i])) return texto.replace(limpio, () => nuevas.join(" | "))
  }
  // Listas tipo "84 tornillos de 1 1/2" · 12 tornillos de 1"": cada parte por separado
  if (limpio.includes(" · ")) {
    const partes = limpio.split(" · ")
    const nuevas = partes.map((p) => (p.trim() ? traducirTexto(p, dic, reglas) ?? p : p))
    if (nuevas.some((p, i) => p !== partes[i])) return texto.replace(limpio, () => nuevas.join(" · "))
  }
  return null
}

// Índice sin mayúsculas de cada diccionario, para las partes de una frase
const sinMayus = new WeakMap<Diccionario, Map<string, string>>()
const indice = (dic: Diccionario) => {
  let m = sinMayus.get(dic)
  if (!m) {
    m = new Map()
    for (const [k, v] of Object.entries(dic)) if (!m.has(k.toLowerCase())) m.set(k.toLowerCase(), v)
    sinMayus.set(dic, m)
  }
  return m
}

/** Traduce una parte de una frase sin importar mayúsculas ("router cnc" → "CNC router"). */
function pieza(x: string, dic: Diccionario, reglas: Reglas, nivel = 0): string {
  const limpio = x.trim()
  if (!limpio || nivel > 2) return x
  const directo = dic[limpio]
  if (directo !== undefined) return directo
  const otro = indice(dic).get(limpio.toLowerCase())
  if (otro !== undefined) {
    // Si la parte venía en minúsculas, la traducción también (a menos que empiece con sigla)
    const minus = limpio.charAt(0) === limpio.charAt(0).toLowerCase() && !/^[A-Z]{2}/.test(otro)
    return minus ? otro.charAt(0).toLowerCase() + otro.slice(1) : otro
  }
  for (const [re, reemplazo] of reglas) {
    if (re.test(x)) {
      const r = x.replace(re, reemplazo)
      return r.includes("⟪") ? r.replace(/⟪([^⟪⟫]*)⟫/g, (_, y: string) => pieza(y, dic, reglas, nivel + 1)) : r
    }
  }
  return x
}

/** Función t(): el texto en inglés si existe; si no, el original. */
export const crearT = (dic: Diccionario, reglas: Reglas) => (texto: string) =>
  typeof texto === "string" ? traducirTexto(texto, dic, reglas) ?? texto : texto

export const sinTraducir = (texto: string) => texto
