// @ts-nocheck
// Corte mensual de la comisión HETNA de los anticipos cobrados con PayPal.
//
// Con Mercado Pago la comisión se descuenta sola en cada cobro
// (marketplace_fee). Con PayPal el dinero llega completo al taller (PayPal sólo
// descuenta comisiones de plataforma a socios aprobados), así que cada pago se
// anota con comision_cobrada = false y el día 1 de cada mes:
//   1. se suma lo pendiente del mes anterior por taller y moneda,
//   2. se crea un cobro en `comisiones_cobros` con su liga de pago
//      (Mercado Pago para pesos, PayPal para dólares, ambos a la cuenta HETNA),
//   3. se avisa al taller (alerta en la app + correo).
// Al pagarse (aviso /api/mp-comision o regreso /api/cotizador-comision/paypal),
// el cobro queda pagado y sus pagos con comision_cobrada = true.
//
// Si un taller no paga, la app lo sigue mostrando en Configuración; HETNA
// decide qué hacer (no se bloquea nada automáticamente).
import { T_PAGO as T_PAGO_LIC, comisionesPaypalPendientes } from "./licitacion-cobro"
import { avisarTaller } from "./avisos-taller"
import { supa } from "./cotizador-suscripciones"
import { paypal, paypalListo } from "./paypal-api"

const SITIO = (process.env.STOREFRONT_URL || "https://hetnacnc.com").replace(/\/$/, "")
const API = (process.env.COTIZADOR_API_URL || `${SITIO}/api`).replace(/\/$/, "")
const MP_API = "https://api.mercadopago.com"
const mpToken = () => process.env.MERCADOPAGO_ACCESS_TOKEN || ""

const dinero = (n: number, m: string) =>
  `$${Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${m}`

