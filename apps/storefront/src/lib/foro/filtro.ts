// Filtro de publicaciones del foro: oculta teléfonos, correos y ligas de WhatsApp o Telegram
// (los tratos se hacen dentro de HETNA, donde hay protección), y manda a revisión lo que parece spam.

export const OCULTO = "[dato de contacto oculto]"

export type Revision = {
  texto: string // texto ya limpio, listo para guardar
  ocultos: number // cuántos datos de contacto se ocultaron
  revisar: boolean // true = queda en revisión antes de publicarse
  motivos: string[]
}

const UNIDADES = /^\s*(mm|cm|m\b|mts?|rpm|w\b|kw|hz|v\b|a\b|amp|in\b|pulg|"|°|%|mm\/min|ipm|pzas?|piezas|pesos|mxn|usd|\$)/i

// 10 dígitos (México), o con lada de país 52 / 521
const esTelefono = (d: string) =>
  d.length === 10 || (d.length === 12 && d.startsWith("52")) || (d.length === 13 && d.startsWith("521"))

function ocultarTelefonos(t: string): { texto: string; n: number } {
  let n = 0
  const texto = t.replace(/\+?\(?\d[\d\s().-]{8,20}\d/g, (m, pos: number, todo: string) => {
    const digitos = m.replace(/\D/g, "")
    if (!esTelefono(digitos)) return m
    // medidas y cantidades: "1500 3000 mm", "12000 24000 rpm"
    if (UNIDADES.test(todo.slice(pos + m.length))) return m
    // grupos de 4 o más dígitos separados por espacios de 3 o más grupos casi nunca son teléfonos si hay "x"
    if (/\d\s*[x×]\s*\d/i.test(m)) return m
    n++
    return OCULTO
  })
  return { texto, n }
}

const PATRONES_CONTACTO: RegExp[] = [
  /\b[\w.+-]+@[\w-]+(\.[\w-]+)+\b/gi, // correo
  /(https?:\/\/)?(www\.)?(wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com|wa\.link|whatsapp\.com\/(send|message|channel))[^\s)]*/gi,
  /(https?:\/\/)?(www\.)?(t\.me|telegram\.me)\/[^\s)]*/gi,
]

// frases de fraude o spam muy típicas
const SPAM = [
  /ganancias? garantizad/i,
  /inversi[oó]n (segura|garantizada)/i,
  /(duplica|multiplica) tu dinero/i,
  /trabaja desde casa y gana/i,
  /pr[eé]stamos? (inmediato|sin bur[oó])/i,
  /\bcasino\b|\bapuestas\b/i,
]

export function revisarTexto(entrada: string, opciones: { cuentaNueva?: boolean } = {}): Revision {
  let texto = entrada.replace(/\r\n?/g, "\n").replace(/[​-‍﻿]/g, "").trim()
  let ocultos = 0
  const motivos: string[] = []

  for (const p of PATRONES_CONTACTO) {
    texto = texto.replace(p, () => {
      ocultos++
      return OCULTO
    })
  }
  const tel = ocultarTelefonos(texto)
  texto = tel.texto
  ocultos += tel.n
  if (ocultos) motivos.push(`contacto oculto (${ocultos})`)

  const ligas = (texto.match(/https?:\/\/\S+/g) || []).length
  let revisar = false
  if (ligas > 8 || (opciones.cuentaNueva && ligas > 3)) {
    revisar = true
    motivos.push(`muchas ligas (${ligas})`)
  }
  if (SPAM.some((r) => r.test(texto))) {
    revisar = true
    motivos.push("parece spam")
  }
  // textos gritados completos en mayúsculas y largos
  const letras = texto.replace(/[^a-záéíóúñ]/gi, "")
  if (letras.length > 80 && letras === letras.toUpperCase()) motivos.push("todo en mayúsculas")

  return { texto, ocultos, revisar, motivos }
}
