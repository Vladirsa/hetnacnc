// @ts-nocheck
// Requisitos para ofrecer servicios o vender en HETNA (decisión del 4 nov 2026):
//
//   1. Aceptar los Términos para vendedores en su versión vigente
//      (se guarda versión, fecha e IP; se vuelve a pedir sólo si cambian).
//   2. Verificar una tarjeta de débito o crédito: un cargo de $10 MXN con
//      Mercado Pago o PayPal que se devuelve al momento. Sólo comprueba que
//      la tarjeta es real (frena cuentas falsas); no se guarda la tarjeta ni
//      se le cobra nada más. HETNA nunca ve el número: lo procesa Mercado
//      Pago o PayPal. PayPal es para talleres extranjeros.
//
// Sin los dos, el taller no puede publicar productos, ofertas, cursos, libros
// ni mandar propuestas de licitación (api/vendor/hetna-alta/middlewares.ts).
// Las cuentas de la casa (HETNA) y las que el administrador marque con
// metadata.requisitos_exento = true no los necesitan.
//
// Todo queda en seller.metadata, en llaves que el taller no puede escribir
// (PROTEGIDAS de api/vendor/hetna-verificacion/middlewares.ts).
import { randomBytes } from "crypto"

import { correosDeLaCasa } from "./cuentas-casa"
import { STORE_URL, VENDOR_URL } from "./licitacion"
import { paypal, paypalListo } from "./paypal-api"
import { sendEmail } from "./resend"

/**
 * Versión vigente de los Términos para vendedores. Debe ser la misma que
 * VERSION en apps/storefront/src/app/[locale]/(main)/terminos-vendedores/page.tsx:
 * al publicar una versión nueva, cambia las dos y cada taller la vuelve a aceptar.
 */
export const TERMINOS_VERSION = process.env.TERMINOS_VENDEDOR_VERSION || "1.3"

export const MONTO_VERIFICACION = 10 // MXN, se devuelve
const MP_API = "https://api.mercadopago.com"
const API = (process.env.COTIZADOR_API_URL || `${STORE_URL}/api`).replace(/\/$/, "")
const PAGINA = `${VENDOR_URL}/requisitos`
const mpToken = () => process.env.MERCADOPAGO_ACCESS_TOKEN || ""

const meta = (s: any) => (s?.metadata && typeof s.metadata === "object" ? s.metadata : {})

export type EstadoRequisitos = {
  exento: boolean
  terminos: { ok: boolean; version_vigente: string; version_aceptada: string | null; en: string | null }
  tarjeta: { ok: boolean; proveedor: string | null; detalle: string | null; en: string | null }
  metodos: { mercadopago: boolean; paypal: boolean }
  completo: boolean
}

export function esExento(s: any): boolean {
  const m = meta(s)
  if (m.requisitos_exento === true) return true
  const correo = String(s?.email || "").trim().toLowerCase()
  return Boolean(correo) && correosDeLaCasa().includes(correo)
}

export function estadoRequisitos(s: any): EstadoRequisitos {
  const m = meta(s)
  const exento = esExento(s)
  const terminosOk = m.terminos_version === TERMINOS_VERSION
  const t = m.tarjeta && typeof m.tarjeta === "object" ? m.tarjeta : null
  const tarjetaOk = Boolean(m.tarjeta_verificada_en)
  return {
    exento,
    terminos: { ok: terminosOk, version_vigente: TERMINOS_VERSION, version_aceptada: m.terminos_version || null, en: m.terminos_vendedor_en || null },
    tarjeta: {
      ok: tarjetaOk,
      proveedor: t?.proveedor || null,
      detalle: t ? [t.marca, t.ultimos4 ? `terminación ${t.ultimos4}` : null, t.tipo].filter(Boolean).join(" · ") || null : null,
      en: m.tarjeta_verificada_en || null,
    },
    metodos: { mercadopago: Boolean(mpToken()), paypal: paypalListo() },
    completo: exento || (terminosOk && tarjetaOk),
  }
}

