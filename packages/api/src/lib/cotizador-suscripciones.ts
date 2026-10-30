// Suscripciones del Cotizador HETNA (app Flutter + Supabase) cobradas con
// Mercado Pago (México, MXN). PayPal (USD, mercado de EE. UU.) vive en
// cotizador-paypal.ts y usa las mismas piezas de este archivo.
//
// La app no puede decidir su plan: el plan vive en `negocios.plan` de la base
// de Supabase del Cotizador, protegido por un trigger que sólo deja cambiarlo
// con la llave de servicio. Este archivo es ese "alguien con la llave":
//
//   1. La app pide suscribirse  -> POST /api/cotizador-suscripcion
//      (con la sesión de Supabase del usuario). Se crea una suscripción
//      (preapproval) en Mercado Pago y la app abre su enlace de pago.
//   2. Mercado Pago avisa      -> POST /api/mp-suscripcion
//      No se confía en el aviso: se consulta la suscripción a Mercado Pago y
//      con eso se actualiza `negocios.plan`.
//   3. "Ya pagué, actualizar"  -> POST /api/cotizador-suscripcion/verificar
//      Lo mismo que el aviso, por si el aviso tarda o no llega.
//   4. Cancelar                -> POST /api/cotizador-suscripcion/cancelar
//      El plan sigue hasta el fin del periodo pagado; el job
//      cotizador-planes-vencidos lo baja a Gratis al vencer.
//
// Un taller tiene a lo más UNA suscripción activa: al activarse una (de
// Mercado Pago o de PayPal) se cancela la anterior, sea del proveedor que sea.
//
// Variables (.env de packages/api):
//   MERCADOPAGO_ACCESS_TOKEN        la misma de la tienda
//   COTIZADOR_SUPABASE_URL          https://ldfmkfbhcbsbecfbzsny.supabase.co (por defecto)
//   COTIZADOR_SUPABASE_SERVICE_KEY  Supabase > Project Settings > API > service_role

// cotizador-paypal.ts también importa este archivo; sólo se usan sus funciones
// dentro de otras funciones, así que el ciclo no causa problemas al cargar.
import { cancelarSuscripcionPaypal, sincronizarSuscripcionPaypal } from "./cotizador-paypal"
import { paypal, paypalListo } from "./paypal-api"
import { correosDeLaCasa, PLAN_APP_DE_LA_CASA } from "./cuentas-casa"

const MP_API = "https://api.mercadopago.com"
const mpToken = () => process.env.MERCADOPAGO_ACCESS_TOKEN || ""
const supaUrl = () => (process.env.COTIZADOR_SUPABASE_URL || "https://ldfmkfbhcbsbecfbzsny.supabase.co").replace(/\/$/, "")
const supaKey = () => process.env.COTIZADOR_SUPABASE_SERVICE_KEY || ""
export const RETORNO = process.env.COTIZADOR_URL_RETORNO || "https://hetnacnc.com/cotizador/"

// precio: MXN al mes con Mercado Pago (mismos que lib/services/planes.dart de la
// app y hetnacnc.com). precioUsd: USD al mes con PayPal.
export const PLANES_COTIZADOR = {
  taller: {
    nombre: "Taller",
    precio: Number(process.env.COTIZADOR_PRECIO_TALLER || 299),
    precioUsd: Number(process.env.COTIZADOR_PRECIO_USD_TALLER || 29),
  },
  pro: {
    nombre: "Pro",
    precio: Number(process.env.COTIZADOR_PRECIO_PRO || 599),
    precioUsd: Number(process.env.COTIZADOR_PRECIO_USD_PRO || 59),
  },
  industrial: {
    nombre: "Industrial",
    precio: Number(process.env.COTIZADOR_PRECIO_INDUSTRIAL || 1199),
    precioUsd: Number(process.env.COTIZADOR_PRECIO_USD_INDUSTRIAL || 99),
  },
} as const
export type PlanPago = keyof typeof PLANES_COTIZADOR

export class ErrorSuscripcion extends Error {
  constructor(mensaje: string, public status = 400) {
    super(mensaje)
  }
}

export const suscripcionesListas = () => Boolean(mpToken() && supaKey())
export const supabaseListo = () => Boolean(supaKey())

