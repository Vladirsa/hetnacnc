// @ts-nocheck
// Agente de ventas del WhatsApp de HETNA. Contesta a quien ESCRIBE primero y lo
// atiende como un vendedor: entiende quién es (alguien que necesita una pieza,
// un comprador de la tienda, un taller, un proveedor), pregunta lo necesario
// (una cosa a la vez), recomienda lo que le sirve con su liga y lo lleva a
// cerrar (comprar, publicar su solicitud, probar el Cotizador, registrarse).
//
// - Recuerda la conversación (últimos mensajes del chat) y el perfil del cliente.
// - Sólo datos reales: DATOS_HETNA, las herramientas y planes con sus precios
//   del código, y productos de la tienda que coinciden (nombre y liga; el precio
//   está en la liga). Nunca inventa precios, descuentos, plazos ni existencias.
// - Cliente caliente, queja, pago, factura o negociación: te avisa por Telegram
//   con el resumen del cliente para que cierres tú.
// - Espera unos segundos por si el cliente manda varios mensajes seguidos y
//   contesta todo junto. Si alguien del equipo escribe en el chat desde el
//   celular, se calla 12 horas en ese chat.
import Anthropic from "@anthropic-ai/sdk"

import { STORE_URL } from "./licitacion"
import { T_CONFIG_S, asegurarSocial, iaSocial } from "./social-hub"
import { DATOS_HETNA } from "./social-comentarios"
import { mandarPrivado } from "./social-telegram"
import { enviarTexto, normalizarNumero, whatsappListo } from "./whatsapp"

