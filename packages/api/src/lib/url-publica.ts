// ¿Esta URL apunta a internet y no a la red interna del servidor? Para las
// funciones que descargan una URL que manda un usuario (auditoría Thermos,
// 15 nov 2026: la revisión de fondo blanco hacía fetch a cualquier dirección,
// incluidas IPs internas y los metadatos de la nube).
import { lookup } from "node:dns/promises"
import net from "node:net"

// Rangos que no son internet pública (IPv4 e IPv6, incluidas las formas
// "IPv4 dentro de IPv6" que usa Node al normalizar: ::ffff:7f00:1)
const BLOQUEADAS = new net.BlockList()
for (const [red, bits] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["224.0.0.0", 3],
] as const) BLOQUEADAS.addSubnet(red, bits, "ipv4")
for (const [red, bits] of [
  ["::", 96], // :: , ::1 e IPv4 compatibles
  // (::ffff:0:0/96 no va aquí: BlockList la cruza con TODAS las IPv4; se revisa en ipPrivada)
  ["64:ff9b::", 96], ["2002::", 16], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
] as const) BLOQUEADAS.addSubnet(red, bits, "ipv6")

/** IPv4 escondida en una IPv6 (::ffff:a.b.c.d o ::ffff:XXXX:XXXX). */
function ipv4Mapeada(ip: string): string | null {
  const x = ip.toLowerCase()
  const punto = x.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (punto) return punto[1]
  const hex = x.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
  if (!hex) return null
  const a = parseInt(hex[1], 16)
  const b = parseInt(hex[2], 16)
  return `${a >> 8}.${a & 255}.${b >> 8}.${b & 255}`
}

export function ipPrivada(ip: string): boolean {
  const v = net.isIP(ip)
  if (v === 4) return BLOQUEADAS.check(ip, "ipv4")
  if (v === 6) {
    // Una IPv4 escondida en IPv6 (::ffff:7f00:1) nunca hace falta para una foto: se bloquea
    if (ipv4Mapeada(ip)) return true
    return BLOQUEADAS.check(ip, "ipv6")
  }
  return true
}

const hostDe = (u: string) => {
  try {
    return new URL(u).hostname.toLowerCase().replace(/^www\./, "")
  } catch {
    return ""
  }
}

/** Hosts del propio sitio (tienda, API y almacenamiento de archivos). */
export function hostsPropios(): string[] {
  return [process.env.STORE_URL, process.env.STOREFRONT_URL, process.env.FILE_BACKEND_URL, process.env.MEDUSA_BACKEND_URL, process.env.BACKEND_URL]
    .filter(Boolean)
    .map((u) => hostDe(String(u)))
    .filter(Boolean)
    .concat(["hetnacnc.com"])
}

/** ¿La URL (ya interpretada) es de un host del propio sitio? */
export function esHostPropio(u: URL): boolean {
  const h = u.hostname.toLowerCase().replace(/^www\./, "")
  return hostsPropios().some((x) => h === x || h.endsWith(`.${x}`))
}

/** true si es http(s) y todas las IPs del nombre son públicas. */
export async function urlPublica(u: URL): Promise<boolean> {
  if (u.protocol !== "http:" && u.protocol !== "https:") return false
  const host = u.hostname.replace(/^\[|\]$/g, "")
  if (net.isIP(host)) return !ipPrivada(host)
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false
  try {
    const ips = await lookup(host, { all: true })
    return ips.length > 0 && ips.every((r) => !ipPrivada(r.address))
  } catch {
    return false
  }
}
