"use server"

// Registro de un taller que quiere unirse a la red (POST /store/talleres-registro).
const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export type RegistroTallerInput = {
  /** Medición (no viajan al backend): aceptó cookies de publicidad y el id del evento del Pixel */
  rastreo?: boolean
  evento_id?: string
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
  entrada: RegistroTallerInput
): Promise<{ ok: true; panel: string } | { ok: false; mensaje: string }> {
  const { rastreo, evento_id, ...input } = entrada
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
    if (rastreo && evento_id && /^reg_[\w-]{6,40}$/.test(evento_id)) {
      const { reportarLeadMeta } = await import("@/lib/analytics/meta-lead")
      await reportarLeadMeta({ evento: "CompleteRegistration", eventId: evento_id, contenido: "Registro de taller", email: input.email, telefono: input.whatsapp, ciudad: input.ciudad, estado: input.estado_mx })
    }
    return { ok: true, panel: body.panel || "/seller" }
  } catch {
    return { ok: false, mensaje: "No pudimos guardar tu registro. Intenta de nuevo." }
  }
}
