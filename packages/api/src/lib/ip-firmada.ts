// IP real de quien usa la tienda, cuando la petición llega desde el servidor de
// la tienda (auditoría de seguridad del 18 nov 2026).
//
// La tienda (Next) llama al API por dentro del servidor, así que el API veía a
// todos los compradores con la misma IP (la del servidor): la bitácora de
// intentos fallidos no servía para saber de dónde venían y un límite por IP
// habría frenado a todos a la vez. Ahora la tienda manda la IP del comprador en
// la cabecera x-hetna-ip, FIRMADA con el secreto que ya comparten la tienda y el
// API (REVALIDATE_SECRET = STOREFRONT_REVALIDATE_SECRET). Sin firma válida, o
// con más de 2 minutos, se ignora: nadie de fuera puede hacerse pasar por otra IP.
import { createHmac, timingSafeEqual } from "crypto"

const VIGENCIA_S = 120

const secreto = () => {
  const s = process.env.STOREFRONT_REVALIDATE_SECRET || ""
  return s && s !== "supersecret" && s.length >= 16 ? s : null
}

export const firmaIp = (ip: string, ts: number, s: string) => createHmac("sha256", s).update(`${ip}|${ts}`).digest("base64url")

/** "ip.ts.firma" → la IP si la firma es buena y reciente; si no, null. */
export function ipDeFirma(valor: unknown, ahora = Date.now()): string | null {
  const s = secreto()
  if (!s || typeof valor !== "string" || valor.length > 200) return null
  const m = /^([0-9a-fA-F:.]{2,64})\.(\d{9,12})\.([A-Za-z0-9_-]{20,})$/.exec(valor)
  if (!m) return null
  const [, ip, tsTexto, firma] = m
  const ts = Number(tsTexto)
  if (Math.abs(ahora / 1000 - ts) > VIGENCIA_S) return null
  const esperada = Buffer.from(firmaIp(ip, ts, s))
  const dada = Buffer.from(firma)
  if (esperada.length !== dada.length || !timingSafeEqual(esperada, dada)) return null
  return ip.replace(/^::ffff:/, "")
}
