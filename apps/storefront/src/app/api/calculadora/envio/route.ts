// "Mándame estos parámetros por correo" de la Calculadora CNC: pasa el pedido
// a la API con la IP real del cliente, que es con la que se cuentan los límites.
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const BACKEND = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
const PK = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string

// nginx agrega la IP de quien se conectó al final de X-Forwarded-For: lo de antes lo pudo escribir el cliente
const ipDe = (req: Request) => {
  const partes = (req.headers.get("x-forwarded-for") || "").split(",").map((s) => s.trim()).filter(Boolean)
  return partes[partes.length - 1] || req.headers.get("x-real-ip") || "desconocida"
}

export async function POST(req: Request) {
  let cuerpo: string
  try {
    cuerpo = await req.text()
    if (cuerpo.length > 2000) throw new Error("largo")
    JSON.parse(cuerpo)
  } catch {
    return NextResponse.json({ ok: false, message: "No se pudo leer el pedido." }, { status: 400 })
  }
  try {
    const r = await fetch(`${BACKEND}/store/calculadora/envio`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-publishable-api-key": PK, "x-forwarded-for": ipDe(req) },
      body: cuerpo,
      cache: "no-store",
    })
    const d = (await r.json().catch(() => ({}))) as { message?: string }
    if (!r.ok) return NextResponse.json({ ok: false, message: d.message || "No se pudo mandar el correo." }, { status: r.status === 429 ? 429 : 400 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, message: "No se pudo mandar el correo. Intenta más tarde." }, { status: 503 })
  }
}
