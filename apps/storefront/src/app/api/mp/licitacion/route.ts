// Puente público para los avisos de Mercado Pago de la licitación.
// Reenvía el aviso tal cual a la API (que verifica el pago directo con Mercado Pago).
const API = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const url = new URL(req.url)
  const cuerpo = await req.text()
  try {
    await fetch(`${API}/hooks/mp-licitacion${url.search}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: cuerpo || "{}",
      cache: "no-store",
    })
  } catch (e) {
    console.error("[mp-licitacion] no se pudo reenviar el aviso", e)
  }
  return Response.json({ ok: true })
}

export async function GET() {
  return Response.json({ ok: true })
}
