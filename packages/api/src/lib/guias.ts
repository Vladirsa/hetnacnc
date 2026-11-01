// Guías de Envíos HETNA (Skydropx) desde el panel del taller.
//
// Cuando un cliente paga "Envío económico" o "Envío express" (Envíos HETNA),
// el taller entra a Guías en su panel y:
//   1. Cotizar: se cotiza la guía real desde la dirección del taller a la del
//      cliente, con la misma paquetería que pagó (económica o la más rápida).
//   2. Comprar: se compra la guía en Skydropx (cobra del saldo de la cuenta de
//      HETNA), se espera la etiqueta PDF y:
//        - el pedido queda como enviado con su número de guía (el cliente lo ve
//          en Mis pedidos),
//        - el cliente recibe un correo con la paquetería y la guía.
//   3. La tarea actualizar-guias revisa el rastreo y marca el pedido como
//      entregado cuando llega.
//
// Protecciones del saldo:
//   - Solo pedidos pagados que usaron Envíos HETNA, del propio taller.
//   - Una sola guía por pedido (la tabla tiene el pedido como llave y el paso a
//     "generando" es un UPDATE condicionado).
//   - Si la guía cuesta bastante más de lo que pagó el cliente
//     (GUIA_TOLERANCIA_PCT, 30% por omisión), no se compra: HETNA la revisa.
import { marcarEntregado } from "./saldos-talleres"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import {
  createOrderFulfillmentWorkflow,
  createOrderShipmentWorkflow,
  markOrderFulfillmentAsDeliveredWorkflow,
} from "@medusajs/medusa/core-flows"

import { SkydropxClient, leerEnvio, mejorTarifa, type Envio } from "../modules/skydropx/client"
import { armarPaquete, tarifaRapida } from "../modules/skydropx/tarifas"
import { EVIDENCIA_OBLIGATORIA, type Evidencia, buscarCP, leerEvidencia } from "./envios"
import { folioSobrepeso, sobrepesosPendientes } from "./sobrepesos"
import { sendEmail } from "./resend"

export const T_GUIAS = "hetna_guia"

const PAQUETE_BASE = { largo: 30, ancho: 30, alto: 20, peso: 2 }
const MINUTOS_COTIZACION = 25 // Skydropx pide no usar tarifas de más de ~30 min
const tolerancia = () => Number(process.env.GUIA_TOLERANCIA_PCT ?? 30)
// Clave de Carta Porte (SAT) y tipo de empaque que pide Skydropx para México.
// Configurables porque dependen de lo que se envía.
const CARTA_PORTE = () => process.env.SKYDROPX_CARTA_PORTE || "01010101"
const TIPO_EMPAQUE = () => process.env.SKYDROPX_TIPO_EMPAQUE || "4G"
// Teléfono de respaldo si el cliente no dejó el suyo (las paqueterías lo exigen)
const TELEFONO_RESPALDO = () => process.env.ENVIO_TELEFONO_RESPALDO || "2217076014"

export const guiasListas = () => Boolean(process.env.SKYDROPX_CLIENT_ID && process.env.SKYDROPX_CLIENT_SECRET)

let cliente: SkydropxClient | null = null
const skydropx = () =>
  (cliente ??= new SkydropxClient({
    clientId: process.env.SKYDROPX_CLIENT_ID || "",
    clientSecret: process.env.SKYDROPX_CLIENT_SECRET || "",
    sandbox: process.env.SKYDROPX_SANDBOX === "true",
  }))

export class ErrorGuia extends Error {
  constructor(
    mensaje: string,
    public status = 400
  ) {
    super(mensaje)
  }
}

