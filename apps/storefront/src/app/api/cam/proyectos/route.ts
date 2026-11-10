// Proyectos guardados del CAM Studio. Pasa las peticiones al API con la sesión
// del cliente (la cookie sólo se puede leer en el servidor).
//   GET    /api/cam/proyectos?herramienta=2d|3d|torno   lista los propios
//   GET    /api/cam/proyectos?id=…                      abre uno (propio o compartido)
//   POST   /api/cam/proyectos                           guarda { id?, herramienta, nombre, datos }
//   POST   /api/cam/proyectos?id=…                      { compartido } enciende o apaga la liga
//   DELETE /api/cam/proyectos?id=…
import { NextResponse } from "next/server"

import { getAuthHeaders } from "@/lib/data/cookies"

export const dynamic = "force-dynamic"

const BACKEND = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
const PK = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string
const MAX_BYTES = 1_800_000
const ID = /^[A-Za-z0-9_-]{6,40}$/

async function pasar(ruta: string, opciones: { metodo?: string; cuerpo?: string; exigeSesion?: boolean } = {}) {
  const auth = (await getAuthHeaders()) as { authorization?: string }
  if (opciones.exigeSesion && !auth.authorization) {
    return NextResponse.json({ ok: false, codigo: "sesion", mensaje: "Entra a tu cuenta para guardar tus proyectos." }, { status: 401 })
  }
  try {
    const r = await fetch(`${BACKEND}${ruta}`, {
      method: opciones.metodo || "GET",
      headers: { "Content-Type": "application/json", "x-publishable-api-key": PK, ...auth },
      body: opciones.cuerpo,
      cache: "no-store",
    })
    const d = (await r.json().catch(() => ({}))) as Record<string, unknown>
    if (r.status === 401) return NextResponse.json({ ok: false, codigo: "sesion", mensaje: "Tu sesión expiró. Vuelve a entrar." }, { status: 401 })
    if (!r.ok) return NextResponse.json({ ok: false, codigo: d.codigo, mensaje: (d.message as string) || "No se pudo completar." }, { status: r.status })
    return NextResponse.json({ ok: true, ...d })
  } catch {
    return NextResponse.json({ ok: false, mensaje: "No pudimos conectar con tus proyectos. Intenta de nuevo." }, { status: 503 })
  }
}

const idDe = (req: Request) => {
  const id = new URL(req.url).searchParams.get("id") || ""
  return ID.test(id) ? id : null
}

export async function GET(req: Request) {
  const u = new URL(req.url)
  if (u.searchParams.has("id")) {
    const id = idDe(req)
    if (!id) return NextResponse.json({ ok: false, mensaje: "Esa liga no es válida." }, { status: 400 })
    return pasar(`/store/cam/proyectos/${id}`)
  }
  const h = u.searchParams.get("herramienta")
  return pasar(`/store/cam/proyectos${h === "2d" || h === "3d" || h === "torno" ? `?herramienta=${h}` : ""}`, { exigeSesion: true })
}

export async function POST(req: Request) {
  const cuerpo = await req.text()
  if (cuerpo.length > MAX_BYTES) {
    return NextResponse.json({ ok: false, codigo: "grande", mensaje: "El proyecto es demasiado grande para guardarlo. Simplifica el dibujo o el relieve." }, { status: 413 })
  }
  try {
    JSON.parse(cuerpo)
  } catch {
    return NextResponse.json({ ok: false, mensaje: "No se pudo leer el proyecto." }, { status: 400 })
  }
  if (new URL(req.url).searchParams.has("id")) {
    const id = idDe(req)
    if (!id) return NextResponse.json({ ok: false, mensaje: "Ese proyecto no es válido." }, { status: 400 })
    return pasar(`/store/cam/proyectos/${id}`, { metodo: "POST", cuerpo, exigeSesion: true })
  }
  return pasar("/store/cam/proyectos", { metodo: "POST", cuerpo, exigeSesion: true })
}

export async function DELETE(req: Request) {
  const id = idDe(req)
  if (!id) return NextResponse.json({ ok: false, mensaje: "Ese proyecto no es válido." }, { status: 400 })
  return pasar(`/store/cam/proyectos/${id}`, { metodo: "DELETE", exigeSesion: true })
}
