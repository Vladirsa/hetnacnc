// Acceso del administrador al panel de publicidad (solo servidor).
// Usa el MISMO usuario y contraseña del /dashboard (administrador de Medusa).
// No guardamos contraseñas: pedimos un token a Medusa y lo dejamos en una cookie privada (httpOnly).

import { cookies } from "next/headers"

export const COOKIE_PUB = "hetna_pub"

export const urlBackend = () =>
  (process.env.MEDUSA_BACKEND_URL || process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000").replace(
    /\/$/,
    ""
  )

async function tokenValido(token: string): Promise<boolean> {
  try {
    const r = await fetch(`${urlBackend()}/admin/users/me`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    return r.ok
  } catch {
    return false
  }
}

/** Devuelve el token si quien visita es un administrador válido; si no, null. */
export async function tokenAdmin(): Promise<string | null> {
  const t = (await cookies()).get(COOKIE_PUB)?.value
  if (!t) return null
  return (await tokenValido(t)) ? t : null
}

export const esAdmin = async () => Boolean(await tokenAdmin())

/** Inicia sesión contra Medusa y guarda la cookie. */
export async function entrar(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  if (!email || !password) return { ok: false, error: "Escribe tu correo y contraseña." }
  try {
    const r = await fetch(`${urlBackend()}/auth/user/emailpass`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    })
    if (!r.ok) return { ok: false, error: "Correo o contraseña incorrectos." }
    const { token } = (await r.json()) as { token?: string }
    if (!token || !(await tokenValido(token))) return { ok: false, error: "Esta cuenta no es de administrador." }
    ;(await cookies()).set(COOKIE_PUB, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8, // 8 horas
    })
    return { ok: true }
  } catch {
    return { ok: false, error: "No se pudo conectar con el servidor. Intenta de nuevo." }
  }
}

export async function salir() {
  ;(await cookies()).delete(COOKIE_PUB)
}