// ── Tabla ───────────────────────────────────────────────────────────────────────────
let lista = false
export async function asegurarTablaGuias(knex: any) {
  if (lista) return
  if (!(await knex.schema.hasTable(T_GUIAS))) {
    await knex.schema.createTable(T_GUIAS, (t: any) => {
      t.text("order_id").primary()
      t.text("seller_id").notNullable().index()
      // cotizada | generando | lista | entregada | error
      t.text("estado").notNullable().index()
      t.jsonb("cotizacion")
      t.text("envio_id")
      t.text("guia")
      t.text("paqueteria")
      t.decimal("costo", 12, 2)
      t.decimal("pagado_cliente", 12, 2)
      t.text("etiqueta_url")
      t.text("rastreo_url")
      t.text("rastreo_estado")
      t.text("fulfillment_id")
      t.text("error")
      t.timestamp("aviso_enviado_en", { useTz: true })
      t.timestamp("creado", { useTz: true }).notNullable().defaultTo(knex.fn.now())
      t.timestamp("actualizado", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }
  // Evidencia del paquete (fotos con la guía visible) y cuándo aceptó el taller
  // las condiciones de sobrepeso al comprar la guía.
  if (!(await knex.schema.hasColumn(T_GUIAS, "evidencia"))) {
    await knex.schema.alterTable(T_GUIAS, (t: any) => {
      t.jsonb("evidencia").notNullable().defaultTo("[]")
      t.timestamp("acepta_en", { useTz: true }).nullable()
    })
  }
  lista = true
}

// ── Evidencia y bloqueos ─────────────────────────────────────────────────────────────
// Después de comprar la guía el taller sube 4 fotos con la guía visible (alto,
// largo, ancho y báscula). Con ellas HETNA pelea un sobrepeso. Si pasan más de
// HORAS_EVIDENCIA sin subirlas, o si debe un sobrepeso, no puede comprar otra guía.
const HORAS_EVIDENCIA = () => Number(process.env.GUIA_HORAS_EVIDENCIA ?? 24)

export const evidenciaGuiaCompleta = (f: { evidencia?: unknown }) => {
  const ev = leerEvidencia(f.evidencia)
  return EVIDENCIA_OBLIGATORIA.every((t) => ev.some((e) => e.tipo === t))
}

export type Bloqueo = { sobrepesos: { folio: string; referencia: string; monto: number; pago_url: string | null }[]; sin_evidencia: string[] }

export async function bloqueoDelTaller(c: MedusaContainer, sellerId: string): Promise<Bloqueo> {
  const knex = knexDe(c)
  await asegurarTablaGuias(knex)
  const limite = new Date(Date.now() - HORAS_EVIDENCIA() * 3600_000)
  const [pendientes, guias] = await Promise.all([
    sobrepesosPendientes(knex, "taller", sellerId),
    knex(T_GUIAS)
      .where({ seller_id: sellerId })
      .whereIn("estado", ["lista", "entregada"])
      .whereNotNull("acepta_en")
      .where("acepta_en", "<", limite)
      .select("order_id", "evidencia"),
  ])
  const faltan = guias.filter((g: any) => !evidenciaGuiaCompleta(g)).map((g: any) => g.order_id)
  let sinEvidencia: string[] = []
  if (faltan.length) {
    const pedidos = await knex("order").whereIn("id", faltan).select("id", "display_id")
    const folio = new Map(pedidos.map((p: any) => [p.id, `#${p.display_id}`]))
    // Si no se encuentra el pedido, igual cuenta (con su id): el bloqueo no se pierde
    sinEvidencia = faltan.map((id: string) => folio.get(id) || id)
  }
  return {
    sobrepesos: pendientes.map((s) => ({ folio: folioSobrepeso(s.folio), referencia: s.referencia, monto: Number(s.monto), pago_url: s.pago_url })),
    sin_evidencia: sinEvidencia,
  }
}

export async function guardarEvidenciaGuia(c: MedusaContainer, sellerId: string, orderId: string, nueva: Evidencia) {
  const knex = knexDe(c)
  await asegurarTablaGuias(knex)
  const f = await leerFila(knex, orderId)
  if (!f || f.seller_id !== sellerId) throw new ErrorGuia("Pedido no encontrado.", 404)
  if (!["lista", "entregada"].includes(f.estado)) throw new ErrorGuia("Primero genera la guía: las fotos van con la guía pegada y visible.")
  let ev = leerEvidencia(f.evidencia)
  if (nueva.tipo === "extra") {
    if (ev.filter((x) => x.tipo === "extra").length >= 6) throw new ErrorGuia("Máximo 6 fotos extra.")
    ev = [...ev, nueva]
  } else ev = [...ev.filter((x) => x.tipo !== nueva.tipo), nueva]
  await knex(T_GUIAS).where({ order_id: orderId }).update({ evidencia: JSON.stringify(ev), actualizado: knex.fn.now() })
  return ev
}

export async function evidenciaDeGuia(c: MedusaContainer, sellerId: string, orderId: string): Promise<Evidencia[]> {
  const knex = knexDe(c)
  await asegurarTablaGuias(knex)
  const f = await leerFila(knex, orderId)
  if (!f || f.seller_id !== sellerId) throw new ErrorGuia("Pedido no encontrado.", 404)
  return leerEvidencia(f.evidencia)
}

export type FilaGuia = {
  order_id: string
  seller_id: string
  estado: "cotizada" | "generando" | "lista" | "entregada" | "error"
  cotizacion: Cotizacion | null
  envio_id: string | null
  guia: string | null
  paqueteria: string | null
  costo: string | number | null
  pagado_cliente: string | number | null
  etiqueta_url: string | null
  rastreo_url: string | null
  rastreo_estado: string | null
  fulfillment_id: string | null
  error: string | null
  aviso_enviado_en: Date | null
  evidencia?: unknown
  acepta_en?: Date | null
  creado: Date
  actualizado: Date
}

type Cotizacion = {
  rateId: string
  quotation_id: string
  paqueteria: string
  servicio: string
  dias: number | string
  costo: number
  cotizado_en: string
  express: boolean
  // Paquete con el que se cotizó (sale de los productos): contra esto se mide un sobrepeso
  paquete?: { largo: number; ancho: number; alto: number; peso: number }
}

const knexDe = (c: MedusaContainer) => c.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any

// ── Datos del pedido y del taller ─────────────────────────────────────────────────
type Direccion = Record<string, any>
type Pedido = {
  id: string
  display_id: number
  status: string
  email: string | null
  created_at: string
  shipping_address: Direccion | null
  items: any[]
  shipping_methods: { id: string; name: string; amount: number; shipping_option_id: string }[]
  payment_collections: { status: string }[]
  fulfillments: { id: string; canceled_at: string | null }[]
}

const CAMPOS_PEDIDO = [
  "id",
  "display_id",
  "status",
  "email",
  "created_at",
  "shipping_address.*",
  "items.id",
  "items.title",
  "items.quantity",
  "items.requires_shipping",
  "items.detail.fulfilled_quantity",
  "items.variant.weight",
  "items.variant.length",
  "items.variant.width",
  "items.variant.height",
  "items.variant.product.weight",
  "items.variant.product.length",
  "items.variant.product.width",
  "items.variant.product.height",
  "shipping_methods.id",
  "shipping_methods.name",
  "shipping_methods.amount",
  "shipping_methods.shipping_option_id",
  "payment_collections.status",
  "fulfillments.id",
  "fulfillments.canceled_at",
]

const pagado = (p: Pedido) =>
  (p.payment_collections || []).some((pc) => ["completed", "authorized", "partially_captured"].includes(pc?.status))

// Opciones de envío que son de Envíos HETNA (proveedor Skydropx)
async function opcionesHetna(c: MedusaContainer, ids: string[]): Promise<Map<string, { name: string }>> {
  if (!ids.length) return new Map()
  const query = c.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "shipping_option", fields: ["id", "name", "provider_id"], filters: { id: ids } })
  return new Map(
    (data as { id: string; name: string; provider_id: string }[])
      .filter((o) => String(o.provider_id || "").includes("skydropx") || String(o.provider_id || "").includes("envios-hetna"))
      .map((o) => [o.id, { name: o.name }])
  )
}

export const metodoHetna = (p: Pedido, opciones: Map<string, { name: string }>) =>
  (p.shipping_methods || []).find((m) => opciones.has(m.shipping_option_id)) || null

async function pedidosDelTaller(c: MedusaContainer, sellerId: string): Promise<string[]> {
  const query = c.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "order_seller", fields: ["order_id"], filters: { seller_id: sellerId } })
  return (data as { order_id: string }[]).map((o) => o.order_id)
}

