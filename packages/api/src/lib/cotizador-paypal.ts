// Suscripciones del Cotizador HETNA cobradas con PayPal (USD), para talleres
// de EE. UU. y de cualquier país con tarjeta internacional o cuenta PayPal.
//
// Mismo camino que Mercado Pago (ver cotizador-suscripciones.ts):
//   1. La app pide suscribirse con proveedor "paypal" -> se crea la suscripción
//      en PayPal y la app abre el enlace para aprobarla.
//   2. PayPal avisa -> POST /api/paypal-suscripcion. No se confía en el aviso:
//      se consulta la suscripción a PayPal y con eso se actualiza el taller.
//   3. "Ya pagué" y "Cancelar" usan las mismas rutas que Mercado Pago.
//
// El producto "Cotizador HETNA" y un plan mensual por cada nivel y precio se
// crean solos en PayPal la primera vez. Si cambias COTIZADOR_PRECIO_USD_*,
// se crea un plan nuevo con el precio nuevo; los talleres ya suscritos siguen
// con el que contrataron.

import {
  adminDesdeToken,
  anotarEvento,
  actualizarNegocio,
  cancelarMercadoPagoAnterior,
  cancelarPaypalAnterior,
  ErrorSuscripcion,
  leerNegocio,
  leerReferencia,
  marcarSuscripcionTerminada,
  PLANES_COTIZADOR,
  referencia,
  RETORNO,
  supabaseListo,
  type Bitacora,
  type Negocio,
  type PlanPago,
} from "./cotizador-suscripciones"
import { paypal, paypalListo } from "./paypal-api"

const NOMBRE_PRODUCTO = "Cotizador HETNA"
const MONEDA = "USD"

export const paypalSuscripcionesListas = () => Boolean(supabaseListo() && paypalListo())

const nombrePlan = (plan: PlanPago, precio: number) =>
  `${NOMBRE_PRODUCTO} — Plan ${PLANES_COTIZADOR[plan].nombre} · ${MONEDA} ${precio.toFixed(2)} al mes`

// ── Producto y planes en PayPal (se crean una vez y se recuerdan) ──────────
let productoId: string | null = process.env.COTIZADOR_PAYPAL_PRODUCTO || null
const planesPorNombre = new Map<string, string>()

async function asegurarProducto(): Promise<string> {
  if (productoId) return productoId
  for (let pagina = 1; pagina <= 10; pagina++) {
    const r = await paypal<{ products?: { id: string; name: string }[]; total_pages?: number }>(
      `/v1/catalogs/products?page_size=20&page=${pagina}&total_required=true`
    )
    const p = r.products?.find((x) => x.name === NOMBRE_PRODUCTO)
    if (p) return (productoId = p.id)
    if (!r.total_pages || pagina >= r.total_pages) break
  }
  const nuevo = await paypal<{ id: string }>("/v1/catalogs/products", {
    method: "POST",
    body: JSON.stringify({
      name: NOMBRE_PRODUCTO,
      description: "Software para talleres CNC: cotizaciones, clientes, producción e inventario.",
      type: "SERVICE",
      category: "SOFTWARE",
      home_url: "https://hetnacnc.com",
    }),
  })
  return (productoId = nuevo.id)
}

type PlanPaypal = {
  id: string
  name?: string
  status?: string
  product_id?: string
  billing_cycles?: {
    tenure_type?: string
    frequency?: { interval_unit?: string; interval_count?: number }
    pricing_scheme?: { fixed_price?: { value?: string; currency_code?: string } }
  }[]
}

