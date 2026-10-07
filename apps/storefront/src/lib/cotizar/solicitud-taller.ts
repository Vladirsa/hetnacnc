"use server"

// Solicitud de cotización general (opcionalmente para un taller).
// Llama a POST /store/solicitudes-taller desde el servidor.

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export type SolicitudTallerInput = {
  taller?: string
  nombre?: string
  email: string
  telefono?: string
  ciudad?: string
  servicio?: string
  material?: string
  cantidad?: string
  fecha?: string
  descripcion: string
  archivo_url?: string
  sitio_web?: string
}

export type SolicitudTallerResultado = { ok: true } | { ok: false; mensaje: string }

export async function enviarSolicitudTaller(
  input: SolicitudTallerInput
): Promise<SolicitudTallerResultado> {
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/solicitudes-taller`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string,
      },
      body: JSON.stringify(input),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return { ok: false, mensaje: body.message || "No se pudo enviar tu solicitud. Intenta de nuevo." }
    }
    return { ok: true }
  } catch (e) {
    console.error("[cotizar] fallo llamando a solicitudes-taller", e)
    return { ok: false, mensaje: "No se pudo enviar tu solicitud. Intenta de nuevo." }
  }
}
