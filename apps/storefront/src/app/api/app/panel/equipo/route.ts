// HETNA Panel → Equipo (sólo dueño):
//   POST { accion: "rol", user_id, rol }      cambia el rol de un administrador
//   POST { accion: "invitar", email, rol }   crea la invitación y regresa la liga
import { NextResponse } from "next/server"

import { ROLES, type Rol } from "@/lib/panel/roles"
import { adminFetch, usuarioPanel } from "@/lib/panel/sesion"

const SITIO = (process.env.NEXT_PUBLIC_BASE_URL || "https://hetnacnc.com").replace(/\/$/, "")

export async function POST(req: Request) {
  const yo = await usuarioPanel()
  if (!yo) return NextResponse.json({ message: "Sin sesión." }, { status: 401 })
  if (yo.rol !== "dueno") return NextResponse.json({ message: "Sólo el dueño puede cambiar el equipo." }, { status: 403 })
  let b: { accion?: string; user_id?: string; rol?: string; email?: string } = {}
  try { b = await req.json() } catch {}
  const rol = (b.rol && b.rol in ROLES ? b.rol : "sin_acceso") as Rol
  try {
    // Al asignar el primer rol, el dueño que lo hace queda guardado como dueño
    // (si no, al terminar el arranque se quedaría sin acceso)
    const yoRaw = await adminFetch<{ user: { metadata?: Record<string, unknown> } }>("/admin/users/me")
    if (!yoRaw.user.metadata?.panel_rol) {
      await adminFetch(`/admin/users/${yo.id}`, { method: "POST", body: JSON.stringify({ metadata: { ...(yoRaw.user.metadata || {}), panel_rol: "dueno" } }) })
    }
    if (b.accion === "rol" && b.user_id) {
      if (b.user_id === yo.id && rol !== "dueno") return NextResponse.json({ message: "No te puedes quitar el rol de dueño a ti mismo." }, { status: 400 })
      const otro = await adminFetch<{ user: { metadata?: Record<string, unknown> } }>(`/admin/users/${b.user_id}`)
      await adminFetch(`/admin/users/${b.user_id}`, { method: "POST", body: JSON.stringify({ metadata: { ...(otro.user.metadata || {}), panel_rol: rol } }) })
      return NextResponse.json({ ok: true })
    }
    if (b.accion === "invitar" && b.email) {
      const email = String(b.email).trim().toLowerCase()
      const r = await adminFetch<{ invite: { id: string; token: string } }>("/admin/invites", { method: "POST", body: JSON.stringify({ email }) })
      // El rol se guarda para aplicarlo cuando acepte (el dueño lo confirma en Equipo)
      const liga = `${SITIO}/dashboard/invite?token=${encodeURIComponent(r.invite.token)}`
      return NextResponse.json({ ok: true, liga, rol })
    }
    return NextResponse.json({ message: "Acción no válida." }, { status: 400 })
  } catch (e) {
    const m = (e as Error).message
    if (m === "sin_sesion") return NextResponse.json({ message: "La sesión venció; vuelve a entrar." }, { status: 401 })
    return NextResponse.json({ message: `No se pudo: ${m}` }, { status: 502 })
  }
}
