// Filtro del chat en modo BLOQUEO: si el mensaje trae datos de contacto, NO se envía
// y se le explica a la persona por qué. Así los tratos se quedan dentro de HETNA.
//
// Detecta: teléfonos (también escritos con palabras o separados), correos, @usuarios,
// redes sociales, WhatsApp/Telegram, enlaces externos, CLABE y tarjetas (muchos dígitos seguidos)
// y frases como "pásame tu cel" o "llámame".

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

  return { bloqueado: motivos.size > 0, motivos: [...motivos] }
}