async function leerPedido(c: MedusaContainer, orderId: string): Promise<Pedido | null> {
  const query = c.resolve(ContainerRegistrationKeys.QUERY)
  const {
    data: [p],
  } = await query.graph({ entity: "order", fields: CAMPOS_PEDIDO, filters: { id: orderId } })
  return (p as unknown as Pedido) || null
}

// El pedido, validado: es del taller, está pagado, no cancelado y usó Envíos HETNA
async function pedidoDelTaller(c: MedusaContainer, sellerId: string, orderId: string) {
  const ids = await pedidosDelTaller(c, sellerId)
  if (!ids.includes(orderId)) throw new ErrorGuia("No encontramos ese pedido en tu tienda.", 404)
  const p = await leerPedido(c, orderId)
  if (!p) throw new ErrorGuia("No encontramos ese pedido.", 404)
  if (p.status === "canceled") throw new ErrorGuia("El pedido está cancelado.")
  if (!pagado(p)) throw new ErrorGuia("El pedido todavía no está pagado.")
  const opciones = await opcionesHetna(c, (p.shipping_methods || []).map((m) => m.shipping_option_id))
  const metodo = metodoHetna(p, opciones)
  if (!metodo) throw new ErrorGuia("Este pedido no usó Envíos HETNA. Envíalo por tu cuenta y captura la guía en el pedido.")
  return { pedido: p, metodo, express: /express/i.test(metodo.name || "") }
}

const limpio = (v: unknown, max = 80) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max)
const soloDigitos = (v: unknown) => String(v ?? "").replace(/\D/g, "").replace(/^52(?=\d{10}$)/, "").slice(-10)

const normal = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()

