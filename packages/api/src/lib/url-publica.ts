// ¿Esta URL apunta a internet y no a la red interna del servidor? Para las
// funciones que descargan una URL que manda un usuario (auditoría Thermos,
// 15 nov 2026: la revisión de fondo blanco hacía fetch a cualquier dirección,
// incluidas IPs internas y los metadatos de la nube).
import { lookup } from "node:dns/promises"
import net from "node:net"

export function ipPrivada(ip: string): boolean {
  const v = net.isIP(ip)
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number)
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // CGNAT
      (a === 169 && b === 254) || // link-local / metadatos de la nube
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224 // multicast y reservadas
    )
  }
  if (v === 6) {
    const x = ip.toLowerCase()
    if (x === "::1" || x === "::") return true
    if (x.startsWith("fc") || x.startsWith("fd") || x.startsWith("fe80")) return true
    const m = x.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    return m ? ipPrivada(m[1]) : false
  }
  return true
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
