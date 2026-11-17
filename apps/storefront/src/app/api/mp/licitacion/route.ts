// Puente público para los avisos de Mercado Pago de la licitación.
// Reenvía el aviso tal cual a la API (que verifica el pago directo con Mercado Pago).
const API = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const url = new URL(req.url)
  const cuerpo = await req.text()
  // Devuelve el resultado de la API: si falla, Mercado Pago recibe un 500 y
  // reintenta el aviso (antes siempre respondía 200 y el pago se perdía).
  try {
    const r = await fetch(`${API}/hooks/mp-licitacion${url.search}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: cuerpo || "{}",
      cache: "no-store",
    })
    return Response.json({ ok: r.ok }, { status: r.ok ? 200 : 500 })
  } catch (e) {
    console.error("[mp-licitacion] no se pudo reenviar el aviso", e)
    return Response.json({ ok: false }, { status: 502 })
  }
}

export async function GET() {
  return Response.json({ ok: true })
}