// La colonia del C.P. que aparezca en el texto de la dirección; si no, la primera
function coloniaDe(cp: string, ...textos: unknown[]): string {
  const info = buscarCP(cp)
  const colonias = info?.colonias || []
  const texto = normal(textos.map((t) => String(t ?? "")).join(" "))
  const hallada = colonias
    .map((c) => c.nombre)
    .sort((a, b) => b.length - a.length)
    .find((n) => n.length > 3 && texto.includes(normal(n)))
  return hallada || colonias[0]?.nombre || "Centro"
}

// Skydropx no acepta más de 45 caracteres en la calle: el resto va a referencias
function partirCalle(calle: string) {
  const t = limpio(calle, 200)
  if (t.length <= 45) return { calle: t, resto: "" }
  const corte = t.lastIndexOf(" ", 45)
  const n = corte >= 20 ? corte : 45
  return { calle: t.slice(0, n).replace(/[,\s]+$/, ""), resto: t.slice(n).replace(/^[,\s]+/, "") }
}

type Punto = {
  nombre: string
  empresa: string
  telefono: string
  email: string
  calle: string
  referencia: string
  cp: string
  estado: string
  ciudad: string
  colonia: string
}

async function origenDelTaller(c: MedusaContainer, sellerId: string): Promise<Punto> {
  const query = c.resolve(ContainerRegistrationKeys.QUERY)
  let seller: any = null
  try {
    ;({
      data: [seller],
    } = await query.graph({
      entity: "seller",
      fields: ["id", "name", "email", "phone", "address.*", "stock_locations.address.*"],
      filters: { id: sellerId },
    }))
  } catch {
    ;({
      data: [seller],
    } = await query.graph({
      entity: "seller",
      fields: ["id", "name", "email", "phone", "stock_locations.address.*"],
      filters: { id: sellerId },
    }))
  }
  if (!seller) throw new ErrorGuia("No encontramos tu tienda.", 404)

  // Primero la dirección de la tienda; si está incompleta, la del almacén
  const candidatas = [seller.address, ...(seller.stock_locations || []).map((l: any) => l?.address)].filter(Boolean)
  const dir = candidatas.find((d: any) => d?.address_1 && /^\d{5}$/.test(String(d?.postal_code || "").trim())) || candidatas[0] || {}
  const cp = String(dir.postal_code || "").trim()
  const persona = limpio([dir.first_name, dir.last_name].filter(Boolean).join(" ")) || limpio(seller.name)
  const telefono = soloDigitos(dir.phone || seller.phone)

  const faltan: string[] = []
  if (!dir.address_1) faltan.push("calle y número")
  if (!/^\d{5}$/.test(cp)) faltan.push("código postal")
  if (telefono.length < 10) faltan.push("teléfono a 10 dígitos")
  if (!seller.email) faltan.push("correo")
  if (faltan.length) {
    throw new ErrorGuia(
      `Para generar guías falta en la dirección de tu tienda: ${faltan.join(", ")}. Complétala en Configuración > Tienda.`
    )
  }
  const info = buscarCP(cp)
  return {
    nombre: persona,
    empresa: limpio(dir.company || seller.name),
    telefono,
    email: limpio(seller.email, 100),
    calle: limpio(dir.address_1, 200),
    referencia: limpio(dir.address_2, 100),
    cp,
    estado: limpio(dir.province) || info?.estado || "",
    ciudad: limpio(dir.city) || info?.municipio || info?.ciudad || "",
    colonia: coloniaDe(cp, dir.address_2, dir.address_1),
  }
}

function destinoDelPedido(p: Pedido): Punto {
  const d = p.shipping_address || {}
  const cp = String(d.postal_code || "").trim()
  if (!/^\d{5}$/.test(cp)) throw new ErrorGuia("La dirección de entrega no tiene un código postal válido.")
  if (!d.address_1) throw new ErrorGuia("La dirección de entrega no tiene calle.")
  const info = buscarCP(cp)
  const telefono = soloDigitos(d.phone)
  return {
    nombre: limpio([d.first_name, d.last_name].filter(Boolean).join(" ")) || limpio(p.email) || "Cliente",
    empresa: limpio(d.company || [d.first_name, d.last_name].filter(Boolean).join(" ") || "Cliente"),
    telefono: telefono.length === 10 ? telefono : TELEFONO_RESPALDO(),
    email: limpio(p.email || process.env.RESEND_FROM_EMAIL || "", 100),
    calle: limpio(d.address_1, 200),
    referencia: limpio(d.address_2, 100),
    cp,
    estado: limpio(d.province) || info?.estado || "",
    ciudad: limpio(d.city) || info?.municipio || info?.ciudad || "",
    colonia: coloniaDe(cp, d.address_2, d.address_1),
  }
}

