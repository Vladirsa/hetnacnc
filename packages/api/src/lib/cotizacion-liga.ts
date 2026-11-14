// @ts-nocheck
// Cotizador 2.0 · Fase 2 — Liga pública de la cotización, aceptación en
// línea y cobro del anticipo a la cuenta de Mercado Pago de cada taller.
//
// Flujo:
//   1. El taller conecta su Mercado Pago una sola vez (OAuth):
//        POST /api/cotizador-mp/conectar  (sesión de Supabase)  -> { url }
//        GET  /api/cotizador-mp/callback?code&state           <- Mercado Pago
//      El access_token del taller se guarda en `negocios_mp` (Supabase, sin
//      políticas: sólo lo lee el servidor con la llave de servicio).
//   2. Cada cotización tiene token_publico; la liga es hetnacnc.com/c/<token>.
//        GET  /api/cotizacion-liga/<token>           -> datos para la página
//        POST /api/cotizacion-liga/<token>/aceptar   { nombre }
//        POST /api/cotizacion-liga/<token>/pagar     -> { url } de Checkout Pro
//      La preferencia se crea CON EL TOKEN DEL TALLER: el dinero entra a su
//      cuenta. `marketplace_fee` = comisión HETNA por plan (Gratis 3 %,
//      Taller 2 %, Pro 1.5 %, Industrial 1 %, tope $150 por cobro) y se
//      descuenta sola; la comisión de Mercado Pago la paga el taller.
//   3. Mercado Pago avisa a POST /api/mp-cotizacion. No se confía en el
//      aviso: se consulta el pago con el token del taller y con eso se anota
//      en `cotizacion_pagos` y se marca el anticipo.
//
// Variables (.env de packages/api):
//   MP_APP_ID, MP_CLIENT_SECRET   Mercado Pago > Tus integraciones > la app
//                                 (la misma app del MERCADOPAGO_ACCESS_TOKEN).
//                                 Redirect URL registrada en la app:
//                                 https://hetnacnc.com/api/cotizador-mp/callback
//   COTIZADOR_SUPABASE_SERVICE_KEY (ya existe)
import { createHmac, timingSafeEqual } from "crypto"

import { avisarTaller } from "./avisos-taller"
import { paypal, paypalListo } from "./paypal-api"
import { adminDesdeToken, ErrorSuscripcion, supa, supaBase } from "./cotizador-suscripciones"

const MP_API = "https://api.mercadopago.com"
const SITIO = (process.env.STOREFRONT_URL || "https://hetnacnc.com").replace(/\/$/, "")
const API = (process.env.COTIZADOR_API_URL || `${SITIO}/api`).replace(/\/$/, "")
const appId = () => process.env.MP_APP_ID || ""
const clientSecret = () => process.env.MP_CLIENT_SECRET || ""
export const REDIRECT_MP = `${API}/cotizador-mp/callback`

export const mpConexionLista = () => Boolean(appId() && clientSecret())

// ── Comisión HETNA por plan ────────────────────────────────────────────
export const COMISION_TOPE = Number(process.env.COTIZADOR_COMISION_TOPE || 150)
export function comisionPct(plan: string | null | undefined, trialHasta?: string | null) {
  const p = String(plan || "").toLowerCase()
  if (p === "industrial" || p === "master") return 1
  if (p === "pro" || p === "premium") return 1.5
  if (p === "taller") return 2
  if ((p === "trial" || p === "prueba") && trialHasta && new Date(trialHasta) > new Date()) return 2
  return 3
}
export function comisionHetna(monto: number, plan: string | null | undefined, trialHasta?: string | null) {
  const pct = comisionPct(plan, trialHasta)
  const c = Math.round(monto * pct) / 100
  return { pct, monto: Math.min(COMISION_TOPE, Math.max(0, c)) }
}

// ── Lectura de la cotización por token ─────────────────────────────────
const CAMPOS_COT =
  "id,folio,negocio_id,cliente_id,estado,subtotal,descuento_pct,descuento_fijo,iva_pct,iva_monto,costo_envio,total,metodo_pago,condicion_entrega,fecha_entrega,dias_habiles,vigencia_dias,notas,pdf_url,token_publico,liga_vista_en,aceptada_en,aceptada_por,anticipo_monto,anticipo_pagado,anticipo_estado,created_at"

const tokenValido = (t: string) => /^[A-Za-z0-9]{16,40}$/.test(t)

export async function cotizacionPorToken(token: string) {
  if (!tokenValido(token)) throw new ErrorSuscripcion("Esta liga no es válida.", 404)
  const filas = await supa<any[]>(`/rest/v1/cotizaciones?token_publico=eq.${token}&select=${CAMPOS_COT}&limit=1`)
  const c = filas[0]
  if (!c) throw new ErrorSuscripcion("Esta cotización ya no existe o la liga no es válida.", 404)
  return c
}

async function cotizacionPorId(id: string) {
  const filas = await supa<any[]>(`/rest/v1/cotizaciones?id=eq.${id}&select=${CAMPOS_COT}&limit=1`)
  return filas[0] || null
}

