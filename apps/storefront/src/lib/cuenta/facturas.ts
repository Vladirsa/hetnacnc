"use server"

// Datos fiscales del cliente y facturas (CFDI) de sus pedidos. Cada taller
// emite el CFDI de sus ventas; aquí se piden y se descargan (ver
// packages/api/src/lib/facturas.ts).
import { getAuthHeaders } from "@/lib/data/cookies"

const API = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
const PK = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string

async function llamar(ruta: string, init: RequestInit = {}) {
  const auth = (await getAuthHeaders()) as Record<string, string>
  const res = await fetch(`${API}${ruta}`, {
    ...init,
    headers: { "Content-Type": "application/json", "x-publishable-api-key": PK, ...auth, ...(init.headers || {}) },
    cache: "no-store",
  })
  const body = await res.json().catch(() => ({}))
  return { res, body }
}

export type DatosFiscales = { rfc: string; razon_social: string; regimen: string; cp: string; uso_cfdi: string; correo: string }
export type Factura = {
  id: string
  order_id: string
  display_id: number | null
  estado: "solicitada" | "emitida" | "rechazada"
  nota: string | null
  tiene_pdf: boolean
  tiene_xml: boolean
  emitida_at: string | null
  created_at: string
}

export async function leerFiscal(): Promise<{ fiscal: DatosFiscales | null; regimenes: Record<string, string>; usos: Record<string, string> } | null> {
  try {
    const { res, body } = await llamar("/store/customers/me/fiscal")
    return res.ok ? body : null
  } catch {
    return null
  }
}

export async function guardarFiscal(d: DatosFiscales): Promise<{ ok: true } | { ok: false; mensaje: string }> {
  try {
    const { res, body } = await llamar("/store/customers/me/fiscal", { method: "POST", body: JSON.stringify(d) })
    return res.ok ? { ok: true } : { ok: false, mensaje: body.message || "No pudimos guardar tus datos fiscales." }
  } catch {
    return { ok: false, mensaje: "No pudimos guardar tus datos fiscales. Intenta de nuevo." }
  }
}

export async function misFacturas(): Promise<Factura[]> {
  try {
    const { res, body } = await llamar("/store/customers/me/facturas")
    return res.ok ? body.facturas || [] : []
  } catch {
    return []
  }
}

export async function pedirFactura(orderId: string): Promise<{ ok: true } | { ok: false; mensaje: string }> {
  try {
    const { res, body } = await llamar("/store/customers/me/facturas", { method: "POST", body: JSON.stringify({ order_id: orderId }) })
    return res.ok ? { ok: true } : { ok: false, mensaje: body.message || "No pudimos pedir la factura." }
  } catch {
    return { ok: false, mensaje: "No pudimos pedir la factura. Intenta de nuevo." }
  }
}

export async function ligaFactura(id: string, tipo: "pdf" | "xml"): Promise<string | null> {
  try {
    const { res, body } = await llamar(`/store/customers/me/facturas/${encodeURIComponent(id)}/archivo?tipo=${tipo}`)
    return res.ok ? body.url : null
  } catch {
    return null
  }
}