const paraSkydropx = (p: Punto) => {
  const { calle, resto } = partirCalle(p.calle)
  const referencia = limpio([resto, p.referencia].filter(Boolean).join(" · "), 100) || "Sin referencia"
  return {
    name: limpio(p.nombre, 80),
    company: limpio(p.empresa || p.nombre, 80),
    street1: calle,
    phone: p.telefono,
    email: p.email,
    reference: referencia,
  }
}

const itemsParaPaquete = (p: Pedido) =>
  (p.items || [])
    .filter((i) => i.requires_shipping !== false)
    .map((i) => ({ quantity: i.quantity, variant: i.variant, product: i.variant?.product }))

const pendientesDeEnviar = (p: Pedido) =>
  (p.items || [])
    .filter((i) => i.requires_shipping !== false)
    .map((i) => ({ id: i.id, quantity: Number(i.quantity) - Number(i.detail?.fulfilled_quantity || 0) }))
    .filter((i) => i.quantity > 0)

const limiteDeCosto = (pagadoCliente: number) => pagadoCliente * (1 + tolerancia() / 100) + 5

async function leerFila(knex: any, orderId: string): Promise<FilaGuia | undefined> {
  return knex(T_GUIAS).where({ order_id: orderId }).first()
}

// ── 1. Cotizar ─────────────────────────────────────────────────────────────────────────
export async function cotizarGuia(c: MedusaContainer, sellerId: string, orderId: string) {
  if (!guiasListas()) throw new ErrorGuia("Envíos HETNA no está activo.", 503)
  const knex = knexDe(c)
  await asegurarTablaGuias(knex)
  const fila = await leerFila(knex, orderId)
  if (fila && ["generando", "lista", "entregada"].includes(fila.estado)) {
    throw new ErrorGuia("Este pedido ya tiene guía.")
  }

  const { pedido, metodo, express } = await pedidoDelTaller(c, sellerId, orderId)
  if (!pendientesDeEnviar(pedido).length) throw new ErrorGuia("Este pedido ya se envió.")
  const origen = await origenDelTaller(c, sellerId)
  const destino = destinoDelPedido(pedido)
  const { paquete } = armarPaquete(itemsParaPaquete(pedido), PAQUETE_BASE)

  const cot: any = await skydropx().cotizar(
    { cp: origen.cp, estado: origen.estado, ciudad: origen.ciudad, colonia: origen.colonia },
    { cp: destino.cp, estado: destino.estado, ciudad: destino.ciudad, colonia: destino.colonia },
    paquete
  )
  const t = express ? tarifaRapida(cot, 0) : mejorTarifa(cot, 0)
  if (!t || !t.rateId) throw new ErrorGuia("Skydropx no dio tarifas para esta ruta. Intenta de nuevo más tarde.", 502)

  const pagadoCliente = Number(metodo.amount) || 0
  const cotizacion: Cotizacion = {
    rateId: t.rateId,
    quotation_id: String(cot.id || ""),
    paqueteria: t.paqueteria,
    servicio: t.servicio,
    dias: t.dias,
    costo: t.costo,
    cotizado_en: new Date().toISOString(),
    express,
    paquete,
  }
  await knex(T_GUIAS)
    .insert({
      order_id: orderId,
      seller_id: sellerId,
      estado: "cotizada",
      cotizacion: JSON.stringify(cotizacion),
      pagado_cliente: pagadoCliente,
      error: null,
    })
    .onConflict("order_id")
    .merge({
      estado: "cotizada",
      cotizacion: JSON.stringify(cotizacion),
      pagado_cliente: pagadoCliente,
      error: null,
      actualizado: knex.fn.now(),
    })

  return {
    paqueteria: t.paqueteria,
    servicio: t.servicio,
    dias: t.dias,
    costo: t.costo,
    pagado_cliente: pagadoCliente,
    se_puede_comprar: t.costo <= limiteDeCosto(pagadoCliente),
    paquete,
    origen: `${origen.ciudad || origen.estado} (${origen.cp})`,
    destino: `${destino.ciudad || destino.estado} (${destino.cp})`,
  }
}

