// Suscripciones del Cotizador HETNA cobradas con Stripe (México, MXN, tarjeta sin
// crear cuenta). Mismo camino que Mercado Pago y PayPal (cotizador-suscripciones.ts):
//
//   1. La app pide suscribirse con proveedor "stripe" -> se abre una página de pago
//      de Stripe (Checkout) con el plan; el taller pone su tarjeta.
//   2. Stripe avisa -> POST /api/stripe-webhook. No se confía en el aviso: se consulta
//      la suscripción a Stripe y con eso se actualiza el plan del taller.
//   3. "Ya pagué" y "Cancelar" usan las mismas rutas que los otros proveedores.
//
// Los identificadores de Stripe se guardan en la base de hetnacnc (hetna_stripe_cotizador),
// no en Supabase: así no hace falta cambiar la base del Cotizador. En Supabase sólo se
// cambia el plan, con la llave de servicio, como siempre.
//
// El precio de cada plan se crea solo en Stripe la primera vez (lookup_key con el precio):
// si cambias COTIZADOR_PRECIO_*, se crea uno nuevo y los ya suscritos siguen con el suyo.
import { container } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { stripe, stripeListo } from "./stripe-api"
import {
  ErrorSuscripcion, PLANES_COTIZADOR, RETORNO, type Bitacora, type Negocio, type PlanPago,
  actualizarNegocio, adminDesdeToken, anotarEvento, atribuirPago, cancelarMercadoPagoAnterior, cancelarPaypalAnterior,
  leerNegocio, leerReferencia, marcarSuscripcionTerminada, referencia, supabaseListo,
} from "./cotizador-suscripciones"

export const T_STRIPE_COTIZADOR = "hetna_stripe_cotizador"
export const stripeSuscripcionesListas = () => Boolean(supabaseListo() && stripeListo())

const knex = () => container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any

let listo = false
async function asegurarTabla(k: any) {
  if (listo) return
  if (!(await k.schema.hasTable(T_STRIPE_COTIZADOR))) {
    await k.schema.createTable(T_STRIPE_COTIZADOR, (t: any) => {
      t.text("negocio_id").primary()
      t.text("suscripcion_id").nullable()
      t.text("sesion_pendiente").nullable()
      t.text("plan").nullable()
      t.text("estado").nullable()
      t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(k.fn.now())
    })
  }
  listo = true
}
async function fila(negocioId: string) {
  const k = knex()
  await asegurarTabla(k)
  return k(T_STRIPE_COTIZADOR).where({ negocio_id: negocioId }).first()
}
async function guardar(negocioId: string, cambios: Record<string, unknown>) {
  const k = knex()
  await asegurarTabla(k)
  await k(T_STRIPE_COTIZADOR).insert({ negocio_id: negocioId, ...cambios, updated_at: k.fn.now() }).onConflict("negocio_id").merge()
}

const lookupKey = (plan: PlanPago) => `hetna_cotizador_${plan}_mxn_${PLANES_COTIZADOR[plan].precio}`

/** El precio mensual del plan en Stripe (lo crea si no existe). */
export async function precioDelPlan(plan: PlanPago): Promise<string> {
  const lk = lookupKey(plan)
  const lista = await stripe<{ data: { id: string }[] }>("/prices", { metodo: "GET", datos: { lookup_keys: [lk], active: true, limit: 1 } })
  if (lista.data[0]) return lista.data[0].id
  const p = await stripe<{ id: string }>("/prices", {
    datos: {
      currency: "mxn",
      unit_amount: Math.round(PLANES_COTIZADOR[plan].precio * 100),
      recurring: { interval: "month" },
      lookup_key: lk,
      product_data: { name: `Cotizador HETNA · Plan ${PLANES_COTIZADOR[plan].nombre}` },
      metadata: { plan },
    },
    idempotencia: `precio-${lk}`,
  })
  return p.id
}

