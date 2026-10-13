// Recibe los avisos del navegador cuando algo incumple la política de seguridad (CSP) en modo
// solo-reporte. No bloquea nada: solo deja un renglon en el registro del servidor (pm2 logs hetna-web)
// para que podamos ver qué habría que permitir antes de activar la política de verdad.

import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// Para no llenar el registro: cada aviso distinto se anota una sola vez por reinicio
const vistos = new Set<string>()

export async function POST(req: Request) {
  try {
    const crudo = (await req.text()).slice(0, 4000)
    const datos = JSON.parse(crudo) as Record<string, any>
    const r = (datos["csp-report"] ?? datos) as Record<string, any>
    const regla = String(r["violated-directive"] ?? r.effectiveDirective ?? "?")
    const bloqueado = String(r["blocked-uri"] ?? r.blockedURL ?? "?").slice(0, 160)
    const pagina = String(r["document-uri"] ?? r.documentURL ?? "?").replace(/\?.*$/, "").slice(0, 120)
    const clave = `${regla}|${bloqueado}`
    if (!vistos.has(clave) && vistos.size < 500) {
      vistos.add(clave)
      console.warn(`[csp] regla=${regla} bloqueado=${bloqueado} pagina=${pagina}`)
    }
  } catch {
    // aviso mal formado: se ignora
  }
  return new NextResponse(null, { status: 204 })
}
