"use server"

// Solicitud de cotización general (opcionalmente para un taller).
// Llama a POST /store/solicitudes-taller desde el servidor.

import { getAuthHeaders } from "@/lib/data/cookies"

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
  cp?: string
  medidas?: string
  frecuencia?: string
  presupuesto?: string
  acepta_envio?: string
  necesidad?: string
  tiene_archivo?: string
  acabado?: string
  tolerancia?: string
  medidas_archivo?: string
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
        // Con sesión, la solicitud queda en "Mis solicitudes"
        ...(await getAuthHeaders()),
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
  // Anticipo que pide el taller si le pagas directo (null = pago completo)
  anticipo_pct?: number | null
  taller: { nombre: string; handle: string; estado: string; calificacion: number | null; resenas?: number; verificado?: boolean }
}

export type CobroSolicitud = {
  modo: "taller" | "hetna"
  metodos: ("mercadopago" | "paypal")[]
  total: number
  pagado: number
  saldo: number
  anticipo_pct: number
  siguiente: { tipo: "anticipo" | "resto" | "total"; monto: number } | null
  comision_pct: number
}

export type PreguntaSolicitud = { id: string; pregunta: string; respuesta: string | null; respondida_en: string | null; fecha: string }

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
  // Licitaciones 2.0
  cobro?: CobroSolicitud | null
  preguntas?: PreguntaSolicitud[]
  resena?: { calidad: number; tiempo: number; trato: number; comentario: string } | null
  puede_resenar?: boolean
}

const cabeceras = () => ({
  "Content-Type": "application/json",
  "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string,
})

export async function verSolicitud(token: string): Promise<VistaSolicitud | null> {
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/solicitudes-taller/${encodeURIComponent(token)}`, {
      // Con sesión iniciada, la solicitud se guarda en "Mis solicitudes"
      headers: { ...cabeceras(), ...(await getAuthHeaders()) },
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

// ---- Licitaciones 2.0 ----

async function postar(ruta: string, cuerpo: unknown, porDefecto: string): Promise<{ ok: true; body: any } | { ok: false; mensaje: string }> {
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}${ruta}`, { method: "POST", headers: cabeceras(), body: JSON.stringify(cuerpo ?? {}) })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, mensaje: body.message || porDefecto }
    return { ok: true, body }
  } catch {
    return { ok: false, mensaje: porDefecto }
  }
}

/** Liga del siguiente pago (anticipo, resto o total) con Mercado Pago o PayPal. */
export async function pagarSolicitud(
  token: string,
  proveedor: "mercadopago" | "paypal"
): Promise<{ ok: true; url: string } | { ok: false; mensaje: string }> {
  const r = await postar(`/store/solicitudes-taller/${encodeURIComponent(token)}/pagar`, { proveedor }, "No se pudo crear la liga de pago. Intenta de nuevo.")
  return r.ok ? { ok: true, url: r.body.url } : r
}

export async function responderPregunta(token: string, preguntaId: string, respuesta: string): Promise<{ ok: true } | { ok: false; mensaje: string }> {
  const r = await postar(
    `/store/solicitudes-taller/${encodeURIComponent(token)}/preguntas/${encodeURIComponent(preguntaId)}`,
    { respuesta },
    "No se pudo guardar tu respuesta."
  )
  return r.ok ? { ok: true } : r
}

export async function enviarResena(
  token: string,
  datos: { calidad: number; tiempo: number; trato: number; comentario: string }
): Promise<{ ok: true } | { ok: false; mensaje: string }> {
  const r = await postar(`/store/solicitudes-taller/${encodeURIComponent(token)}/resena`, datos, "No se pudo guardar tu calificación.")
  return r.ok ? { ok: true } : r
}

export type MiSolicitud = {
  folio: string
  liga: string
  etapa: string
  etapa_nombre: string
  resumen: string
  propuestas: number
  taller: { nombre: string; precio: number } | null
  falta_pago: boolean
  creada: string
}

/** Solicitudes del cliente con sesión. `sesion: false` si no ha entrado. */
export async function misSolicitudes(): Promise<{ sesion: boolean; solicitudes: MiSolicitud[] }> {
  const auth = await getAuthHeaders()
  if (!("authorization" in auth)) return { sesion: false, solicitudes: [] }
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/mis-solicitudes`, { headers: { ...cabeceras(), ...auth }, cache: "no-store" })
    if (res.status === 401) return { sesion: false, solicitudes: [] }
    const body = await res.json().catch(() => ({}))
    return { sesion: true, solicitudes: (body.solicitudes || []) as MiSolicitud[] }
  } catch {
    return { sesion: true, solicitudes: [] }
  }
}
