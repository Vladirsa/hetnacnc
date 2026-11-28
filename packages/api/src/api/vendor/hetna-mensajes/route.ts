// GET  /vendor/hetna-mensajes → conversaciones del taller con sus clientes (chat
//      de HETNA, cada una se abre en hetnacnc.com/chat-taller/<token>) con su
//      grupo, etiquetas y si está archivada; y sus preguntas a solicitudes con la
//      respuesta del cliente (en la liga o por WhatsApp).
// POST /vendor/hetna-mensajes { conv_id, grupo?, etiquetas?, archivada? }
//      → organiza una conversación (sólo la ve este taller).
import type { MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { mensajesDelTaller } from "../../../lib/clientes-taller"
import { T_PREGUNTA } from "../../../lib/licitacion-extra"
import { T_SOLICITUD, folioTexto } from "../../../lib/licitacion"
import type { VendorRequest } from "../tablero/vendor-request"

const T_ORG = "hetna_conv_organizar"
let lista = false
async function asegurar(knex: any) {
  if (lista) return
  if (!(await knex.schema.hasTable(T_ORG))) {
    await knex.schema.createTable(T_ORG, (t: any) => {
      t.text("seller_id").notNullable()
      t.text("conv_id").notNullable()
      t.text("grupo").nullable()
      t.jsonb("etiquetas").notNullable().defaultTo("[]")
      t.boolean("archivada").notNullable().defaultTo(false)
      t.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now())
      t.primary(["seller_id", "conv_id"])
    })
  }
  lista = true
}

const limpiar = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n)

export const GET = async (req: VendorRequest, res: MedusaResponse) => {
  const sellerId = req.seller_context?.seller_id
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  try {
    await asegurar(knex)
    const chat = await mensajesDelTaller(sellerId).catch(() => ({ disponible: false, conversaciones: [] as any[] }))
    const org = (await knex(T_ORG).where({ seller_id: sellerId }).select("*")) as any[]
    const por = new Map(org.map((o) => [String(o.conv_id), o]))
    const conversaciones = chat.conversaciones.map((c: any) => {
      const o = por.get(String(c.id))
      return { ...c, grupo: o?.grupo || null, etiquetas: Array.isArray(o?.etiquetas) ? o.etiquetas : [], archivada: !!o?.archivada }
    })
    // Sus preguntas a solicitudes de los últimos 60 días, con la respuesta del cliente
    const preguntas = (await knex.schema.hasTable(T_PREGUNTA))
      ? ((await knex(`${T_PREGUNTA} as p`)
          .join(`${T_SOLICITUD} as s`, "s.id", "p.solicitud_id")
          .where("p.seller_id", sellerId)
          .where("p.created_at", ">=", knex.raw("now() - interval '60 days'"))
          .orderByRaw("coalesce(p.respondida_en, p.created_at) desc")
          .limit(100)
          .select("p.id", "p.pregunta", "p.respuesta", "p.respondida_en", "p.created_at", "s.folio", "s.trabajo", "s.estado")
          .catch(() => [])) as any[]).map((p) => ({
          id: p.id,
          folio: folioTexto(p.folio),
          trabajo: limpiar(p.trabajo?.descripcion, 90),
          pregunta: p.pregunta,
          respuesta: p.respuesta || null,
          fecha: new Date(p.respondida_en || p.created_at).toISOString(),
          abierta: !["cerrada", "cancelada"].includes(p.estado),
        }))
      : []
    const grupos = [...new Set(conversaciones.map((c: any) => c.grupo).filter(Boolean))]
    const etiquetas = [...new Set(conversaciones.flatMap((c: any) => c.etiquetas))]
    res.json({ disponible: chat.disponible, conversaciones, preguntas, grupos, etiquetas })
  } catch (e) {
    res.status(502).json({ message: `No se pudieron leer tus mensajes: ${(e as Error).message}` })
  }
}

export const POST = async (req: VendorRequest, res: MedusaResponse) => {
  const sellerId = req.seller_context?.seller_id
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const b = (req.body || {}) as any
  const convId = limpiar(b.conv_id, 80)
  if (!convId) return res.status(400).json({ message: "Falta la conversación." })
  // Sólo conversaciones de este taller
  const chat = await mensajesDelTaller(sellerId).catch(() => ({ conversaciones: [] as any[] }))
  if (!chat.conversaciones.some((c: any) => String(c.id) === convId)) return res.status(404).json({ message: "Conversación no encontrada." })
  await asegurar(knex)
  const cambio: any = { updated_at: knex.fn.now() }
  if ("grupo" in b) cambio.grupo = limpiar(b.grupo, 40) || null
  if ("etiquetas" in b) {
    const l = (Array.isArray(b.etiquetas) ? b.etiquetas : String(b.etiquetas || "").split(","))
      .map((x: unknown) => limpiar(x, 24))
      .filter(Boolean)
    cambio.etiquetas = JSON.stringify([...new Set(l)].slice(0, 8))
  }
  if ("archivada" in b) cambio.archivada = b.archivada === true
  await knex(T_ORG)
    .insert({ seller_id: sellerId, conv_id: convId, grupo: null, etiquetas: "[]", archivada: false, ...cambio })
    .onConflict(["seller_id", "conv_id"])
    .merge(cambio)
  res.json({ ok: true })
}