async function asegurarPlan(plan: PlanPago): Promise<string> {
  const precio = PLANES_COTIZADOR[plan].precioUsd
  const nombre = nombrePlan(plan, precio)
  const guardado = planesPorNombre.get(nombre)
  if (guardado) return guardado
  const producto = await asegurarProducto()
  for (let pagina = 1; pagina <= 10; pagina++) {
    const r = await paypal<{ plans?: PlanPaypal[]; total_pages?: number }>(
      `/v1/billing/plans?product_id=${producto}&page_size=20&page=${pagina}&total_required=true`
    )
    const p = r.plans?.find((x) => x.name === nombre && x.status === "ACTIVE")
    if (p) {
      planesPorNombre.set(nombre, p.id)
      return p.id
    }
    if (!r.total_pages || pagina >= r.total_pages) break
  }
  const nuevo = await paypal<{ id: string }>("/v1/billing/plans", {
    method: "POST",
    body: JSON.stringify({
      product_id: producto,
      name: nombre,
      description: `Suscripción mensual al plan ${PLANES_COTIZADOR[plan].nombre} del Cotizador HETNA`,
      status: "ACTIVE",
      billing_cycles: [
        {
          frequency: { interval_unit: "MONTH", interval_count: 1 },
          tenure_type: "REGULAR",
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: { fixed_price: { value: precio.toFixed(2), currency_code: MONEDA } },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee_failure_action: "CANCEL",
        payment_failure_threshold: 2,
      },
    }),
  })
  planesPorNombre.set(nombre, nuevo.id)
  return nuevo.id
}

/** El plan de PayPal debe ser de nuestro producto, mensual, en USD y con el precio de ese nivel (o más). */
async function planValido(planId: string | undefined, plan: PlanPago): Promise<{ ok: boolean; monto: number; moneda?: string }> {
  if (!planId) return { ok: false, monto: 0 }
  const p = await paypal<PlanPaypal>(`/v1/billing/plans/${encodeURIComponent(planId)}`)
  const ciclo = p.billing_cycles?.find((c) => c.tenure_type === "REGULAR")
  const precio = ciclo?.pricing_scheme?.fixed_price
  const monto = Number(precio?.value || 0)
  const ok =
    p.product_id === (await asegurarProducto()) &&
    ciclo?.frequency?.interval_unit === "MONTH" &&
    (ciclo?.frequency?.interval_count ?? 1) === 1 &&
    precio?.currency_code === MONEDA &&
    monto + 0.001 >= PLANES_COTIZADOR[plan].precioUsd
  return { ok, monto, moneda: precio?.currency_code }
}

// ── Suscripciones ──────────────────────────────────────────────────────────────────────────
type SuscripcionPaypal = {
  id: string
  status: "APPROVAL_PENDING" | "APPROVED" | "ACTIVE" | "SUSPENDED" | "CANCELLED" | "EXPIRED" | string
  plan_id?: string
  custom_id?: string
  links?: { rel: string; href: string }[]
  billing_info?: { next_billing_time?: string; last_payment?: { time?: string } }
}

/** Crea la suscripción en PayPal y devuelve el enlace para aprobarla. */
export async function crearSuscripcionPaypal(p: { token?: string; plan: string }) {
  if (!paypalSuscripcionesListas()) throw new ErrorSuscripcion("El pago con PayPal todavía no está activo.", 503)
  if (!(p.plan in PLANES_COTIZADOR)) throw new ErrorSuscripcion("Ese plan no existe.")
  const plan = p.plan as PlanPago
  const { negocio } = await adminDesdeToken(p.token)
  if (negocio.plan === "master") throw new ErrorSuscripcion("La cuenta de HETNA ya tiene todo abierto.")
  if (negocio.plan === plan && negocio.plan_estado === "activa")
    throw new ErrorSuscripcion(`Tu taller ya tiene el plan ${PLANES_COTIZADOR[plan].nombre}.`)

  const planId = await asegurarPlan(plan)
  const sub = await paypal<SuscripcionPaypal>("/v1/billing/subscriptions", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      plan_id: planId,
      custom_id: referencia(negocio.id, plan),
      application_context: {
        brand_name: "HETNA CNC",
        shipping_preference: "NO_SHIPPING",
        user_action: "SUBSCRIBE_NOW",
        return_url: RETORNO,
        cancel_url: RETORNO,
      },
    }),
  })
  const url = sub.links?.find((l) => l.rel === "approve")?.href
  if (!url) throw new ErrorSuscripcion("PayPal no devolvió el enlace de pago. Intenta de nuevo.", 502)

  await actualizarNegocio(negocio.id, { pp_suscripcion_pendiente: sub.id })
  await anotarEvento({
    negocio_id: negocio.id,
    preapproval_id: sub.id,
    evento: "creada",
    plan,
    estado: "paypal",
    monto: PLANES_COTIZADOR[plan].precioUsd,
  })
  return { url, id: sub.id }
}

