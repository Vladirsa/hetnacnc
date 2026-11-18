// Cifrado en reposo de las llaves de terceros que guarda el servidor:
// tokens de Mercado Pago de cada taller (negocios_mp), llaves de Facturapi
// (negocios_facturapi) y tokens de redes (TikTok, Pinterest, Google, Threads)
// en la configuración del Social Hub.
//
// Formato: "enc:v1:<iv>:<tag>:<datos>" (AES-256-GCM, cada parte en base64url).
// La llave sale de LLAVES_CIFRADO (32 bytes, en hex de 64 letras o en base64).
// Generarla: openssl rand -hex 32
//
// Pensado para no romper producción:
//   - Sin llave válida, cifrar() deja el texto como viene (y avisa en el log
//     una vez por hora): todo sigue funcionando como antes.
//   - descifrar() deja pasar el texto plano viejo (sin prefijo), así que lo
//     guardado antes de este cambio se sigue leyendo hasta que se migre con
//     src/scripts/cifrar-llaves.ts.
//   - Rotación: la llave nueva va en LLAVES_CIFRADO y la vieja en
//     LLAVES_CIFRADO_ANTERIOR; se descifra con cualquiera de las dos y se
//     cifra siempre con la nueva.
// Ningún mensaje de error incluye el valor (ni cifrado ni en claro).
import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

export const PREFIJO = "enc:v1:"
const ALGORITMO = "aes-256-gcm"
const LARGO_IV = 12
const LARGO_TAG = 16

/** Lee una llave de 32 bytes en hex (64 letras) o base64/base64url. null si falta o no cuadra. */
export function leerLlave(texto: string | undefined | null): Buffer | null {
  const t = String(texto || "").trim()
  if (!t) return null
  // Primero hex: 64 letras hex también "parecen" base64 (y darían 48 bytes)
  if (/^[0-9a-fA-F]{64}$/.test(t)) return Buffer.from(t, "hex")
  if (/^[A-Za-z0-9+/_-]{43}=?$/.test(t)) {
    const b = Buffer.from(t.replace(/-/g, "+").replace(/_/g, "/"), "base64")
    return b.length === 32 ? b : null
  }
  return null
}

// Se leen en cada llamada (no al importar): así un cambio del .env tras
// reiniciar, o las pruebas, no dependen del orden de carga.
const llaveActual = () => leerLlave(process.env.LLAVES_CIFRADO)
const llaveAnterior = () => leerLlave(process.env.LLAVES_CIFRADO_ANTERIOR)

/** ¿Hay una LLAVES_CIFRADO con formato válido? */
export const cifradoListo = () => llaveActual() !== null

export const estaCifrado = (v: unknown): boolean => typeof v === "string" && v.startsWith(PREFIJO)

let ultimoAviso = 0
function avisarSinLlave() {
  if (Date.now() - ultimoAviso < 3600_000) return
  ultimoAviso = Date.now()
  const motivo = String(process.env.LLAVES_CIFRADO || "").trim() ? "tiene un formato que no sirve (deben ser 32 bytes: openssl rand -hex 32)" : "no está puesta"
  console.warn(`[cifrado-llaves] LLAVES_CIFRADO ${motivo}: las llaves de terceros se guardan SIN cifrar.`)
}

/** Sólo para las pruebas: vuelve a permitir el aviso. */
export const _reiniciarAviso = () => {
  ultimoAviso = 0
}

/**
 * Cifra un texto. Sin llave válida lo devuelve igual (no rompe nada). Si ya
 * viene cifrado no lo cifra otra vez. null, undefined, "" y lo que no es
 * texto pasan sin cambios (p. ej. llave_real: null al cambiar de CSD).
 */
export function cifrar<T>(texto: T): T {
  if (typeof texto !== "string" || texto === "" || estaCifrado(texto)) return texto
  const llave = llaveActual()
  if (!llave) {
    avisarSinLlave()
    return texto
  }
  const iv = randomBytes(LARGO_IV)
  const c = createCipheriv(ALGORITMO, llave, iv, { authTagLength: LARGO_TAG })
  const datos = Buffer.concat([c.update(texto, "utf8"), c.final()])
  const tag = c.getAuthTag()
  return `${PREFIJO}${iv.toString("base64url")}:${tag.toString("base64url")}:${datos.toString("base64url")}` as T
}

function abrir(llave: Buffer, iv: Buffer, tag: Buffer, datos: Buffer): string | null {
  try {
    const d = createDecipheriv(ALGORITMO, llave, iv, { authTagLength: LARGO_TAG })
    d.setAuthTag(tag)
    return Buffer.concat([d.update(datos), d.final()]).toString("utf8")
  } catch {
    return null
  }
}

/**
 * Descifra. Lo que no trae el prefijo (texto plano viejo, null, etc.) pasa
 * igual. Si trae el prefijo y no hay llave, o la llave no es la que cifró,
 * lanza un error claro sin enseñar el valor.
 */
export function descifrar<T>(valor: T): T {
  if (!estaCifrado(valor)) return valor
  const partes = (valor as unknown as string).slice(PREFIJO.length).split(":")
  if (partes.length !== 3) throw new Error("Llave cifrada dañada: el formato no es enc:v1:<iv>:<tag>:<datos>.")
  const [iv, tag, datos] = partes.map((p) => Buffer.from(p, "base64url"))
  if (iv.length !== LARGO_IV || tag.length !== LARGO_TAG) throw new Error("Llave cifrada dañada: el formato no es enc:v1:<iv>:<tag>:<datos>.")
  const llaves = [llaveActual(), llaveAnterior()].filter(Boolean) as Buffer[]
  if (!llaves.length) throw new Error("Hay llaves cifradas en la base pero falta LLAVES_CIFRADO en el .env del backend (o no tiene formato válido).")
  for (const k of llaves) {
    const t = abrir(k, iv, tag, datos)
    if (t !== null) return t as unknown as T
  }
  throw new Error("No se pudo descifrar: LLAVES_CIFRADO no es la llave que cifró estos datos (¿se cambió? pon la vieja en LLAVES_CIFRADO_ANTERIOR).")
}

/** Copia del objeto con esos campos cifrados (no toca el original). */
export function cifrarCampos<T extends Record<string, any>>(obj: T, campos: readonly string[]): T {
  if (!obj || typeof obj !== "object") return obj
  const copia: Record<string, any> = { ...obj }
  for (const c of campos) if (c in copia) copia[c] = cifrar(copia[c])
  return copia as T
}
