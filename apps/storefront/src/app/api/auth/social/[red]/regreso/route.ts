// GET /api/auth/social/<red>/regreso?code=…&state=…  La red social regresa aquí.
//   1. El "state" debe ser el mismo que se guardó en este navegador (si no, alguien
//      podría meter a la persona en una cuenta ajena)
//   2. El backend cambia el código por la identidad (token de la red)
//   3. /store/hetna-social/completar entra, une o crea la cuenta (reglas de seguridad allá)
//   4. Se renueva el token (ya con el cliente) y se aplican los mismos filtros que al
//      entrar con correo: si la cuenta debe confirmar su correo, no queda sesión
import { revalidateTag } from "next/cache"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

import { COOKIE_ESTADO, COOKIE_PARA, COOKIE_VOLVER, PANEL_TALLER, SITIO_PUBLICO, esRedSocial } from "@/lib/auth/social"
import { getCacheTag } from "@/lib/data/cookies"
import { reenviarConfirmacion, transferCart } from "@/lib/data/customer"
import { eventoSocial } from "@/lib/hetna/social-evento"
import { destinoSeguro } from "@/lib/seguridad/destino-seguro"

const BACKEND = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
const LLAVE = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string

export async function GET(req: NextRequest, { params }: { params: Promise<{ red: string }> }) {
  const { red } = await params
  const tarro = await cookies()
  const estadoGuardado = tarro.get(COOKIE_ESTADO)?.value || ""
  const volver = destinoSeguro(tarro.get(COOKIE_VOLVER)?.value, "/user")
  const q = req.nextUrl.searchParams
  const taller = tarro.get(COOKIE_PARA)?.value === "taller"
  const limpiar = (res: NextResponse) => {
    res.cookies.delete(COOKIE_ESTADO)
    res.cookies.delete(COOKIE_VOLVER)
    res.cookies.delete(COOKIE_PARA)
    return res
  }
  const login = taller ? `${PANEL_TALLER}/login` : "/login"
  const alLogin = (msg: string) => limpiar(NextResponse.redirect(new URL(`${login}?social=${encodeURIComponent(msg)}`, SITIO_PUBLICO)))

  if (!esRedSocial(red)) return alLogin("Esa forma de entrar no existe.")
  if (q.get("error")) return alLogin("Cancelaste la entrada o la red no dio permiso. Puedes intentarlo otra vez.")
  if (!estadoGuardado || q.get("state") !== estadoGuardado) return alLogin("La sesión expiró o se abrió en otro navegador. Vuelve a intentarlo.")

  // Taller: nada de la tienda (carrito, sesión de cliente, recomendaciones)
  if (taller) return limpiar(await regresoTaller(red, q, alLogin))

  try {
    // 2. Identidad de la red
    const r = await fetch(`${BACKEND}/auth/customer/${red}/callback?${q.toString()}`, { cache: "no-store" })
    const d = (await r.json().catch(() => ({}))) as { token?: string }
    if (!r.ok || !d.token) return alLogin("No se pudo comprobar tu cuenta de la red social. Intenta de nuevo.")

    // 3. Entrar, unir o crear la cuenta
    const c = await fetch(`${BACKEND}/store/hetna-social/completar`, {
      method: "POST",
      headers: { Authorization: `Bearer ${d.token}`, "x-publishable-api-key": LLAVE, "Content-Type": "application/json" },
      body: "{}",
      cache: "no-store",
    })
    const dc = (await c.json().catch(() => ({}))) as { nueva?: boolean; message?: string }
    if (!c.ok) return alLogin(dc.message || "No se pudo terminar el registro. Intenta de nuevo.")

    // 4. Token con el cliente ya ligado
    const t = await fetch(`${BACKEND}/auth/token/refresh`, { method: "POST", headers: { Authorization: `Bearer ${d.token}` }, cache: "no-store" })
    const dt = (await t.json().catch(() => ({}))) as { token?: string }
    if (!t.ok || !dt.token) return alLogin("No se pudo abrir tu sesión. Intenta de nuevo.")

    // Mismo filtro que al entrar con correo: la cuenta que debe confirmar su correo no entra
    const v = await fetch(`${BACKEND}/store/verificacion`, { headers: { Authorization: `Bearer ${dt.token}`, "x-publishable-api-key": LLAVE }, cache: "no-store" })
    const dv = v.ok ? ((await v.json().catch(() => ({}))) as { requiere?: boolean; email?: string | null }) : {}
    if (dv.requiere) {
      if (dv.email) await reenviarConfirmacion(dv.email)
      return alLogin(`Primero confirma tu correo: te mandamos una liga${dv.email ? ` a ${dv.email}` : ""}. Revisa también spam o promociones.`)
    }

    tarro.set("_medusa_jwt", dt.token, { maxAge: 60 * 60 * 24 * 7, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" })
    if (dc.nueva) {
      // Lo mismo que el registro con correo: recomendación de un amigo y conversión de redes
      const codigo = tarro.get("hetna_ref")?.value
      if (codigo) {
        await fetch(`${BACKEND}/store/hetna-recomienda/vincular`, {
          method: "POST",
          headers: { Authorization: `Bearer ${dt.token}`, "x-publishable-api-key": LLAVE, "Content-Type": "application/json" },
          body: JSON.stringify({ codigo }),
          cache: "no-store",
        }).catch(() => undefined)
        tarro.delete("hetna_ref")
      }
      await eventoSocial("registro_cliente", red).catch(() => undefined)
    }
    await transferCart().catch(() => undefined)
    revalidateTag(await getCacheTag("customers"))
    return limpiar(NextResponse.redirect(new URL(volver, SITIO_PUBLICO)))
  } catch {
    return alLogin("No se pudo conectar con la red social. Intenta de nuevo.")
  }
}

// Entrada al panel de vendedor. El panel abre su propia sesión en su página
// /seller/entrar-red con el token (va en el "#": no llega a ningún servidor ni log).
async function regresoTaller(red: string, q: URLSearchParams, alLogin: (msg: string) => NextResponse): Promise<NextResponse> {
  try {
    const r = await fetch(`${BACKEND}/auth/member/${red}/callback?${q.toString()}`, { cache: "no-store" })
    const d = (await r.json().catch(() => ({}))) as { token?: string }
    if (!r.ok || !d.token) return alLogin("No se pudo comprobar tu cuenta de la red social. Intenta de nuevo.")

    const c = await fetch(`${BACKEND}/store/hetna-social/taller`, {
      method: "POST",
      headers: { Authorization: `Bearer ${d.token}`, "x-publishable-api-key": LLAVE, "Content-Type": "application/json" },
      body: "{}",
      cache: "no-store",
    })
    const dc = (await c.json().catch(() => ({}))) as { accion?: string; email?: string; first_name?: string; last_name?: string; message?: string }
    if (!c.ok) return alLogin(dc.message || "No se pudo terminar la entrada. Intenta de nuevo.")

    let token = d.token
    if (dc.accion === "vincular") {
      // El token debe traer el miembro recién unido
      const t = await fetch(`${BACKEND}/auth/token/refresh`, { method: "POST", headers: { Authorization: `Bearer ${d.token}` }, cache: "no-store" })
      const dt = (await t.json().catch(() => ({}))) as { token?: string }
      if (!t.ok || !dt.token) return alLogin("No se pudo abrir tu sesión. Intenta de nuevo.")
      token = dt.token
    }
    const h = new URLSearchParams({ t: token })
    if (dc.accion === "nueva") {
      h.set("n", "1")
      if (dc.email) h.set("e", dc.email)
      if (dc.first_name) h.set("fn", dc.first_name)
      if (dc.last_name) h.set("ln", dc.last_name)
    }
    return NextResponse.redirect(new URL(`${PANEL_TALLER}/entrar-red#${h.toString()}`, SITIO_PUBLICO))
  } catch {
    return alLogin("No se pudo conectar con la red social. Intenta de nuevo.")
  }
}
