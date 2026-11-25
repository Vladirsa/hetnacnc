"use server"

// "Liberar pago" y reclamos de una compra (packages/api/src/lib/reclamos-pedido.ts).
// Las fotos y videos se suben por /api/pedido-evidencia/:id (una server action
// corta el cuerpo en 1 MB); aquí sólo viajan los ids.
import { revalidatePath } from "next/cache"

import { getAuthHeaders } from "@/lib/data/cookies"

const API = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
const ORDER = /^order_[A-Za-z0-9]+$/

export type MotivoReclamo = { id: string; nombre: string }
export type Evidencia = { id: string; autor: "cliente" | "taller"; mime: string; tamano: number; creado: string }
export type ReclamoVista = {
  id: string
  folio: string
  motivo: string
  motivo_nombre: string
  detalle: string
  estado: "abierto" | "respondido" | "resuelto"
  estado_nombre: string
  creado: string
  responder_antes: string | null
  respuesta_taller: string | null
  taller_no_respondio: boolean
  decision: "liberar" | "reembolso_total" | "reembolso_parcial" | null
  decision_nombre: string | null
  monto_reembolso: number | null
  guia_paga: "taller" | "cliente" | null
  decision_nota: string | null
  evidencias: Evidencia[]
}
export type EstadoEntrega = {
  order_id: string
  fisico: boolean
  saldo_estado: string | null
  entregado_en: string | null
  se_libera_en: string | null
  aceptado_en: string | null
  devolucion_hasta: string | null
  dias_liberacion: number
  puede_liberar: boolean
  motivos: MotivoReclamo[]
  reclamo: ReclamoVista | null
}

async function cabeceras() {
  const auth = (await getAuthHeaders()) as { authorization?: string }
  if (!auth.authorization) return null
  return { "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string, ...auth }
}

export async function estadoEntrega(orderId: string): Promise<EstadoEntrega | null> {
  if (!ORDER.test(orderId)) return null
  const h = await cabeceras()
  if (!h) return null
  try {
    const r = await fetch(`${API}/store/hetna-pedidos/${orderId}/reclamo`, { headers: h, cache: "no-store" })
    return r.ok ? ((await r.json()) as EstadoEntrega) : null
  } catch {
    return null
  }
}

export async function liberarPago(orderId: string): Promise<{ ok: boolean; mensaje: string }> {
  if (!ORDER.test(orderId)) return { ok: false, mensaje: "Pedido inválido." }
  const h = await cabeceras()
  if (!h) return { ok: false, mensaje: "Inicia sesión de nuevo." }
  try {
    const r = await fetch(`${API}/store/hetna-pedidos/${orderId}/liberar`, { method: "POST", headers: h, cache: "no-store" })
    const j = (await r.json().catch(() => ({}))) as { mensaje?: string; message?: string }
    if (r.ok) revalidatePath("/[locale]/user/orders/[id]", "page")
    return r.ok ? { ok: true, mensaje: j.mensaje || "¡Gracias! Liberaste el pago." } : { ok: false, mensaje: j.message || "No se pudo liberar el pago." }
  } catch {
    return { ok: false, mensaje: "No se pudo conectar. Intenta de nuevo." }
  }
}

export async function enviarReclamo(
  orderId: string,
  datos: { motivo: string; detalle: string; evidencias: string[] }
): Promise<{ ok: true; estado: EstadoEntrega } | { ok: false; mensaje: string }> {
  if (!ORDER.test(orderId)) return { ok: false, mensaje: "Pedido inválido." }
  const h = await cabeceras()
  if (!h) return { ok: false, mensaje: "Inicia sesión de nuevo." }
  try {
    const r = await fetch(`${API}/store/hetna-pedidos/${orderId}/reclamo`, {
      method: "POST",
      headers: { ...h, "content-type": "application/json" },
      body: JSON.stringify({
        motivo: String(datos.motivo || ""),
        detalle: String(datos.detalle || "").slice(0, 2000),
        evidencias: (datos.evidencias || []).filter((x) => typeof x === "string").slice(0, 8),
      }),
      cache: "no-store",
    })
    const j = (await r.json().catch(() => ({}))) as { estado?: EstadoEntrega; message?: string }
    if (r.ok && j.estado) return { ok: true, estado: j.estado }
    return { ok: false, mensaje: j.message || "No se pudo enviar tu reporte." }
  } catch {
    return { ok: false, mensaje: "No se pudo conectar. Intenta de nuevo." }
  }
}