/** Fin del periodo pagado (la API nueva lo pone en el renglón de la suscripción). */
export function finDePeriodo(sub: any): string | null {
  const s = sub?.current_period_end ?? sub?.items?.data?.[0]?.current_period_end
  return s ? new Date(Number(s) * 1000).toISOString() : null
}

export async function crearSuscripcionStripe(p: { token?: string; plan: string }) {
  if (!stripeSuscripcionesListas()) throw new ErrorSuscripcion("El pago con tarjeta todavía no está activo.", 503)
  if (!(p.plan in PLANES_COTIZADOR)) throw new ErrorSuscripcion("Ese plan no existe.")
  const plan = p.plan as PlanPago
  const { negocio, correo } = await adminDesdeToken(p.token)
  if (negocio.plan === "master") throw new ErrorSuscripcion("La cuenta de HETNA ya tiene todo abierto.")
  if (negocio.plan === plan && negocio.plan_estado === "activa")
    throw new ErrorSuscripcion(`Tu taller ya tiene el plan ${PLANES_COTIZADOR[plan].nombre}.`)

  const ref = referencia(negocio.id, plan)
  const sesion = await stripe<{ id: string; url: string }>("/checkout/sessions", {
    datos: {
      mode: "subscription",
      line_items: [{ price: await precioDelPlan(plan), quantity: 1 }],
      client_reference_id: ref,
      metadata: { ref },
      subscription_data: { metadata: { ref } },
      customer_email: correo || undefined,
      locale: "es-419",
      success_url: `${RETORNO}${RETORNO.includes("?") ? "&" : "?"}pago=stripe&sesion={CHECKOUT_SESSION_ID}`,
      cancel_url: RETORNO,
    },
  })
  if (!sesion.url) throw new ErrorSuscripcion("Stripe no devolvió el enlace de pago. Intenta de nuevo.", 502)
  await guardar(negocio.id, { sesion_pendiente: sesion.id, plan })
  await anotarEvento({ negocio_id: negocio.id, preapproval_id: sesion.id, evento: "creada", plan, estado: "stripe", monto: PLANES_COTIZADOR[plan].precio })
  return { url: sesion.url, id: sesion.id }
}

/** Cancela de inmediato la suscripción de Stripe anterior del taller (al activarse otra, del proveedor que sea). */
export async function cancelarStripeAnterior(negocioId: string, nuevaId: string, logger?: Bitacora) {
  if (!stripeListo()) return
  try {
    const f = await fila(negocioId)
    const anterior = f?.suscripcion_id
    if (!anterior || anterior === nuevaId) return
    await stripe(`/subscriptions/${anterior}`, { metodo: "DELETE" })
    await guardar(negocioId, { suscripcion_id: nuevaId || null, estado: nuevaId ? "activa" : "cancelada" })
  } catch (e) {
    logger?.error(`[cotizador] no se pudo cancelar la suscripción de Stripe anterior: ${(e as Error).message}`)
  }
}