/** Precios y medios de pago activos, para la pantalla de planes de la app. */
export function preciosCotizador() {
  return {
    planes: Object.fromEntries(
      Object.entries(PLANES_COTIZADOR).map(([k, v]) => [k, { nombre: v.nombre, mxn: v.precio, usd: v.precioUsd }])
    ),
    mercadopago: suscripcionesListas(),
    paypal: Boolean(supaKey() && paypalListo()),
  }
}

// ── Supabase (con la llave de servicio) ───────────────────────────────────
async function supa<T = any>(ruta: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${supaUrl()}${ruta}`, {
    ...init,
    headers: {
      apikey: supaKey(),
      Authorization: `Bearer ${supaKey()}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(10_000),
  })
  const texto = await res.text()
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${texto.slice(0, 300)}`)
  return (texto ? JSON.parse(texto) : null) as T
}

export type Negocio = {
  id: string
  nombre: string | null
  plan: string | null
  plan_estado: string | null
  plan_renueva: string | null
  plan_vence: string | null
  pago_proveedor: string | null
  mp_suscripcion_id: string | null
  mp_suscripcion_pendiente: string | null
  pp_suscripcion_id: string | null
  pp_suscripcion_pendiente: string | null
}
const CAMPOS_NEGOCIO =
  "id,nombre,plan,plan_estado,plan_renueva,plan_vence,pago_proveedor,mp_suscripcion_id,mp_suscripcion_pendiente,pp_suscripcion_id,pp_suscripcion_pendiente"

export async function leerNegocio(id: string): Promise<Negocio | null> {
  const filas = await supa<Negocio[]>(`/rest/v1/negocios?id=eq.${encodeURIComponent(id)}&select=${CAMPOS_NEGOCIO}`)
  return filas[0] ?? null
}

export async function actualizarNegocio(id: string, cambios: Record<string, unknown>) {
  await supa(`/rest/v1/negocios?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(cambios),
    headers: { Prefer: "return=minimal" },
  })
}

export async function anotarEvento(e: Record<string, unknown>) {
  try {
    await supa("/rest/v1/suscripciones_eventos", {
      method: "POST",
      body: JSON.stringify(e),
      headers: { Prefer: "return=minimal" },
    })
  } catch {
    // la bitácora nunca detiene el cobro
  }
}

