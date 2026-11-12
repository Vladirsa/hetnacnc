// @ts-nocheck
// Respondedor del WhatsApp de HETNA: contesta las dudas de quien ESCRIBE
// primero (cómo cotizar, cómo registrarse, si tienen tal producto, envíos…).
//
// - Sólo con datos reales: los de DATOS_HETNA y productos de la tienda que
//   coinciden con lo que preguntan (nombre y liga; el precio está en la liga,
//   no se dice para no equivocarse). Lo que no sabe lo pasa a una persona
//   (aviso por Telegram) y se lo dice al cliente.
// - Si alguien del equipo contesta desde el celular, el respondedor se calla
//   en ese chat 12 horas.
// - Tope: 12 respuestas al día por número y una cada 20 s.
import Anthropic from "@anthropic-ai/sdk"

import { STORE_URL } from "./licitacion"
import { T_CONFIG_S, asegurarSocial, iaSocial } from "./social-hub"
import { DATOS_HETNA } from "./social-comentarios"
import { mandarPrivado } from "./social-telegram"
import { enviarTexto, normalizarNumero, whatsappListo } from "./whatsapp"

export const T_CHAT = "hetna_whatsapp_chat"
const PAUSA_HUMANO_H = 12
const TOPE_DIA_NUMERO = 12
const ENTRE_RESPUESTAS_MS = 20_000

let listo = false
async function asegurar(knex: any) {
  if (listo) return
  if (!(await knex.schema.hasTable(T_CHAT))) {
    await knex.schema.createTable(T_CHAT, (t: any) => {
      t.text("numero").primary()
      t.timestamp("pausa_hasta")
      t.text("dia")
      t.integer("respuestas").defaultTo(0)
      t.timestamp("ultima")
      t.integer("pasados").defaultTo(0)
      t.timestamp("updated_at").defaultTo(knex.fn.now())
    })
  }
  listo = true
}

export async function botActivo(knex: any) {
  await asegurarSocial(knex)
  return !!(await knex(T_CONFIG_S).where({ clave: "whatsapp_bot" }).first())?.valor?.activo
}
export async function activarBot(knex: any, activo: boolean) {
  await asegurarSocial(knex)
  await knex.raw(`insert into ?? (clave, valor) values ('whatsapp_bot', ?::jsonb) on conflict (clave) do update set valor = excluded.valor`, [T_CONFIG_S, JSON.stringify({ activo: !!activo })])
}

/** Alguien del equipo escribió en ese chat desde el celular: el respondedor se calla. */
export async function pausarChat(knex: any, numeroCrudo: string) {
  const numero = normalizarNumero(numeroCrudo)
  if (!numero) return
  await asegurar(knex)
  const hasta = new Date(Date.now() + PAUSA_HUMANO_H * 3_600_000)
  await knex.raw(`insert into ?? (numero, pausa_hasta, updated_at) values (?, ?, now()) on conflict (numero) do update set pausa_hasta = excluded.pausa_hasta, updated_at = now()`, [T_CHAT, numero, hasta])
}

const VACIAS = new Set("hola buenas buenos dias tardes noches tienen tienes tiene quiero quisiera busco necesito precio precios cuanto cuesta cuestan como para donde favor gracias ustedes hacen venden puedo pueden informacion info saber este esta esto unos unas algun alguna".split(" "))
export function palabrasClave(texto: string) {
  return [...new Set(
    String(texto || "")
      .toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9ñ ]+/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !VACIAS.has(w)),
  )].slice(0, 6)
}

/** Productos publicados cuyo nombre trae alguna palabra de la pregunta. */
export async function productosParecidos(knex: any, texto: string) {
  const ps = palabrasClave(texto)
  if (!ps.length) return []
  const sinAcento = "lower(translate(p.title, 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun'))"
  const filas = await knex("product as p")
    .whereNull("p.deleted_at")
    .where("p.status", "published")
    .whereRaw("coalesce(p.metadata->>'producto_creditos_3d', 'false') <> 'true'")
    .where((w: any) => { for (const x of ps) w.orWhereRaw(`${sinAcento} like ?`, [`%${x.replace(/s$/, "")}%`]) })
    .orderBy("p.created_at", "desc")
    .limit(5)
    .select("p.title", "p.handle")
  return filas.map((f: any) => ({ nombre: String(f.title).slice(0, 90), liga: `${STORE_URL}/mx/products/${f.handle}` }))
}

const DATOS_WHATSAPP = [
  ...DATOS_HETNA,
  `La tienda: ${STORE_URL}/mx. Cada producto tiene su precio, envío y botón de compra en su página.`,
  `Para que un taller fabrique una pieza a la medida (corte láser, router, plasma, fibra, impresión 3D): publicar la solicitud gratis en ${STORE_URL}/mx/cotizar.`,
  "Los pedidos de la tienda se pagan en la misma página del carrito y se envían por paquetería; el estado del pedido se ve en la cuenta del cliente (Mis pedidos).",
]

