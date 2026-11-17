// CFDI automático de HETNA por cada cobro de una suscripción del Cotizador
// (Mercado Pago, PayPal o Stripe), y su XML directo a la contabilidad de HETNA.
//
//   1. Cada aviso de pago del proveedor llega a registrarCobro*(): se vuelve a
//      consultar el cobro al proveedor (no se confía en el aviso) y se anota UNA
//      vez por cobroId en hetna_cobro_suscripcion (clave única: los avisos
//      repetidos no facturan doble).
//   2. facturarCobro():
//      - Si el taller ya capturó sus datos fiscales en la app (negocios_facturapi:
//        razón social, RFC, régimen, CP), se emite un CFDI nominativo, uso G03.
//      - Si no, el cobro espera a la FACTURA GLOBAL del mes (público en general,
//        XAXX010101000, régimen 616, uso S01) que emite el job el día 1.
//   3. El XML timbrado entra a la contabilidad (lib/conta: guardarCfdi, origen "suscripcion").
//
// Precios con IVA incluido (planes $299 / $599 / $1,199 MXN al mes, como en la app).
// PayPal cobra en USD: el CFDI se emite en USD (Facturapi pone el tipo de cambio si no
// se manda; ver "No verificado") y nunca va a la global (que es en pesos): sin datos
// fiscales del taller queda en "revisar" para facturarlo a mano.
//
// Todo apagado hasta configurar:
//   FACTURAPI_KEY_HETNA     llave secreta (sk_live_… o sk_test_…) de la ORGANIZACIÓN de
//                           HETNA en Facturapi (con su RFC y CSD). No es la llave de usuario.
//   y el RFC de HETNA en Dashboard > Contabilidad > Datos fiscales.
// Opcionales: COTIZADOR_CLAVE_PROD (clave SAT del servicio; por defecto 81112106,
// proveedores de servicios de aplicación), COTIZADOR_FORMA_PAGO (por defecto 31,
// intermediario de pagos), COTIZADOR_SERIE_CFDI (por defecto "SUS").
//
// No verificado contra la documentación de Facturapi (el sitio no se pudo abrir): el
// campo `global` de la factura global y que `exchange` se llene solo en USD. La clave
// de producto y la forma de pago son una propuesta para el contador (configurables).
import { container } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { contribuyenteHetna, guardarCfdi } from "./conta/almacen"
import { PLANES_COTIZADOR, leerReferencia, mp, supa, type PlanPago } from "./cotizador-suscripciones"
import { paypal } from "./paypal-api"
import { stripe } from "./stripe-api"

export const T_COBRO = "hetna_cobro_suscripcion"
const API = "https://www.facturapi.io/v2"
const RFC = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/
const r2 = (n: number) => Math.round(n * 100) / 100

export type Proveedor = "mercadopago" | "paypal" | "stripe"
export type Cobro = { proveedor: Proveedor; cobroId: string; negocioId: string; plan: string; monto: number; moneda: string; fecha: string }
export type Receptor = { razon_social: string; rfc: string; regimen: string; cp: string; correo: string | null }

export const llaveHetna = () => (process.env.FACTURAPI_KEY_HETNA || "").trim()
const claveProd = () => (/^\d{8}$/.test(process.env.COTIZADOR_CLAVE_PROD || "") ? process.env.COTIZADOR_CLAVE_PROD! : "81112106")
const formaPago = () => (/^\d{2}$/.test(process.env.COTIZADOR_FORMA_PAGO || "") ? process.env.COTIZADOR_FORMA_PAGO! : "31")
const serie = () => (process.env.COTIZADOR_SERIE_CFDI || "SUS").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 10) || "SUS"
const knexDe = () => container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any

