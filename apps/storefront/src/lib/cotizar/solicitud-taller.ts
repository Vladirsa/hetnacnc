"use server"

// Solicitud de cotización general (opcionalmente para un taller).
// Llama a POST /store/solicitudes-taller desde el servidor.

import { getAuthHeaders } from "@/lib/data/cookies"
import { eventoSocial } from "@/lib/hetna/social-evento"

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
  // Licitaciones 3.0 (Fase 1)
  empresa?: string
  modalidad?: string
  privacidad?: string
  difundir_redes?: boolean
  invitados?: string
  // Fase 3: sólo talleres verificados (Membresía Empresarial)
  solo_verificados?: boolean
  // Fase 2: suministro de material e insumos (lo cotizan proveedores)
  tipo?: "fabricacion" | "suministro"
  marca?: string
  unidad?: string
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
    await eventoSocial("solicitud", String(body.folio || ""))
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
  // Licitaciones 3.0 (Fase 2): propuesta formal
  moneda?: string
  materiales?: string
  operaciones?: string
  fecha_entrega?: string | null
  condiciones_pago?: string
  garantia?: string
  observaciones?: string
  adjuntos?: { nombre: string; tamano: number; url: string | null }[]
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
  // Problema reportado por el cliente (cancelar | retraso | defecto | otro):
  // HETNA retiene lo cobrado, media y decide.
  puede_reportar?: boolean
  cobro_directo?: boolean
  // Problema 4: quién bajó los archivos del cliente y su conservación
  archivos_protegidos?: {
    descargas: { fecha: string; archivo: string; quien: string; accion: string }[]
    borrados_en: string | null
    borrados: string[]
    puede_borrar: boolean
    dias_conservacion: number
  }
  disputa?: { tipo: string; nombre: string; desde: string | null } | null
  // Licitaciones 2.0
  cobro?: CobroSolicitud | null
  preguntas?: PreguntaSolicitud[]
  resena?: ({ calidad: number; tiempo: number; trato: number; comentario: string } & Partial<Record<"comunicacion" | "precio" | "capacidad" | "profesionalismo" | "posventa", number | null>>) | null
  // Fase 4 (Trust & Ranking)
  evaluaciones?: {
    recibida: ({ id: string; promedio: number; comentario: string | null; respuesta: string | null; fecha: string } & Record<string, unknown>) | null
    recibida_pendiente: boolean
    dias_publicacion: number
  } | null
  puede_resenar?: boolean
  // Licitaciones 3.0 (Fase 1)
  modalidad?: "publica" | "privada" | "restringida"
  privacidad?: Record<string, string>
  difundir_redes?: boolean
  accesos?: { seller_id: string; estado: "pendiente" | "aprobado" | "rechazado"; mensaje: string | null; created_at: string; taller: string; handle: string }[]
  invitados?: { seller_id: string; taller: string; handle: string }[]
  comparacion?: { mediana: number | null; notas: { id: string; notas: string[]; faltan: string[] }[] }
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
  propuestaId: string,
  compartirContacto = false
): Promise<{ ok: true; pago_url: string | null } | { ok: false; mensaje: string }> {
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/solicitudes-taller/${encodeURIComponent(token)}/elegir`, {
      method: "POST",
      headers: cabeceras(),
      body: JSON.stringify({ propuesta_id: propuestaId, compartir_contacto: compartirContacto }),
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

/** Borra para siempre los archivos de una solicitud cerrada o cancelada. */
export async function borrarArchivosSolicitud(token: string) {
  return postar(`/store/solicitudes-taller/${encodeURIComponent(token)}/borrar-archivos`, {}, "No se pudieron borrar. Intenta de nuevo.")
}

export type TipoProblema = "cancelar" | "retraso" | "defecto" | "otro"

/** Reporta un problema con el trabajo: abre una disputa que HETNA media. */
export async function reportarProblema(token: string, tipo: TipoProblema, detalle: string) {
  return postar(`/store/solicitudes-taller/${encodeURIComponent(token)}/problema`, { tipo, detalle }, "No se pudo enviar. Intenta de nuevo o escríbenos.")
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
  datos: Record<string, number | string>
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

// ---- Licitaciones 3.0 (Fase 1) ----

/** El cliente aprueba o rechaza que un taller vea sus planos. */
export async function decidirAcceso(token: string, sellerId: string, decision: "aprobar" | "rechazar") {
  return postar(`/store/solicitudes-taller/${encodeURIComponent(token)}/acceso`, { seller_id: sellerId, decision }, "No se pudo guardar tu decisión.")
}

/** El cliente invita talleres por el nombre de su tienda. */
export async function invitarTalleresSolicitud(token: string, talleres: string) {
  return postar(`/store/solicitudes-taller/${encodeURIComponent(token)}/invitar`, { talleres }, "No se pudo invitar a esos talleres.")
}

/** Resumen de las propuestas escrito por IA (no elige ganador). */
export async function analizarPropuestas(token: string): Promise<{ disponible: boolean; resumen: string | null; motivo?: string }> {
  const r = await postar(`/store/solicitudes-taller/${encodeURIComponent(token)}/analisis`, {}, "No se pudo preparar el resumen.")
  if (!r.ok) return { disponible: true, resumen: null, motivo: r.mensaje }
  return { disponible: !!r.body.disponible, resumen: r.body.resumen || null, motivo: r.body.motivo }
}

// ---- Licitaciones 3.0 (Fase 3) ----

/** ¿El cliente con sesión tiene Membresía Empresarial? */
export async function miMembresia(): Promise<{ miembro: boolean; sesion: boolean }> {
  const auth = await getAuthHeaders()
  if (!("authorization" in auth)) return { miembro: false, sesion: false }
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/mi-membresia`, { headers: { ...cabeceras(), ...auth }, cache: "no-store" })
    const body = await res.json().catch(() => ({}))
    return { miembro: !!body.miembro, sesion: !!body.sesion }
  } catch {
    return { miembro: false, sesion: true }
  }
}

// ---- Licitaciones 3.0 (Fase 4): conversación privada y SafeDeal ----

const rutaSol = (token: string, resto: string) => `/store/solicitudes-taller/${encodeURIComponent(token)}/${resto}`

async function leer(ruta: string): Promise<any | null> {
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}${ruta}`, { headers: cabeceras(), cache: "no-store" })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export type MensajeSol = { id: string; autor: string; texto: string; fecha: string; mio: boolean }

export async function verMensajes(token: string): Promise<MensajeSol[]> {
  return ((await leer(rutaSol(token, "mensajes")))?.mensajes || []) as MensajeSol[]
}

export async function mandarMensaje(token: string, texto: string) {
  return postar(rutaSol(token, "mensajes"), { texto }, "No se pudo enviar tu mensaje.")
}

export async function verAcuerdo(token: string): Promise<any | null> {
  return leer(rutaSol(token, "acuerdo"))
}

export async function accionAcuerdo(token: string, cuerpo: Record<string, unknown>) {
  return postar(rutaSol(token, "acuerdo"), cuerpo, "No se pudo completar la acción.")
}

/** El cliente responde o reclama la evaluación que el taller hizo de él (Fase 4). */
export async function accionEvaluacion(token: string, accion: "responder" | "reclamar", texto: string) {
  return postar(rutaSol(token, "evaluacion"), { accion, texto }, "No se pudo guardar.")
}
