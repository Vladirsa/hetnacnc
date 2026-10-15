// Lo llama n8n una vez al día (con la clave compartida en la cabecera x-hetna-token).
// Devuelve los talleres fundadores cuyo plan Pro gratis termina en 30 días o menos, UNA sola vez por taller:
//   { ok: true, porVencer: [{ nombre, handle, vence, dias }] }

import { timingSafeEqual } from "crypto"
import { NextRequest, NextResponse } from "next/server"

import { porVencer } from "@/lib/hetna/fundadores"

export const dynamic = "force-dynamic"

const igual = (a: string, b: string) => {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export async function GET(req: NextRequest) {
  const clave = (process.env.N8N_REDES_TOKEN || "").trim()
  const recibida = (req.headers.get("x-hetna-token") || "").trim()
  if (!clave || !recibida || !igual(clave, recibida)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 })
  }
  const r = await porVencer()
  return NextResponse.json(r, { status: r.ok ? 200 : 500 })
}