// ── 2. Comprar ─────────────────────────────────────────────────────────────────────────
export async function comprarGuia(c: MedusaContainer, sellerId: string, orderId: string, acepta = false) {
  if (!guiasListas()) throw new ErrorGuia("Envíos HETNA no está activo.", 503)
  if (!acepta)
    throw new ErrorGuia(
      "Confirma que el paquete embalado mide y pesa lo cotizado, que aceptas pagar el sobrepeso si no coincide y que subirás las 4 fotos con la guía visible."
    )
  const knex = knexDe(c)
  await asegurarTablaGuias(knex)
  const bloqueo = await bloqueoDelTaller(c, sellerId)
  if (bloqueo.sobrepesos.length)
    throw new ErrorGuia(
      `Tienes ${bloqueo.sobrepesos.length === 1 ? "un sobrepeso" : `${bloqueo.sobrepesos.length} sobrepesos`} por pagar (${bloqueo.sobrepesos.map((s) => s.folio).join(", ")}). Págalo para generar nuevas guías.`,
      402
    )
  if (bloqueo.sin_evidencia.length)
    throw new ErrorGuia(
      `Sube primero las fotos de evidencia de ${bloqueo.sin_evidencia.length === 1 ? "tu pedido" : "tus pedidos"} ${bloqueo.sin_evidencia.join(", ")} (alto, largo, ancho y báscula con la guía visible).`,
      409
    )
  const fila = await leerFila(knex, orderId)
  if (!fila || fila.seller_id !== sellerId) throw new ErrorGuia("Primero cotiza la guía.")
  if (["generando", "lista", "entregada"].includes(fila.estado)) throw new ErrorGuia("Este pedido ya tiene guía.")
  const cot = fila.cotizacion
  if (!cot?.rateId || Date.now() - new Date(cot.cotizado_en).getTime() > MINUTOS_COTIZACION * 60_000) {
    throw new ErrorGuia("La cotización ya venció. Vuelve a cotizar.")
  }
  if (cot.costo > limiteDeCosto(Number(fila.pagado_cliente) || 0)) {
    throw new ErrorGuia(
      `La guía cuesta $${cot.costo} y el cliente pagó $${Number(fila.pagado_cliente) || 0} de envío. Escríbenos y la generamos nosotros.`
    )
  }

  // Se vuelven a revisar el pedido y las direcciones (pudo cambiar algo)
  const { pedido } = await pedidoDelTaller(c, sellerId, orderId)
  const origen = await origenDelTaller(c, sellerId)
  const destino = destinoDelPedido(pedido)

  // Solo una solicitud pasa de "cotizada/error" a "generando"
  const tomadas = await knex(T_GUIAS)
    .where({ order_id: orderId })
    .whereIn("estado", ["cotizada", "error"])
    .update({ estado: "generando", error: null, acepta_en: knex.fn.now(), actualizado: knex.fn.now() })
  if (!tomadas) throw new ErrorGuia("La guía ya se está generando.")

  let envio: Envio | null
  try {
    const json = await skydropx().crearEnvio({
      rate_id: cot.rateId,
      printing_format: "standard",
      address_from: paraSkydropx(origen),
      address_to: paraSkydropx(destino),
      packages: [
        {
          package_number: "1",
          package_protected: false,
          consignment_note: CARTA_PORTE(),
          package_type: TIPO_EMPAQUE(),
        },
      ],
    })
    envio = leerEnvio(json)
    if (!envio?.id) throw new Error("Skydropx no devolvió el número de envío.")
  } catch (e) {
    const msg = (e as Error).message.slice(0, 500)
    await knex(T_GUIAS).where({ order_id: orderId }).update({ estado: "error", error: msg, actualizado: knex.fn.now() })
    c.resolve("logger").error(`[guias] pedido ${orderId}: no se pudo crear la guía: ${msg}`)
    throw new ErrorGuia("Skydropx no pudo crear la guía. Vuelve a cotizar e inténtalo de nuevo.", 502)
  }
  await knex(T_GUIAS).where({ order_id: orderId }).update({ envio_id: envio.id, actualizado: knex.fn.now() })

  // La etiqueta tarda unos segundos
  for (let i = 0; i < 10 && !envio.etiqueta && !envio.error && !/fail|cancel/i.test(envio.estado); i++) {
    await new Promise((r) => setTimeout(r, 2000))
    try {
      envio = leerEnvio(await skydropx().envio(envio.id)) || envio
    } catch {
      // se reintenta en la siguiente vuelta
    }
  }

  return revisarEnvio(c, orderId, envio)
}

// Aplica lo que diga Skydropx de un envío: error, todavía generando, o lista
async function revisarEnvio(c: MedusaContainer, orderId: string, envio: Envio) {
  const knex = knexDe(c)
  if (envio.error || /fail|cancel/i.test(envio.estado)) {
    await knex(T_GUIAS)
      .where({ order_id: orderId })
      .update({ estado: "error", error: (envio.error || `Skydropx: ${envio.estado}`).slice(0, 500), actualizado: knex.fn.now() })
    return leerFila(knex, orderId)
  }
  if (!envio.etiqueta || !envio.guia) return leerFila(knex, orderId) // sigue "generando"; la tarea lo termina

  await knex(T_GUIAS)
    .where({ order_id: orderId })
    .update({
      estado: "lista",
      guia: envio.guia,
      paqueteria: envio.paqueteria || null,
      costo: envio.costo,
      etiqueta_url: envio.etiqueta,
      rastreo_url: envio.rastreo_url,
      rastreo_estado: envio.rastreo_estado,
      error: null,
      actualizado: knex.fn.now(),
    })
  await registrarEnPedido(c, orderId)
  return leerFila(knex, orderId)
}

