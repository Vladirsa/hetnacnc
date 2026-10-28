// Compra directa de créditos: el cliente elige un paquete y paga en ese momento
// con Mercado Pago o PayPal, sin pasar por el carrito.
//
// Los créditos son de HETNA (pagan sus herramientas: escaneo 3D, cotizador),
// no de un taller. Por eso no se venden como una oferta de Mercur: así no
// generan pago a ningún vendedor ni comisión, y no piden envío.
//
// Cómo funciona:
//   1. POST /store/creditos-3d/comprar crea la compra (pendiente) y la liga de
//      pago en Mercado Pago o PayPal. El navegador va a esa liga.
//   2. Al pagar, el proveedor regresa a /<pais>/user/creditos/pago?compra=<id>,
//      que llama a POST /store/creditos-3d/confirmar.
//   3. confirmarCompra pregunta al proveedor (nunca confía en lo que diga el
//      navegador), y si el pago está aprobado y el monto cuadra, acredita.
//   4. Si el cliente cierra la ventana antes de regresar, la tarea
//      confirmar-compras-creditos revisa las compras pendientes cada 10 minutos.
//
// Acreditar solo pasa una vez por compra: la fila se marca "pagado" con un
// UPDATE condicionado antes de sumar los créditos.
import { randomBytes } from "crypto"

import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"

import { grantCreditsWorkflow } from "../workflows/grant-credits"
import { STORE_URL } from "./licitacion"
import { paypal, paypalListo } from "./paypal-api"

export const T_COMPRAS = "hetna_compra_creditos"

// Paquetes a la venta. El título y los créditos se leen del producto del
// catálogo (mismo handle) si existe; el precio se puede cambiar desde el panel
// poniendo metadata.precio_mxn en el producto. Si no, vale el de aquí.
export const PAQUETES: { handle: string; titulo: string; descripcion: string; creditos: number; precio: number }[] = [
  {
    handle: "creditos-3d-basico",
    titulo: "Paquete Básico — 10 créditos",
    descripcion: "Para probar: 10 créditos para las herramientas de HETNA.",
    creditos: 10,
    precio: 249,
  },
  {
    handle: "creditos-3d-estandar",
    titulo: "Paquete Estándar — 20 créditos + 5 de regalo",
    descripcion: "Compra 20 créditos y te damos 25.",
    creditos: 25,
    precio: 449,
  },
  {
    handle: "creditos-3d-pro",
    titulo: "Paquete Pro — 50 créditos + 15 de regalo",
    descripcion: "Compra 50 créditos y te damos 65: el mejor precio por crédito.",
    creditos: 65,
    precio: 999,
  },
]

const MONEDA = "MXN"
const MP_API = "https://api.mercadopago.com"
const mpToken = () => process.env.MERCADOPAGO_ACCESS_TOKEN || ""

export type Proveedor = "mercadopago" | "paypal"

export const proveedoresDisponibles = (): Proveedor[] => [
  ...(mpToken() ? (["mercadopago"] as const) : []),
  ...(paypalListo() ? (["paypal"] as const) : []),
]

export type Paquete = (typeof PAQUETES)[number]

export class ErrorCompra extends Error {
  constructor(
    mensaje: string,
    public status = 400
  ) {
    super(mensaje)
  }
}

// ── Paquetes ────────────────────────────────────────────────────────────────────────────────
export async function listarPaquetes(container: MedusaContainer): Promise<Paquete[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  let productos: { handle: string; title?: string; description?: string | null; status?: string; metadata?: Record<string, unknown> | null }[] = []
  try {
    const { data } = await query.graph({
      entity: "product",
      fields: ["handle", "title", "description", "status", "metadata"],
      filters: { handle: PAQUETES.map((p) => p.handle) },
    })
    productos = data as typeof productos
  } catch {
    // Sin catálogo se venden con los datos de aquí
  }

  return PAQUETES.flatMap((base) => {
    const p = productos.find((x) => x.handle === base.handle)
    // Si el producto existe y se despublicó en el panel, el paquete no se vende
    if (p && p.status && p.status !== "published") return []
    const meta = (p?.metadata || {}) as Record<string, unknown>
    const creditos = Number(meta.creditos_otorgados) || base.creditos
    const precio = Number(meta.precio_mxn) || base.precio
    return [
      {
        handle: base.handle,
        titulo: p?.title || base.titulo,
        descripcion: p?.description || base.descripcion,
        creditos,
        precio,
      },
    ]
  })
}

