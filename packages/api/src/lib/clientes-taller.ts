// Clientes y mensajes del taller, sin datos de contacto.
//
// Regla de HETNA: los tratos se quedan dentro de la plataforma. Por eso el
// taller ve de sus clientes sólo el nombre (primer nombre + inicial), la
// ubicación (ciudad y estado), el giro, sus pedidos y lo que ha comprado —
// nunca el correo ni el teléfono — y les escribe por el chat de HETNA
// (esquema "chat" en la base del foro, el mismo del botón "Preguntar al
// taller"), que bloquea teléfonos, correos y redes.
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import { Pool } from "pg"

import { revisarMensaje } from "./chat-filtro"

const g = globalThis as unknown as { __hetnaChatPoolApi?: Pool }
const urlChat = () => process.env.HETNA_FORO_DB || process.env.HETNA_TALLER_DB || ""
export const chatConfigurado = () => !!urlChat()
const pool = (): Pool => {
  if (!g.__hetnaChatPoolApi) {
    g.__hetnaChatPoolApi = new Pool({ connectionString: urlChat(), max: 3, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000, statement_timeout: 6_000 })
    g.__hetnaChatPoolApi.on("error", (e) => console.error("[chat] base", e.message))
  }
  return g.__hetnaChatPoolApi
}

export class ErrorClientes extends Error {
  constructor(msg: string, public status = 400, public extra: Record<string, unknown> = {}) { super(msg) }
}

// Primer nombre + inicial del apellido (igual que el chat del lado del cliente)
const nombreCorto = (first?: string | null, last?: string | null) => {
  const primero = String(first || "").trim().split(/\s+/)[0]
  const inicial = String(last || "").trim().charAt(0)
  return [primero, inicial ? inicial.toUpperCase() + "." : ""].filter(Boolean).join(" ") || "Cliente"
}

const giroDe = (c: any, dir: any) => {
  const m = c?.metadata || {}
  return String(m.giro || m.tipo_negocio || m.industria || m.empresa_giro || c?.company_name || dir?.company || "").trim().slice(0, 80) || null
}

async function pedidosDelTaller(container: MedusaContainer, sellerId: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: rel } = await query.graph({ entity: "order_seller", fields: ["order_id"], filters: { seller_id: sellerId } })
  const ids = rel.map((r: any) => r.order_id)
  if (!ids.length) return []
  const { data } = await query.graph({
    entity: "order",
    fields: [
      "id", "display_id", "created_at", "total", "currency_code", "status", "customer_id",
      "customer.first_name", "customer.last_name", "customer.company_name", "customer.metadata",
      "shipping_address.city", "shipping_address.province", "shipping_address.country_code", "shipping_address.company",
      "items.title", "items.quantity",
    ],
    filters: { id: ids },
  })
  return data as any[]
}

export type ClienteTaller = {
  id: string
  nombre: string
  ciudad: string | null
  estado: string | null
  giro: string | null
  pedidos: number
  total: number
  moneda: string
  ultimo: string
  productos: string[]
  chat: { id: string; token: string; sin_leer: number } | null
}

export async function clientesDelTaller(container: MedusaContainer, sellerId: string): Promise<ClienteTaller[]> {
  const pedidos = await pedidosDelTaller(container, sellerId)
  const mapa = new Map<string, ClienteTaller>()
  for (const o of pedidos.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))) {
    if (!o.customer_id || o.status === "canceled") continue
    let c = mapa.get(o.customer_id)
    if (!c) {
      c = {
        id: o.customer_id,
        nombre: nombreCorto(o.customer?.first_name, o.customer?.last_name),
        ciudad: o.shipping_address?.city || null,
        estado: o.shipping_address?.province || null,
        giro: giroDe(o.customer, o.shipping_address),
        pedidos: 0, total: 0, moneda: o.currency_code || "mxn", ultimo: o.created_at, productos: [], chat: null,
      }
      mapa.set(o.customer_id, c)
    }
    c.pedidos++
    c.total += Number(o.total) || 0
    for (const it of o.items || []) if (it?.title && !c.productos.includes(it.title) && c.productos.length < 5) c.productos.push(it.title)
  }
  const lista = [...mapa.values()]
  if (lista.length && chatConfigurado()) {
    try {
      const { rows } = await pool().query(
        `select distinct on (cliente_id) cliente_id, id, token_taller, sin_leer_taller
           from chat.conversaciones where taller_id = $1 and cliente_id = any($2) order by cliente_id, ultimo_mensaje desc`,
        [sellerId, lista.map((c) => c.id)]
      )
      for (const r of rows) {
        const c = mapa.get(r.cliente_id)
        if (c) c.chat = { id: r.id, token: r.token_taller, sin_leer: Number(r.sin_leer_taller) || 0 }
      }
    } catch (e) {
      console.warn("[clientes] chat", (e as Error).message)
    }
  }
  return lista
}

