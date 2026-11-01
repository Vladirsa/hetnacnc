"use server"

// El comprador confirma que ya recibió su pedido (api/store/hetna-pedidos/:id/recibido).
// Desde ese momento corren los días para pagarle al taller.
import { getAuthHeaders } from "@/lib/data/cookies"

const API = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export async function confirmarRecibido(orderId: string): Promise<{ ok: boolean; mensaje: string }> {
  if (!/^order_[A-Za-z0-9]+$/.test(orderId)) return { ok: false, mensaje: "Pedido inválido." }
  const auth = (await getAuthHeaders()) as { authorization?: string }
  if (!auth.authorization) return { ok: false, mensaje: "Inicia sesión de nuevo." }
  try {
    const r = await fetch(`${API}/store/hetna-pedidos/${orderId}/recibido`, {
      method: "POST",
      headers: { "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string, ...auth },
      cache: "no-store",
    })
    const j = (await r.json().catch(() => ({}))) as { mensaje?: string; message?: string }
    return r.ok ? { ok: true, mensaje: j.mensaje || "¡Gracias por confirmar!" } : { ok: false, mensaje: j.message || "No se pudo confirmar." }
  } catch {
    return { ok: false, mensaje: "No se pudo conectar. Intenta de nuevo." }
  }
}