async function patchCotizacion(id: string, cambios: Record<string, unknown>) {
  await supa(`/rest/v1/cotizaciones?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ ...cambios, updated_at: new Date().toISOString() }),
    headers: { Prefer: "return=minimal" },
  })
}

/** PATCH sólo si `campo` sigue vacío. true = esta llamada fue la que lo puso
 *  (así el aviso al taller sale una sola vez aunque lleguen dos peticiones juntas). */
async function ponerSiVacio(id: string, campo: string, cambios: Record<string, unknown>): Promise<boolean> {
  const filas = await supa<any[]>(`/rest/v1/cotizaciones?id=eq.${id}&${campo}=is.null&select=id`, {
    method: "PATCH",
    body: JSON.stringify({ ...cambios, updated_at: new Date().toISOString() }),
    headers: { Prefer: "return=representation" },
  })
  return Array.isArray(filas) && filas.length > 0
}

const mxn = (n: number) => `$${Number(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// ── Monedas de los talleres (México, EE. UU., Colombia, Perú, Chile) ───
export const MONEDAS = ["MXN", "USD", "COP", "PEN", "CLP"] as const
const SIN_CENTAVOS = new Set(["COP", "CLP"])
/** Dinero con el símbolo y los decimales de la moneda: $1,250.00 · S/ 85.50 · $1,250,000 COP */
export function dinero(n: number, moneda = "MXN") {
  const dec = SIN_CENTAVOS.has(moneda) ? 0 : 2
  const t = Number(n || 0).toLocaleString(moneda === "USD" ? "en-US" : "es-MX", { minimumFractionDigits: dec, maximumFractionDigits: dec })
  if (moneda === "PEN") return `S/ ${t}`
  return moneda === "MXN" ? `$${t}` : `$${t} ${moneda}`
}

// PayPal no maneja pesos colombianos, soles ni pesos chilenos: esas
// cotizaciones se cobran en dólares al tipo de cambio del día.
const PAYPAL_DIRECTO = new Set(["MXN", "USD"])
// Respaldo si no se puede consultar el tipo de cambio (6 nov 2026)
const CAMBIO_RESPALDO: Record<string, number> = { MXN: 18.63, COP: 3246, PEN: 3.43, CLP: 977 }
let cambioCache: { en: number; tasas: Record<string, number> } | null = null
/** Unidades de `moneda` por 1 dólar. Se consulta cada 6 horas. */
export async function tipoCambioUSD(moneda: string): Promise<number> {
  if (moneda === "USD") return 1
  if (!cambioCache || Date.now() - cambioCache.en > 6 * 3600_000) {
    try {
      const r = await fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(5000) })
      const j: any = await r.json()
      if (j?.result === "success" && j.rates) cambioCache = { en: Date.now(), tasas: j.rates }
    } catch {
      // se usa el respaldo
    }
  }
  const t = Number(cambioCache?.tasas?.[moneda] || CAMBIO_RESPALDO[moneda] || 0)
  if (!(t > 0)) throw new ErrorSuscripcion("No pudimos calcular el tipo de cambio. Intenta en unos minutos.", 503)
  return t
}
/** Cuánto se cobra en PayPal: la misma moneda si PayPal la maneja; si no, dólares. */
async function cobroPaypal(monto: number, moneda: string) {
  if (PAYPAL_DIRECTO.has(moneda)) return { monto: Math.round(monto * 100) / 100, moneda, tipo_cambio: null as number | null }
  const tc = await tipoCambioUSD(moneda)
  return { monto: Math.ceil((monto / tc) * 100) / 100, moneda: "USD", tipo_cambio: tc }
}
const ligaDe = (c) => `${SITIO}/c/${c.token_publico}`

// ── Pedido ligado a la cotización (seguimiento en la misma liga) ───────
async function pedidoDe(cotId: string) {
  // Con las columnas de la guía (supabase/avisos_y_seguimiento.sql) y, si
  // todavía no se corrió ese SQL, sin ellas: la página no debe caerse.
  const base = "id,folio,estado,total,fecha_entrega_estimada,fecha_entregado,created_at"
  for (const campos of [`${base},paqueteria,guia,rastreo_url`, base]) {
    try {
      const filas = await supa<any[]>(`/rest/v1/pedidos?cotizacion_id=eq.${cotId}&select=${campos}&order=created_at.desc&limit=1`)
      return filas[0] || null
    } catch {
      // intenta sin las columnas nuevas
    }
  }
  return null
}

async function seguimientoDe(pedido) {
  if (!pedido) return null
  const [avances, fotos] = await Promise.all([
    supa<any[]>(`/rest/v1/pedido_avances?pedido_id=eq.${pedido.id}&select=etapa,descripcion,created_at&order=created_at.asc`).catch(() => []),
    supa<any[]>(`/rest/v1/pedido_fotos?pedido_id=eq.${pedido.id}&select=url,etapa,created_at&order=created_at.asc`).catch(() => []),
  ])
  return {
    folio: pedido.folio,
    estado: pedido.estado,
    fecha_estimada: pedido.fecha_entrega_estimada || null,
    entregado: pedido.fecha_entregado || null,
    avances: avances.map((a) => ({ etapa: a.etapa, nota: a.descripcion || null, fecha: a.created_at })),
    fotos: fotos.filter((f) => /^https:\/\//.test(String(f.url || ""))).map((f) => ({ url: f.url, etapa: f.etapa || null, fecha: f.created_at })),
    envio: pedido.guia ? { paqueteria: pedido.paqueteria || null, guia: pedido.guia, rastreo: rastreoUrl(pedido.paqueteria, pedido.guia, pedido.rastreo_url) } : null,
  }
}

/** Liga de rastreo: la que puso el taller o, para las paqueterías conocidas, la de su sitio. */
export function rastreoUrl(paqueteria: string | null, guia: string, propia?: string | null): string | null {
  if (propia && /^https:\/\/\S+$/i.test(propia)) return propia
  const g = encodeURIComponent(String(guia || "").trim())
  if (!g) return null
  const p = String(paqueteria || "").toLowerCase()
  if (p.includes("dhl")) return `https://www.dhl.com/mx-es/home/rastreo.html?tracking-id=${g}`
  if (p.includes("fedex")) return `https://www.fedex.com/fedextrack/?trknbr=${g}`
  if (p.includes("ups")) return `https://www.ups.com/track?loc=es_MX&tracknum=${g}`
  return null
}

/** Al completarse el anticipo: crea el pedido o lo pasa a "Anticipo recibido". */
async function asegurarPedido(c, montoPagado: number, logger?: any) {
  const nota = `Anticipo pagado en línea con Mercado Pago (${mxn(montoPagado)})`
  try {
    const existente = await pedidoDe(c.id)
    let pedidoId = existente?.id
    if (existente) {
      if (existente.estado === "Pedido") {
        await supa(`/rest/v1/pedidos?id=eq.${existente.id}`, {
          method: "PATCH",
          body: JSON.stringify({ estado: "Pago50", updated_at: new Date().toISOString() }),
          headers: { Prefer: "return=minimal" },
        })
        await supa(`/rest/v1/pedido_avances`, {
          method: "POST",
          body: JSON.stringify({ pedido_id: existente.id, etapa: "Pago50", descripcion: nota }),
          headers: { Prefer: "return=minimal" },
        })
      }
    } else {
      const ahora = new Date()
      const folio = `PED-${ahora.getFullYear()}-${String(ahora.getTime()).slice(-6)}`
      const nuevo = await supa<any[]>(`/rest/v1/pedidos`, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          folio,
          negocio_id: c.negocio_id,
          cotizacion_id: c.id,
          cliente_id: c.cliente_id,
          estado: "Pago50",
          total: num(c.total),
          fecha_entrega_estimada: c.fecha_entrega || null,
        }),
      })
      pedidoId = nuevo?.[0]?.id
      if (pedidoId) {
        await supa(`/rest/v1/pedido_avances`, {
          method: "POST",
          body: JSON.stringify({ pedido_id: pedidoId, etapa: "Pago50", descripcion: nota }),
          headers: { Prefer: "return=minimal" },
        })
      }
    }
    await patchCotizacion(c.id, { estado: "Pedido" })
    return pedidoId || null
  } catch (e) {
    logger?.warn?.(`[cotizador] no se pudo crear/avanzar el pedido de ${c.folio}: ${(e as Error).message}`)
    return null
  }
}

