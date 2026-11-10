// "Programas probados": lo que reportan los talleres después de correr en su
// máquina un programa del CAM Studio.
//   GET  /api/cam/pruebas  -- resumen por control (público, sin nombres)
//   POST /api/cam/pruebas  -- "lo probé y me fue así" (pide cuenta)
import { NextResponse } from "next/server"

import { getAuthHeaders } from "@/lib/data/cookies"

export const dynamic = "force-dynamic"

const BACKEND = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
const PK = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string

export async function GET() {
  try {
    const r = await fetch(`${BACKEND}/store/cam/pruebas`, { headers: { "x-publishable-api-key": PK }, cache: "no-store" })
    return NextResponse.json(r.ok ? await r.json() : { pruebas: [] })
  } catch {
    return NextResponse.json({ pruebas: [] })
  }
}

export async function POST(req: Request) {
  const auth = (await getAuthHeaders()) as { authorization?: string }
  if (!auth.authorization) {
    return NextResponse.json({ ok: false, codigo: "sesion", mensaje: "Entra a tu cuenta para mandar tu reporte." }, { status: 401 })
  }
  let cuerpo: unknown
  try {
    const texto = await req.text()
    if (texto.length > 4000) throw new Error("largo")
    cuerpo = JSON.parse(texto)
  } catch {
    return NextResponse.json({ ok: false, mensaje: "No se pudo leer tu reporte." }, { status: 400 })
  }
  try {
    const r = await fetch(`${BACKEND}/store/cam/pruebas`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-publishable-api-key": PK, ...auth },
      body: JSON.stringify(cuerpo),
      cache: "no-store",
    })
    const d = (await r.json().catch(() => ({}))) as { message?: string }
    if (r.status === 401) {
      return NextResponse.json({ ok: false, codigo: "sesion", mensaje: "Tu sesión expiró. Vuelve a entrar para mandar tu reporte." }, { status: 401 })
    }
    if (!r.ok) return NextResponse.json({ ok: false, mensaje: d.message || "No se pudo guardar tu reporte." }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, mensaje: "No se pudo guardar tu reporte. Intenta más tarde." }, { status: 503 })
  }
}