/** Mensaje para el taller si le falta algo para publicar; null si cumple. */
export function motivoRequisitos(s: any): string | null {
  const e = estadoRequisitos(s)
  if (e.completo) return null
  const falta = [
    !e.terminos.ok && (e.terminos.version_aceptada ? "aceptar la versión nueva de los Términos para vendedores" : "aceptar los Términos para vendedores"),
    !e.tarjeta.ok && "verificar una tarjeta de débito o crédito (se cobra $10 y se devuelven al momento)",
  ].filter(Boolean)
  return `Para publicar o cotizar en HETNA falta ${falta.join(" y ")}. Hazlo en tu panel, en "Activa tu cuenta".`
}

async function guardar(knex: any, sellerId: string, datos: Record<string, unknown>) {
  await knex.raw(`update seller set metadata = coalesce(metadata, '{}'::jsonb) || ?::jsonb, updated_at = now() where id = ?`, [
    JSON.stringify(datos),
    sellerId,
  ])
}

export async function aceptarTerminos(knex: any, sellerId: string, info: { version: string; ip?: string; agente?: string; quien?: string }) {
  if (info.version !== TERMINOS_VERSION) throw Object.assign(new Error("Esa versión de los términos ya no es la vigente. Recarga la página."), { status: 409 })
  await guardar(knex, sellerId, {
    terminos_version: TERMINOS_VERSION,
    terminos_vendedor_en: new Date().toISOString(),
    terminos_ip: String(info.ip || "").slice(0, 64) || null,
    terminos_agente: String(info.agente || "").slice(0, 200) || null,
    terminos_quien: String(info.quien || "").slice(0, 160) || null,
  })
}

// ---------------------------------------------------------------------
// Mercado Pago (cuenta de HETNA)
// ---------------------------------------------------------------------

