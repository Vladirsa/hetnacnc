// Lecturas del chat (solo servidor). Reutiliza la misma conexión a base de datos del foro.

import { cache } from "react"

import { retrieveCustomer } from "@/lib/data/customer"
import { db, foroConfigurado } from "@/lib/foro/db"

import type { Conversacion, Mensaje } from "./tipos"

type Fila = Record<string, any>

const fecha = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v ?? ""))

export const esUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/.test(v)

// Cliente que tiene la sesión iniciada en la tienda
export type SesionChat = { clienteId: string; nombre: string; correo: string } | null

export const sesionChat = cache(async (): Promise<SesionChat> => {
  const c = await retrieveCustomer().catch(() => null)
  if (!c || !c.id) return null
  // Solo el primer nombre: al taller no le mostramos el nombre completo del cliente
  const primero = (c.first_name || "").trim().split(/\s+/)[0]
  const inicial = (c.last_name || "").trim().charAt(0)
  const nombre = [primero, inicial ? inicial.toUpperCase() + "." : ""].filter(Boolean).join(" ") || "Cliente"
  return { clienteId: c.id, nombre, correo: c.email || "" }
})

const aMensaje = (f: Fila): Mensaje => ({
  id: Number(f.id),
  de: f.de,
  cuerpo: f.cuerpo,
  creado: fecha(f.creado),
})

export async function mensajesDe(conversacionId: string, despuesDe = 0): Promise<Mensaje[]> {
  if (!foroConfigurado()) return []
  try {
    const { rows } = await db().query(
      `select id, de, cuerpo, creado from chat.mensajes
       where conversacion_id = $1 and id > $2 order by id limit 200`,
      [conversacionId, despuesDe]
    )
    return rows.map(aMensaje)
  } catch (e) {
    console.error("[chat] mensajes", (e as Error).message)
    return []
  }
}

export type ConversacionCompleta = Conversacion & { clienteId: string; tallerId: string }

const COLS = `c.id, c.cliente_id, c.cliente_nombre, c.taller_id, c.taller_handle, c.taller_nombre, c.producto_handle,
  c.producto_titulo, c.estado, c.ultimo_mensaje,
  (select left(m.cuerpo, 90) from chat.mensajes m where m.conversacion_id = c.id order by m.id desc limit 1) as ultimo`

const aConversacion = (f: Fila, sinLeer: number): ConversacionCompleta => ({
  id: f.id,
  clienteId: f.cliente_id,
  tallerId: f.taller_id,
  tallerHandle: f.taller_handle,
  tallerNombre: f.taller_nombre,
  clienteNombre: f.cliente_nombre,
  productoHandle: f.producto_handle,
  productoTitulo: f.producto_titulo,
  estado: f.estado,
  sinLeer,
  ultimoMensaje: fecha(f.ultimo_mensaje),
  ultimo: f.ultimo || "",
})

export async function misConversaciones(clienteId: string): Promise<Conversacion[]> {
  if (!foroConfigurado()) return []
  try {
    const { rows } = await db().query(
      `select ${COLS}, c.sin_leer_cliente from chat.conversaciones c
       where c.cliente_id = $1 order by c.ultimo_mensaje desc limit 100`,
      [clienteId]
    )
    return rows.map((f) => aConversacion(f, Number(f.sin_leer_cliente) || 0))
  } catch (e) {
    console.error("[chat] lista", (e as Error).message)
    return []
  }
}

// Conversación vista por el cliente (solo si es suya)
export async function conversacionDelCliente(id: string, clienteId: string): Promise<ConversacionCompleta | null> {
  if (!foroConfigurado() || !esUuid(id)) return null
  try {
    const { rows } = await db().query(
      `select ${COLS}, c.sin_leer_cliente from chat.conversaciones c where c.id = $1 and c.cliente_id = $2`,
      [id, clienteId]
    )
    return rows[0] ? aConversacion(rows[0], Number(rows[0].sin_leer_cliente) || 0) : null
  } catch {
    return null
  }
}

// Conversación vista por el taller, con su enlace privado
export async function conversacionDelTaller(token: string): Promise<ConversacionCompleta | null> {
  if (!foroConfigurado() || !/^[0-9a-f]{64}$/.test(token)) return null
  try {
    const { rows } = await db().query(
      `select ${COLS}, c.sin_leer_taller from chat.conversaciones c where c.token_taller = $1`,
      [token]
    )
    return rows[0] ? aConversacion(rows[0], Number(rows[0].sin_leer_taller) || 0) : null
  } catch {
    return null
  }
}