/**
 * Lee la suscripción en PayPal y deja el taller como corresponde.
 * Se puede llamar las veces que sea (aviso de PayPal, "Ya pagué", cancelar).
 */
export async function sincronizarSuscripcionPaypal(id: string, logger?: Bitacora) {
  if (!/^I-[A-Z0-9]{6,40}$/.test(id)) return null
  const sub = await paypal<SuscripcionPaypal>(`/v1/billing/subscriptions/${id}`)
  const ref = leerReferencia(sub.custom_id)
  if (!ref) return null // no es del Cotizador
  const negocio = await leerNegocio(ref.negocioId)
  if (!negocio) return null

  if (sub.status === "ACTIVE") {
    const valido = await planValido(sub.plan_id, ref.plan)
    if (!valido.ok) {
      logger?.error(`[cotizador] suscripción PayPal ${sub.id} con plan inesperado: ${valido.monto} ${valido.moneda}`)
      return null
    }
    // Una sola suscripción activa: se cancela la anterior (de PayPal o de Mercado Pago)
    await cancelarPaypalAnterior(negocio, sub.id, logger)
    await cancelarMercadoPagoAnterior(negocio, "", logger)
    await actualizarNegocio(negocio.id, {
      plan: ref.plan,
      plan_estado: "activa",
      plan_renueva: sub.billing_info?.next_billing_time ?? null,
      plan_vence: null,
      pago_proveedor: "paypal",
      pp_suscripcion_id: sub.id,
      mp_suscripcion_id: null,
      // la pendiente sólo se limpia si es ésta: puede haber otra en camino (cambio de plan)
      ...(negocio.pp_suscripcion_pendiente === sub.id ? { pp_suscripcion_pendiente: null } : {}),
    })
    if (negocio.plan !== ref.plan || negocio.plan_estado !== "activa" || negocio.pp_suscripcion_id !== sub.id) {
      await anotarEvento({ negocio_id: negocio.id, preapproval_id: sub.id, evento: "activada", plan: ref.plan, estado: "paypal", monto: valido.monto })
      logger?.info(`[cotizador] taller ${negocio.id} con plan ${ref.plan} (PayPal ${sub.id})`)
    }
    return { plan: ref.plan, estado: "activa" }
  }

  if (["SUSPENDED", "CANCELLED", "EXPIRED"].includes(sub.status) && negocio.pp_suscripcion_id === sub.id) {
    // PayPal ya no da la siguiente fecha de cobro al cancelar: se usa la que
    // teníamos guardada (hasta ahí está pagado).
    return marcarSuscripcionTerminada(
      negocio,
      {
        id: sub.id,
        proveedor: "paypal",
        estado: sub.status === "SUSPENDED" ? "pausada" : "cancelada",
        hasta: sub.billing_info?.next_billing_time || negocio.plan_renueva,
        plan: ref.plan,
      },
      logger
    )
  }

  return { plan: negocio.plan, estado: sub.status }
}

/** Cancela la suscripción de PayPal del taller; el plan sigue hasta el fin del periodo pagado. */
export async function cancelarSuscripcionPaypal(negocio: Negocio) {
  const id = negocio.pp_suscripcion_id
  if (!id) throw new ErrorSuscripcion("Tu taller no tiene una suscripción activa.")
  if (!paypalListo()) throw new ErrorSuscripcion("El pago con PayPal todavía no está activo.", 503)
  await paypal(`/v1/billing/subscriptions/${id}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason: "Cancelada por el taller desde el Cotizador HETNA" }),
  })
  return (await sincronizarSuscripcionPaypal(id)) ?? { plan: negocio.plan, estado: "cancelada" }
}