export const T_CHAT = "hetna_whatsapp_chat"
export const T_MSG = "hetna_whatsapp_msg"
const PAUSA_HUMANO_H = 12
const TOPE_DIA_NUMERO = 30
const ESPERA_MS = 8000 // junta los mensajes seguidos
const HISTORIA = 16

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
  for (const [col, tipo] of [["perfil", "jsonb"], ["temperatura", "text"], ["avisado_en", "timestamp"], ["created_at", "timestamp"]] as const) {
    if (!(await knex.schema.hasColumn(T_CHAT, col))) await knex.schema.alterTable(T_CHAT, (t: any) => (tipo === "jsonb" ? t.jsonb(col) : tipo === "timestamp" ? t.timestamp(col) : t.text(col)))
  }
  if (!(await knex.schema.hasTable(T_MSG))) {
    await knex.schema.createTable(T_MSG, (t: any) => {
      t.increments("id").primary()
      t.text("numero").notNullable().index()
      t.text("rol").notNullable() // cliente | agente | equipo
      t.text("texto").notNullable()
      t.timestamp("created_at").defaultTo(knex.fn.now())
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

async function guardarMsg(knex: any, numero: string, rol: string, texto: string) {
  if (!String(texto || "").trim()) return
  await knex(T_MSG).insert({ numero, rol, texto: String(texto).slice(0, 2000) })
}

/** Alguien del equipo escribió en ese chat desde el celular: el agente se calla y guarda lo que dijo. */
export async function pausarChat(knex: any, numeroCrudo: string, texto?: string) {
  const numero = normalizarNumero(numeroCrudo)
  if (!numero) return
  await asegurar(knex)
  const hasta = new Date(Date.now() + PAUSA_HUMANO_H * 3_600_000)
  await knex.raw(`insert into ?? (numero, pausa_hasta, created_at, updated_at) values (?, ?, now(), now()) on conflict (numero) do update set pausa_hasta = excluded.pausa_hasta, updated_at = now()`, [T_CHAT, numero, hasta])
  if (texto) await guardarMsg(knex, numero, "equipo", texto).catch(() => null)
}

const VACIAS = new Set("hola buenas buenos dias tardes noches tienen tienes tiene quiero quisiera busco necesito precio precios cuanto cuesta cuestan como para donde favor gracias ustedes hacen venden puedo pueden informacion info saber este esta esto unos unas algun alguna".split(" "))
export function palabrasClave(texto: string) {
  return [...new Set(
    String(texto || "")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9ñ ]+/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !VACIAS.has(w)),
  )].slice(0, 8)
}

/** Productos publicados cuyo nombre trae alguna palabra de la conversación. */
export async function productosParecidos(knex: any, texto: string) {
  const ps = palabrasClave(texto)
  if (!ps.length) return []
  const sinAcento = "lower(translate(p.title, 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun'))"
  const filas = await knex("product as p")
    .whereNull("p.deleted_at")
    .where("p.status", "published")
    .whereRaw("coalesce(p.metadata->>'producto_creditos_3d', 'false') <> 'true'")
    .where((w: any) => { for (const x of ps) w.orWhereRaw(`${sinAcento} like ?`, [`%${x.replace(/(es|s)$/, "")}%`]) })
    .orderBy("p.created_at", "desc")
    .limit(6)
    .select("p.title", "p.handle")
  return filas.map((f: any) => ({ nombre: String(f.title).slice(0, 90), liga: `${STORE_URL}/mx/products/${f.handle}` }))
}

/** Todo lo que el agente puede ofrecer, con datos reales del código. */
export function catalogoVentas() {
  const l: string[] = [...DATOS_HETNA]
  l.push(`Tienda de productos CNC (diseños, piezas, regalos personalizados, insumos): ${STORE_URL}/mx. Cada producto tiene su precio, costo de envío y botón de compra en su página. Pago protegido con Mercado Pago dentro de HETNA; el envío se ve antes de pagar.`)
  l.push(`Pieza a la medida (corte láser, router CNC, plasma, fibra, impresión 3D, maquinado): el cliente publica gratis su solicitud con plano, foto o medidas en ${STORE_URL}/mx/cotizar; talleres de su zona le mandan cotización y elige. Pago protegido.`)
  try {
    const { PLANES_COTIZADOR } = require("./cotizador-suscripciones")
    l.push(`HETNA Cotizador (app para talleres; es lo que HETNA cobra): plan Gratis con 5 cotizaciones al mes, prueba de 14 días sin límite, y planes ${Object.values(PLANES_COTIZADOR).map((p: any) => `${p.nombre} $${p.precio} MXN/mes`).join(", ")}. Más info: ${STORE_URL}/mx/herramientas-cnc`)
  } catch {}
  try {
    const { HERRAMIENTAS } = require("./fabrica/promociones")
    const vistos = new Set<string>()
    for (const h of HERRAMIENTAS) {
      if (!h.texto || vistos.has(h.nombre)) continue
      vistos.add(h.nombre)
      l.push(`${h.nombre} (para ${h.publico || "todos"}): ${h.texto} Liga: ${STORE_URL}${h.ruta}`)
    }
  } catch {}
  return l
}

const ESQUEMA = {
  type: "object", additionalProperties: false,
  required: ["tipo", "respuesta", "perfil", "temperatura", "avisar_equipo", "resumen_para_equipo"],
  properties: {
    tipo: { type: "string", enum: ["responder", "pasar_a_persona", "ignorar"] },
    respuesta: { type: "string" },
    perfil: {
      type: "object", additionalProperties: false,
      required: ["quien", "nombre", "ciudad", "necesidad", "interes"],
      properties: {
        quien: { type: "string", enum: ["necesita_pieza", "comprador_tienda", "taller", "proveedor", "empresa", "otro", "sin_saber"] },
        nombre: { type: "string" }, ciudad: { type: "string" }, necesidad: { type: "string" }, interes: { type: "string" },
      },
    },
    temperatura: { type: "string", enum: ["frio", "tibio", "caliente"] },
    avisar_equipo: { type: "boolean" },
    resumen_para_equipo: { type: "string" },
  },
}

const SISTEMA = (catalogo: string[], productos: { nombre: string; liga: string }[], perfil: any) =>
  "Eres el agente de ventas del WhatsApp de HETNA CNC, marketplace mexicano de fabricación CNC con tienda de productos y herramientas para talleres. " +
  "Tu meta es convertir a quien escribe en cliente: entender qué necesita, recomendar lo que de verdad le sirve y llevarlo a la acción (comprar en la tienda, publicar su solicitud de cotización, probar el Cotizador, usar una herramienta, registrar su taller o anunciarse).\n\n" +
  "Cómo vendes:\n" +
  "- Español de México, tuteando, cálido y profesional, como un buen vendedor por WhatsApp. Mensajes cortos (2 a 5 oraciones), máximo 1 emoji, sin listas largas.\n" +
  "- Primero entiende: si no sabes quién es o qué busca, haz UNA pregunta concreta (¿es para ti o para tu negocio?, ¿qué pieza, material, medidas y cuántas?, ¿en qué ciudad?). No hagas interrogatorios: una pregunta por mensaje.\n" +
  "- Luego recomienda UNA opción clara con su liga y un siguiente paso concreto. Destaca el beneficio para él (ahorra tiempo, varios talleres compiten por su pieza, pago protegido, empieza gratis).\n" +
  "- Si es un taller CNC, ofrece el Cotizador (empieza gratis o la prueba de 14 días) y el registro gratis para recibir trabajos. Si busca un producto y está en la lista, dale nombre y liga. Si no está, ofrece que un taller se lo fabrique publicando su solicitud.\n" +
  "- Objeciones (precio, confianza, tiempo): responde con hechos de abajo (pago protegido, talleres verificados con evaluaciones, empieza gratis), sin presionar.\n" +
  "- Usa el nombre del cliente si lo dio. No repitas lo que ya dijiste en la conversación.\n\n" +
  "Reglas que no se rompen:\n" +
  "- Usa SÓLO los datos y productos de abajo. Nunca inventes precios de productos o piezas, descuentos, existencias, tiempos de entrega, costos de envío ni capacidades. El precio de un producto está en su liga; el de una pieza a la medida lo dan los talleres al cotizar.\n" +
  "- Los únicos precios que puedes decir son los de los planes del Cotizador escritos abajo.\n" +
  "- tipo = pasar_a_persona si: queja, problema con un pedido, pago o envío, factura, piden hablar con alguien, quieren negociar o un trato especial, o no se puede contestar con estos datos. En respuesta dile que una persona del equipo le contesta en breve (y si falta, pídele el dato que ayude: qué pieza, cuántas, ciudad).\n" +
  "- tipo = ignorar sólo para «ok», «gracias», stickers o spam cuando no hace falta contestar (respuesta vacía).\n" +
  "- temperatura: caliente = quiere comprar o cotizar ya, pidió precio de algo concreto con cantidad, es empresa o pedido grande, o quiere contratar un plan; tibio = interesado con dudas; frio = sólo curiosea.\n" +
  "- avisar_equipo = true cuando está caliente o pasas a persona. resumen_para_equipo: quién es, qué necesita, datos que dio y qué le ofreciste, en 2 a 3 líneas.\n" +
  "- perfil: llena lo que ya se sabe de la conversación (vacío si no se sabe).\n\n" +
  "Datos de HETNA (lo único que puedes afirmar):\n- " + catalogo.join("\n- ") +
  "\n\nProductos de la tienda que coinciden con la conversación:\n" + (productos.length ? productos.map((p) => `- ${p.nombre}: ${p.liga}`).join("\n") : "(ninguno)") +
  (perfil ? `\n\nLo que ya sabemos de este cliente: ${JSON.stringify(perfil)}` : "")

let ia: Anthropic | null = null
export async function redactar(historia: { rol: string; texto: string }[], productos: { nombre: string; liga: string }[], perfil: any) {
  ia ??= new Anthropic()
  // La conversación como turnos: cliente = user; agente y equipo = assistant
  const turnos: any[] = []
  for (const m of historia) {
    const role = m.rol === "cliente" ? "user" : "assistant"
    const texto = m.rol === "equipo" ? `(Respondió una persona del equipo) ${m.texto}` : m.texto
    if (turnos.length && turnos[turnos.length - 1].role === role) turnos[turnos.length - 1].content += `\n${texto}`
    else turnos.push({ role, content: texto })
  }
  while (turnos.length && turnos[0].role !== "user") turnos.shift()
  if (!turnos.length || turnos[turnos.length - 1].role !== "user") return null
  const resp = await ia.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 1200,
    output_config: { effort: "medium", format: { type: "json_schema", schema: ESQUEMA } },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SISTEMA(catalogoVentas(), productos, perfil),
    messages: turnos,
  } as any)
  if (resp.stop_reason === "refusal") return { tipo: "pasar_a_persona", respuesta: "", perfil: null, temperatura: "tibio", avisar_equipo: true, resumen_para_equipo: "La IA no pudo contestar este mensaje." }
  return JSON.parse(resp.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join(""))
}