/** Usuario dueño del token de sesión de Supabase, y su taller (debe ser administrador). */
export async function adminDesdeToken(token: string | undefined): Promise<{ userId: string; correo: string; negocio: Negocio }> {
  if (!token) throw new ErrorSuscripcion("Inicia sesión en el Cotizador.", 401)
  const r = await fetch(`${supaUrl()}/auth/v1/user`, {
    headers: { apikey: supaKey(), Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  })
  if (!r.ok) throw new ErrorSuscripcion("Tu sesión expiró. Vuelve a iniciar sesión.", 401)
  const user = (await r.json()) as { id: string; email?: string }
  const filas = await supa<{ negocio_id: string; rol: string }[]>(
    `/rest/v1/usuarios_negocio?user_id=eq.${user.id}&activo=eq.true&select=negocio_id,rol&order=id.desc&limit=1`
  )
  const fila = filas[0]
  if (!fila) throw new ErrorSuscripcion("Tu cuenta no tiene taller.", 403)
  if (!["administrador", "super_admin"].includes(fila.rol))
    throw new ErrorSuscripcion("Sólo el administrador del taller puede cambiar el plan.", 403)
  const negocio = await leerNegocio(fila.negocio_id)
  if (!negocio) throw new ErrorSuscripcion("No encontramos tu taller.", 404)
  return { userId: user.id, correo: user.email || "", negocio }
}

// ── Mercado Pago ──────────────────────────────────────────────────────────
async function mp<T = any>(ruta: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${MP_API}${ruta}`, {
    ...init,
    headers: { Authorization: `Bearer ${mpToken()}`, "Content-Type": "application/json", ...(init.headers || {}) },
    signal: AbortSignal.timeout(15_000),
  })
  const cuerpo = (await res.json().catch(() => ({}))) as any
  if (!res.ok) {
    const msg = cuerpo?.message || cuerpo?.error || `HTTP ${res.status}`
    throw new Error(`Mercado Pago: ${msg}`)
  }
  return cuerpo as T
}

type Preapproval = {
  id: string
  status: "pending" | "authorized" | "paused" | "cancelled" | string
  external_reference?: string
  payer_email?: string
  init_point?: string
  next_payment_date?: string
  auto_recurring?: { transaction_amount?: number; currency_id?: string }
}

export const referencia = (negocioId: string, plan: PlanPago) => `cotizador:${negocioId}:${plan}`
export function leerReferencia(ref: string | undefined): { negocioId: string; plan: PlanPago } | null {
  const m = /^cotizador:([0-9a-f-]{36}):(taller|pro|industrial)$/i.exec(ref || "")
  return m ? { negocioId: m[1], plan: m[2].toLowerCase() as PlanPago } : null
}

/** Crea la suscripción en Mercado Pago y devuelve el enlace para pagar. */
export async function crearSuscripcion(p: { token?: string; plan: string; correoPago?: string }) {
  if (!suscripcionesListas()) throw new ErrorSuscripcion("El cobro en línea todavía no está activo. Escríbenos por WhatsApp.", 503)
  if (!(p.plan in PLANES_COTIZADOR)) throw new ErrorSuscripcion("Ese plan no existe.")
  const plan = p.plan as PlanPago
  const { correo, negocio } = await adminDesdeToken(p.token)
  const correoPago = (p.correoPago || correo).trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correoPago)) throw new ErrorSuscripcion("Revisa el correo de tu cuenta de Mercado Pago.")
  if (negocio.plan === "master") throw new ErrorSuscripcion("La cuenta de HETNA ya tiene todo abierto.")
  if (negocio.plan === plan && negocio.plan_estado === "activa")
    throw new ErrorSuscripcion(`Tu taller ya tiene el plan ${PLANES_COTIZADOR[plan].nombre}.`)

  const info = PLANES_COTIZADOR[plan]
  const pre = await mp<Preapproval>("/preapproval", {
    method: "POST",
    body: JSON.stringify({
      reason: `Cotizador HETNA — Plan ${info.nombre}`,
      external_reference: referencia(negocio.id, plan),
      payer_email: correoPago,
      back_url: RETORNO,
      status: "pending",
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: info.precio,
        currency_id: "MXN",
      },
    }),
  })
  if (!pre.init_point) throw new ErrorSuscripcion("Mercado Pago no devolvió el enlace de pago. Intenta de nuevo.", 502)

  await actualizarNegocio(negocio.id, { mp_suscripcion_pendiente: pre.id, mp_correo_pago: correoPago })
  await anotarEvento({ negocio_id: negocio.id, preapproval_id: pre.id, evento: "creada", plan, estado: pre.status, monto: info.precio })
  return { url: pre.init_point, id: pre.id }
}

export type Bitacora = { info: (m: string) => void; error: (m: string) => void }

/** Cancela en PayPal la suscripción anterior del taller (si tenía), al activarse otra. */
export async function cancelarPaypalAnterior(negocio: Negocio, nuevaId: string, logger?: Bitacora) {
  const anterior = negocio.pp_suscripcion_id
  if (!anterior || anterior === nuevaId || !paypalListo()) return
  try {
    await paypal(`/v1/billing/subscriptions/${anterior}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason: "Cambio de plan o de forma de pago en el Cotizador HETNA" }),
    })
  } catch (e) {
    logger?.error(`[cotizador] no se pudo cancelar la suscripción de PayPal ${anterior}: ${(e as Error).message}`)
  }
}

/** Cancela en Mercado Pago la suscripción anterior del taller (si tenía), al activarse otra. */
export async function cancelarMercadoPagoAnterior(negocio: Negocio, nuevaId: string, logger?: Bitacora) {
  const anterior = negocio.mp_suscripcion_id
  if (!anterior || anterior === nuevaId || !mpToken()) return
  try {
    await mp(`/preapproval/${anterior}`, { method: "PUT", body: JSON.stringify({ status: "cancelled" }) })
  } catch (e) {
    logger?.error(`[cotizador] no se pudo cancelar la suscripción anterior ${anterior}: ${(e as Error).message}`)
  }
}