/** 'YYYY-MM' del mes anterior en hora de México. */
export function periodoAnterior(hoy = new Date()) {
  const mx = new Date(hoy.toLocaleString("en-US", { timeZone: "America/Mexico_City" }))
  const d = new Date(mx.getFullYear(), mx.getMonth() - 1, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

/** Inicio del mes actual en México, en ISO (los pagos antes de esto entran al corte). */
function inicioMesActual(hoy = new Date()) {
  const mx = new Date(hoy.toLocaleString("en-US", { timeZone: "America/Mexico_City" }))
  // 06:00 UTC = 00:00 en Ciudad de México (sin horario de verano desde 2022)
  return new Date(Date.UTC(mx.getFullYear(), mx.getMonth(), 1, 6, 0, 0)).toISOString()
}

async function ligaMercadoPago(cobro) {
  if (!mpToken()) return null
  const r = await fetch(`${MP_API}/checkout/preferences`, {
    method: "POST",
    headers: { Authorization: `Bearer ${mpToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      items: [
        {
          id: cobro.id,
          title: `Cargos HETNA ${cobro.periodo} (comisión PayPal y facturas extra)`,
          quantity: 1,
          currency_id: "MXN",
          unit_price: Number(cobro.monto),
        },
      ],
      external_reference: `comision:${cobro.id}`,
      notification_url: `${API}/mp-comision`,
      back_urls: { success: `${SITIO}/mercado-pago-conectado?resultado=comision` },
      auto_return: "approved",
    }),
    signal: AbortSignal.timeout(15_000),
  })
  const j = (await r.json().catch(() => ({}))) as any
  if (!r.ok) throw new Error(`Mercado Pago ${r.status}: ${j.message || ""}`)
  return j.init_point || null
}

async function ligaPaypal(cobro) {
  if (!paypalListo()) return null
  const orden = await paypal<any>("/v2/checkout/orders", {
    method: "POST",
    headers: { "PayPal-Request-Id": `comision-${cobro.id}` },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: cobro.id,
          custom_id: `comision:${cobro.id}`,
          description: `Cargos HETNA ${cobro.periodo} (comisión PayPal y facturas extra)`,
          amount: { currency_code: "USD", value: Number(cobro.monto).toFixed(2) },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: "HETNA CNC",
            shipping_preference: "NO_SHIPPING",
            user_action: "PAY_NOW",
            return_url: `${API}/cotizador-comision/paypal`,
            cancel_url: `${SITIO}/mercado-pago-conectado?resultado=cancelado`,
          },
        },
      },
    }),
  })
  return (orden.links || []).find((l) => l.rel === "payer-action" || l.rel === "approve")?.href || null
}

/** Corre el corte. Devuelve cuántos cobros creó. */
export async function corteComisiones(logger?: any, knex?: any) {
  const periodo = periodoAnterior()
  const hasta = inicioMesActual()
  const pagos = await supa<any[]>(
    `/rest/v1/cotizacion_pagos?proveedor=eq.paypal&estado=eq.approved&comision_cobrada=eq.false&comision_cobro_id=is.null` +
      `&creado=lt.${encodeURIComponent(hasta)}&select=id,negocio_id,moneda,comision_hetna`
  )
  // Facturas electrónicas extra (pasaron las incluidas en su plan). Si la
  // tabla aún no existe (falta el SQL de la Fase 4) simplemente no hay.
  const facturas = await supa<any[]>(
    `/rest/v1/cfdi_emitidos?extra=eq.true&costo_extra=gt.0&comision_cobro_id=is.null&modo=eq.real` +
      `&creado=lt.${encodeURIComponent(hasta)}&select=id,negocio_id,costo_extra`
  ).catch(() => [])
  // Licitaciones que el cliente pagó con PayPal directo al taller (Medusa DB)
  const licitaciones = knex ? await comisionesPaypalPendientes(knex, hasta).catch(() => []) : []
  type Grupo = { negocio: string; moneda: string; ids: string[]; cfdi: string[]; lic: string[]; total: number; totalPaypal: number; totalCfdi: number; totalLic: number }
  const grupos = new Map<string, Grupo>()
  const grupo = (negocio: string, moneda: string) => {
    const k = `${negocio}|${moneda}`
    const g = grupos.get(k) || { negocio, moneda, ids: [], cfdi: [], lic: [], total: 0, totalPaypal: 0, totalCfdi: 0, totalLic: 0 }
    grupos.set(k, g)
    return g
  }
  for (const p of pagos) {
    const g = grupo(p.negocio_id, p.moneda || "MXN")
    g.ids.push(p.id)
    g.total += Number(p.comision_hetna || 0)
    g.totalPaypal += Number(p.comision_hetna || 0)
  }
  for (const l of licitaciones) {
    const g = grupo(l.negocio_id, "MXN")
    g.lic.push(l.id)
    g.total += Number(l.comision || 0)
    g.totalLic += Number(l.comision || 0)
  }
  for (const f of facturas) {
    const g = grupo(f.negocio_id, "MXN")
    g.cfdi.push(f.id)
    g.total += Number(f.costo_extra || 0)
    g.totalCfdi += Number(f.costo_extra || 0)
  }

  let creados = 0
  for (const g of grupos.values()) {
    const monto = Math.round(g.total * 100) / 100
    if (monto <= 0) continue
    try {
      const filas = await supa<any[]>(`/rest/v1/comisiones_cobros?on_conflict=negocio_id,periodo,moneda`, {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
        body: JSON.stringify({ negocio_id: g.negocio, periodo, monto, moneda: g.moneda }),
      })
      const cobro = filas?.[0]
      if (!cobro) continue // ya existía (corrida repetida)
      const liga = g.moneda === "USD" ? await ligaPaypal(cobro) : await ligaMercadoPago(cobro)
      await supa(`/rest/v1/comisiones_cobros?id=eq.${cobro.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ liga_pago: liga }),
      })
      if (g.ids.length)
        await supa(`/rest/v1/cotizacion_pagos?id=in.(${g.ids.join(",")})`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ comision_cobro_id: cobro.id }),
        })
      if (g.lic.length && knex)
        await knex(T_PAGO_LIC).whereIn("id", g.lic).update({ comision_cobro_id: cobro.id, updated_at: knex.fn.now() })
      if (g.cfdi.length)
        await supa(`/rest/v1/cfdi_emitidos?id=in.(${g.cfdi.join(",")})`, {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ comision_cobro_id: cobro.id }),
        })
      await avisarTaller(
        {
          negocioId: g.negocio,
          tipo: "comision_hetna",
          titulo: `Cargos HETNA de ${periodo}: ${dinero(monto, g.moneda)}`,
          cuerpo:
            [
              g.totalPaypal > 0
                ? `Comisión de tus anticipos cobrados con PayPal: ${dinero(g.totalPaypal, g.moneda)} (con Mercado Pago se descuenta sola).`
                : "",
              g.totalLic > 0 ? `Comisión de licitaciones cobradas con PayPal: ${dinero(g.totalLic, "MXN")}.` : "",
              g.totalCfdi > 0 ? `Facturas electrónicas extra (pasaste las incluidas en tu plan): ${g.cfdi.length} × ${dinero(g.totalCfdi / g.cfdi.length, "MXN")}.` : "",
            ]
              .filter(Boolean)
              .join(" ") + (liga ? ` Págalo aquí: ${liga}` : " Te mandamos la liga de pago en breve."),
          correo: true,
          boton: liga ? "Pagar la comisión" : "Abrir el Cotizador",
          liga: liga || `${SITIO}/cotizador/`,
        },
        logger
      )
      creados++
    } catch (e) {
      logger?.warn?.(`[comisiones] taller ${g.negocio} ${g.moneda}: ${(e as Error).message}`)
    }
  }
  return creados
}