async function mp<T = any>(ruta: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${MP_API}${ruta}`, {
    ...init,
    headers: { Authorization: `Bearer ${mpToken()}`, "Content-Type": "application/json", ...(init.headers || {}) },
    signal: AbortSignal.timeout(15_000),
  })
  const cuerpo = (await res.json().catch(() => ({}))) as any
  if (!res.ok) throw new Error(`Mercado Pago ${res.status}: ${cuerpo?.message || cuerpo?.error || ""}`)
  return cuerpo as T
}

const referencia = (sellerId: string) => `tarjeta:${sellerId}:${randomBytes(4).toString("hex")}`
const leerRef = (r: unknown): string | null => {
  const m = /^tarjeta:([A-Za-z0-9_]{4,80}):[a-f0-9]{8}$/.exec(String(r || ""))
  return m ? m[1] : null
}

export async function ligaMercadoPago(seller: any): Promise<string> {
  if (!mpToken()) throw Object.assign(new Error("Mercado Pago no está disponible ahora. Usa PayPal."), { status: 503 })
  const pref = await mp<any>("/checkout/preferences", {
    method: "POST",
    body: JSON.stringify({
      items: [
        {
          id: "verificacion-tarjeta",
          title: "Verificación de tarjeta HETNA (se devuelve al momento)",
          quantity: 1,
          currency_id: "MXN",
          unit_price: MONTO_VERIFICACION,
        },
      ],
      payer: seller.email ? { email: seller.email } : undefined,
      // Sólo tarjetas: nada de efectivo, transferencia ni saldo
      payment_methods: {
        excluded_payment_types: [{ id: "ticket" }, { id: "atm" }, { id: "bank_transfer" }],
        installments: 1,
      },
      external_reference: referencia(seller.id),
      notification_url: `${API}/mp-tarjeta`,
      back_urls: { success: `${PAGINA}?mp=1`, pending: `${PAGINA}?mp=1`, failure: `${PAGINA}?mp=error` },
      auto_return: "approved",
      statement_descriptor: "HETNA VERIFICA",
      metadata: { tipo: "verificacion_tarjeta", seller_id: seller.id },
    }),
  })
  const url = pref.init_point || pref.sandbox_init_point
  if (!url) throw new Error("Mercado Pago no devolvió la liga")
  return url
}

const TIPOS_TARJETA: Record<string, string> = { credit_card: "crédito", debit_card: "débito", prepaid_card: "prepago" }

/**
 * Revisa un pago de verificación (se consulta a Mercado Pago, no se confía en
 * lo que llega): si es con tarjeta y está aprobado, marca la tarjeta del
 * taller como verificada y devuelve el dinero. Idempotente.
 */
export async function confirmarPagoMP(knex: any, pagoId: string, logger?: any): Promise<{ ok: boolean; sellerId: string | null; motivo?: string }> {
  if (!/^\d{5,24}$/.test(pagoId) || !mpToken()) return { ok: false, sellerId: null, motivo: "pago inválido" }
  const p = await mp<any>(`/v1/payments/${pagoId}`)
  const sellerId = leerRef(p.external_reference)
  if (!sellerId) return { ok: false, sellerId: null, motivo: "no es una verificación" }
  const seller = await knex("seller").where({ id: sellerId }).first("id", "email", "name", "metadata")
  if (!seller) return { ok: false, sellerId: null, motivo: "taller no encontrado" }

  const devolver = async () => {
    if (p.status !== "approved" || Number(p.transaction_amount_refunded || 0) >= Number(p.transaction_amount || 0)) return
    try {
      await mp(`/v1/payments/${pagoId}/refunds`, { method: "POST", headers: { "X-Idempotency-Key": `dev-tarjeta-${pagoId}` }, body: "{}" })
    } catch (e) {
      logger?.error?.(`[requisitos] no se devolvió el pago de verificación ${pagoId}: ${(e as Error).message}`)
      await avisarDevolucionPendiente(`Mercado Pago ${pagoId}`, seller)
    }
  }

  if (p.status !== "approved") return { ok: false, sellerId, motivo: p.status === "rejected" ? "La tarjeta fue rechazada." : "El pago todavía no se aprueba." }
  if (Number(p.transaction_amount) !== MONTO_VERIFICACION || p.currency_id !== "MXN") {
    await devolver()
    return { ok: false, sellerId, motivo: "monto distinto" }
  }
  if (!TIPOS_TARJETA[p.payment_type_id]) {
    await devolver()
    return { ok: false, sellerId, motivo: "Hay que pagar con tarjeta de débito o crédito, no con saldo ni efectivo." }
  }
  const ya = meta(seller).tarjeta
  if (!(ya && ya.pago === `mp:${pagoId}`)) {
    await guardar(knex, sellerId, {
      tarjeta_verificada_en: new Date().toISOString(),
      tarjeta: {
        proveedor: "mercadopago",
        tipo: TIPOS_TARJETA[p.payment_type_id],
        marca: String(p.payment_method_id || "").toUpperCase() || null,
        ultimos4: p.card?.last_four_digits || null,
        pais: p.card?.issuer?.country || null,
        pago: `mp:${pagoId}`,
      },
    })
    logger?.info?.(`[requisitos] tarjeta verificada con Mercado Pago: ${seller.name || sellerId}`)
  }
  await devolver()
  return { ok: true, sellerId }
}

// ---------------------------------------------------------------------
// PayPal (talleres extranjeros)
// ---------------------------------------------------------------------

export async function ligaPayPal(seller: any): Promise<string> {
  if (!paypalListo()) throw Object.assign(new Error("PayPal no está disponible ahora. Usa Mercado Pago."), { status: 503 })
  const orden = await paypal<any>("/v2/checkout/orders", {
    method: "POST",
    headers: { "PayPal-Request-Id": `tarjeta-${seller.id}-${Math.floor(Date.now() / 600_000)}` },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: seller.id,
          custom_id: referencia(seller.id),
          description: "Verificación de tarjeta HETNA (se devuelve al momento)",
          amount: { currency_code: "MXN", value: MONTO_VERIFICACION.toFixed(2) },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: "HETNA CNC",
            locale: "es-MX",
            shipping_preference: "NO_SHIPPING",
            user_action: "PAY_NOW",
            return_url: `${API}/tarjeta-paypal`,
            cancel_url: `${PAGINA}?paypal=cancelado`,
          },
        },
      },
    }),
  })
  const url = (orden.links || []).find((l: any) => l.rel === "payer-action" || l.rel === "approve")?.href
  if (!url) throw new Error("PayPal no devolvió la liga")
  return url
}

/** Regreso de PayPal: cobra, verifica y devuelve. Responde la página a la que se manda al taller. */
export async function confirmarOrdenPayPal(knex: any, ordenId: string, logger?: any): Promise<string> {
  if (!/^[A-Z0-9]{10,30}$/i.test(ordenId || "") || !paypalListo()) return `${PAGINA}?paypal=error`
  let orden = await paypal<any>(`/v2/checkout/orders/${ordenId}`)
  const unidad = orden.purchase_units?.[0]
  const sellerId = leerRef(unidad?.custom_id)
  if (!sellerId) return `${PAGINA}?paypal=error`
  const seller = await knex("seller").where({ id: sellerId }).first("id", "email", "name", "metadata")
  if (!seller) return `${PAGINA}?paypal=error`
  if (String(unidad?.amount?.currency_code) !== "MXN" || Number(unidad?.amount?.value) !== MONTO_VERIFICACION) return `${PAGINA}?paypal=error`

  if (orden.status === "APPROVED") {
    orden = await paypal<any>(`/v2/checkout/orders/${ordenId}/capture`, {
      method: "POST",
      headers: { "PayPal-Request-Id": `cap-tarjeta-${ordenId}` },
      body: "{}",
    })
  }
  const captura = orden.purchase_units?.[0]?.payments?.captures?.[0]
  if (!captura || captura.status !== "COMPLETED") return `${PAGINA}?paypal=${captura?.status === "PENDING" ? "pendiente" : "error"}`

  const fuente = orden.payment_source || {}
  const tarjeta = fuente.card || null
  const ya = meta(seller).tarjeta
  if (!(ya && ya.pago === `pp:${captura.id}`)) {
    await guardar(knex, sellerId, {
      tarjeta_verificada_en: new Date().toISOString(),
      tarjeta: {
        proveedor: "paypal",
        tipo: tarjeta ? (String(tarjeta.type || "").toLowerCase() === "debit" ? "débito" : "tarjeta") : "cuenta PayPal",
        marca: tarjeta?.brand || null,
        ultimos4: tarjeta?.last_digits || null,
        pais: orden.payer?.address?.country_code || tarjeta?.billing_address?.country_code || null,
        pago: `pp:${captura.id}`,
      },
    })
    logger?.info?.(`[requisitos] tarjeta verificada con PayPal: ${seller.name || sellerId}`)
  }
  try {
    await paypal(`/v2/payments/captures/${captura.id}/refund`, {
      method: "POST",
      headers: { "PayPal-Request-Id": `dev-tarjeta-${captura.id}` },
      body: "{}",
    })
  } catch (e) {
    // Si ya se devolvió (doble regreso) PayPal responde error: no pasa nada
    if (!/ALREADY|REFUNDED|exceed/i.test((e as Error).message)) {
      logger?.error?.(`[requisitos] no se devolvió la verificación PayPal ${captura.id}: ${(e as Error).message}`)
      await avisarDevolucionPendiente(`PayPal ${captura.id}`, seller)
    }
  }
  return `${PAGINA}?paypal=ok`
}

async function avisarDevolucionPendiente(pago: string, seller: any) {
  if (!process.env.HETNA_LEADS_EMAIL) return
  await sendEmail({
    to: process.env.HETNA_LEADS_EMAIL,
    subject: `Devolver a mano: verificación de tarjeta de ${seller?.name || seller?.id}`,
    html: `<p>No se pudo devolver solo el cargo de verificación de $${MONTO_VERIFICACION} MXN (${pago}) del taller ${seller?.name || ""} (${seller?.id}). Devuélvelo desde el panel del procesador.</p>`,
  }).catch(() => {})
}