async function negocioDe(id: string) {
  // codigo_referido viene de supabase/referidos.sql del Cotizador; si ese SQL
  // aún no se corre, se lee sin él.
  try {
    const filas = await supa<any[]>(`/rest/v1/negocios?id=eq.${id}&select=id,nombre,telefono,plan,trial_hasta,codigo_referido&limit=1`)
    return filas[0] || null
  } catch {
    const filas = await supa<any[]>(`/rest/v1/negocios?id=eq.${id}&select=id,nombre,telefono,plan,trial_hasta&limit=1`)
    return filas[0] || null
  }
}

async function configDe(negocioId: string) {
  const base = "nombre_comercial,telefono1,correo,logo_url,sitio_web,direccion"
  // `moneda` la agrega supabase/moneda_impuesto.sql; si no se corrió, MXN.
  for (const campos of [`${base},moneda`, base]) {
    try {
      const filas = await supa<any[]>(`/rest/v1/configuracion_empresa?negocio_id=eq.${negocioId}&select=${campos}&limit=1`)
      return filas[0] || null
    } catch {
      // intenta sin moneda
    }
  }
  return null
}

const monedaDe = (config): string => {
  const m = String(config?.moneda || "MXN").toUpperCase()
  return (MONEDAS as readonly string[]).includes(m) ? m : "MXN"
}

export async function paypalDelNegocio(negocioId: string) {
  try {
    const filas = await supa<any[]>(`/rest/v1/negocios_paypal?negocio_id=eq.${negocioId}&select=*&limit=1`)
    return filas[0] || null
  } catch {
    return null // la tabla aún no existe (supabase/paypal_y_marketing.sql)
  }
}

/** Anota un pago. Si todavía no se corrió paypal_y_marketing.sql (faltan
 *  proveedor/moneda/comision_cobrada), lo guarda sin esas columnas. */
async function guardarPago(fila: Record<string, unknown>) {
  const enviar = (f) =>
    supa(`/rest/v1/cotizacion_pagos?on_conflict=mp_payment_id`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(f),
    })
  try {
    await enviar(fila)
  } catch (e) {
    if (!/proveedor|moneda|comision_cobrada|column/i.test((e as Error).message)) throw e
    const { proveedor, moneda, comision_cobrada, ...resto } = fila as any
    await enviar(resto)
  }
}

async function clienteDe(id: string | null) {
  if (!id) return null
  const filas = await supa<any[]>(`/rest/v1/clientes?id=eq.${id}&select=nombre,empresa&limit=1`)
  return filas[0] || null
}

async function itemsDe(cotId: string) {
  return supa<any[]>(
    `/rest/v1/cotizacion_items?cotizacion_id=eq.${cotId}&select=nombre_producto,sku,cantidad,precio_unitario,descuento_item_pct,subtotal,notas_item,orden&order=orden.asc`
  )
}

async function pagosDe(cotId: string) {
  return supa<any[]>(
    `/rest/v1/cotizacion_pagos?cotizacion_id=eq.${cotId}&select=mp_payment_id,monto,estado,metodo,creado,detalle&order=creado.desc`
  )
}

export async function mpDelNegocio(negocioId: string) {
  const filas = await supa<any[]>(`/rest/v1/negocios_mp?negocio_id=eq.${negocioId}&select=*&limit=1`)
  return filas[0] || null
}

const num = (v) => Number(v || 0)

export function vencida(c): boolean {
  const dias = Number(c.vigencia_dias || 7)
  const creada = new Date(c.created_at || Date.now())
  return Date.now() > creada.getTime() + dias * 86_400_000
}

/** Cuánto se pide de anticipo: lo que fijó la app o, si no, el % del método de pago. */
export function anticipoDe(c): number {
  if (c.anticipo_monto != null && Number(c.anticipo_monto) > 0) return Math.round(Number(c.anticipo_monto) * 100) / 100
  const total = num(c.total)
  const m = String(c.metodo_pago || "")
  const pct = m.match(/(\d{1,3})\s*%\s*(de\s+)?anticipo/i) || m.match(/anticipo\s*(?:de\s*)?(\d{1,3})\s*%/i)
  if (pct) return Math.round(total * Number(pct[1])) / 100
  const monto = m.match(/anticipo\s+de\s+\$?\s*([\d,]+(?:\.\d+)?)/i)
  if (monto) return Math.min(total, Number(monto[1].replace(/,/g, "")))
  return 0
}

