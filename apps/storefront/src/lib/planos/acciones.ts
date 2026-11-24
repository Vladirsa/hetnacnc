"use server"

// "Bájalo gratis con tu correo" de la Biblioteca de planos: llama al backend
// (POST /store/planos-correo), que guarda el pedido y manda la liga por correo.
const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export type PedidoPlanoInput = { email: string; plano: string; acepta: boolean; promos: boolean; sitio_web?: string }

export async function pedirPlanoCorreo(input: PedidoPlanoInput): Promise<{ ok: true } | { ok: false; mensaje: string }> {
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/planos-correo`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string },
      body: JSON.stringify(input),
    })
    if (!res.ok) {
      const b = await res.json().catch(() => ({}))
      return { ok: false, mensaje: b.message || "No pudimos registrar tu correo. Intenta de nuevo." }
    }
    return { ok: true }
  } catch {
    return { ok: false, mensaje: "No pudimos registrar tu correo. Intenta de nuevo." }
  }
}