let ia: Anthropic | null = null
export async function redactar(texto: string, productos: { nombre: string; liga: string }[]) {
  ia ??= new Anthropic()
  const resp = await ia.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 700,
    output_config: {
      effort: "low",
      format: {
        type: "json_schema",
        schema: {
          type: "object", additionalProperties: false, required: ["tipo", "respuesta"],
          properties: {
            tipo: { type: "string", enum: ["responder", "pasar_a_persona", "ignorar"] },
            respuesta: { type: "string" },
          },
        },
      },
    },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system:
      "Eres el asistente del WhatsApp de HETNA CNC (marketplace mexicano de fabricación CNC y tienda de productos). Contesta en español de México, tuteando, " +
      "breve (1 a 4 oraciones, máximo 1 emoji), útil y con la liga que corresponde. Usa SÓLO los datos y productos de abajo. Nunca inventes precios, descuentos, " +
      "existencias, plazos de entrega, costos de envío ni capacidades: si preguntan un precio, da la liga del producto (ahí está el precio). Si preguntan por un producto " +
      "y está en la lista, da su nombre y liga; si no está, invita a buscar en la tienda o a publicar la solicitud para que un taller lo haga. " +
      "tipo = pasar_a_persona cuando: es una queja, un problema con un pedido o un pago, piden factura, quieren hablar con alguien, negocian, o la duda no se contesta con estos datos " +
      "(en respuesta pon un mensaje corto diciendo que una persona del equipo le contesta pronto). tipo = ignorar para saludos sin pregunta ya contestados, stickers, «ok», «gracias» " +
      "(respuesta vacía) o spam. Saludo solo («hola»): responde con un saludo y pregunta en qué le ayudas.\n\nDatos de HETNA:\n- " +
      DATOS_WHATSAPP.join("\n- ") +
      "\n\nProductos de la tienda que coinciden con el mensaje:\n" +
      (productos.length ? productos.map((p) => `- ${p.nombre}: ${p.liga}`).join("\n") : "(ninguno)"),
    messages: [{ role: "user", content: String(texto).slice(0, 1500) }],
  } as any)
  if (resp.stop_reason === "refusal") return { tipo: "pasar_a_persona", respuesta: "" }
  return JSON.parse(resp.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join(""))
}

/**
 * ¿Le toca contestar al respondedor? (encendido, IA, sin pausa por humano y sin
 * pasar el tope). Si sí, regresa true y contesta en segundo plano.
 */
export async function intentarResponder(knex: any, m: { numero: string; texto?: string; tipo?: string }, logger?: any) {
  const texto = String(m.texto || "").trim()
  const numero = normalizarNumero(m.numero)
  if (!numero || !texto || !whatsappListo() || !iaSocial()) return false
  if (!(await botActivo(knex))) return false
  await asegurar(knex)
  const hoy = new Date().toISOString().slice(0, 10)
  const f = await knex(T_CHAT).where({ numero }).first()
  if (f?.pausa_hasta && new Date(f.pausa_hasta).getTime() > Date.now()) return false
  if (f?.dia === hoy && (f.respuestas || 0) >= TOPE_DIA_NUMERO) return false
  if (f?.ultima && Date.now() - new Date(f.ultima).getTime() < ENTRE_RESPUESTAS_MS) return true // muy seguido: se toma por contestado
  const respuestas = f?.dia === hoy ? (f.respuestas || 0) + 1 : 1
  await knex.raw(
    `insert into ?? (numero, dia, respuestas, ultima, updated_at) values (?, ?, ?, now(), now()) on conflict (numero) do update set dia = excluded.dia, respuestas = excluded.respuestas, ultima = now(), updated_at = now()`,
    [T_CHAT, numero, hoy, respuestas],
  )
  void (async () => {
    try {
      const productos = await productosParecidos(knex, texto).catch(() => [])
      const r = await redactar(texto, productos)
      if (r.tipo === "ignorar" || !String(r.respuesta || "").trim()) {
        if (r.tipo !== "pasar_a_persona") return
      }
      const respuesta = String(r.respuesta || "").trim() || "Gracias por escribir. Una persona del equipo de HETNA te contesta en breve."
      await enviarTexto(numero, respuesta.slice(0, 1200))
      if (r.tipo === "pasar_a_persona") {
        await knex(T_CHAT).where({ numero }).increment("pasados", 1)
        await mandarPrivado(knex, { texto: `💬 WhatsApp: alguien necesita a una persona\n+${numero}: «${texto.slice(0, 600)}»\n\nContéstale desde el celular de HETNA (el respondedor se calla 12 h en ese chat cuando escribes).` }).catch(() => null)
      }
    } catch (e) {
      logger?.warn?.(`[whatsapp-bot] ${numero}: ${(e as Error).message}`)
    }
  })()
  return true
}

/** Para el panel. */
export async function resumenBot(knex: any) {
  await asegurar(knex)
  const hoy = new Date().toISOString().slice(0, 10)
  const r = await knex(T_CHAT).where({ dia: hoy }).sum({ n: "respuestas" }).count({ chats: "*" }).first().catch(() => null)
  const p = await knex(T_CHAT).sum({ n: "pasados" }).first().catch(() => null)
  return { activo: await botActivo(knex), ia: iaSocial(), respuestas_hoy: Number(r?.n || 0), chats_hoy: Number(r?.chats || 0), pasados: Number(p?.n || 0) }
}
