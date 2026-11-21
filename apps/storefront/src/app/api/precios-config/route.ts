// Ajustes de precio del dueño para la calculadora del navegador (/cotizar y
// "Fabrícalo con un taller"). Los guarda el Panel de HETNA > Precios de la
// calculadora; aquí sólo se reenvían, con caché de un minuto.
const BACKEND = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
const PK = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""

export async function GET() {
  try {
    const r = await fetch(`${BACKEND}/store/hetna-precios`, { headers: { "x-publishable-api-key": PK }, next: { revalidate: 60 } })
    const d = r.ok ? await r.json() : { cfg: {} }
    return Response.json({ cfg: d.cfg || {} }, { headers: { "Cache-Control": "public, max-age=60" } })
  } catch {
    return Response.json({ cfg: {} })
  }
}
