// Aviso de clic en un correo de prospección (scripts/prospectos): las ligas de los
// correos llevan &e=<id de la empresa en la hoja>. La tienda lo manda aquí y esto
// lo pasa al flujo de n8n «Clic en correo», que te avisa por Telegram para que le
// llames mientras tiene la página abierta. Vive en /api/app/ porque nginx manda
// /api/v... a otro servicio.
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const WEBHOOK = process.env.N8N_PROSPECTO_CLIC_URL || "https://n8n.hetnacnc.com/webhook/hetna-prospecto-clic"
// Un aviso por empresa cada 30 min desde este servidor (n8n además deja uno al día)
const ultimos = new Map<string, number>()

export async function POST(req: NextRequest) {
  const b = (await req.json().catch(() => ({}))) as { e?: string; ruta?: string; campana?: string }
  const e = String(b.e || "").trim().toLowerCase()
  if (!/^[a-z0-9][a-z0-9.-]{2,120}$/.test(e)) return NextResponse.json({ ok: false }, { status: 400 })
  const ahora = Date.now()
  if (ahora - (ultimos.get(e) || 0) < 30 * 60_000) return NextResponse.json({ ok: true })
  ultimos.set(e, ahora)
  if (ultimos.size > 5000) ultimos.clear()
  // Los robots de antivirus también abren las ligas: sólo cuenta un navegador real
  const ua = req.headers.get("user-agent") || ""
  if (!/mozilla/i.test(ua) || /bot|crawl|spider|preview|scan|safelinks|proofpoint|mimecast|barracuda/i.test(ua)) {
    return NextResponse.json({ ok: true })
  }
  try {
    await fetch(WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (compatible; HETNA-Tienda/1.0)" },
      body: JSON.stringify({
        e,
        ruta: String(b.ruta || "/").replace(/[^\w/.-]/g, "").slice(0, 120),
        campana: String(b.campana || "").replace(/[^\w-]/g, "").slice(0, 40),
      }),
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    // sin aviso no pasa nada
  }
  return NextResponse.json({ ok: true })
}