// ── 3. Pedido enviado + aviso al cliente ─────────────────────────────────────────
async function registrarEnPedido(c: MedusaContainer, orderId: string) {
  const knex = knexDe(c)
  const logger = c.resolve("logger")
  const fila = await leerFila(knex, orderId)
  if (!fila || fila.estado !== "lista" || !fila.guia) return
  const pedido = await leerPedido(c, orderId)
  if (!pedido) return

  if (!fila.fulfillment_id) {
    try {
      const opciones = await opcionesHetna(c, (pedido.shipping_methods || []).map((m) => m.shipping_option_id))
      const metodo = metodoHetna(pedido, opciones)
      const items = pendientesDeEnviar(pedido)
      if (items.length && metodo) {
        const { result: cumplimiento } = await createOrderFulfillmentWorkflow(c).run({
          input: { order_id: orderId, items, shipping_option_id: metodo.shipping_option_id, created_by: "hetna-guias" },
        })
        const etiqueta = {
          tracking_number: fila.guia,
          tracking_url: fila.rastreo_url || "",
          label_url: fila.etiqueta_url || "",
        }
        await createOrderShipmentWorkflow(c).run({
          input: { order_id: orderId, fulfillment_id: cumplimiento.id, items, labels: [etiqueta], created_by: "hetna-guias" },
        })
        await knex(T_GUIAS).where({ order_id: orderId }).update({ fulfillment_id: cumplimiento.id, actualizado: knex.fn.now() })
      }
    } catch (e) {
      // La guía ya está comprada: se deja anotado y la tarea lo vuelve a intentar
      logger.error(`[guias] pedido ${orderId}: guía ${fila.guia} lista, pero no se pudo marcar como enviado: ${(e as Error).message}`)
      return
    }
  }

  if (!fila.aviso_enviado_en && pedido.email) {
    const rastreo = fila.rastreo_url
      ? `<p style="margin-top:20px;"><a href="${fila.rastreo_url}" style="background:#C2560A;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Rastrear mi paquete</a></p>`
      : ""
    const { sent } = await sendEmail({
      to: pedido.email,
      subject: `Tu pedido #${pedido.display_id} va en camino`,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;background:#f4f4f4;padding:24px;">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
<div style="background:#142033;padding:20px 24px;color:#fff;font-size:18px;font-weight:600;">HETNA CNC</div>
<div style="padding:24px;color:#1a1a1a;font-size:15px;line-height:1.5;">
<h1 style="font-size:20px;margin:0 0 12px;">¡Tu pedido #${pedido.display_id} va en camino!</h1>
<p>El taller ya entregó tu paquete a la paquetería.</p>
<p><b>Paquetería:</b> ${fila.paqueteria || "—"}<br><b>Número de guía:</b> ${fila.guia}</p>
${rastreo}
<p style="color:#666;font-size:13px;margin-top:20px;">También puedes ver el envío en Mis pedidos, en hetnacnc.com.</p>
</div></div></div>`,
    }).catch(() => ({ sent: false }))
    if (sent) await knex(T_GUIAS).where({ order_id: orderId }).update({ aviso_enviado_en: knex.fn.now() })
  }
}

// ── 4. Tarea programada: terminar guías y seguir el rastreo ─────────────────
export async function actualizarGuias(c: MedusaContainer) {
  if (!guiasListas()) return { revisadas: 0, entregadas: 0 }
  const knex = knexDe(c)
  await asegurarTablaGuias(knex)
  const desde = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000)
  const filas: FilaGuia[] = await knex(T_GUIAS)
    .whereIn("estado", ["generando", "lista"])
    .whereNotNull("envio_id")
    .where("creado", ">", desde)
    .orderBy("actualizado", "asc")
    .limit(60)

  let entregadas = 0
  for (const f of filas) {
    try {
      const envio = leerEnvio(await skydropx().envio(f.envio_id as string))
      if (!envio) continue
      if (f.estado === "generando") {
        await revisarEnvio(c, f.order_id, envio)
        continue
      }
      // Ya lista: si faltó marcar el pedido o avisar, se reintenta
      if (!f.fulfillment_id || !f.aviso_enviado_en) await registrarEnPedido(c, f.order_id)
      const entregada = /deliver|entreg/i.test(`${envio.estado} ${envio.rastreo_estado || ""}`)
      await knex(T_GUIAS)
        .where({ order_id: f.order_id })
        .update({
          rastreo_estado: envio.rastreo_estado || envio.estado || f.rastreo_estado,
          rastreo_url: envio.rastreo_url || f.rastreo_url,
          ...(entregada ? { estado: "entregada" } : {}),
          actualizado: knex.fn.now(),
        })
      if (entregada) {
        entregadas++
        // Arranca la cuenta para pagarle al taller (lib/saldos-talleres.ts)
        await marcarEntregado(c, f.order_id, "guia").catch((e: Error) =>
          c.resolve("logger").warn(`[saldos] pedido ${f.order_id}: ${e.message}`)
        )
        const fila = await leerFila(knex, f.order_id)
        if (fila?.fulfillment_id) {
          await markOrderFulfillmentAsDeliveredWorkflow(c)
            .run({ input: { orderId: f.order_id, fulfillmentId: fila.fulfillment_id } })
            .catch((e: Error) => c.resolve("logger").warn(`[guias] pedido ${f.order_id}: no se marcó entregado: ${e.message}`))
        }
      }
    } catch (e) {
      c.resolve("logger").warn(`[guias] pedido ${f.order_id}: ${(e as Error).message}`)
    }
  }
  return { revisadas: filas.length, entregadas }
}

// ── 5. Lista para el panel ─────────────────────────────────────────────────────────────────
export async function listarParaPanel(c: MedusaContainer, sellerId: string) {
  const knex = knexDe(c)
  await asegurarTablaGuias(knex)
  const ids = await pedidosDelTaller(c, sellerId)
  if (!ids.length) return []
  const query = c.resolve(ContainerRegistrationKeys.QUERY)
  const desde = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await query.graph({
    entity: "order",
    fields: CAMPOS_PEDIDO,
    filters: { id: ids, created_at: { $gte: desde } },
  })
  const pedidos = (data as unknown as Pedido[]).filter((p) => p.status !== "canceled")
  const opciones = await opcionesHetna(c, [
    ...new Set(pedidos.flatMap((p) => (p.shipping_methods || []).map((m) => m.shipping_option_id)).filter(Boolean)),
  ])
  const filas: FilaGuia[] = await knex(T_GUIAS).whereIn("order_id", pedidos.map((p) => p.id))
  const porPedido = new Map(filas.map((f) => [f.order_id, f]))

  return pedidos
    .map((p) => ({ p, metodo: metodoHetna(p, opciones) }))
    .filter(({ metodo }) => metodo)
    .sort((a, b) => String(b.p.created_at).localeCompare(String(a.p.created_at)))
    .map(({ p, metodo }) => {
      const f = porPedido.get(p.id)
      const d = p.shipping_address || {}
      return {
        id: p.id,
        folio: p.display_id,
        fecha: p.created_at,
        cliente: limpio([d.first_name, d.last_name].filter(Boolean).join(" ")) || p.email,
        destino: [d.city, d.province, d.postal_code].filter(Boolean).join(", "),
        articulos: (p.items || []).reduce((n, i) => n + Number(i.quantity || 0), 0),
        envio: metodo!.name,
        envio_pagado: Number(metodo!.amount) || 0,
        pagado: pagado(p),
        por_enviar: pendientesDeEnviar(p).length > 0,
        guia: f
          ? {
              estado: f.estado,
              guia: f.guia,
              paqueteria: f.paqueteria || f.cotizacion?.paqueteria || null,
              costo: f.costo != null ? Number(f.costo) : null,
              rastreo_estado: f.rastreo_estado,
              rastreo_url: f.rastreo_url,
              tiene_etiqueta: Boolean(f.etiqueta_url),
              error: f.error,
              paquete: f.cotizacion?.paquete || null,
              evidencia: leerEvidencia(f.evidencia).map(({ tipo, nombre, subido }) => ({ tipo, nombre, subido })),
              evidencia_completa: evidenciaGuiaCompleta(f),
            }
          : null,
      }
    })
}

// Etiqueta PDF del pedido (solo para su taller)
export async function etiquetaDelPedido(c: MedusaContainer, sellerId: string, orderId: string) {
  const knex = knexDe(c)
  await asegurarTablaGuias(knex)
  const f = await leerFila(knex, orderId)
  if (!f || f.seller_id !== sellerId || !f.etiqueta_url) throw new ErrorGuia("Este pedido no tiene etiqueta.", 404)
  return { ...(await skydropx().descargar(f.etiqueta_url)), nombre: `guia-${f.guia || orderId}.pdf` }
}