/** Lo que ve la página pública. Marca la primera vista. */
// El PDF de la cotización: la app lo sube a un bucket privado de Supabase y guarda la
// ruta ("cotizaciones-pdf/<negocio>/<id>.pdf"); aquí se firma por una hora para que el
// cliente lo vea o lo descargue. Las ligas viejas que ya eran URL completas pasan igual.
async function ligaPdf(pdfUrl: string | null | undefined, negocioId: string): Promise<string | null> {
  const ruta = String(pdfUrl || "").trim()
  if (!ruta) return null
  if (/^https:\/\//i.test(ruta)) return ruta
  // Sólo PDFs de la carpeta del taller dueño de la cotización: antes se firmaba
  // cualquier ruta de cotizaciones-pdf/, y un taller que escribiera la ruta de
  // otro en su pdf_url obtenía el PDF ajeno (auditoría del 14 nov 2026).
  if (ruta.includes("..") || !ruta.startsWith(`cotizaciones-pdf/${negocioId}/`)) {
    if (ruta.startsWith("cotizaciones-pdf/")) console.warn(`[cotizacion-liga] PDF fuera de la carpeta del taller ${negocioId}: ${ruta}`)
    return null
  }
  try {
    const r = await supa<{ signedURL?: string }>(`/storage/v1/object/sign/${ruta.split("/").map(encodeURIComponent).join("/")}`, {
      method: "POST",
      body: JSON.stringify({ expiresIn: 3600 }),
    })
    return r?.signedURL ? `${supaBase()}/storage/v1${r.signedURL}` : null
  } catch {
    return null // sin PDF la liga sigue funcionando
  }
}

export async function paginaPublica(token: string) {
  const c = await cotizacionPorToken(token)
  const [negocio, config, cliente, items, pagos, mp, pp] = await Promise.all([
    negocioDe(c.negocio_id),
    configDe(c.negocio_id),
    clienteDe(c.cliente_id),
    itemsDe(c.id),
    pagosDe(c.id),
    mpDelNegocio(c.negocio_id),
    paypalDelNegocio(c.negocio_id),
  ])
  const moneda = monedaDe(config)
  if (!c.liga_vista_en) {
    // Primera vez que el cliente abre la liga: se marca y se avisa al taller
    // (sin esperar, para que la página cargue rápido).
    ponerSiVacio(c.id, "liga_vista_en", { liga_vista_en: new Date().toISOString() })
      .then((primera) => {
        if (!primera) return
        const quien = cliente?.nombre || "Tu cliente"
        return avisarTaller({
          negocioId: c.negocio_id,
          tipo: "cotizacion_vista",
          titulo: `👀 ${quien} abrió la cotización ${c.folio}`,
          cuerpo: `Buen momento para darle seguimiento. Total ${dinero(num(c.total), moneda)}.`,
          cotizacionId: c.id,
          clienteId: c.cliente_id,
          correo: false,
          liga: ligaDe(c),
        })
      })
      .catch(() => {})
  }
  const seguimiento = c.estado === "Pedido" || c.anticipo_estado === "pagado" ? await seguimientoDe(await pedidoDe(c.id)) : null
  const anticipo = anticipoDe(c)
  const estaVencida = vencida(c) && !c.aceptada_en && c.estado !== "Aprobada" && c.estado !== "Pedido"
  return {
    folio: c.folio,
    estado: c.estado,
    vencida: estaVencida,
    creada: c.created_at,
    vigencia_dias: c.vigencia_dias,
    taller: {
      nombre: config?.nombre_comercial || negocio?.nombre || "Taller",
      telefono: config?.telefono1 || negocio?.telefono || null,
      correo: config?.correo || null,
      logo: config?.logo_url || null,
      sitio: config?.sitio_web || null,
      direccion: config?.direccion || null,
      // Para la invitación "¿Tienes un taller?" al pie de la liga: si otro taller
      // la abre y se registra, cuenta como invitado de este.
      ref: negocio?.codigo_referido || null,
    },
    cliente: cliente ? { nombre: cliente.nombre, empresa: cliente.empresa } : null,
    items: items.map((i) => ({
      nombre: i.nombre_producto,
      sku: i.sku,
      cantidad: num(i.cantidad),
      precio: num(i.precio_unitario),
      descuento_pct: num(i.descuento_item_pct),
      subtotal: num(i.subtotal),
      notas: i.notas_item,
    })),
    subtotal: num(c.subtotal),
    descuento_pct: num(c.descuento_pct),
    descuento_fijo: num(c.descuento_fijo),
    iva_pct: num(c.iva_pct),
    iva: num(c.iva_monto),
    envio: num(c.costo_envio),
    total: num(c.total),
    metodo_pago: c.metodo_pago,
    condicion_entrega: c.condicion_entrega,
    fecha_entrega: c.fecha_entrega,
    dias_habiles: c.dias_habiles,
    notas: c.notas,
    pdf: await ligaPdf(c.pdf_url, String(c.negocio_id)),
    aceptada: c.aceptada_en ? { en: c.aceptada_en, por: c.aceptada_por } : null,
    moneda,
    anticipo: (() => {
      const pendiente = anticipo > 0 && num(c.anticipo_pagado) < anticipo && !estaVencida && c.estado !== "Rechazada"
      // Mercado Pago cobra sólo en pesos mexicanos; PayPal en pesos o dólares
      // (COP, PEN y CLP se cobran en dólares al tipo de cambio del día)
      const metodos = {
        mercadopago: pendiente && Boolean(mp) && moneda === "MXN",
        paypal: pendiente && Boolean(pp) && paypalListo(),
      }
      return {
        monto: anticipo,
        pagado: num(c.anticipo_pagado),
        estado: anticipo > 0 ? c.anticipo_estado : "sin_anticipo",
        se_puede_pagar: metodos.mercadopago || metodos.paypal,
        paypal_en_dolares: !PAYPAL_DIRECTO.has(moneda),
        metodos,
      }
    })(),
    pagos: pagos.filter((p) => p.estado === "approved").map((p) => ({ monto: num(p.detalle?.monto_cotizacion ?? p.monto), metodo: p.metodo, fecha: p.creado })),
    pedido: seguimiento,
  }
}

/** El cliente acepta la cotización desde la liga. */
export async function aceptar(token: string, nombre: string) {
  const c = await cotizacionPorToken(token)
  const quien = String(nombre || "").replace(/\s+/g, " ").trim().slice(0, 120)
  if (!quien) throw new ErrorSuscripcion("Escribe tu nombre para aceptar.")
  if (c.aceptada_en) return { ok: true, ya: true, en: c.aceptada_en }
  if (c.estado === "Rechazada") throw new ErrorSuscripcion("Esta cotización fue rechazada. Pide una nueva al taller.")
  if (vencida(c)) throw new ErrorSuscripcion("Esta cotización ya venció. Pide al taller que la renueve.")
  const en = new Date().toISOString()
  const primera = await ponerSiVacio(c.id, "aceptada_en", {
    aceptada_en: en,
    aceptada_por: quien,
    estado: c.estado === "Pedido" ? "Pedido" : "Aprobada",
  })
  if (primera) {
    const anticipo = anticipoDe(c)
    const moneda = monedaDe(await configDe(c.negocio_id).catch(() => null))
    await avisarTaller({
      negocioId: c.negocio_id,
      tipo: "cotizacion_aceptada",
      titulo: `✅ ${quien} aceptó la cotización ${c.folio}`,
      cuerpo:
        `Total ${dinero(num(c.total), moneda)}.` +
        (anticipo > 0 && c.anticipo_estado !== "pagado" ? ` Falta el anticipo de ${dinero(anticipo, moneda)}; puede pagarlo desde la misma liga.` : ""),
      cotizacionId: c.id,
      clienteId: c.cliente_id,
      mensajeCliente: `¡Gracias, ${quien}! Recibimos tu aceptación de la cotización ${c.folio}.` +
        (anticipo > 0 ? ` En cuanto se acredite el anticipo de ${dinero(anticipo, moneda)} arrancamos. Puedes pagarlo aquí: ${ligaDe(c)}` : " Te avisamos cuando empecemos."),
      liga: ligaDe(c),
    })
  }
  return { ok: true, en }
}

// ── Mercado Pago con el token del taller ───────────────────────────────
export async function mpCon<T = any>(token: string, ruta: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${MP_API}${ruta}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) },
    signal: AbortSignal.timeout(15_000),
  })
  const cuerpo = (await res.json().catch(() => ({}))) as any
  if (!res.ok) {
    const msg = cuerpo?.message || cuerpo?.error || `HTTP ${res.status}`
    const e: any = new Error(`Mercado Pago ${res.status}: ${msg}`)
    e.status = res.status
    throw e
  }
  return cuerpo as T
}

