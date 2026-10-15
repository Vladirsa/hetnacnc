// Puerta de entrada de la pantalla "Fundadores" del /dashboard.
//   GET  /api/pub/fundadores/lista    -> talleres, cupo y fechas
//   POST /api/pub/fundadores/marcar   -> { id }  marca como fundador (6 meses de Pro)
//   POST /api/pub/fundadores/quitar   -> { id }  quita la marca
// Solo responde a administradores del dashboard (se verifica con Medusa).

import { NextRequest, NextResponse } from "next/server"

import { listarAdmin, marcar, quitar } from "@/lib/hetna/fundadores"
import { autorizacion } from "@/lib/publicidad/sesion"

export const dynamic = "force-dynamic"

const json = (cuerpo: unknown, status = 200) => NextResponse.json(cuerpo, { status })

type Ctx = { params: Promise<{ accion: string }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  const { accion } = await ctx.params
  if (accion !== "lista") return json({ ok: false, error: "No existe." }, 404)
  const h = await autorizacion(req)
  if (!h) return json({ ok: false, error: "sin_sesion" }, 401)
  const r = await listarAdmin(h)
  return r.ok ? json(r) : json(r, 500)
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { accion } = await ctx.params
  // Cabecera propia: evita que otro sitio pueda disparar estas acciones con tu sesión.
  if (req.headers.get("x-hetna-pub") !== "1") return json({ ok: false, error: "Petición no permitida." }, 403)
  const h = await autorizacion(req)
  if (!h) return json({ ok: false, error: "sin_sesion" }, 401)

  const cuerpo = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!cuerpo) return json({ ok: false, error: "Datos no válidos." }, 400)
  const id = String(cuerpo.id ?? "")

  switch (accion) {
    case "marcar":
      return json(await marcar(h, id))
    case "quitar":
      return json(await quitar(h, id))
    default:
      return json({ ok: false, error: "No existe." }, 404)
  }
}
