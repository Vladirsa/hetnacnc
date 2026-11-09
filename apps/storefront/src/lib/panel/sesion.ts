// HETNA Panel: sesión con las cuentas de administrador de Medusa.
// El token de admin se guarda en una cookie httpOnly; todas las lecturas van
// del servidor de Next al API de Medusa (el navegador nunca ve el token).

import { cookies } from "next/headers"

import { type Rol, rolDe } from "./roles"

const BACKEND = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
export const COOKIE_PANEL = "hetna_panel"

export type UsuarioPanel = { id: string; email: string; nombre: string; rol: Rol }

export async function tokenPanel(): Promise<string | null> {
  const c = await cookies()
  return c.get(COOKIE_PANEL)?.value || null
}

/** Llama al API de administrador con el token de la sesión. */
export async function adminFetch<T = unknown>(path: string, init?: RequestInit & { token?: string }): Promise<T> {
  const token = init?.token || (await tokenPanel())
  if (!token) throw new Error("sin_sesion")
  const res = await fetch(`${BACKEND}${path}`, {
    ...init,
    headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...(init?.headers || {}) },
    cache: "no-store",
  })
  if (res.status === 401) throw new Error("sin_sesion")
  if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => "")}`.slice(0, 200))
  return (await res.json()) as T
}

/** Inicia sesión con correo y contraseña de administrador; regresa el token. */
export async function entrarAdmin(email: string, password: string): Promise<string | null> {
  const res = await fetch(`${BACKEND}/auth/user/emailpass`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  })
  if (!res.ok) return null
  const j = (await res.json().catch(() => ({}))) as { token?: string }
  return j.token || null
}

/** Quién está en el panel (o null si no hay sesión válida). */
export async function usuarioPanel(): Promise<UsuarioPanel | null> {
  try {
    const me = await adminFetch<{ user: { id: string; email: string; first_name?: string; last_name?: string; metadata?: Record<string, unknown>; created_at?: string } }>("/admin/users/me")
    const u = me.user
    let arranque = false
    if (!u.metadata?.panel_rol) {
      // Arranque: mientras NINGÚN administrador tenga rol del panel, todos los
      // administradores entran como dueño (sólo el dueño crea administradores).
      // En cuanto se asigna el primer rol en Equipo, manda lo asignado.
      try {
        const lista = await adminFetch<{ users: { id: string; metadata?: Record<string, unknown> }[] }>("/admin/users?limit=100")
        arranque = !lista.users.some((x) => x.metadata?.panel_rol)
      } catch {}
      const duenos = (process.env.PANEL_DUENOS || "").toLowerCase().split(",").map((x) => x.trim()).filter(Boolean)
      if (duenos.includes(u.email.toLowerCase())) arranque = true
    }
    return { id: u.id, email: u.email, nombre: [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email, rol: rolDe(u.metadata, arranque) }
  } catch {
    return null
  }
}

/** Para cada página: exige sesión y permiso; si no, redirige. */
export async function exigirPagina(locale: string, pagina: string): Promise<UsuarioPanel> {
  const { redirect } = await import("next/navigation")
  const { puede } = await import("./roles")
  const u = await usuarioPanel()
  if (!u) redirect(`/${locale}/panel/entrar`)
  if (!puede(u!.rol, pagina)) redirect(`/${locale}/panel`)
  return u!
}

export const pesos = (n: number, moneda = "MXN") =>
  Number(n || 0).toLocaleString("es-MX", { style: "currency", currency: moneda, maximumFractionDigits: 0 })
export const fechaCorta = (iso?: string | null) => {
  if (!iso) return ""
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
}
export const hace = (iso?: string | null) => {
  if (!iso) return ""
  const ms = Date.now() - new Date(iso).getTime()
  const h = Math.floor(ms / 36e5)
  if (h < 1) return "hace minutos"
  if (h < 48) return `hace ${h} h`
  return `hace ${Math.floor(h / 24)} días`
}
