"use server"

// Notificaciones al celular del cliente (packages/api/src/lib/push.ts). El
// navegador no tiene el token de la sesión (va en una cookie httpOnly), así que
// estas acciones lo agregan y hablan con la API.
import { getAuthHeaders } from "./cookies"

const API = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
const PK = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string

type Suscripcion = { endpoint: string; keys: { p256dh: string; auth: string } }

export async function llavePush(): Promise<string | null> {
  try {
    const r = await fetch(`${API}/store/hetna-push`, { headers: { "x-publishable-api-key": PK }, next: { revalidate: 3600 } })
    if (!r.ok) return null
    return ((await r.json()) as { llave?: string | null }).llave || null
  } catch {
    return null
  }
}

export async function activarPushCliente(suscripcion: Suscripcion, dispositivo?: string): Promise<{ ok: boolean; mensaje?: string }> {
  const auth = (await getAuthHeaders().catch(() => ({}))) as { authorization?: string }
  if (!auth.authorization) return { ok: false, mensaje: "Inicia sesión para activar los avisos." }
  try {
    const r = await fetch(`${API}/store/hetna-push`, {
      method: "POST",
      headers: { "x-publishable-api-key": PK, "content-type": "application/json", ...auth },
      body: JSON.stringify({ suscripcion, dispositivo }),
      cache: "no-store",
    })
    const j = (await r.json().catch(() => ({}))) as { message?: string }
    return r.ok ? { ok: true } : { ok: false, mensaje: j.message || "No se pudieron activar los avisos." }
  } catch {
    return { ok: false, mensaje: "No se pudieron activar los avisos." }
  }
}

export async function desactivarPushCliente(endpoint: string): Promise<{ ok: boolean }> {
  const auth = (await getAuthHeaders().catch(() => ({}))) as { authorization?: string }
  if (!auth.authorization) return { ok: false }
  try {
    const r = await fetch(`${API}/store/hetna-push`, {
      method: "DELETE",
      headers: { "x-publishable-api-key": PK, "content-type": "application/json", ...auth },
      body: JSON.stringify({ endpoint }),
      cache: "no-store",
    })
    return { ok: r.ok }
  } catch {
    return { ok: false }
  }
}
