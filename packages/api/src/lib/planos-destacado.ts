// "Taller destacado" en los planos de la tienda (decisión del dueño, 25 nov 2026):
// $199 por 7 días; el taller sale primero y con la insignia «Destacado» en TODOS
// los planos donde tiene oferta (components/hetna/planos/TalleresPlano.tsx).
// Mismo flujo de pago que el destacado de Impresión 3D bajo pedido
// (lib/impresion-bajo-pedido.ts): liga de Mercado Pago, aviso en /api/mp-destacado
// y el pago se consulta a Mercado Pago, nunca se confía en el navegador.
import { randomBytes } from "crypto"

import { STORE_URL, VENDOR_URL } from "./licitacion"

export const PRECIO_DESTACADO_PLANOS = Number(process.env.PRECIO_DESTACADO_PLANOS) || 199
export const DIAS_DESTACADO_PLANOS = 7
// en seller.metadata; protegida (api/vendor/hetna-verificacion/middlewares.ts): sólo la escribe el pago
export const CLAVE_DESTACADO_PLANOS = "destacado_planos"

const meta = (s: any): Record<string, any> => (s?.metadata && typeof s.metadata === "object" ? s.metadata : {})

/** Hasta cuándo está destacado el taller en planos (null si nunca o ya venció). */
export function destacadoPlanosHasta(seller: any, ahora = Date.now()): string | null {
  const hasta = meta(seller)[CLAVE_DESTACADO_PLANOS]?.hasta
  const t = hasta ? Date.parse(String(hasta)) : NaN
  return Number.isFinite(t) && t > ahora ? new Date(t).toISOString() : null
}

/** Nuevo vencimiento al pagar: 7 días desde hoy o desde que vence el actual (se suman). */
export function extenderDestacadoPlanos(hastaActual: string | null, ahora = Date.now()): string {
  const base = hastaActual ? Math.max(ahora, Date.parse(hastaActual) || 0) : ahora
  return new Date(base + DIAS_DESTACADO_PLANOS * 86_400_000).toISOString()
}

const MP_API = "https://api.mercadopago.com"
const mpToken = () => process.env.MERCADOPAGO_ACCESS_TOKEN || ""
const API = (process.env.COTIZADOR_API_URL || `${STORE_URL}/api`).replace(/\/$/, "")

async function mp(ruta: string, init: RequestInit = {}) {
  const res = await fetch(`${MP_API}${ruta}`, {
    ...init,
    headers: { Authorization: `Bearer ${mpToken()}`, "Content-Type": "application/json", ...(init.headers || {}) },
    signal: AbortSignal.timeout(15_000),
  })
  const cuerpo = (await res.json().catch(() => ({}))) as any
  if (!res.ok) throw new Error(`Mercado Pago ${res.status}: ${cuerpo?.message || cuerpo?.error || ""}`)
  return cuerpo
}

const refDestacadoPlanos = (sellerId: string) => `destplano:${sellerId}:${randomBytes(4).toString("hex")}`
export const leerRefDestacadoPlanos = (r: unknown): string | null => {
  const m = /^destplano:([A-Za-z0-9_]{4,80}):[a-f0-9]{8}$/.exec(String(r || ""))
  return m ? m[1] : null
}

export async function ligaPagoDestacadoPlanos(seller: any): Promise<string> {
  if (!mpToken()) throw Object.assign(new Error("El pago con Mercado Pago no está disponible ahora. Intenta más tarde."), { status: 503 })
  const pagina = `${VENDOR_URL}/planos`
  const pref = await mp("/checkout/preferences", {
    method: "POST",
    body: JSON.stringify({
      items: [
        {
          id: "destacado-planos",
          title: `Taller destacado en planos HETNA (${DIAS_DESTACADO_PLANOS} días)`,
          quantity: 1,
          currency_id: "MXN",
          unit_price: PRECIO_DESTACADO_PLANOS,
        },
      ],
      payer: seller.email ? { email: seller.email } : undefined,
      external_reference: refDestacadoPlanos(seller.id),
      notification_url: `${API}/mp-destacado`,
      back_urls: { success: `${pagina}?pago=ok`, pending: `${pagina}?pago=ok`, failure: `${pagina}?pago=error` },
      auto_return: "approved",
      statement_descriptor: "HETNA DESTACADO",
      metadata: { tipo: "destacado_planos", seller_id: seller.id },
    }),
  })
  const url = pref.init_point || pref.sandbox_init_point
  if (!url) throw new Error("Mercado Pago no devolvió la liga")
  return url
}

/** Revisa el pago con Mercado Pago. Idempotente: un pago suma 7 días una sola vez. */
export async function confirmarPagoDestacadoPlanos(knex: any, pagoId: string, logger?: any, pago?: any): Promise<{ ok: boolean; sellerId: string | null; hasta?: string; motivo?: string }> {
  if (!/^\d{5,24}$/.test(String(pagoId)) || !mpToken()) return { ok: false, sellerId: null, motivo: "pago inválido" }
  const p = pago || (await mp(`/v1/payments/${pagoId}`))
  const sellerId = leerRefDestacadoPlanos(p.external_reference)
  if (!sellerId) return { ok: false, sellerId: null, motivo: "no es un pago de destacado en planos" }
  if (p.status !== "approved") return { ok: false, sellerId, motivo: "El pago todavía no se aprueba." }
  if (Number(p.transaction_amount) < PRECIO_DESTACADO_PLANOS || p.currency_id !== "MXN") return { ok: false, sellerId, motivo: "monto distinto" }
  const s = await knex("seller").where({ id: sellerId }).first("id", "metadata")
  if (!s) return { ok: false, sellerId: null, motivo: "taller no encontrado" }
  const actual = meta(s)[CLAVE_DESTACADO_PLANOS] || {}
  const pagos: string[] = Array.isArray(actual.pagos) ? actual.pagos : []
  if (pagos.includes(`mp:${pagoId}`)) return { ok: true, sellerId, hasta: actual.hasta }
  const vigente = destacadoPlanosHasta(s)
  const hasta = extenderDestacadoPlanos(vigente)
  const nuevo = { hasta, desde: actual.desde && vigente ? actual.desde : new Date().toISOString(), pagos: [...pagos, `mp:${pagoId}`].slice(-52) }
  await knex.raw(`update seller set metadata = coalesce(metadata, '{}'::jsonb) || ?::jsonb, updated_at = now() where id = ?`, [
    JSON.stringify({ [CLAVE_DESTACADO_PLANOS]: nuevo }),
    sellerId,
  ])
  logger?.info?.(`[destacado-planos] ${sellerId} destacado hasta ${hasta} (mp:${pagoId})`)
  return { ok: true, sellerId, hasta }
}
