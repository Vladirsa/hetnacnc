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
import { adminDesdeToken, ErrorSuscripcion, supa } from "./cotizador-suscripciones"

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
  const filas = await supa<any[]>(`/rest/v1/negocios?id=eq.${id}&select=id,nombre,telefono,plan,trial_hasta&limit=1`)
  return filas[0] || null
}

async function configDe(negocioId: string) {
  const filas = await supa<any[]>(
    `/rest/v1/configuracion_empresa?negocio_id=eq.${negocioId}&select=nombre_comercial,telefono1,correo,logo_url,sitio_web,direccion&limit=1`
  )
  return filas[0] || null
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
    `/rest/v1/cotizacion_pagos?cotizacion_id=eq.${cotId}&select=mp_payment_id,monto,estado,metodo,creado&order=creado.desc`
  )
}

async function mpDelNegocio(negocioId: string) {
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
export async function paginaPublica(token: string) {
  const c = await cotizacionPorToken(token)
  const [negocio, config, cliente, items, pagos, mp] = await Promise.all([
    negocioDe(c.negocio_id),
    configDe(c.negocio_id),
    clienteDe(c.cliente_id),
    itemsDe(c.id),
    pagosDe(c.id),
    mpDelNegocio(c.negocio_id),
  ])
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
          cuerpo: `Buen momento para darle seguimiento. Total ${mxn(num(c.total))}.`,
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
    pdf: c.pdf_url || null,
    aceptada: c.aceptada_en ? { en: c.aceptada_en, por: c.aceptada_por } : null,
    anticipo: {
      monto: anticipo,
      pagado: num(c.anticipo_pagado),
      estado: anticipo > 0 ? c.anticipo_estado : "sin_anticipo",
      se_puede_pagar: Boolean(mp) && anticipo > 0 && num(c.anticipo_pagado) < anticipo && !estaVencida && c.estado !== "Rechazada",
    },
    pagos: pagos.filter((p) => p.estado === "approved").map((p) => ({ monto: num(p.monto), metodo: p.metodo, fecha: p.creado })),
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
    await avisarTaller({
      negocioId: c.negocio_id,
      tipo: "cotizacion_aceptada",
      titulo: `✅ ${quien} aceptó la cotización ${c.folio}`,
      cuerpo:
        `Total ${mxn(num(c.total))}.` +
        (anticipo > 0 && c.anticipo_estado !== "pagado" ? ` Falta el anticipo de ${mxn(anticipo)}; puede pagarlo desde la misma liga.` : ""),
      cotizacionId: c.id,
      clienteId: c.cliente_id,
      mensajeCliente: `¡Gracias, ${quien}! Recibimos tu aceptación de la cotización ${c.folio}.` +
        (anticipo > 0 ? ` En cuanto se acredite el anticipo de ${mxn(anticipo)} arrancamos. Puedes pagarlo aquí: ${ligaDe(c)}` : " Te avisamos cuando empecemos."),
      liga: ligaDe(c),
    })
  }
  return { ok: true, en }
}

// ── Mercado Pago con el token del taller ───────────────────────────────
async function mpCon<T = any>(token: string, ruta: string, init: RequestInit = {}): Promise<T> {
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
async function tokenDelTaller(negocioId: string): Promise<{ token: string; mpUserId: string }> {
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
  await supa(`/rest/v1/cotizacion_pagos?on_conflict=mp_payment_id`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      cotizacion_id: c.id,
      negocio_id: c.negocio_id,
      mp_payment_id: String(p.id),
      monto,
      comision_hetna: comision,
      estado: String(p.status || ""),
      metodo: p.payment_type_id || null,
      pagador: p.payer?.email || null,
      detalle: { status_detail: p.status_detail, date_approved: p.date_approved, net_received_amount: p.transaction_details?.net_received_amount },
      actualizado: new Date().toISOString(),
    }),
  })

  // Suma de aprobados
  const aprobados = await supa<any[]>(`/rest/v1/cotizacion_pagos?cotizacion_id=eq.${c.id}&estado=eq.approved&select=monto`)
  const pagado = Math.round(aprobados.reduce((s, x) => s + Number(x.monto || 0), 0) * 100) / 100
  const anticipo = anticipoDe(c)
  const cambios: Record<string, unknown> = { anticipo_pagado: pagado }
  if (pagado >= anticipo && anticipo > 0) {
    cambios.anticipo_estado = "pagado"
    if (!c.aceptada_en) {
      cambios.aceptada_en = new Date().toISOString()
      cambios.aceptada_por = p.payer?.email || "Pago en línea"
    }
    if (c.estado !== "Pedido") cambios.estado = "Aprobada"
  }
  await patchCotizacion(c.id, cambios)
  logger?.info?.(`[cotizador] pago ${p.status} de $${monto} en ${c.folio} (comisión HETNA $${comision})`)

  if (recienAprobado) {
    const completo = cambios.anticipo_estado === "pagado" && c.anticipo_estado !== "pagado"
    const pedidoId = completo ? await asegurarPedido(c, pagado, logger) : null
    const cliente = await clienteDe(c.cliente_id).catch(() => null)
    const quien = cliente?.nombre || p.payer?.first_name || "Tu cliente"
    const neto = Number(p.transaction_details?.net_received_amount || 0)
    await avisarTaller(
      {
        negocioId: c.negocio_id,
        tipo: "anticipo_pagado",
        titulo: `💰 ${quien} pagó ${mxn(monto)} de la cotización ${c.folio}`,
        cuerpo:
          (completo ? "Anticipo completo: el pedido ya está en Avances como \"Anticipo recibido\". " : `Lleva ${mxn(pagado)} de ${mxn(anticipo)}. `) +
          (neto > 0 ? `Te llegan ${mxn(neto)} a tu Mercado Pago (ya sin comisiones).` : "El dinero entra a tu Mercado Pago."),
        cotizacionId: c.id,
        clienteId: c.cliente_id,
        pedidoId,
        mensajeCliente: `¡Gracias, ${quien}! Recibimos tu pago de ${mxn(monto)} de la cotización ${c.folio}. Aquí puedes seguir tu pedido: ${ligaDe(c)}`,
        liga: ligaDe(c),
      },
      logger
    )
  }
  return { cotizacion: c.folio, estado: p.status, monto }
}

// ── OAuth: conectar la cuenta del taller ───────────────────────────────
const firmar = (datos: string) => createHmac("sha256", clientSecret() || "sin-secreto").update(datos).digest("base64url")

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
