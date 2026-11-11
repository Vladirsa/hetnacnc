// Liga pública de una cotización del Cotizador (hetnacnc.com/c/<token>),
// contra /api/cotizacion-liga/<token> del backend (lib/cotizacion-liga.ts).

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export type CotizacionPublica = {
  folio: string
  estado: string
  vencida: boolean
  creada: string
  vigencia_dias: number | null
  taller: { nombre: string; telefono: string | null; correo: string | null; logo: string | null; sitio: string | null; direccion: string | null; ref?: string | null }
  cliente: { nombre: string; empresa: string | null } | null
  items: { nombre: string; sku: string | null; cantidad: number; precio: number; descuento_pct: number; subtotal: number; notas: string | null }[]
  subtotal: number
  descuento_pct: number
  descuento_fijo: number
  iva_pct: number
  iva: number
  envio: number
  total: number
  metodo_pago: string | null
  condicion_entrega: string | null
  fecha_entrega: string | null
  dias_habiles: number | null
  notas: string | null
  pdf: string | null
  aceptada: { en: string; por: string | null } | null
  moneda?: "MXN" | "USD" | "COP" | "PEN" | "CLP"
  anticipo: {
    monto: number
    pagado: number
    estado: "pendiente" | "pagado" | "sin_anticipo"
    se_puede_pagar: boolean
    // Con qué se puede pagar (Mercado Pago sólo en pesos; PayPal en pesos o dólares)
    metodos?: { mercadopago: boolean; paypal: boolean }
    /** COP/PEN/CLP: PayPal cobra en dólares al tipo de cambio del día */
    paypal_en_dolares?: boolean
  }
  pagos: { monto: number; metodo: string | null; fecha: string }[]
  // Cuando ya es pedido: etapas, avances, fotos y guía de envío
  pedido: {
    folio: string
    estado: string
    fecha_estimada: string | null
    entregado: string | null
    avances: { etapa: string; nota: string | null; fecha: string }[]
    fotos: { url: string; etapa: string | null; fecha: string }[]
    envio: { paqueteria: string | null; guia: string; rastreo: string | null } | null
  } | null
}

export async function leerCotizacionPublica(token: string): Promise<CotizacionPublica | null> {
  if (!/^[A-Za-z0-9]{16,40}$/.test(token)) return null
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/api/cotizacion-liga/${token}`, { cache: "no-store" })
    if (!res.ok) return null
    return (await res.json()) as CotizacionPublica
  } catch {
    return null
  }
}
