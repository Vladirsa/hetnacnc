// Puente para n8n: lo que el dueño le escribe al bot de Telegram (o los botones
// que toca) llega aquí y se pasa al backend, que es quien valida el token
// (x-hetna-token) y decide. El backend no está publicado en internet.
import { NextRequest, NextResponse } from "next/server"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export async function POST(req: NextRequest) {
  const token = req.headers.get("x-hetna-token") || ""
  if (!token) return NextResponse.json({ message: "No autorizado." }, { status: 401 })
  const cuerpo = await req.text()
  if (cuerpo.length > 10_000) return NextResponse.json({ message: "Demasiado largo." }, { status: 413 })
  try {
    const r = await fetch(`${MEDUSA_BACKEND_URL}/hooks/social-hub/telegram`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-hetna-token": token },
      body: cuerpo,
      signal: AbortSignal.timeout(50_000),
    })
    return NextResponse.json(await r.json().catch(() => ({})), { status: r.status })
  } catch {
    return NextResponse.json({ ok: false, respuesta: "El servidor de HETNA no respondió. Intenta en un minuto." })
  }
}