async function marcarPagado(cobroId: string, referencia: string) {
  await supa(`/rest/v1/comisiones_cobros?id=eq.${cobroId}&estado=eq.pendiente`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ estado: "pagado", pagado_en: new Date().toISOString(), referencia_pago: referencia }),
  })
  await supa(`/rest/v1/cotizacion_pagos?comision_cobro_id=eq.${cobroId}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ comision_cobrada: true }),
  })
  // Las facturas extra quedan ligadas al cobro (comision_cobro_id); su estado lo da el cobro
}

async function cobroPorId(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const filas = await supa<any[]>(`/rest/v1/comisiones_cobros?id=eq.${id}&select=*&limit=1`)
  return filas[0] || null
}

/** Aviso de Mercado Pago de un pago de comisión (cuenta HETNA). */
export async function pagoComisionMercadoPago(paymentId: string, logger?: any) {
  const r = await fetch(`${MP_API}/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${mpToken()}` },
    signal: AbortSignal.timeout(15_000),
  })
  const p = (await r.json().catch(() => ({}))) as any
  if (!r.ok) return null
  const m = String(p.external_reference || "").match(/^comision:([0-9a-f-]{36})$/i)
  if (!m || p.status !== "approved") return null
  const cobro = await cobroPorId(m[1])
  if (!cobro || Number(p.transaction_amount || 0) + 0.01 < Number(cobro.monto)) {
    logger?.warn?.(`[comisiones] pago ${paymentId} no cubre el cobro ${m[1]}`)
    return null
  }
  await marcarPagado(cobro.id, `mp:${p.id}`)
  return cobro.id
}

/** Regreso de PayPal de un pago de comisión en dólares. */
export async function pagoComisionPaypal(ordenId: string) {
  if (!/^[A-Z0-9]{10,30}$/i.test(ordenId || "")) return false
  let orden = await paypal<any>(`/v2/checkout/orders/${ordenId}`)
  const m = String(orden.purchase_units?.[0]?.custom_id || "").match(/^comision:([0-9a-f-]{36})$/i)
  if (!m) return false
  if (orden.status === "APPROVED") {
    orden = await paypal<any>(`/v2/checkout/orders/${ordenId}/capture`, {
      method: "POST",
      headers: { "PayPal-Request-Id": `cap-${ordenId}` },
      body: "{}",
    })
  }
  const captura = orden.purchase_units?.[0]?.payments?.captures?.[0]
  if (captura?.status !== "COMPLETED") return false
  const cobro = await cobroPorId(m[1])
  if (!cobro || Number(captura.amount?.value || 0) + 0.01 < Number(cobro.monto)) return false
  await marcarPagado(cobro.id, `pp:${captura.id}`)
  return true
}