export async function mensajesDelTaller(sellerId: string) {
  if (!chatConfigurado()) return { disponible: false, conversaciones: [] }
  const { rows } = await pool().query(
    `select c.id, c.cliente_nombre, c.producto_titulo, c.token_taller, c.sin_leer_taller, c.estado, c.ultimo_mensaje,
            (select m.cuerpo from chat.mensajes m where m.conversacion_id = c.id order by m.id desc limit 1) as ultimo_texto,
            (select m.de from chat.mensajes m where m.conversacion_id = c.id order by m.id desc limit 1) as ultimo_de
       from chat.conversaciones c where c.taller_id = $1 order by c.ultimo_mensaje desc limit 200`,
    [sellerId]
  )
  return {
    disponible: true,
    conversaciones: rows.map((r) => ({
      id: r.id,
      cliente: r.cliente_nombre,
      producto: r.producto_titulo,
      token: r.token_taller,
      sin_leer: Number(r.sin_leer_taller) || 0,
      estado: r.estado,
      fecha: r.ultimo_mensaje instanceof Date ? r.ultimo_mensaje.toISOString() : String(r.ultimo_mensaje),
      ultimo: String(r.ultimo_texto || "").slice(0, 140),
      ultimo_de: r.ultimo_de,
    })),
  }
}

/** El taller le escribe a un cliente que ya le compró (dentro de HETNA). */
export async function iniciarChatTaller(container: MedusaContainer, sellerId: string, clienteId: string, mensajeCrudo: unknown) {
  if (!chatConfigurado()) throw new ErrorClientes("El chat no está disponible por ahora.", 503)
  const cuerpo = typeof mensajeCrudo === "string" ? mensajeCrudo.replace(/\r\n?/g, "\n").trim().slice(0, 2000) : ""
  if (!cuerpo) throw new ErrorClientes("Escribe un mensaje.")
  if (!/^cus_[A-Za-z0-9]+$/.test(clienteId)) throw new ErrorClientes("Cliente inválido.")

  // Sólo a clientes que de verdad le compraron a este taller
  const pedidos = await pedidosDelTaller(container, sellerId)
  if (!pedidos.some((o) => o.customer_id === clienteId)) throw new ErrorClientes("Sólo puedes escribir a clientes que te han comprado.", 403)

  const filtro = revisarMensaje(cuerpo)
  if (filtro.bloqueado) {
    await pool().query(
      `insert into chat.bloqueos (conversacion_id, autor_clave, motivos, texto_original) values (null, $1, $2, $3)`,
      [`t:${sellerId}`, filtro.motivos, cuerpo]
    ).catch(() => null)
    throw new ErrorClientes("Tu mensaje trae datos de contacto (teléfono, correo, redes o enlaces). En HETNA los tratos se hacen por el chat: quítalos y vuelve a enviarlo.", 422, { motivos: filtro.motivos })
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const [{ data: clientes }, { data: sellers }] = await Promise.all([
    query.graph({ entity: "customer", fields: ["id", "first_name", "last_name", "email"], filters: { id: clienteId } }),
    query.graph({ entity: "seller", fields: ["id", "name", "handle"], filters: { id: sellerId } }),
  ])
  const c: any = clientes[0], s: any = sellers[0]
  if (!c || !s) throw new ErrorClientes("No encontré al cliente o al taller.", 404)

  const { rows } = await pool().query(
    `insert into chat.conversaciones (cliente_id, cliente_nombre, cliente_correo, taller_id, taller_handle, taller_nombre, producto_handle, producto_titulo)
     values ($1, $2, $3, $4, $5, $6, null, null)
     on conflict (cliente_id, taller_id, producto_clave) do update set estado = 'abierta'
     returning id, token_taller`,
    [c.id, nombreCorto(c.first_name, c.last_name), c.email || null, s.id, s.handle, s.name]
  )
  const { id, token_taller } = rows[0]
  const { rows: n } = await pool().query(
    `select count(*)::int as n from chat.mensajes where conversacion_id = $1 and de = 'taller' and creado > now() - interval '1 hour'`, [id]
  )
  if (n[0].n >= 40) throw new ErrorClientes("Mandaste muchos mensajes en la última hora. Espera un poco.", 429)
  await pool().query(`insert into chat.mensajes (conversacion_id, de, cuerpo) values ($1, 'taller', $2)`, [id, cuerpo])
  // El cliente se entera por la campanita del sitio (sin_leer_cliente), nunca por fuera
  await pool().query(`update chat.conversaciones set ultimo_mensaje = now(), sin_leer_cliente = sin_leer_cliente + 1 where id = $1`, [id])
  return { ok: true, id, token: token_taller }
}

// ── Escudo de privacidad para las pantallas de Mercur ──────────────────
// /vendor/customers y /vendor/orders devuelven correo y teléfono del cliente.
// Se borran de la respuesta antes de que lleguen al panel del taller.
const CAMPOS_CONTACTO = new Set(["email", "phone"])
export function sinContacto(v: any, prof = 0): any {
  if (prof > 12 || v === null || typeof v !== "object") return v
  if (Array.isArray(v)) return v.map((x) => sinContacto(x, prof + 1))
  const out: Record<string, any> = {}
  for (const [k, x] of Object.entries(v)) {
    if (CAMPOS_CONTACTO.has(k) && (typeof x === "string" || x === null)) { out[k] = ""; continue }
    out[k] = sinContacto(x, prof + 1)
  }
  return out
}
