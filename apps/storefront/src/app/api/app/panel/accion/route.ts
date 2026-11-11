// HETNA Panel: acciones (reenvía al API de administrador con el token de la
// sesión, sólo a rutas permitidas y según el rol).
//   POST { ruta: "/admin/hetna-solicitudes/<id>/accion", cuerpo: {...}, area: "licitaciones" }
//   POST { ruta: "/admin/hetna-verificacion/<sellerId>",  cuerpo: {...}, area: "talleres" }
//   POST { ruta: "/admin/hetna-distribuidores", cuerpo: {accion...}, area: "distribuidores" }
import { NextResponse } from "next/server"

import { puedeActuar } from "@/lib/panel/roles"
import { adminFetch, usuarioPanel } from "@/lib/panel/sesion"

const PERMITIDAS: { patron: RegExp; area: string }[] = [
  { patron: /^\/admin\/hetna-solicitudes\/[\w-]+\/accion$/, area: "licitaciones" },
  { patron: /^\/admin\/hetna-verificacion\/[\w-]+$/, area: "talleres" },
  { patron: /^\/admin\/orders\/[\w-]+\/(cancel|complete)$/, area: "pedidos" },
  { patron: /^\/admin\/hetna-distribuidores$/, area: "distribuidores" },
]

export async function POST(req: Request) {
  const yo = await usuarioPanel()
  if (!yo) return NextResponse.json({ message: "Sin sesión." }, { status: 401 })
  let b: { ruta?: string; cuerpo?: unknown; area?: string } = {}
  try { b = await req.json() } catch {}
  const ruta = String(b.ruta || "")
  const regla = PERMITIDAS.find((r) => r.patron.test(ruta))
  if (!regla) return NextResponse.json({ message: "Acción no permitida." }, { status: 400 })
  if (!puedeActuar(yo.rol, regla.area)) return NextResponse.json({ message: "Tu rol no puede hacer esto." }, { status: 403 })
  try {
    const r = await adminFetch<unknown>(ruta, { method: "POST", body: JSON.stringify(b.cuerpo || {}) })
    return NextResponse.json({ ok: true, r })
  } catch (e) {
    const m = (e as Error).message
    if (m === "sin_sesion") return NextResponse.json({ message: "La sesión venció; vuelve a entrar." }, { status: 401 })
    return NextResponse.json({ message: m }, { status: 502 })
  }
}
