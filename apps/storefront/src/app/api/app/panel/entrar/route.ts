// HETNA Panel: inicio de sesión con cuenta de administrador de Medusa.
// POST { email, password } → pone la cookie httpOnly y regresa { ok }.
// Va bajo /api/app/ porque nginx manda ese prefijo a la tienda (Next).
import { NextResponse } from "next/server"

import { ipDe } from "@/lib/seguridad/ip-cliente"
import { COOKIE_PANEL, entrarAdmin } from "@/lib/panel/sesion"

const intentos = new Map<string, { n: number; hasta: number }>()

export async function POST(req: Request) {
  const ip = ipDe(req.headers)
  const reg = intentos.get(ip)
  if (reg && reg.n >= 8 && Date.now() < reg.hasta) {
    return NextResponse.json({ message: "Demasiados intentos. Espera 15 minutos." }, { status: 429 })
  }
  let email = "", password = ""
  try {
    const b = (await req.json()) as { email?: string; password?: string }
    email = String(b.email || "").trim().toLowerCase()
    password = String(b.password || "")
  } catch {}
  if (!email || !password) return NextResponse.json({ message: "Escribe correo y contraseña." }, { status: 400 })
  const token = await entrarAdmin(email, password)
  if (!token) {
    const r = intentos.get(ip) || { n: 0, hasta: 0 }
    intentos.set(ip, { n: r.n + 1, hasta: Date.now() + 15 * 60 * 1000 })
    return NextResponse.json({ message: "Correo o contraseña incorrectos." }, { status: 401 })
  }
  intentos.delete(ip)
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_PANEL, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/",
    maxAge: 60 * 60 * 24 * 30,
  })
  return res
}