let listo = false
export async function asegurarCobros(knex: any) {
  if (listo) return
  if (!(await knex.schema.hasTable(T_COBRO))) {
    await knex.schema.createTable(T_COBRO, (t: any) => {
      t.text("cobro_id").primary() // mp:<id> | pp:<sale> | st:<invoice>
      t.text("proveedor").notNullable()
      t.text("negocio_id").notNullable().index()
      t.text("plan").nullable()
      t.decimal("monto", 12, 2).notNullable()
      t.text("moneda").notNullable().defaultTo("MXN")
      t.timestamp("fecha", { useTz: true }).notNullable()
      // pendiente | procesando | facturado | en_global | revisar | error
      t.text("estado").notNullable().defaultTo("pendiente")
      t.text("tipo_cfdi").nullable() // nominativo | global
      t.text("facturapi_id").nullable()
      t.text("uuid").nullable()
      t.text("receptor_rfc").nullable()
      t.text("mensaje").nullable()
      t.integer("intentos").notNullable().defaultTo(0)
      t.boolean("en_contabilidad").notNullable().defaultTo(false)
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
      t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }
  listo = true
}

/** Desglose de un precio con IVA incluido (16%). */
export function desglose(totalConIva: number, tasa = 0.16) {
  const subtotal = r2(totalConIva / (1 + tasa))
  return { subtotal, iva: r2(totalConIva - subtotal), total: r2(totalConIva) }
}

// ── Facturapi (organización de HETNA) ─────────────────────────────────────
type Fetch = typeof fetch
async function fapi<T = any>(ruta: string, init: RequestInit = {}, binario = false, f: Fetch = fetch): Promise<T> {
  const r = await f(`${API}${ruta}`, {
    ...init,
    headers: { Authorization: `Bearer ${llaveHetna()}`, ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers || {}) },
    signal: AbortSignal.timeout(45_000),
  })
  if (binario && r.ok) return Buffer.from(await r.arrayBuffer()) as any
  const texto = await r.text()
  let cuerpo: any = texto
  try { cuerpo = texto ? JSON.parse(texto) : {} } catch { /* texto plano */ }
  if (!r.ok) throw new Error(`Facturapi ${r.status}: ${(typeof cuerpo === "object" && (cuerpo.message || cuerpo.error)) || texto.slice(0, 200)}`)
  return cuerpo as T
}

/** Datos fiscales del taller que ya capturó en la app para SUS facturas. null si están incompletos. */
export async function receptorDelTaller(negocioId: string): Promise<Receptor | null> {
  const reg = (await supa<any[]>(`/rest/v1/negocios_facturapi?negocio_id=eq.${negocioId}&select=razon_social,rfc,regimen,cp&limit=1`).catch(() => []))[0]
  const cfg = (await supa<any[]>(`/rest/v1/configuracion_empresa?negocio_id=eq.${negocioId}&select=correo&limit=1`).catch(() => []))[0]
  const correo = /^\S+@\S+\.\S+$/.test(String(cfg?.correo || "").trim()) ? String(cfg.correo).trim() : null
  return validarReceptor({ razon_social: reg?.razon_social, rfc: reg?.rfc, regimen: reg?.regimen, cp: reg?.cp, correo })
}

export function validarReceptor(r: { razon_social?: any; rfc?: any; regimen?: any; cp?: any; correo?: string | null }): Receptor | null {
  const rfc = String(r.rfc || "").toUpperCase().replace(/\s/g, "")
  const cp = String(r.cp || "").replace(/\D/g, "")
  const razon = String(r.razon_social || "").trim()
  const regimen = String(r.regimen || "")
  if (!RFC.test(rfc) || rfc === "XAXX010101000" || rfc === "XEXX010101000" || !razon || !/^\d{3}$/.test(regimen) || cp.length !== 5) return null
  return { razon_social: razon, rfc, regimen, cp, correo: r.correo || null }
}

const nombrePlan = (plan: string) => (PLANES_COTIZADOR as any)[plan]?.nombre || plan
const concepto = (c: { plan: string; fecha: string; proveedor: string; cobroId: string }) =>
  `Suscripción mensual Cotizador HETNA · Plan ${nombrePlan(c.plan)} · ${String(c.fecha).slice(0, 10)} (${c.cobroId})`

/** Cuerpo del CFDI nominativo para Facturapi. */
export function cuerpoNominativo(c: Cobro, rec: Receptor) {
  return {
    customer: { legal_name: rec.razon_social, tax_id: rec.rfc, tax_system: rec.regimen, address: { zip: rec.cp }, ...(rec.correo ? { email: rec.correo } : {}) },
    items: [{
      quantity: 1,
      product: { description: concepto(c), product_key: claveProd(), unit_key: "E48", price: r2(c.monto), tax_included: true, taxes: [{ type: "IVA", rate: 0.16 }] },
    }],
    use: "G03",
    payment_form: formaPago(),
    payment_method: "PUE",
    currency: c.moneda,
    series: serie(),
  }
}

/** Cuerpo de la factura global del mes (público en general). */
export function cuerpoGlobal(cobros: Cobro[], anio: number, mes: number, cpHetna: string) {
  return {
    customer: { legal_name: "PUBLICO EN GENERAL", tax_id: "XAXX010101000", tax_system: "616", address: { zip: cpHetna } },
    global: { periodicity: "month", months: String(mes).padStart(2, "0"), year: anio },
    items: cobros.map((c) => ({
      quantity: 1,
      product: { description: concepto(c), product_key: claveProd(), unit_key: "ACT", price: r2(c.monto), tax_included: true, taxes: [{ type: "IVA", rate: 0.16 }] },
    })),
    use: "S01",
    payment_form: formaPago(),
    payment_method: "PUE",
    currency: "MXN",
    series: serie(),
  }
}

/** ¿Se puede facturar? Llave de Facturapi de HETNA y RFC de HETNA en la contabilidad. */
export async function facturacionLista(knex: any) {
  if (!llaveHetna()) return { ok: false as const, motivo: "Falta FACTURAPI_KEY_HETNA en el servidor." }
  const ctb = await contribuyenteHetna(knex)
  if (!ctb) return { ok: false as const, motivo: "Falta el RFC de HETNA en Contabilidad > Datos fiscales." }
  return { ok: true as const, ctb }
}

/** El XML timbrado a la contabilidad de HETNA. */
async function aContabilidad(knex: any, ctb: any, facturapiId: string, f: Fetch) {
  const xml = await fapi<Buffer>(`/invoices/${facturapiId}/xml`, {}, true, f)
  await guardarCfdi(knex, ctb, xml.toString("utf8"), "suscripcion")
}

/** Anota un cobro (una sola vez) y lo intenta facturar. */
export async function facturarCobroSuscripcion(c: Cobro, opciones: { knex?: any; fetch?: Fetch; logger?: any; receptor?: Receptor | null } = {}) {
  const knex = opciones.knex || knexDe()
  await asegurarCobros(knex)
  await knex(T_COBRO).insert({
    cobro_id: c.cobroId, proveedor: c.proveedor, negocio_id: c.negocioId, plan: c.plan,
    monto: r2(c.monto), moneda: c.moneda.toUpperCase(), fecha: c.fecha,
  }).onConflict("cobro_id").ignore()
  return facturarCobro(knex, c.cobroId, opciones)
}

/** Factura un cobro anotado (también sirve para "reintentar"). Nunca timbra dos veces el mismo. */
export async function facturarCobro(knex: any, cobroId: string, opciones: { fetch?: Fetch; logger?: any; receptor?: Receptor | null } = {}) {
  const f = opciones.fetch || fetch
  await asegurarCobros(knex)
  const lista = await facturacionLista(knex)
  if (!lista.ok) {
    await knex(T_COBRO).where({ cobro_id: cobroId }).whereIn("estado", ["pendiente", "error"]).update({ mensaje: lista.motivo, updated_at: knex.fn.now() })
    return { estado: "pendiente", mensaje: lista.motivo }
  }
  // Tomar el cobro (sólo si nadie más lo está facturando y no tiene CFDI)
  const tomado = await knex(T_COBRO).where({ cobro_id: cobroId }).whereIn("estado", ["pendiente", "error", "revisar"]).whereNull("facturapi_id")
    .update({ estado: "procesando", intentos: knex.raw("intentos + 1"), updated_at: knex.fn.now() })
  const fila = await knex(T_COBRO).where({ cobro_id: cobroId }).first()
  if (!fila) return { estado: "no_existe" }
  if (!tomado) {
    // Ya facturado pero sin llegar a la contabilidad: sólo se reintenta eso
    if (fila.facturapi_id && !fila.en_contabilidad) {
      try {
        await aContabilidad(knex, lista.ctb, fila.facturapi_id, f)
        await knex(T_COBRO).where({ cobro_id: cobroId }).update({ en_contabilidad: true, updated_at: knex.fn.now() })
      } catch (e) {
        opciones.logger?.warn?.(`[cfdi-suscripcion] ${cobroId}: no entró a la contabilidad: ${(e as Error).message}`)
      }
    }
    return { estado: fila.estado }
  }
  const c: Cobro = { proveedor: fila.proveedor, cobroId, negocioId: fila.negocio_id, plan: fila.plan, monto: Number(fila.monto), moneda: fila.moneda, fecha: new Date(fila.fecha).toISOString() }
  try {
    const rec = opciones.receptor !== undefined ? opciones.receptor : await receptorDelTaller(c.negocioId)
    if (!rec) {
      const estado = c.moneda === "MXN" ? "en_global" : "revisar"
      const mensaje = estado === "en_global"
        ? "El taller no tiene datos fiscales: va en la factura global del mes."
        : "Cobro en dólares sin datos fiscales del taller: factúralo a mano (la global es en pesos)."
      await knex(T_COBRO).where({ cobro_id: cobroId }).update({ estado, tipo_cfdi: estado === "en_global" ? "global" : null, mensaje, updated_at: knex.fn.now() })
      return { estado, mensaje }
    }
    const inv = await fapi<any>(`/invoices`, { method: "POST", body: JSON.stringify(cuerpoNominativo(c, rec)) }, false, f)
    // Guardar el id de Facturapi ANTES de cualquier otra cosa: así nunca se vuelve a timbrar
    await knex(T_COBRO).where({ cobro_id: cobroId }).update({
      estado: "facturado", tipo_cfdi: "nominativo", facturapi_id: inv.id, uuid: inv.uuid || null, receptor_rfc: rec.rfc, mensaje: null, updated_at: knex.fn.now(),
    })
    if (rec.correo) await fapi(`/invoices/${inv.id}/email`, { method: "POST", body: JSON.stringify({ email: rec.correo }) }, false, f).catch(() => null)
    try {
      await aContabilidad(knex, lista.ctb, inv.id, f)
      await knex(T_COBRO).where({ cobro_id: cobroId }).update({ en_contabilidad: true })
    } catch (e) {
      opciones.logger?.warn?.(`[cfdi-suscripcion] ${cobroId}: timbrado, pero no entró a la contabilidad: ${(e as Error).message}`)
    }
    opciones.logger?.info?.(`[cfdi-suscripcion] ${cobroId} facturado a ${rec.rfc} (${inv.uuid || inv.id})`)
    return { estado: "facturado", uuid: inv.uuid || null }
  } catch (e) {
    await knex(T_COBRO).where({ cobro_id: cobroId }).update({ estado: "error", mensaje: (e as Error).message.slice(0, 500), updated_at: knex.fn.now() })
    opciones.logger?.error?.(`[cfdi-suscripcion] ${cobroId}: ${(e as Error).message}`)
    return { estado: "error", mensaje: (e as Error).message }
  }
}

/** Factura global del mes anterior con los cobros en pesos sin datos fiscales. Idempotente por mes. */
export async function facturaGlobalDelMes(knex: any, anio: number, mes: number, opciones: { fetch?: Fetch; logger?: any } = {}) {
  const f = opciones.fetch || fetch
  await asegurarCobros(knex)
  const lista = await facturacionLista(knex)
  if (!lista.ok) return { estado: "pendiente", mensaje: lista.motivo }
  if (!lista.ctb.cp) return { estado: "pendiente", mensaje: "Falta el código postal fiscal de HETNA (lugar de expedición de la global)." }
  const desde = new Date(Date.UTC(anio, mes - 1, 1, 6)) // medianoche del centro de México ≈ 06:00 UTC
  const hasta = new Date(Date.UTC(anio, mes, 1, 6))
  const filas = (await knex(T_COBRO).where({ estado: "en_global", moneda: "MXN" }).whereNull("facturapi_id")
    .where("fecha", ">=", desde).where("fecha", "<", hasta).orderBy("fecha").select("*")) as any[]
  if (!filas.length) return { estado: "vacia" }
  const ids = filas.map((x) => x.cobro_id)
  // Tomar todos de una vez: si otra corrida ya los tomó, no se duplica la global
  const tomados = await knex(T_COBRO).whereIn("cobro_id", ids).where({ estado: "en_global" }).whereNull("facturapi_id").update({ estado: "procesando", updated_at: knex.fn.now() })
  if (tomados !== ids.length) {
    await knex(T_COBRO).whereIn("cobro_id", ids).where({ estado: "procesando" }).whereNull("facturapi_id").update({ estado: "en_global" })
    return { estado: "ocupado" }
  }
  const cobros: Cobro[] = filas.map((x) => ({ proveedor: x.proveedor, cobroId: x.cobro_id, negocioId: x.negocio_id, plan: x.plan, monto: Number(x.monto), moneda: "MXN", fecha: new Date(x.fecha).toISOString() }))
  try {
    const inv = await fapi<any>(`/invoices`, { method: "POST", body: JSON.stringify(cuerpoGlobal(cobros, anio, mes, lista.ctb.cp)) }, false, f)
    await knex(T_COBRO).whereIn("cobro_id", ids).update({ estado: "facturado", tipo_cfdi: "global", facturapi_id: inv.id, uuid: inv.uuid || null, receptor_rfc: "XAXX010101000", mensaje: null, updated_at: knex.fn.now() })
    try {
      await aContabilidad(knex, lista.ctb, inv.id, f)
      await knex(T_COBRO).whereIn("cobro_id", ids).update({ en_contabilidad: true })
    } catch (e) {
      opciones.logger?.warn?.(`[cfdi-suscripcion] global ${mes}/${anio}: no entró a la contabilidad: ${(e as Error).message}`)
    }
    return { estado: "facturado", cobros: ids.length, uuid: inv.uuid || null }
  } catch (e) {
    await knex(T_COBRO).whereIn("cobro_id", ids).where({ estado: "procesando" }).update({ estado: "en_global", mensaje: `Global: ${(e as Error).message.slice(0, 400)}` })
    opciones.logger?.error?.(`[cfdi-suscripcion] global ${mes}/${anio}: ${(e as Error).message}`)
    return { estado: "error", mensaje: (e as Error).message }
  }
}

// ── Cobros de cada proveedor (se vuelven a consultar; no se confía en el aviso) ─────────
const refDe = (texto: string | undefined) => leerReferencia(texto) as { negocioId: string; plan: PlanPago } | null

/** Mercado Pago: un cobro mensual (authorized_payment) de una suscripción. */
export async function registrarCobroMercadoPago(authorizedPaymentId: string, logger?: any) {
  if (!/^\d+$/.test(authorizedPaymentId)) return null
  const p = await mp<any>(`/authorized_payments/${authorizedPaymentId}`)
  const aprobado = p?.payment?.status === "approved" || p?.status === "processed"
  if (!aprobado || !p.preapproval_id) return null
  const pre = await mp<any>(`/preapproval/${p.preapproval_id}`)
  const ref = refDe(pre?.external_reference)
  if (!ref) return null
  return facturarCobroSuscripcion({
    proveedor: "mercadopago", cobroId: `mp:${authorizedPaymentId}`, negocioId: ref.negocioId, plan: ref.plan,
    monto: Number(p.transaction_amount || pre?.auto_recurring?.transaction_amount || 0), moneda: String(p.currency_id || "MXN"),
    fecha: p.debit_date || p.date_created || new Date().toISOString(),
  }, { logger })
}

/** PayPal: un cobro (sale) de una suscripción. */
export async function registrarCobroPaypal(saleId: string, logger?: any) {
  if (!/^[A-Z0-9]{8,30}$/i.test(saleId)) return null
  const sale = await paypal<any>(`/v1/payments/sale/${saleId}`)
  if (String(sale?.state || "").toLowerCase() !== "completed" || !sale.billing_agreement_id) return null
  const sub = await paypal<any>(`/v1/billing/subscriptions/${sale.billing_agreement_id}`)
  const ref = refDe(sub?.custom_id)
  if (!ref) return null
  return facturarCobroSuscripcion({
    proveedor: "paypal", cobroId: `pp:${saleId}`, negocioId: ref.negocioId, plan: ref.plan,
    monto: Number(sale.amount?.total || 0), moneda: String(sale.amount?.currency || "USD"), fecha: sale.create_time || new Date().toISOString(),
  }, { logger })
}

/** Stripe: una factura pagada (invoice.paid) de una suscripción. */
export async function registrarCobroStripe(invoiceId: string, logger?: any) {
  if (!/^in_[A-Za-z0-9]{8,80}$/.test(invoiceId)) return null
  const inv = await stripe<any>(`/invoices/${invoiceId}`)
  if (inv?.status !== "paid" || !(Number(inv.amount_paid) > 0)) return null
  const subId = inv.subscription || inv.parent?.subscription_details?.subscription
  if (typeof subId !== "string") return null
  const sub = await stripe<any>(`/subscriptions/${subId}`)
  const ref = refDe(sub?.metadata?.ref)
  if (!ref) return null
  const pagado = inv.status_transitions?.paid_at ? new Date(Number(inv.status_transitions.paid_at) * 1000).toISOString() : new Date().toISOString()
  return facturarCobroSuscripcion({
    proveedor: "stripe", cobroId: `st:${invoiceId}`, negocioId: ref.negocioId, plan: ref.plan,
    monto: r2(Number(inv.amount_paid) / 100), moneda: String(inv.currency || "mxn").toUpperCase(), fecha: pagado,
  }, { logger })
}

/** Para el dashboard: cobros recientes con su estado de CFDI. */
export async function cobrosRecientes(knex: any, limite = 100) {
  await asegurarCobros(knex)
  return knex(T_COBRO).orderBy("fecha", "desc").limit(limite)
    .select("cobro_id", "proveedor", "negocio_id", "plan", "monto", "moneda", "fecha", "estado", "tipo_cfdi", "uuid", "receptor_rfc", "mensaje", "intentos", "en_contabilidad")
}

/** Reintentos del job: errores con menos de 5 intentos, pendientes y facturados sin llegar a contabilidad. */
export async function reintentarPendientes(knex: any, logger?: any) {
  await asegurarCobros(knex)
  const filas = (await knex(T_COBRO)
    .where((q: any) => q.where({ estado: "pendiente" }).orWhere((w: any) => w.where({ estado: "error" }).where("intentos", "<", 5))
      .orWhere((w: any) => w.where({ estado: "facturado", en_contabilidad: false })))
    .limit(50).select("cobro_id")) as any[]
  let n = 0
  for (const x of filas) { await facturarCobro(knex, x.cobro_id, { logger }); n++ }
  return n
}
