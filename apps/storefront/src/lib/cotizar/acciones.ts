"use server"

// Funnel público de cotización rápida (landing pages /cotizar/*): llama al
// backend de Medusa (POST /store/quote-leads), que calcula el estimado con
// el motor real del Cotizador CNC y avisa por correo/WhatsApp. Server Action
// para no exponer la URL interna del backend ni la clave publicable al
// navegador más de lo necesario.

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export type CotizarLeadInput = {
  servicio: "laser_co2" | "router"
  material: string
  ancho: number
  largo: number
  cantidad: number
  piezas_mes_estimado?: number
  email: string
  nombre?: string
  telefono?: string
  ciudad?: string
}

export type CotizarLeadResultado =
  | { ok: true; estimado: { minimo: number; recomendado: number; maximo: number }; volumenAlto: boolean; whatsappUrl: string }
  | { ok: false; mensaje: string }

export async function cotizarLead(input: CotizarLeadInput): Promise<CotizarLeadResultado> {
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