/** Lee la suscripción en Stripe y deja el taller como corresponde. Se puede llamar las veces que sea. */
export async function sincronizarSuscripcionStripe(id: string, logger?: Bitacora) {
  if (!/^sub_[A-Za-z0-9]{8,80}$/.test(id)) return null
  const sub = await stripe<any>(`/subscriptions/${id}`)
  const ref = leerReferencia(sub?.metadata?.ref)
  if (!ref) return null // no es del Cotizador
  const negocio = await leerNegocio(ref.negocioId)
  if (!negocio) return null

  // Que lo cobrado sea el precio del plan, en pesos (no se confía en la referencia sola)
  const precio = sub.items?.data?.[0]?.price
  const esperado = Math.round(PLANES_COTIZADOR[ref.plan].precio * 100)
  if (!precio || precio.currency !== "mxn" || Number(precio.unit_amount) < esperado) {
    logger?.error(`[cotizador] suscripción Stripe ${id} con precio inesperado: ${precio?.unit_amount} ${precio?.currency}`)
    return null
  }
  const local = await fila(negocio.id)
  const hasta = finDePeriodo(sub)

  if (["active", "trialing", "past_due"].includes(sub.status)) {
    if (sub.cancel_at_period_end) {
      await guardar(negocio.id, { suscripcion_id: id, estado: "cancelada" })
      return marcarSuscripcionTerminada(negocio, { id, proveedor: "stripe", estado: "cancelada", hasta, plan: ref.plan }, logger)
    }
    // Una sola suscripción activa: se cancelan las demás (Stripe anterior, PayPal, Mercado Pago)
    await cancelarStripeAnterior(negocio.id, id, logger)
    await cancelarPaypalAnterior(negocio, "", logger)
    await cancelarMercadoPagoAnterior(negocio, "", logger)
    await actualizarNegocio(negocio.id, {
      plan: ref.plan, plan_estado: "activa", plan_renueva: hasta, plan_vence: null,
      pago_proveedor: "stripe", mp_suscripcion_id: null, pp_suscripcion_id: null,
    })
    await guardar(negocio.id, { suscripcion_id: id, plan: ref.plan, estado: "activa", ...(local?.sesion_pendiente ? { sesion_pendiente: null } : {}) })
    if (negocio.plan !== ref.plan || negocio.plan_estado !== "activa" || negocio.pago_proveedor !== "stripe" || local?.suscripcion_id !== id) {
      await anotarEvento({ negocio_id: negocio.id, preapproval_id: id, evento: "activada", plan: ref.plan, estado: "stripe", monto: PLANES_COTIZADOR[ref.plan].precio })
      await atribuirPago(negocio.id, PLANES_COTIZADOR[ref.plan].precio, id)
      logger?.info(`[cotizador] taller ${negocio.id} con plan ${ref.plan} (Stripe ${id})`)
    }
    return { plan: ref.plan, estado: "activa" }
  }

  if (["canceled", "unpaid", "incomplete_expired", "paused"].includes(sub.status) && local?.suscripcion_id === id) {
    await guardar(negocio.id, { estado: sub.status === "paused" ? "pausada" : "cancelada" })
    return marcarSuscripcionTerminada(negocio, { id, proveedor: "stripe", estado: sub.status === "paused" ? "pausada" : "cancelada", hasta, plan: ref.plan }, logger)
  }
  return { plan: negocio.plan, estado: sub.status }
}

/** Después del pago: de la sesión de Checkout a la suscripción. */
export async function sincronizarSesionStripe(sesionId: string, logger?: Bitacora) {
  if (!/^cs_(live|test)_[A-Za-z0-9]{8,200}$/.test(sesionId)) return null
  const s = await stripe<any>(`/checkout/sessions/${sesionId}`)
  if (!s?.subscription || !leerReferencia(s?.metadata?.ref)) return null
  return sincronizarSuscripcionStripe(String(s.subscription), logger)
}

/** Para "Ya pagué": la sesión pendiente o la suscripción guardada del taller. */
export async function verificarStripe(negocio: Negocio, logger?: Bitacora) {
  if (!stripeListo()) return null
  const f = await fila(negocio.id)
  if (f?.sesion_pendiente) {
    const r = await sincronizarSesionStripe(f.sesion_pendiente, logger)
    if (r) return r
  }
  return f?.suscripcion_id ? sincronizarSuscripcionStripe(f.suscripcion_id, logger) : null
}

/** Cancela al final del periodo pagado (el plan sigue hasta esa fecha). */
export async function cancelarSuscripcionStripe(negocio: Negocio) {
  const f = await fila(negocio.id)
  if (!f?.suscripcion_id) throw new ErrorSuscripcion("Tu taller no tiene una suscripción activa con tarjeta.")
  await stripe(`/subscriptions/${f.suscripcion_id}`, { datos: { cancel_at_period_end: true } })
  return (await sincronizarSuscripcionStripe(f.suscripcion_id)) ?? { plan: negocio.plan, estado: "cancelada" }
}
