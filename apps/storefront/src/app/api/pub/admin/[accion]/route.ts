// Puerta de entrada del panel de publicidad que vive dentro del /dashboard.
//   GET  /api/pub/admin/lista      -> anuncios + configuración de espacios
//   POST /api/pub/admin/guardar    -> crear o editar
//   POST /api/pub/admin/borrar     -> { id }
//   POST /api/pub/admin/alternar   -> { id, activo }
// Solo responde a administradores del dashboard (se verifica con Medusa).

import { NextRequest, NextResponse } from "next/server"

import { alternar, borrar, guardar, listar } from "@/lib/publicidad/admin"
import { autorizacion } from "@/lib/publicidad/sesion"
import { ESPACIOS, ORDEN_ESPACIOS, type DatosPieza } from "@/lib/publicidad/tipos"

export const dynamic = "force-dynamic"

const json = (cuerpo: unknown, status = 200) => NextResponse.json(cuerpo, { status })

type Ctx = { params: Promise<{ accion: string }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  const { accion } = await ctx.params
  if (accion !== "lista") return json({ ok: false, error: "No existe." }, 404)
  if (!(await autorizacion(req))) return json({ ok: false, error: "sin_sesion" }, 401)
  const r = await listar()
  return r.ok ? json({ ...r, espacios: ESPACIOS, orden: ORDEN_ESPACIOS }) : json(r, 500)
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { accion } = await ctx.params
  // Cabecera propia: evita que otro sitio pueda disparar estas acciones con tu sesión.
  if (req.headers.get("x-hetna-pub") !== "1") return json({ ok: false, error: "Petición no permitida." }, 403)
  if (!(await autorizacion(req))) return json({ ok: false, error: "sin_sesion" }, 401)

  const cuerpo = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!cuerpo) return json({ ok: false, error: "Datos no válidos." }, 400)

  switch (accion) {
    case "guardar":
      return json(await guardar(cuerpo as unknown as DatosPieza))
    case "borrar":
      return json(await borrar(String(cuerpo.id ?? "")))
    case "alternar":
      return json(await alternar(String(cuerpo.id ?? ""), Boolean(cuerpo.activo)))
    default:
      return json({ ok: false, error: "No existe." }, 404)
  }
}