// ── Tabla de compras ──────────────────────────────────────────────────────────────────────
let lista = false
async function asegurarTabla(knex: any) {
  if (lista) return
  if (!(await knex.schema.hasTable(T_COMPRAS))) {
    await knex.schema.createTable(T_COMPRAS, (t: any) => {
      t.text("id").primary()
      t.text("customer_id").notNullable().index()
      t.text("email")
      t.text("handle").notNullable()
      t.text("titulo")
      t.integer("creditos").notNullable()
      t.decimal("monto", 12, 2).notNullable()
      t.text("moneda").notNullable()
      t.text("proveedor").notNullable()
      t.text("externo_id")
      t.text("pago_id")
      t.text("estado").notNullable().defaultTo("pendiente").index()
      t.timestamp("creado", { useTz: true }).notNullable().defaultTo(knex.fn.now())
      t.timestamp("pagado_en", { useTz: true })
    })
  }
  lista = true
}

export type Compra = {
  id: string
  customer_id: string
  email: string | null
  handle: string
  titulo: string | null
  creditos: number
  monto: string | number
  moneda: string
  proveedor: Proveedor
  externo_id: string | null
  pago_id: string | null
  estado: "pendiente" | "pagado" | "vencido"
  creado: Date
  pagado_en: Date | null
}

const knexDe = (c: MedusaContainer) => c.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any

const urlRetorno = (id: string, pais: string, proveedor: Proveedor) =>
  `${STORE_URL}/${pais}/user/creditos/pago?compra=${id}&proveedor=${proveedor}`

const referencia = (id: string) => `creditos:${id}`

