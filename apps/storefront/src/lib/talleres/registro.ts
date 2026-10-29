"use server"

// Registro de un taller que quiere unirse a la red (POST /store/talleres-registro).
const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export type RegistroTallerInput = {
  nombre_taller: string
  contacto?: string
  email: string
  whatsapp: string
  ciudad?: string
  estado_mx?: string
  servicios: string[]
  materiales: string[]
  maquinas?: string
  capacidad?: string
  portafolio?: string
  comentarios?: string
  fotos: { clave: string; nombre: string }[]
  sitio_web?: string
}

export async function registrarTaller(
  input: RegistroTallerInput
): Promise<{ ok: true; panel: string } | { ok: false; mensaje: string }> {
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/talleres-registro`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string,
      },
      body: JSON.stringify(input),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, mensaje: body.message || "No pudimos guardar tu registro. Intenta de nuevo." }
    return { ok: true, panel: body.panel || "/seller" }
  } catch {
    return { ok: false, mensaje: "No pudimos guardar tu registro. Intenta de nuevo." }
  }
}
