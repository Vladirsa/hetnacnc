"use server"

// Solicitud de cotización general (opcionalmente para un taller).
// Llama a POST /store/solicitudes-taller desde el servidor.

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

// Lo que devuelve /api/solicitud-archivo por cada archivo subido.
export type ArchivoSubido = { clave: string; nombre: string; tamano: number }

export type SolicitudTallerInput = {
  taller?: string
  abierta?: boolean
  nombre?: string
  email: string
  telefono?: string
  whatsapp?: string
  ciudad?: string
  estado_mx?: string
  medidas?: string
  frecuencia?: string
  presupuesto?: string
  acepta_envio?: string
  necesidad?: string
  tiene_archivo?: string
  acabado?: string
  archivos?: ArchivoSubido[]
  servicio?: string
  material?: string
  cantidad?: string
  fecha?: string
  descripcion: string
  archivo_url?: string
  sitio_web?: string
}

export type SolicitudTallerResultado = { ok: true; folio?: string } | { ok: false; mensaje: string }

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
    const body = await res.json().catch(() => ({}))
    return { ok: true, folio: body.folio }
  } catch (e) {
    console.error("[cotizar] fallo llamando a solicitudes-taller", e)
    return { ok: false, mensaje: "No se pudo enviar tu solicitud. Intenta de nuevo." }
  }
}

// ---- Vista privada de propuestas (liga del correo) ----

export type Propuesta = {
  id: string
  precio: number
  dias: number
  vigencia_dias: number
  incluye_envio: boolean
  condiciones: string
  estado: string
  fecha: string
  destacado: boolean
  taller: { nombre: string; handle: string; estado: string; calificacion: number | null }
}

export type VistaSolicitud = {
  folio: string
  modo: string
  estado: string
  creada: string
  cierra_en: string | null
  trabajo: Record<string, string> & { archivos?: ArchivoSubido[] }
  propuesta_elegida: string | null
  pago_url: string | null
  pago_estado: string | null
  propuestas: Propuesta[]
  // Seguimiento (ver lib/seguimiento del API)
  etapa?: string
  etapa_nombre?: string
  etapa_explica?: string
  linea?: { etapa: string; nombre: string; explica: string; fecha: string | null; estado: "hecha" | "actual" | "pendiente" | "omitida" }[]
  historial?: { fecha: string; quien: string; nota: string }[]
  envio?: { paqueteria: string; guia: string } | null
  puede_confirmar?: boolean
}

const cabeceras = () => ({
  "Content-Type": "application/json",
  "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string,
})

export async function verSolicitud(token: string): Promise<VistaSolicitud | null> {
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/solicitudes-taller/${encodeURIComponent(token)}`, {
      headers: cabeceras(),
      cache: "no-store",
    })
    if (!res.ok) return null
    return (await res.json()) as VistaSolicitud
  } catch {
    return null
  }
}

export async function elegirPropuesta(
  token: string,
  propuestaId: string
): Promise<{ ok: true; pago_url: string | null } | { ok: false; mensaje: string }> {
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/solicitudes-taller/${encodeURIComponent(token)}/elegir`, {
      method: "POST",
      headers: cabeceras(),
      body: JSON.stringify({ propuesta_id: propuestaId }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, mensaje: body.message || "No se pudo elegir la propuesta." }
    return { ok: true, pago_url: body.pago_url || null }
  } catch {
    return { ok: false, mensaje: "No se pudo elegir la propuesta. Intenta de nuevo." }
  }
}

export async function confirmarRecibido(token: string): Promise<{ ok: true } | { ok: false; mensaje: string }> {
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/solicitudes-taller/${encodeURIComponent(token)}/recibido`, {
      method: "POST",
      headers: cabeceras(),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, mensaje: body.message || "No se pudo confirmar. Intenta de nuevo." }
    return { ok: true }
  } catch {
    return { ok: false, mensaje: "No se pudo confirmar. Intenta de nuevo." }
  }
}