// ── Mercado Pago ──────────────────────────────────────────────────────────────────────────
async function mp<T = any>(ruta: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${MP_API}${ruta}`, {
    ...init,
    headers: { Authorization: `Bearer ${mpToken()}`, "Content-Type": "application/json", ...(init.headers || {}) },
    signal: AbortSignal.timeout(15_000),
  })
  const cuerpo = (await res.json().catch(() => ({}))) as any
  if (!res.ok) throw new Error(`Mercado Pago: ${cuerpo?.message || cuerpo?.error || `HTTP ${res.status}`}`)
  return cuerpo as T
}

async function ligaMercadoPago(compra: Compra, pais: string): Promise<{ externo: string; url: string }> {
  const retorno = urlRetorno(compra.id, pais, "mercadopago")
  const pref = await mp<{ id: string; init_point: string; sandbox_init_point: string }>("/checkout/preferences", {
    method: "POST",
    headers: { "X-Idempotency-Key": referencia(compra.id) },
    body: JSON.stringify({
      items: [
        {
          id: compra.handle,
          title: compra.titulo || "Créditos HETNA CNC",
          quantity: 1,
          unit_price: Number(compra.monto),
          currency_id: MONEDA,
        },
      ],
      payer: compra.email ? { email: compra.email } : undefined,
      external_reference: referencia(compra.id),
      back_urls: { success: retorno, failure: retorno, pending: retorno },
      auto_return: "approved",
      // Solo aprobado o rechazado, como en el checkout: nada de pagos "en proceso"
      binary_mode: true,
      statement_descriptor: "HETNA CNC",
      payment_methods: {
        excluded_payment_types: [{ id: "ticket" }, { id: "atm" }, { id: "bank_transfer" }],
      },
    }),
  })
  const prueba = mpToken().startsWith("TEST-")
  return { externo: pref.id, url: prueba ? pref.sandbox_init_point : pref.init_point }
}

type PagoMP = { id: number; status: string; transaction_amount?: number; currency_id?: string }

async function pagoMercadoPago(compra: Compra): Promise<{ pagado: boolean; pagoId?: string }> {
  const r = await mp<{ results?: PagoMP[] }>(
    `/v1/payments/search?external_reference=${encodeURIComponent(referencia(compra.id))}&sort=date_created&criteria=desc`
  )
  const aprobado = (r.results || []).find((p) => p.status === "approved")
  if (!aprobado) return { pagado: false }
  const cuadra =
    (aprobado.currency_id || MONEDA).toUpperCase() === MONEDA &&
    Number(aprobado.transaction_amount) + 0.009 >= Number(compra.monto)
  if (!cuadra) throw new Error(`Mercado Pago: el pago ${aprobado.id} no coincide con la compra ${compra.id}`)
  return { pagado: true, pagoId: String(aprobado.id) }
}

// ── PayPal ────────────────────────────────────────────────────────────────────────────────
type OrdenPayPal = {
  id: string
  status: string
  links?: { rel: string; href: string }[]
  purchase_units?: {
    custom_id?: string
    payments?: { captures?: { id: string; status: string; amount?: { value: string; currency_code: string } }[] }
  }[]
}

async function ligaPayPal(compra: Compra, pais: string): Promise<{ externo: string; url: string }> {
  const retorno = urlRetorno(compra.id, pais, "paypal")
  const orden = await paypal<OrdenPayPal>("/v2/checkout/orders", {
    method: "POST",
    headers: { "PayPal-Request-Id": referencia(compra.id) },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: "default",
          custom_id: referencia(compra.id),
          description: compra.titulo || "Créditos HETNA CNC",
          amount: { currency_code: MONEDA, value: Number(compra.monto).toFixed(2) },
        },
      ],
      payment_source: {
        paypal: {
          email_address: compra.email || undefined,
          experience_context: {
            brand_name: "HETNA CNC",
            locale: pais === "us" ? "en-US" : "es-MX",
            shipping_preference: "NO_SHIPPING",
            user_action: "PAY_NOW",
            return_url: retorno,
            cancel_url: `${retorno}&cancelado=1`,
          },
        },
      },
    }),
  })
  const liga = orden.links?.find((l) => l.rel === "payer-action" || l.rel === "approve")
  if (!liga) throw new Error("PayPal no devolvió la liga de pago")
  return { externo: orden.id, url: liga.href }
}

async function pagoPayPal(compra: Compra): Promise<{ pagado: boolean; pagoId?: string }> {
  if (!compra.externo_id) return { pagado: false }
  let orden = await paypal<OrdenPayPal>(`/v2/checkout/orders/${compra.externo_id}`)
  if (orden.purchase_units?.[0]?.custom_id && orden.purchase_units[0].custom_id !== referencia(compra.id)) {
    throw new Error(`PayPal: la orden ${orden.id} no es de la compra ${compra.id}`)
  }
  // El cliente aprobó en PayPal: ahora sí se cobra
  if (orden.status === "APPROVED") {
    orden = await paypal<OrdenPayPal>(`/v2/checkout/orders/${orden.id}/capture`, {
      method: "POST",
      headers: { "PayPal-Request-Id": `captura:${compra.id}` },
    })
  }
  const captura = orden.purchase_units?.[0]?.payments?.captures?.[0]
  if (orden.status !== "COMPLETED" || captura?.status !== "COMPLETED") return { pagado: false }
  const cuadra =
    (captura.amount?.currency_code || MONEDA).toUpperCase() === MONEDA &&
    Number(captura.amount?.value) + 0.009 >= Number(compra.monto)
  if (!cuadra) throw new Error(`PayPal: la captura ${captura.id} no coincide con la compra ${compra.id}`)
  return { pagado: true, pagoId: captura.id }
}

// ── Operaciones ───────────────────────────────────────────────────────────────────────────
export async function crearCompra(
  container: MedusaContainer,
  datos: { customerId: string; handle: string; proveedor: string; pais?: string }
): Promise<{ id: string; url: string }> {
  const proveedor = datos.proveedor as Proveedor
  if (!proveedoresDisponibles().includes(proveedor)) {
    throw new ErrorCompra("Esa forma de pago no está disponible.")
  }
  const paquete = (await listarPaquetes(container)).find((p) => p.handle === datos.handle)
  if (!paquete) throw new ErrorCompra("Ese paquete no está a la venta.", 404)
  const pais = /^[a-z]{2}$/.test(datos.pais || "") ? (datos.pais as string) : "mx"

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [cliente],
  } = await query.graph({ entity: "customer", fields: ["id", "email"], filters: { id: datos.customerId } })

  const knex = knexDe(container)
  await asegurarTabla(knex)

  const compra: Compra = {
    id: `cc_${randomBytes(12).toString("hex")}`,
    customer_id: datos.customerId,
    email: (cliente as { email?: string } | undefined)?.email || null,
    handle: paquete.handle,
    titulo: paquete.titulo,
    creditos: paquete.creditos,
    monto: paquete.precio,
    moneda: MONEDA,
    proveedor,
    externo_id: null,
    pago_id: null,
    estado: "pendiente",
    creado: new Date(),
    pagado_en: null,
  }
  await knex(T_COMPRAS).insert({
    id: compra.id,
    customer_id: compra.customer_id,
    email: compra.email,
    handle: compra.handle,
    titulo: compra.titulo,
    creditos: compra.creditos,
    monto: compra.monto,
    moneda: compra.moneda,
    proveedor: compra.proveedor,
  })

  const { externo, url } =
    proveedor === "mercadopago" ? await ligaMercadoPago(compra, pais) : await ligaPayPal(compra, pais)
  await knex(T_COMPRAS).where({ id: compra.id }).update({ externo_id: externo })
  return { id: compra.id, url }
}

export type ResultadoConfirmacion = {
  estado: Compra["estado"]
  creditos: number
  titulo: string | null
}

export async function confirmarCompra(
  container: MedusaContainer,
  id: string,
  customerId?: string
): Promise<ResultadoConfirmacion> {
  const knex = knexDe(container)
  await asegurarTabla(knex)
  const compra = (await knex(T_COMPRAS).where({ id }).first()) as Compra | undefined
  if (!compra || (customerId && compra.customer_id !== customerId)) {
    throw new ErrorCompra("No encontramos esa compra.", 404)
  }
  const resultado = (estado: Compra["estado"]) => ({ estado, creditos: compra.creditos, titulo: compra.titulo })
  if (compra.estado !== "pendiente") return resultado(compra.estado)

  const { pagado, pagoId } =
    compra.proveedor === "mercadopago" ? await pagoMercadoPago(compra) : await pagoPayPal(compra)
  if (!pagado) return resultado("pendiente")

  // Solo una llamada gana: la que cambia la fila de "pendiente" a "pagado"
  const cambiadas = await knex(T_COMPRAS)
    .where({ id, estado: "pendiente" })
    .update({ estado: "pagado", pagado_en: knex.fn.now(), pago_id: pagoId || null })
  if (!cambiadas) return resultado("pagado")

  try {
    await grantCreditsWorkflow(container).run({
      input: {
        customer_id: compra.customer_id,
        amount: compra.creditos,
        type: "compra",
        reference_id: compra.id,
        description: `Compra: ${compra.titulo || compra.handle}`,
      },
    })
  } catch (e) {
    // Se regresa a pendiente para que la siguiente revisión lo intente otra vez
    await knex(T_COMPRAS).where({ id }).update({ estado: "pendiente", pagado_en: null })
    throw e
  }

  container
    .resolve("logger")
    .info(`[creditos] compra ${id}: ${compra.creditos} créditos a ${compra.customer_id} (${compra.proveedor} ${pagoId})`)
  return resultado("pagado")
}

// Para la tarea programada: compras pendientes de los últimos días
export async function comprasPendientes(container: MedusaContainer, dias: number): Promise<Compra[]> {
  const knex = knexDe(container)
  await asegurarTabla(knex)
  return knex(T_COMPRAS)
    .where({ estado: "pendiente" })
    .whereNotNull("externo_id")
    .where("creado", ">", new Date(Date.now() - dias * 24 * 60 * 60 * 1000))
    .orderBy("creado", "asc")
    .limit(200)
}

export async function vencerPendientes(container: MedusaContainer, dias: number): Promise<number> {
  const knex = knexDe(container)
  await asegurarTabla(knex)
  return knex(T_COMPRAS)
    .where({ estado: "pendiente" })
    .where("creado", "<=", new Date(Date.now() - dias * 24 * 60 * 60 * 1000))
    .update({ estado: "vencido" })
}