/** Token del taller; si está por vencer, lo renueva. */
export async function tokenDelTaller(negocioId: string): Promise<{ token: string; mpUserId: string }> {
  const fila = await mpDelNegocio(negocioId)
  if (!fila) throw new ErrorSuscripcion("El taller todavía no conecta su Mercado Pago.", 409)
  const vence = fila.expira_en ? new Date(fila.expira_en).getTime() : 0
  if (fila.refresh_token && vence && vence - Date.now() < 15 * 86_400_000 && mpConexionLista()) {
    try {
      const r = await fetch(`${MP_API}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: appId(),
          client_secret: clientSecret(),
          grant_type: "refresh_token",
          refresh_token: fila.refresh_token,
        }),
        signal: AbortSignal.timeout(15_000),
      })
      const t = (await r.json().catch(() => ({}))) as any
      if (r.ok && t.access_token) {
        await guardarConexion(negocioId, t)
        return { token: t.access_token, mpUserId: String(t.user_id || fila.mp_user_id) }
      }
    } catch {
      // se usa el token actual mientras siga vivo
    }
  }
  return { token: fila.access_token, mpUserId: String(fila.mp_user_id) }
}

async function guardarConexion(negocioId: string, t: any) {
  const expira = t.expires_in ? new Date(Date.now() + Number(t.expires_in) * 1000).toISOString() : null
  await supa(`/rest/v1/negocios_mp?on_conflict=negocio_id`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      negocio_id: negocioId,
      mp_user_id: String(t.user_id),
      access_token: t.access_token,
      refresh_token: t.refresh_token || null,
      public_key: t.public_key || null,
      expira_en: expira,
      actualizado: new Date().toISOString(),
    }),
  })
}

export const referenciaCot = (cotId: string) => `cotizacion:${cotId}`
export function leerReferenciaCot(ref: string | undefined): string | null {
  const m = String(ref || "").match(/^cotizacion:([0-9a-f-]{36})$/i)
  return m ? m[1] : null
}

/** Crea la preferencia de Checkout Pro en la cuenta del taller. */
export async function pagarAnticipo(token: string) {
  const c = await cotizacionPorToken(token)
  if (c.estado === "Rechazada") throw new ErrorSuscripcion("Esta cotización fue rechazada.")
  if (vencida(c) && !c.aceptada_en) throw new ErrorSuscripcion("Esta cotización ya venció. Pide al taller que la renueve.")
  const anticipo = anticipoDe(c)
  const resta = Math.round((anticipo - num(c.anticipo_pagado)) * 100) / 100
  if (anticipo <= 0 || resta <= 0) throw new ErrorSuscripcion("Esta cotización no tiene anticipo pendiente.")

  const [negocio, config, mp] = await Promise.all([negocioDe(c.negocio_id), configDe(c.negocio_id), tokenDelTaller(c.negocio_id)])
  if (monedaDe(config) !== "MXN") throw new ErrorSuscripcion("Mercado Pago cobra sólo en pesos mexicanos: paga esta cotización con PayPal.")
  const com = comisionHetna(resta, negocio?.plan, negocio?.trial_hasta)
  const nombreTaller = config?.nombre_comercial || negocio?.nombre || "Taller"
  const liga = `${SITIO}/c/${c.token_publico}`

  const pref = await mpCon(mp.token, "/checkout/preferences", {
    method: "POST",
    body: JSON.stringify({
      items: [
        {
          id: c.id,
          title: `Anticipo cotización ${c.folio} · ${nombreTaller}`.slice(0, 250),
          description: `Anticipo de la cotización ${c.folio}`.slice(0, 250),
          quantity: 1,
          currency_id: "MXN",
          unit_price: resta,
        },
      ],
      marketplace_fee: com.monto,
      external_reference: referenciaCot(c.id),
      notification_url: `${API}/mp-cotizacion`,
      back_urls: { success: `${liga}?pago=ok`, pending: `${liga}?pago=pendiente`, failure: `${liga}?pago=error` },
      auto_return: "approved",
      statement_descriptor: nombreTaller.replace(/[^A-Za-z0-9 ]/g, "").slice(0, 22) || "HETNA",
      binary_mode: false,
      metadata: { cotizacion_id: c.id, negocio_id: c.negocio_id, folio: c.folio, comision_hetna: com.monto, comision_pct: com.pct },
    }),
  })
  const url = pref.init_point || pref.sandbox_init_point
  if (!url) throw new Error("Mercado Pago no devolvió la liga de pago")
  return { url, monto: resta, comision_hetna: com.monto, comision_pct: com.pct }
}

/** Después de anotar un pago (Mercado Pago o PayPal): suma lo aprobado, marca
 *  el anticipo, crea el pedido si se completó y avisa al taller una sola vez. */
async function trasPago(
  c,
  p: { monto: number; recienAprobado: boolean; pagador: string | null; nombre: string | null; dondeLlega: string },
  logger?: any
) {
  const aprobados = await supa<any[]>(`/rest/v1/cotizacion_pagos?cotizacion_id=eq.${c.id}&estado=eq.approved&select=monto,detalle`)
  // Un pago en dólares de una cotización en COP/PEN/CLP guarda en `detalle`
  // cuánto cubrió en la moneda de la cotización.
  const pagado = Math.round(aprobados.reduce((s, x) => s + Number(x.detalle?.monto_cotizacion ?? x.monto ?? 0), 0) * 100) / 100
  const moneda = monedaDe(await configDe(c.negocio_id).catch(() => null))
  const anticipo = anticipoDe(c)
  const cambios: Record<string, unknown> = { anticipo_pagado: pagado }
  if (pagado >= anticipo && anticipo > 0) {
    cambios.anticipo_estado = "pagado"
    if (!c.aceptada_en) {
      cambios.aceptada_en = new Date().toISOString()
      cambios.aceptada_por = p.pagador || "Pago en línea"
    }
    if (c.estado !== "Pedido") cambios.estado = "Aprobada"
  }
  await patchCotizacion(c.id, cambios)
  if (!p.recienAprobado) return

  const completo = cambios.anticipo_estado === "pagado" && c.anticipo_estado !== "pagado"
  const pedidoId = completo ? await asegurarPedido(c, pagado, logger) : null
  const cliente = await clienteDe(c.cliente_id).catch(() => null)
  const quien = cliente?.nombre || p.nombre || "Tu cliente"
  await avisarTaller(
    {
      negocioId: c.negocio_id,
      tipo: "anticipo_pagado",
      titulo: `💰 ${quien} pagó ${dinero(p.monto, moneda)} de la cotización ${c.folio}`,
      cuerpo:
        (completo ? 'Anticipo completo: el pedido ya está en Avances como "Anticipo recibido". ' : `Lleva ${dinero(pagado, moneda)} de ${dinero(anticipo, moneda)}. `) +
        p.dondeLlega,
      cotizacionId: c.id,
      clienteId: c.cliente_id,
      pedidoId,
      mensajeCliente: `¡Gracias, ${quien}! Recibimos tu pago de ${dinero(p.monto, moneda)} de la cotización ${c.folio}. Aquí puedes seguir tu pedido: ${ligaDe(c)}`,
      liga: ligaDe(c),
    },
    logger
  )
}

/** Aviso de Mercado Pago: consulta el pago con el token del taller y lo anota. */
export async function registrarPago(paymentId: string, mpUserId: string | undefined, logger?: any) {
  // El aviso trae `user_id` = la cuenta del taller (collector). Con eso
  // sabemos qué token usar para leer el pago. Si no viene, se intenta con el
  // token de la app (en modo marketplace también ve los cobros de sus talleres).
  let pago: any = null
  let negocioId: string | null = null
  if (mpUserId) {
    const filas = await supa<any[]>(`/rest/v1/negocios_mp?mp_user_id=eq.${encodeURIComponent(mpUserId)}&select=negocio_id&limit=1`)
    negocioId = filas[0]?.negocio_id || null
  }
  if (negocioId) {
    const mp = await tokenDelTaller(negocioId)
    pago = await mpCon(mp.token, `/v1/payments/${encodeURIComponent(paymentId)}`)
  } else {
    const appToken = process.env.MERCADOPAGO_ACCESS_TOKEN || ""
    if (!appToken) return null
    try {
      pago = await mpCon(appToken, `/v1/payments/${encodeURIComponent(paymentId)}`)
    } catch (e) {
      logger?.warn?.(`[cotizador] pago ${paymentId}: no se pudo leer con el token de la app (${(e as Error).message})`)
      return null
    }
  }
  let cotId = leerReferenciaCot(pago?.external_reference)
  if (!cotId && pago?.metadata?.cotizacion_id) cotId = String(pago.metadata.cotizacion_id)
  if (!cotId) return null

  const c = await cotizacionPorId(cotId)
  if (!c) return null

  // Confirmación con el token del taller (dueño del cobro)
  const mp = await tokenDelTaller(c.negocio_id)
  const p = negocioId === c.negocio_id ? pago : await mpCon(mp.token, `/v1/payments/${encodeURIComponent(paymentId)}`)
  if (String(p.collector_id || "") !== String(mp.mpUserId)) {
    logger?.warn?.(`[cotizador] pago ${paymentId}: el collector no es el taller de la cotización ${c.folio}`)
    return null
  }
  if (leerReferenciaCot(p.external_reference) !== c.id) return null

  const monto = Number(p.transaction_amount || 0)
  const comision = Number(p.marketplace_fee ?? p.fee_details?.find?.((f) => f.type === "application_fee")?.amount ?? 0)
  // Estado anterior de este pago (Mercado Pago avisa varias veces el mismo pago)
  const previo = await supa<any[]>(`/rest/v1/cotizacion_pagos?mp_payment_id=eq.${encodeURIComponent(String(p.id))}&select=estado&limit=1`)
  const recienAprobado = p.status === "approved" && previo[0]?.estado !== "approved"
  await guardarPago({
      cotizacion_id: c.id,
      negocio_id: c.negocio_id,
      mp_payment_id: String(p.id),
      proveedor: "mercadopago",
      moneda: "MXN",
      comision_cobrada: true, // Mercado Pago ya la descontó (marketplace_fee)
      monto,
      comision_hetna: comision,
      estado: String(p.status || ""),
      metodo: p.payment_type_id || null,
      pagador: p.payer?.email || null,
      detalle: { status_detail: p.status_detail, date_approved: p.date_approved, net_received_amount: p.transaction_details?.net_received_amount },
      actualizado: new Date().toISOString(),
  })

  const neto = Number(p.transaction_details?.net_received_amount || 0)
  await trasPago(
    c,
    {
      monto,
      recienAprobado,
      pagador: p.payer?.email || null,
      nombre: p.payer?.first_name || null,
      dondeLlega: neto > 0 ? `Te llegan ${mxn(neto)} a tu Mercado Pago (ya sin comisiones).` : "El dinero entra a tu Mercado Pago.",
    },
    logger
  )
  logger?.info?.(`[cotizador] pago ${p.status} de $${monto} en ${c.folio} (comisión HETNA $${comision})`)
  return { cotizacion: c.folio, estado: p.status, monto }
}

// ── PayPal: el dinero va directo a la cuenta PayPal del taller ─────────
// La orden la crea HETNA (PAYPAL_CLIENT_ID) con `payee.merchant_id` = la
// cuenta del taller, así que el pago llega completo al taller. PayPal sólo
// descuenta comisiones de plataforma a socios aprobados, por eso la comisión
// HETNA se anota como pendiente y se cobra una vez al mes
// (lib/cotizador-comisiones.ts).
export const COMISION_TOPE_USD = Number(process.env.COTIZADOR_COMISION_TOPE_USD || 8)

export async function pagarConPaypal(token: string) {
  const c = await cotizacionPorToken(token)
  if (!paypalListo()) throw new ErrorSuscripcion("PayPal no está disponible por ahora.", 503)
  if (c.estado === "Rechazada") throw new ErrorSuscripcion("Esta cotización fue rechazada.")
  if (vencida(c) && !c.aceptada_en) throw new ErrorSuscripcion("Esta cotización ya venció. Pide al taller que la renueve.")
  const anticipo = anticipoDe(c)
  const resta = Math.round((anticipo - num(c.anticipo_pagado)) * 100) / 100
  if (anticipo <= 0 || resta <= 0) throw new ErrorSuscripcion("Esta cotización no tiene anticipo pendiente.")

  const [negocio, config, pp] = await Promise.all([negocioDe(c.negocio_id), configDe(c.negocio_id), paypalDelNegocio(c.negocio_id)])
  if (!pp) throw new ErrorSuscripcion("El taller todavía no vincula su PayPal.", 409)
  const moneda = monedaDe(config)
  const cobro = await cobroPaypal(resta, moneda)
  const nombreTaller = config?.nombre_comercial || negocio?.nombre || "Taller"
  const liga = ligaDe(c)

  const orden = await paypal<any>("/v2/checkout/orders", {
    method: "POST",
    headers: { "PayPal-Request-Id": `cot-${c.id}-${Math.round(resta * 100)}-${Math.floor(Date.now() / 600_000)}` },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: c.id,
          custom_id: referenciaCot(c.id),
          description: (`Anticipo de la cotización ${c.folio} · ${nombreTaller}` +
            (cobro.tipo_cambio ? ` · ${dinero(resta, moneda)}` : "")).slice(0, 127),
          amount: { currency_code: cobro.moneda, value: cobro.monto.toFixed(2) },
          payee: { merchant_id: pp.payer_id },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: nombreTaller.slice(0, 127),
            locale: moneda === "USD" ? "en-US" : "es-MX",  // (COP/PEN/CLP: en español)
            shipping_preference: "NO_SHIPPING",
            user_action: "PAY_NOW",
            return_url: `${API}/cotizacion-liga/${c.token_publico}/paypal`,
            cancel_url: `${liga}?pago=error`,
          },
        },
      },
    }),
  })
  const url = (orden.links || []).find((l) => l.rel === "payer-action" || l.rel === "approve")?.href
  if (!url) throw new Error("PayPal no devolvió la liga de pago")
  return { url, monto: resta, moneda, cobro }
}

/** Regreso de PayPal: se cobra la orden y se anota el pago. Devuelve a dónde mandar al cliente. */
export async function capturarPaypal(token: string, ordenId: string, logger?: any): Promise<string> {
  const c = await cotizacionPorToken(token)
  const liga = ligaDe(c)
  if (!/^[A-Z0-9]{10,30}$/i.test(ordenId || "")) return `${liga}?pago=error`
  const pp = await paypalDelNegocio(c.negocio_id)
  if (!pp) return `${liga}?pago=error`

  let orden = await paypal<any>(`/v2/checkout/orders/${ordenId}`)
  const unidad = orden.purchase_units?.[0]
  if (unidad?.custom_id !== referenciaCot(c.id)) {
    logger?.warn?.(`[cotizador] PayPal ${ordenId}: no es de la cotización ${c.folio}`)
    return `${liga}?pago=error`
  }
  if (orden.status === "APPROVED") {
    orden = await paypal<any>(`/v2/checkout/orders/${ordenId}/capture`, {
      method: "POST",
      headers: { "PayPal-Request-Id": `cap-${ordenId}` },
      body: "{}",
    })
  }
  const captura = orden.purchase_units?.[0]?.payments?.captures?.[0]
  if (!captura) return `${liga}?pago=${orden.status === "PAYER_ACTION_REQUIRED" ? "error" : "pendiente"}`

  const destino = orden.purchase_units?.[0]?.payee?.merchant_id
  if (destino && destino !== pp.payer_id) {
    logger?.warn?.(`[cotizador] PayPal ${ordenId}: el dinero no fue a la cuenta del taller de ${c.folio}`)
    return `${liga}?pago=error`
  }

  const estado = captura.status === "COMPLETED" ? "approved" : captura.status === "PENDING" ? "pending" : String(captura.status || "").toLowerCase()
  const monto = Number(captura.amount?.value || 0)
  const moneda = String(captura.amount?.currency_code || "MXN")
  const [negocio, config] = await Promise.all([negocioDe(c.negocio_id), configDe(c.negocio_id)])
  // Cotización en COP/PEN/CLP cobrada en dólares: la orden fue por todo lo que
  // faltaba del anticipo, así que cubre eso en la moneda de la cotización.
  const monedaCot = monedaDe(config)
  const montoCot = monedaCot === moneda ? monto : Math.round((anticipoDe(c) - num(c.anticipo_pagado)) * 100) / 100
  const pct = comisionPct(negocio?.plan, negocio?.trial_hasta)
  const tope = moneda === "USD" ? COMISION_TOPE_USD : COMISION_TOPE
  const comision = Math.min(tope, Math.round(monto * pct) / 100)
  const idPago = `pp:${captura.id}`

  const previo = await supa<any[]>(`/rest/v1/cotizacion_pagos?mp_payment_id=eq.${encodeURIComponent(idPago)}&select=estado&limit=1`)
  const recienAprobado = estado === "approved" && previo[0]?.estado !== "approved"
  await guardarPago({
    cotizacion_id: c.id,
    negocio_id: c.negocio_id,
    mp_payment_id: idPago,
    proveedor: "paypal",
    moneda,
    comision_cobrada: false, // se cobra en el corte del mes
    monto,
    comision_hetna: comision,
    estado,
    metodo: "paypal",
    pagador: orden.payer?.email_address || null,
    detalle: {
      orden: ordenId,
      neto: captura.seller_receivable_breakdown?.net_amount?.value || null,
      ...(monedaCot !== moneda ? { monto_cotizacion: montoCot, moneda_cotizacion: monedaCot } : {}),
    },
    actualizado: new Date().toISOString(),
  })
  const neto = Number(captura.seller_receivable_breakdown?.net_amount?.value || 0)
  await trasPago(
    c,
    {
      monto: montoCot,
      recienAprobado,
      pagador: orden.payer?.email_address || null,
      nombre: orden.payer?.name?.given_name || null,
      dondeLlega:
        (monedaCot !== moneda ? `Se cobró en dólares: ${dinero(monto, moneda)}. ` : "") +
        (neto > 0 ? `Te llegan ${dinero(neto, moneda)} a tu PayPal (ya sin la comisión de PayPal). ` : "El dinero entra a tu PayPal. ") +
        `La comisión HETNA (${dinero(comision, moneda)}) se cobra en el corte del mes.`,
    },
    logger
  )
  logger?.info?.(`[cotizador] PayPal ${estado} de ${monto} ${moneda} en ${c.folio} (comisión HETNA pendiente ${comision})`)
  return `${liga}?pago=${estado === "approved" ? "ok" : "pendiente"}`
}

// "Iniciar sesión con PayPal": confirma que la cuenta es del taller y nos da
// su id de cuenta (payer_id) para mandarle el dinero. En la app de PayPal de
// HETNA hay que activar "Log in with PayPal" con la URL de regreso
// https://hetnacnc.com/api/cotizador-paypal/callback y los datos: correo y
// "PayPal account ID (payer ID)".
const PP_WEB = () => (process.env.PAYPAL_SANDBOX === "true" ? "https://www.sandbox.paypal.com" : "https://www.paypal.com")
const PP_API = () => (process.env.PAYPAL_SANDBOX === "true" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com")
export const REDIRECT_PP = `${API}/cotizador-paypal/callback`

export async function ligaParaPaypal(sesion: string | undefined) {
  if (!paypalListo()) throw new ErrorSuscripcion("Vincular PayPal todavía no está activo. Avísanos por WhatsApp.", 503)
  const { negocio } = await adminDesdeToken(sesion)
  const datos = `pp-${negocio.id}.${Date.now()}`
  const state = `${datos}.${firmar(datos)}`
  const url =
    `${PP_WEB()}/signin/authorize?flowEntry=static&client_id=${encodeURIComponent(process.env.PAYPAL_CLIENT_ID || "")}` +
    `&response_type=code&scope=${encodeURIComponent("openid email https://uri.paypal.com/services/paypalattributes")}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_PP)}&state=${encodeURIComponent(state)}`
  return { url }
}

export async function terminarPaypal(code: string, state: string) {
  const [a, ts, firma] = String(state || "").split(".")
  let valida = false
  try {
    valida = Boolean(a?.startsWith("pp-") && firma) && timingSafeEqual(Buffer.from(firma), Buffer.from(firmar(`${a}.${ts}`)))
  } catch {
    valida = false
  }
  if (!valida) throw new ErrorSuscripcion("La liga de PayPal no es válida.")
  if (Date.now() - Number(ts) > 30 * 60_000) throw new ErrorSuscripcion("La liga de PayPal venció. Vuelve a intentarlo desde la app.")
  const negocioId = a.slice(3)
  const credencial = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64")
  const r = await fetch(`${PP_API()}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${credencial}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code }),
    signal: AbortSignal.timeout(15_000),
  })
  const t = (await r.json().catch(() => ({}))) as any
  if (!r.ok || !t.access_token) throw new Error(`PayPal oauth ${r.status}: ${t.error_description || t.error || ""}`)
  const u = await fetch(`${PP_API()}/v1/identity/oauth2/userinfo?schema=paypalv1.1`, {
    headers: { Authorization: `Bearer ${t.access_token}` },
    signal: AbortSignal.timeout(15_000),
  })
  const info = (await u.json().catch(() => ({}))) as any
  const payerId = String(info.payer_id || "").trim()
  if (!u.ok || !payerId) throw new Error(`PayPal userinfo ${u.status}: sin payer_id (¿se activó el dato "PayPal account ID" en Log in with PayPal?)`)
  const correo = (info.emails || []).find((e) => e.primary)?.value || info.emails?.[0]?.value || info.email || null
  await supa(`/rest/v1/negocios_paypal?on_conflict=negocio_id`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      negocio_id: negocioId,
      payer_id: payerId,
      email: correo,
      nombre: info.name || null,
      verificada: info.verified_account === true || info.verified_account === "true" ? true : null,
      actualizado: new Date().toISOString(),
    }),
  })
  return { negocioId, correo }
}

