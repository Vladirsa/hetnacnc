"use server"

// Funnel público de cotización rápida (landing pages /cotizar/*): llama al
// backend de Medusa (POST /store/quote-leads), que calcula el estimado con
// el motor real del Cotizador CNC y avisa por correo/WhatsApp. Server Action
// para no exponer la URL interna del backend ni la clave publicable al
// navegador más de lo necesario.

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export type CotizarLeadInput = {
  /** Medición: aceptó cookies de publicidad y el id del evento del Pixel (no viajan al backend) */
  rastreo?: boolean
  evento_id?: string
  servicio: "laser_co2" | "router" | "plasma" | "impresion_3d"
  material: string
  ancho: number
  largo: number
  alto?: number
  calibre?: string
  calidad?: string
  cantidad: number
  piezas_mes_estimado?: number
  // Del archivo del cliente, ya a la escala de las medidas capturadas
  corte_mm?: number
  perforaciones?: number
  volumen_cm3?: number
  // Lámina doblada desde STEP: dobleces por pieza (se suma la tarifa de referencia)
  dobleces?: number
  // Acabados elegidos (claves): se suma su precio de referencia por pieza
  acabados?: string[]
  email: string
  nombre?: string
  telefono?: string
  ciudad?: string
}

export type CotizarLeadResultado =
  | { ok: true; estimado: { minimo: number; recomendado: number; maximo: number }; volumenAlto: boolean; whatsappUrl: string }
  | { ok: false; mensaje: string }

export async function cotizarLead(entrada: CotizarLeadInput): Promise<CotizarLeadResultado> {
  const { rastreo, evento_id, ...input } = entrada
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/quote-leads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string,
      },
      body: JSON.stringify(input),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return { ok: false, mensaje: body.message || "No se pudo calcular el estimado. Intenta de nuevo." }
    }
    const data = await res.json()
    if (rastreo && evento_id && /^est_[\w-]{6,40}$/.test(evento_id)) {
      const { reportarLeadMeta } = await import("@/lib/analytics/meta-lead")
      await reportarLeadMeta({ eventId: evento_id, contenido: "Estimado al instante", email: input.email })
    }
    return {
      ok: true,
      estimado: data.estimado,
      volumenAlto: Boolean(data.volumen_alto),
      whatsappUrl: data.whatsapp_url,
    }
  } catch (e) {
    console.error("[cotizar] fallo llamando a quote-leads", e)
    return { ok: false, mensaje: "No se pudo calcular el estimado. Intenta de nuevo." }
  }
}

// ── Precio en vivo (estrategia 1.2) ──────────────────────────────────────
// Cómo se forma el precio y cuánto baja por volumen, mientras el cliente
// mueve material, medidas o cantidad. No pide correo ni registra nada.
export type PrecioEnVivo = {
  minimo: number
  recomendado: number
  maximo: number
  iva: number
  total: number
  calculo: string[]
  aplica_minimo: boolean
  por_volumen: { cantidad: number; unitario: number; total: number }[]
}

export async function precioEnVivo(
  input: Omit<CotizarLeadInput, "email" | "nombre" | "telefono" | "ciudad" | "piezas_mes_estimado">
): Promise<PrecioEnVivo | null> {
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/precio-instantaneo`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string,
      },
      body: JSON.stringify(input),
      cache: "no-store",
    })
    if (!res.ok) return null
    return (await res.json()) as PrecioEnVivo
  } catch {
    return null
  }
}

// ── Solicitud desde foto o boceto (estrategia 2.2) ────────────────────────
// La IA lee la imagen y regresa los campos de la solicitud para que el cliente
// los revise. La imagen ya viene reducida desde el navegador (≤ 1400 px).
export type LecturaFoto = {
  es_pieza: boolean
  pieza: string
  descripcion: string
  proceso: string
  material: string | null
  medidas: string | null
  medidas_aproximadas: boolean
  cantidad: string | null
  acabado: string | null
  preguntas: string[]
  confianza: "alta" | "media" | "baja"
}

export async function leerFotoSolicitud(input: { imagen: string; medio: string; texto?: string }): Promise<{ ok: true; lectura: LecturaFoto } | { ok: false; mensaje: string }> {
  try {
    const { headers } = await import("next/headers")
    const h = await headers()
    const ip = h.get("cf-connecting-ip") || h.get("x-real-ip") || (h.get("x-forwarded-for") || "").split(",")[0] || ""
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/solicitud-foto`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string,
        ...(ip ? { "x-real-ip": ip } : {}),
      },
      body: JSON.stringify(input),
      cache: "no-store",
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, mensaje: d.message || "No se pudo leer la foto." }
    return { ok: true, lectura: d as LecturaFoto }
  } catch {
    return { ok: false, mensaje: "No se pudo leer la foto. Llena la solicitud a mano." }
  }
}

// ── Acabados con precio de referencia (estrategia 2.1) ───────────────────
export type AcabadoReferencia = { clave: string; nombre: string; tarifa: number; unidad: "pieza" | "doblez"; talleres: number }

export async function acabadosReferencia(): Promise<AcabadoReferencia[]> {
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/acabados-referencia`, {
      headers: { "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string },
      next: { revalidate: 600 },
    })
    if (!res.ok) return []
    return (((await res.json()) as { acabados?: AcabadoReferencia[] }).acabados || []).filter((a) => a.unidad === "pieza")
  } catch {
    return []
  }
}

// ── "Mándame este estimado por correo" (cotizador de /cotizar) ───────────
export type MandarEstimadoInput = {
  email: string
  acepta: boolean
  sitio_web?: string
  servicio: string
  material: string
  largo_mm: number
  ancho_mm: number
  cantidad: number
  estimado_min: number
  estimado_max: number
  rastreo?: boolean
  evento_id?: string
}

export async function mandarEstimadoCorreo(entrada: MandarEstimadoInput): Promise<{ ok: true } | { ok: false; mensaje: string }> {
  const { rastreo, evento_id, ...input } = entrada
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/estimado-correo`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string },
      body: JSON.stringify(input),
    })
    if (!res.ok) {
      const b = await res.json().catch(() => ({}))
      return { ok: false, mensaje: b.message || "No pudimos mandar el correo. Intenta de nuevo." }
    }
    if (rastreo && evento_id && /^est_[\w-]{6,40}$/.test(evento_id)) {
      const { reportarLeadMeta } = await import("@/lib/analytics/meta-lead")
      await reportarLeadMeta({ eventId: evento_id, contenido: "Estimado por correo", email: input.email })
    }
    return { ok: true }
  } catch {
    return { ok: false, mensaje: "No pudimos mandar el correo. Intenta de nuevo." }
  }
}
