// GET /api/auth/social/<red>?volver=/mx/...  Empieza la entrada con Google, Facebook o LinkedIn:
// pide al backend la dirección de la red, guarda en cookies el "state" (para comprobar al
// regreso que es el mismo navegador) y a dónde volver, y manda al usuario a la red.
// Es una liga normal (no un formulario): así la política de seguridad no bloquea el viaje.
import { NextRequest, NextResponse } from "next/server"

import { COOKIE_ESTADO, COOKIE_VOLVER, SITIO_PUBLICO, esRedSocial } from "@/lib/auth/social"
import { destinoSeguro } from "@/lib/seguridad/destino-seguro"

const BACKEND = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export async function GET(req: NextRequest, { params }: { params: Promise<{ red: string }> }) {
  const { red } = await params
  const volver = destinoSeguro(req.nextUrl.searchParams.get("volver"), "/user")
  const alLogin = (msg: string) => NextResponse.redirect(new URL(`/login?social=${encodeURIComponent(msg)}`, SITIO_PUBLICO))
  if (!esRedSocial(red)) return alLogin("Esa forma de entrar no existe.")
  try {
    const r = await fetch(`${BACKEND}/auth/customer/${red}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", cache: "no-store" })
    const d = (await r.json().catch(() => ({}))) as { location?: string; message?: string }
    if (!r.ok || !d.location) return alLogin("Esta forma de entrar no está disponible por ahora. Usa tu correo.")
    const estado = new URL(d.location).searchParams.get("state") || ""
    const res = NextResponse.redirect(d.location)
    const opciones = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", maxAge: 600, path: "/" }
    res.cookies.set(COOKIE_ESTADO, estado, opciones)
    res.cookies.set(COOKIE_VOLVER, volver, opciones)
    return res
  } catch {
    return alLogin("No se pudo conectar con la red social. Intenta de nuevo.")
  }
}