/** Lo ya pagado se respeta: el plan sigue hasta `hasta`; si ya pasó, baja a Gratis. */
export async function marcarSuscripcionTerminada(
  negocio: Negocio,
  p: { id: string; proveedor: string; estado: "pausada" | "cancelada"; hasta: string | null; plan: string; monto?: number },
  logger?: Bitacora
) {
  const hasta = p.hasta && new Date(p.hasta).getTime() > Date.now() ? p.hasta : null
  await actualizarNegocio(
    negocio.id,
    hasta ? { plan_estado: p.estado, plan_vence: hasta } : { plan: "gratis", plan_estado: p.estado, plan_vence: null }
  )
  await anotarEvento({ negocio_id: negocio.id, preapproval_id: p.id, evento: p.estado, plan: p.plan, estado: p.proveedor, monto: p.monto ?? null })
  logger?.info(`[cotizador] taller ${negocio.id}: suscripción de ${p.proveedor} ${p.estado}${hasta ? ` (plan hasta ${hasta})` : ", pasa a Gratis"}`)
  return { plan: hasta ? negocio.plan : "gratis", estado: p.estado }
}

/**
 * Lee la suscripción en Mercado Pago y deja el taller como corresponde.
 * Junto con la de PayPal, es lo único que cambia `negocios.plan`. Se puede llamar las veces que sea.
 */
export async function sincronizarSuscripcion(preapprovalId: string, logger?: Bitacora) {
  if (!/^[0-9a-z]{10,64}$/i.test(preapprovalId)) return null
  const pre = await mp<Preapproval>(`/preapproval/${preapprovalId}`)
  const ref = leerReferencia(pre.external_reference)
  if (!ref) return null // no es del Cotizador
  const negocio = await leerNegocio(ref.negocioId)
  if (!negocio) return null
  const precio = PLANES_COTIZADOR[ref.plan].precio
  const monto = Number(pre.auto_recurring?.transaction_amount || 0)

  if (pre.status === "authorized") {
    if (pre.auto_recurring?.currency_id !== "MXN" || monto + 0.01 < precio) {
      logger?.error(`[cotizador] suscripción ${pre.id} con monto inesperado: ${monto} ${pre.auto_recurring?.currency_id}`)
      return null
    }
    // Si ya tenía otra suscripción activa (cambio de plan o venía de PayPal), se cancela la anterior
    await cancelarMercadoPagoAnterior(negocio, pre.id, logger)
    await cancelarPaypalAnterior(negocio, "", logger)
    await actualizarNegocio(negocio.id, {
      plan: ref.plan,
      plan_estado: "activa",
      plan_renueva: pre.next_payment_date ?? null,
      plan_vence: null,
      pago_proveedor: "mercadopago",
      mp_suscripcion_id: pre.id,
      pp_suscripcion_id: null,
      // la pendiente sólo se limpia si es ésta: puede haber otra en camino (cambio de plan)
      ...(negocio.mp_suscripcion_pendiente === pre.id ? { mp_suscripcion_pendiente: null } : {}),
    })
    if (negocio.plan !== ref.plan || negocio.plan_estado !== "activa" || negocio.mp_suscripcion_id !== pre.id) {
      await anotarEvento({ negocio_id: negocio.id, preapproval_id: pre.id, evento: "activada", plan: ref.plan, estado: pre.status, monto })
      logger?.info(`[cotizador] taller ${negocio.id} con plan ${ref.plan} (suscripción ${pre.id})`)
    }
    return { plan: ref.plan, estado: "activa" }
  }

  if ((pre.status === "paused" || pre.status === "cancelled") && negocio.mp_suscripcion_id === pre.id) {
    // Lo ya pagado se respeta: el plan sigue hasta la siguiente fecha de cobro
    return marcarSuscripcionTerminada(
      negocio,
      {
        id: pre.id,
        proveedor: "mercadopago",
        estado: pre.status === "paused" ? "pausada" : "cancelada",
        hasta: pre.next_payment_date || negocio.plan_renueva,
        plan: ref.plan,
        monto,
      },
      logger
    )
  }

  return { plan: negocio.plan, estado: pre.status }
}

/** Para "Ya pagué": revisa las suscripciones pendientes (o la activa) del taller, de los dos proveedores. */
export async function verificarSuscripcion(token?: string) {
  if (!supabaseListo()) throw new ErrorSuscripcion("El cobro en línea todavía no está activo.", 503)
  const { negocio } = await adminDesdeToken(token)
  let resultado: { plan: string | null; estado: string | null } | null = null
  const mpId = negocio.mp_suscripcion_pendiente || negocio.mp_suscripcion_id
  if (mpId && mpToken()) resultado = (await sincronizarSuscripcion(mpId)) ?? resultado
  const ppId = negocio.pp_suscripcion_pendiente || negocio.pp_suscripcion_id
  if (ppId && paypalListo()) {
    resultado = (await sincronizarSuscripcionPaypal(ppId)) ?? resultado
  }
  if (resultado) return resultado
  const actual = await leerNegocio(negocio.id)
  return { plan: actual?.plan ?? negocio.plan, estado: actual?.plan_estado ?? negocio.plan_estado }
}