const turnos = new Map<string, ReturnType<typeof setTimeout>>()
const RESPALDO = `¡Gracias por escribir a HETNA CNC! En un momento una persona del equipo te contesta. Mientras, puedes ver la tienda en ${STORE_URL}/mx o publicar gratis la pieza que necesitas en ${STORE_URL}/mx/cotizar.`

/**
 * ¿Le toca al agente? (encendido, IA, sin pausa por humano, sin pasar el tope).
 * Si sí, guarda el mensaje, regresa true y contesta unos segundos después
 * (para juntar mensajes seguidos).
 */
export async function intentarResponder(knex: any, m: { numero: string; texto?: string; tipo?: string }, logger?: any) {
  const texto = String(m.texto || "").trim()
  const numero = normalizarNumero(m.numero)
  if (!numero || !whatsappListo() || !iaSocial()) return false
  if (!(await botActivo(knex))) return false
  await asegurar(knex)
  const f = await knex(T_CHAT).where({ numero }).first()
  if (f?.pausa_hasta && new Date(f.pausa_hasta).getTime() > Date.now()) {
    if (texto) await guardarMsg(knex, numero, "cliente", texto) // para que el agente tenga el contexto al volver
    return false
  }
  const hoy = new Date().toISOString().slice(0, 10)
  if (f?.dia === hoy && (f.respuestas || 0) >= TOPE_DIA_NUMERO) return false
  if (!texto) return m.tipo === "imagen" ? false : true
  if (!f) await knex(T_CHAT).insert({ numero, created_at: new Date(), updated_at: new Date() }).onConflict("numero").ignore()
  await guardarMsg(knex, numero, "cliente", texto)
  const previo = turnos.get(numero)
  if (previo) clearTimeout(previo)
  turnos.set(numero, setTimeout(() => {
    turnos.delete(numero)
    void contestar(knex, numero, logger)
  }, ESPERA_MS))
  return true
}

