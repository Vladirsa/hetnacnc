// Filtro del chat en modo BLOQUEO: si el mensaje trae datos de contacto, NO se envía
// y se le explica a la persona por qué. Así los tratos se quedan dentro de HETNA.
//
// Detecta: teléfonos (también escritos con palabras o separados), correos, @usuarios,
// redes sociales, WhatsApp/Telegram, enlaces externos, CLABE y tarjetas (muchos dígitos seguidos)
// y frases como "pásame tu cel" o "llámame".
//
// NUEVO: también detecta los trucos comunes para esconder datos:
//  - letras separadas: "g-m-a-i-l", "g m a i l", "g.m.a.i.l"
//  - letras repetidas: "whaaatsapp", "gmaaail"
//  - números con palabras mezcladas con cifras: "5 cinco 5 uno 2..."
//  - cambio de letras por números parecidos: "g3mail", "wh4tsapp"

export type ResultadoFiltro = { bloqueado: boolean; motivos: string[] }

const quitarAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "")

const NUMEROS: Record<string, string> = {
  cero: "0", uno: "1", una: "1", dos: "2", tres: "3", cuatro: "4",
  cinco: "5", seis: "6", siete: "7", ocho: "8", nueve: "9",
}

// Cuenta cuántos dígitos seguidos hay (en cifras o con palabras: "cinco cinco uno dos...").
// Las medidas como "1220 x 2440" no suman porque la "x" corta la cuenta.
function digitosSeguidos(t: string): number {
  let max = 0
  let actual = 0
  for (const p of t.split(/[^a-z0-9]+/).filter(Boolean)) {
    if (/^\d+$/.test(p)) actual += p.length
    else if (NUMEROS[p]) actual += 1
    else {
      max = Math.max(max, actual)
      actual = 0
    }
  }
  return Math.max(max, actual)
}

// Versión "compacta": sin espacios, guiones, puntos ni símbolos, y con las letras repetidas
// reducidas a una sola ("whaaatsapp" -> "whatsap"). Sirve para cazar "g-m-a-i-l".
const colapsar = (s: string) => s.replace(/(.)\1+/g, "$1")

function compactar(t: string): string {
  return colapsar(t.replace(/[^a-z0-9]+/g, ""))
}

// Cambia números por letras parecidas SOLO para revisar palabras (g3mail -> gemail)
function sinLeet(t: string): string {
  return t
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/@/g, "a")
}

// Palabras largas (5+ letras) que, aunque las separen, delatan un dato de contacto.
// Se guardan ya "colapsadas" para comparar contra el texto compacto.
const PALABRAS_COMPACTAS = [
  "gmail", "hotmail", "outlook", "yahoo", "icloud", "prodigy", "protonmail",
  "whatsapp", "whatsap", "watsap", "telegram", "instagram", "facebook", "messenger",
  "tiktok", "snapchat", "linkedin",
  "arroba", "puntocom", "puntomx", "puntonet", "dotcom", "atgmail",
].map(colapsar)

const REDES =
  /\b(whats\s?app|whatsap|watsap|wasap|wasa|whats|telegram|telegrm|instagram|insta|facebook|fb|messenger|tik\s?tok|snapchat|twitter|linkedin|signal)\b/

const CORREO = [
  /[a-z0-9._+-]+\s*(@|\(at\)|\[at\]|\barroba\b)\s*[a-z0-9-]+/,
  /\b(gmail|hotmail|outlook|yahoo|icloud|prodigy|live\.com)\b/,
  /\bpunto\s*(com|mx|net|org)\b/,
]

const USUARIO = /(^|\s)@[a-z0-9_.]{3,}/

const ENLACE = [
  /\bhttps?:\/\/(?!(www\.)?hetnacnc\.com)\S+/,
  /\bwww\.(?!hetnacnc\.com)\S+/,
  /\b(?!hetnacnc\.com)[a-z0-9-]+\.(com|mx|net|org|io|me|link|ly|app|shop|store|info)\b/,
  /\b(wa\.me|t\.me|bit\.ly|goo\.gl|linktr\.ee)\b/,
]

const FRASES_CONTACTO = [
  /\b(mi|tu|su)\s+(numero|num|cel|celular|telefono|tel|correo|mail|email|contacto)\b/,
  /\b(llamame|llamarme|marcame|te llamo|te marco|hablame por|escribeme por|buscame en|agregame)\b/,
  /\b(pasame|mandame|dame|enviame)\s+(tu|su)\s+(numero|cel|celular|telefono|correo|contacto)\b/,
  /\bfuera de (la )?(pagina|plataforma|hetna)\b/,
]

// Revisa si, quitando separadores, aparece alguna palabra de contacto escondida
function contactoEscondido(t: string): { red: boolean; correo: boolean } {
  const variantes = [compactar(t), compactar(sinLeet(t))]
  let red = false
  let correo = false
  for (const c of variantes) {
    for (const p of PALABRAS_COMPACTAS) {
      if (c.includes(p)) {
        if (/mail|arroba|punto|dot|outlok|yaho|icloud|prodigy/.test(p)) correo = true
        else red = true
      }
    }
  }
  return { red, correo }
}

// Cuenta números seguidos en el texto compacto: "5 5 uno-dos tres..." aunque lleven símbolos
function digitosEnCompacto(t: string): number {
  const m = t.replace(/[^a-z0-9]+/g, "").match(/(?:cero|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|\d)+/g)
  if (!m) return 0
  let max = 0
  for (const bloque of m) {
    const n = (bloque.match(/cero|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|\d/g) || []).length
    // Solo cuenta bloques con al menos una palabra-número o cifras largas
    max = Math.max(max, n)
  }
  return max
}

export function revisarMensaje(entrada: string): ResultadoFiltro {
  // Quita acentos, mayúsculas y caracteres invisibles que se usan para esconder datos
  const t = quitarAcentos(entrada.toLowerCase())
    .replace(/[​-‏⁠﻿]/g, "")
    .replace(/\s+/g, " ")
  const motivos = new Set<string>()

  if (digitosSeguidos(t) >= 9) motivos.add("telefono")
  if (CORREO.some((r) => r.test(t)) || USUARIO.test(t)) motivos.add("correo")
  if (REDES.test(t)) motivos.add("red_social")
  if (ENLACE.some((r) => r.test(t))) motivos.add("enlace")
  if (FRASES_CONTACTO.some((r) => r.test(t))) motivos.add("frase_contacto")

  // Segunda revisión: trucos para esconder datos (g-m-a-i-l, w.h.a.t.s.a.p.p, etc.)
  const esc = contactoEscondido(t)
  if (esc.correo) motivos.add("correo")
  if (esc.red) motivos.add("red_social")

  // Teléfono escondido entre símbolos o letras: 10+ números/palabras-número seguidos
  // (las medidas con "x" no entran porque la x no es número)
  if (digitosEnCompacto(t) >= 10) motivos.add("telefono")

  return { bloqueado: motivos.size > 0, motivos: [...motivos] }
}