/** Cancela la suscripción activa (del proveedor que sea); el plan se queda hasta el fin del periodo pagado. */
export async function cancelarSuscripcion(token?: string) {
  if (!supabaseListo()) throw new ErrorSuscripcion("El cobro en línea todavía no está activo.", 503)
  const { negocio } = await adminDesdeToken(token)
  if (negocio.pago_proveedor === "paypal" && negocio.pp_suscripcion_id) {
    return cancelarSuscripcionPaypal(negocio)
  }
  if (!negocio.mp_suscripcion_id) throw new ErrorSuscripcion("Tu taller no tiene una suscripción activa.")
  if (!mpToken()) throw new ErrorSuscripcion("El cobro en línea todavía no está activo.", 503)
  await mp(`/preapproval/${negocio.mp_suscripcion_id}`, { method: "PUT", body: JSON.stringify({ status: "cancelled" }) })
  return (await sincronizarSuscripcion(negocio.mp_suscripcion_id)) ?? { plan: negocio.plan, estado: "cancelada" }
}

/** Para el aviso de un cobro mensual: de qué suscripción es. */
export async function preapprovalDePago(authorizedPaymentId: string): Promise<string | null> {
  if (!/^\d+$/.test(authorizedPaymentId)) return null
  const p = await mp<{ preapproval_id?: string }>(`/authorized_payments/${authorizedPaymentId}`)
  return p.preapproval_id || null
}

/** Talleres cuya suscripción se canceló o pausó y ya pasó lo que habían pagado. */
export async function bajarPlanesVencidos(): Promise<number> {
  if (!supaKey()) return 0
  const ahora = new Date().toISOString()
  const vencidos = await supa<{ id: string }[]>(
    `/rest/v1/negocios?plan_estado=in.(cancelada,pausada)&plan_vence=lt.${encodeURIComponent(ahora)}&select=id`
  )
  for (const n of vencidos) {
    await actualizarNegocio(n.id, { plan: "gratis", plan_vence: null })
    await anotarEvento({ negocio_id: n.id, evento: "vencida", plan: "gratis" })
  }
  return vencidos.length
}

// ── Cuentas de la casa ────────────────────────────────────────────────────
// Los talleres de las cuentas de HETNA (lib/cuentas-casa.ts) quedan siempre en
// "master" (todo abierto, el plan reservado para HETNA), sin vencimiento. Corre cada hora con el job de
// planes vencidos: si algo lo bajara (un aviso de pago, una cancelación), en la
// siguiente vuelta regresa solo. Devuelve cuántos talleres tuvo que ajustar.
export async function asegurarPlanesDeLaCasa(): Promise<number> {
  const correos = correosDeLaCasa()
  if (!supaKey() || !correos.length) return 0

  // Usuarios de Supabase con esos correos (la API de administración pagina)
  const ids: string[] = []
  for (let pagina = 1; pagina <= 20; pagina++) {
    const r = await supa<{ users?: { id: string; email?: string }[] }>(`/auth/v1/admin/users?page=${pagina}&per_page=500`)
    const usuarios = r?.users ?? []
    for (const u of usuarios) if (u.email && correos.includes(u.email.toLowerCase())) ids.push(u.id)
    if (usuarios.length < 500) break
  }

  let ajustados = 0
  for (const userId of ids) {
    const filas = await supa<{ negocio_id: string }[]>(
      `/rest/v1/usuarios_negocio?user_id=eq.${userId}&activo=eq.true&rol=in.(administrador,super_admin)&select=negocio_id`
    )
    for (const { negocio_id } of filas) {
      const n = await leerNegocio(negocio_id)
      if (!n || (n.plan === PLAN_APP_DE_LA_CASA && !n.plan_vence)) continue
      await actualizarNegocio(negocio_id, { plan: PLAN_APP_DE_LA_CASA, plan_vence: null, plan_renueva: null })
      await anotarEvento({ negocio_id, evento: "cortesia", plan: PLAN_APP_DE_LA_CASA })
      ajustados++
    }
  }
  return ajustados
}