async function contestar(knex: any, numero: string, logger?: any) {
  try {
    const f = await knex(T_CHAT).where({ numero }).first()
    if (f?.pausa_hasta && new Date(f.pausa_hasta).getTime() > Date.now()) return
    const historia = (await knex(T_MSG).where({ numero }).where("created_at", ">=", knex.raw("now() - interval '30 days'")).orderBy("id", "desc").limit(HISTORIA)).reverse()
    if (!historia.length || historia[historia.length - 1].rol !== "cliente") return
    const textoCliente = historia.filter((x: any) => x.rol === "cliente").slice(-4).map((x: any) => x.texto).join(" ")
    const productos = await productosParecidos(knex, textoCliente).catch(() => [])
    let r: any
    try {
      r = await redactar(historia, productos, f?.perfil || null)
    } catch (e) {
      // Sin IA (sin saldo, caída): el cliente no se queda sin respuesta y el dueño se entera
      const msg = (e as Error).message || ""
      logger?.warn?.(`[whatsapp-agente] IA: ${msg.slice(0, 200)}`)
      if (historia.filter((x: any) => x.rol === "agente").slice(-1)[0]?.texto === RESPALDO) return
      r = { tipo: "pasar_a_persona", respuesta: RESPALDO, perfil: null, temperatura: null, avisar_equipo: true, resumen_para_equipo: /credit balance/i.test(msg) ? "⚠️ El agente no pudo contestar: la cuenta de la IA (Anthropic) no tiene saldo." : "⚠️ El agente no pudo contestar: la IA falló." }
    }
    if (!r) return
    const hoy = new Date().toISOString().slice(0, 10)
    await knex(T_CHAT).where({ numero }).update({
      perfil: r.perfil ? JSON.stringify(r.perfil) : f?.perfil ? JSON.stringify(f.perfil) : null,
      temperatura: r.temperatura || f?.temperatura || null,
      dia: hoy,
      respuestas: f?.dia === hoy ? (f.respuestas || 0) + 1 : 1,
      ultima: new Date(),
      updated_at: new Date(),
    })
    let respuesta = String(r.respuesta || "").trim()
    if (r.tipo === "ignorar" && !respuesta) return
    if (!respuesta) respuesta = "Gracias por escribir. Una persona del equipo de HETNA te contesta en breve."
    await enviarTexto(numero, respuesta.slice(0, 1500))
    await guardarMsg(knex, numero, "agente", respuesta)
    // Aviso al dueño: cliente caliente o que necesita a una persona (no más de uno cada 6 h por chat, salvo pasar a persona)
    const reciente = f?.avisado_en && Date.now() - new Date(f.avisado_en).getTime() < 6 * 3_600_000
    if (r.tipo === "pasar_a_persona" || (r.avisar_equipo && !reciente)) {
      if (r.tipo === "pasar_a_persona") await knex(T_CHAT).where({ numero }).increment("pasados", 1)
      await knex(T_CHAT).where({ numero }).update({ avisado_en: new Date() })
      const p = r.perfil || {}
      const icono = r.tipo === "pasar_a_persona" ? "🙋" : "🔥"
      await mandarPrivado(knex, {
        texto:
          `${icono} WhatsApp: ${r.tipo === "pasar_a_persona" ? "necesita a una persona" : "cliente caliente"}\n` +
          `+${numero}${p.nombre ? ` · ${p.nombre}` : ""}${p.ciudad ? ` · ${p.ciudad}` : ""}\n` +
          `${r.resumen_para_equipo || p.necesidad || ""}\n\n` +
          `Último mensaje: «${historia[historia.length - 1].texto.slice(0, 400)}»\n` +
          `Le contestamos: «${respuesta.slice(0, 400)}»\n\n` +
          `Escríbele desde el celular de HETNA: https://wa.me/${numero} (el agente se calla 12 h en ese chat cuando escribes).`,
      }).catch(() => null)
    }
  } catch (e) {
    logger?.warn?.(`[whatsapp-agente] ${numero}: ${(e as Error).message}`)
  }
}

/** Para el panel. */
export async function resumenBot(knex: any) {
  await asegurar(knex)
  const hoy = new Date().toISOString().slice(0, 10)
  const r = await knex(T_CHAT).where({ dia: hoy }).sum({ n: "respuestas" }).count({ chats: "*" }).first().catch(() => null)
  const p = await knex(T_CHAT).sum({ n: "pasados" }).first().catch(() => null)
  const calientes = await knex(T_CHAT).where({ temperatura: "caliente" }).where("updated_at", ">=", knex.raw("now() - interval '7 days'")).count({ n: "*" }).first().catch(() => null)
  return { activo: await botActivo(knex), ia: iaSocial(), respuestas_hoy: Number(r?.n || 0), chats_hoy: Number(r?.chats || 0), pasados: Number(p?.n || 0), calientes_7d: Number(calientes?.n || 0) }
}