export async function estadoPaypal(sesion: string | undefined) {
  const { negocio } = await adminDesdeToken(sesion)
  const fila = await paypalDelNegocio(negocio.id)
  let pendiente = 0
  try {
    const filas = await supa<any[]>(
      `/rest/v1/cotizacion_pagos?negocio_id=eq.${negocio.id}&proveedor=eq.paypal&estado=eq.approved&comision_cobrada=eq.false&select=comision_hetna`
    )
    pendiente = Math.round(filas.reduce((s, f) => s + Number(f.comision_hetna || 0), 0) * 100) / 100
  } catch {
    // aún sin columnas
  }
  return {
    disponible: paypalListo(),
    conectado: Boolean(fila),
    email: fila?.email || null,
    conectado_en: fila?.conectado_en || null,
    comision_pct: comisionPct(negocio.plan),
    comision_tope: COMISION_TOPE,
    comision_tope_usd: COMISION_TOPE_USD,
    comision_pendiente: pendiente,
  }
}

export async function desconectarPaypal(sesion: string | undefined) {
  const { negocio } = await adminDesdeToken(sesion)
  await supa(`/rest/v1/negocios_paypal?negocio_id=eq.${negocio.id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } })
  return { ok: true }
}

// ── OAuth: conectar la cuenta del taller ───────────────────────────────
// Firma del `state` de OAuth (Mercado Pago y PayPal). Antes usaba el secreto de
// Mercado Pago con "sin-secreto" de respaldo: sin esa variable cualquiera podía
// fabricar un state y conectar SU cuenta de PayPal al taller de otro, y quedarse
// con sus anticipos (auditoría del 14 nov 2026). Ahora usa un secreto propio
// (o el JWT del API) y, si no hay ninguno, no firma.
const secretoState = () => {
  const s = process.env.OAUTH_STATE_SECRET || process.env.JWT_SECRET || ""
  if (!s || s === "supersecret") throw new ErrorSuscripcion("Conectar cuentas de cobro no está disponible ahora. Avísanos por WhatsApp.", 503)
  return s
}
const firmar = (datos: string) => createHmac("sha256", secretoState()).update(datos).digest("base64url")

export async function ligaParaConectar(sesion: string | undefined) {
  if (!mpConexionLista()) throw new ErrorSuscripcion("Conectar Mercado Pago todavía no está activo. Avísanos por WhatsApp.", 503)
  const { negocio } = await adminDesdeToken(sesion)
  const datos = `${negocio.id}.${Date.now()}`
  const state = `${datos}.${firmar(datos)}`
  const url =
    `https://auth.mercadopago.com.mx/authorization?client_id=${encodeURIComponent(appId())}` +
    `&response_type=code&platform_id=mp&state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(REDIRECT_MP)}`
  return { url }
}

export function leerState(state: string): string | null {
  const partes = String(state || "").split(".")
  if (partes.length !== 3) return null
  const [negocioId, ts, firma] = partes
  const esperada = firmar(`${negocioId}.${ts}`)
  try {
    if (!timingSafeEqual(Buffer.from(firma), Buffer.from(esperada))) return null
  } catch {
    return null
  }
  if (Date.now() - Number(ts) > 30 * 60_000) return null // media hora para terminar
  return negocioId
}

export async function terminarConexion(code: string, state: string) {
  const negocioId = leerState(state)
  if (!negocioId) throw new ErrorSuscripcion("La liga de conexión venció. Vuelve a intentarlo desde la app.")
  const r = await fetch(`${MP_API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: appId(),
      client_secret: clientSecret(),
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_MP,
    }),
    signal: AbortSignal.timeout(15_000),
  })
  const t = (await r.json().catch(() => ({}))) as any
  if (!r.ok || !t.access_token) throw new Error(`Mercado Pago oauth ${r.status}: ${t.message || t.error || "sin token"}`)
  await guardarConexion(negocioId, t)
  return { negocioId, mpUserId: String(t.user_id) }
}

export async function estadoConexion(sesion: string | undefined) {
  const { negocio } = await adminDesdeToken(sesion)
  const fila = await mpDelNegocio(negocio.id)
  return {
    disponible: mpConexionLista(),
    conectado: Boolean(fila),
    mp_user_id: fila?.mp_user_id || null,
    conectado_en: fila?.conectado_en || null,
    comision_pct: comisionPct(negocio.plan),
    comision_tope: COMISION_TOPE,
  }
}

export async function desconectar(sesion: string | undefined) {
  const { negocio } = await adminDesdeToken(sesion)
  await supa(`/rest/v1/negocios_mp?negocio_id=eq.${negocio.id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } })
  return { ok: true }
}
