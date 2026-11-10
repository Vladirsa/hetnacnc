// @ts-nocheck
// Marketing HETNA — respuestas a comentarios (Instagram y Facebook).
// Cada 15 minutos se leen los comentarios de lo publicado en los últimos 14
// días (vía n8n). La IA clasifica cada uno y propone respuesta con datos
// reales de HETNA (nunca inventa precios ni plazos):
//   - spam: se ignora
//   - pregunta frecuente o elogio: se contesta sola si "Respuestas automáticas"
//     está prendido; si no, va a Telegram para aprobar
//   - lo demás (preguntas específicas, quejas): siempre a Telegram con botones
//     ✅ Enviar respuesta, ✏️ Cambiar y 🗑 Ignorar
import Anthropic from "@anthropic-ai/sdk"

import { STORE_URL, nuevoId } from "./licitacion"
import { MERCADOS, T_POST, asegurarSocial, enviarAN8n, iaSocial, leerConfig } from "./social-hub"
import { mandarPrivado } from "./social-telegram"

export const T_COMENTARIO = "hetna_social_comentario"
const PAGINA_FB = "109722907076187"
const USUARIO_IG = "hetna_cnc"

let listo = false
async function asegurar(knex: any) {
  if (listo) return
  await asegurarSocial(knex)
  if (!(await knex.schema.hasTable(T_COMENTARIO))) {
    await knex.schema.createTable(T_COMENTARIO, (t: any) => {
      t.text("id").primary()
      t.text("externo").notNullable().unique() // id del comentario en la red
      t.text("red").notNullable() // instagram | facebook
      t.text("post_id").index()
      t.text("autor")
      t.text("texto").notNullable()
      t.timestamp("fecha", { useTz: true })
      t.text("estado").notNullable().defaultTo("nuevo") // nuevo | propuesta | respondido | ignorado | error
      t.text("categoria")
      t.text("respuesta")
      t.text("error")
      t.timestamp("respondido_en", { useTz: true })
      t.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now())
    })
  }
  listo = true
}

// Lo único que la IA puede afirmar de HETNA (para no inventar)
export const DATOS_HETNA = [
  `Para cotizar una pieza: publicar la solicitud gratis en ${STORE_URL}/mx/cotizar; varios talleres mandan propuesta y el cliente elige.`,
  "HETNA no cobra comisión en las licitaciones (solicitudes de cotización).",
  `Los talleres y proveedores se registran gratis en ${STORE_URL}/mx/talleres/unete y reciben solicitudes de trabajo.`,
  `Hay talleres verificados y un ranking público con evaluaciones reales: ${STORE_URL}/mx/talleres/ranking.`,
  `Calculadora CNC gratis (router, láser, fibra, plasma, impresión 3D): ${STORE_URL}/mx/calculadora-cnc.`,
  `Tienda con productos y diseños CNC: ${STORE_URL}/mx.`,
  "Los precios dependen de cada taller y de la pieza (material, medidas, cantidad); no hay precio fijo publicado.",
  "Para dudas puntuales, el usuario puede escribir por mensaje privado a la página.",
]

let ia: Anthropic | null = null
/** Clasifica y propone respuesta. null si no hay IA. */
export async function proponer(c: { texto: string; red: string; autor?: string }, contextoPost: string, mercado = "mx") {
  if (!iaSocial()) return null
  ia ??= new Anthropic()
  const resp = await ia.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 800,
    output_config: {
      effort: "low",
      format: {
        type: "json_schema",
        schema: {
          type: "object", additionalProperties: false, required: ["categoria", "responder", "respuesta"],
          properties: {
            categoria: { type: "string", enum: ["pregunta_frecuente", "pregunta", "elogio", "queja", "spam", "otro"] },
            responder: { type: "boolean" },
            respuesta: { type: "string" },
          },
        },
      },
    },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system:
      "Eres el community manager de HETNA CNC (marketplace de fabricación CNC en México). Clasifica el comentario y, si conviene, escribe una respuesta breve " +
      `(1 a 3 oraciones, cálida, en ${MERCADOS[mercado]?.nota || "español de México"}, tutea). Usa SÓLO estos datos de HETNA; si la pregunta pide algo que no está aquí ` +
      "(precio exacto, plazo, si hacen tal pieza), invita a publicar la solicitud o escribir por mensaje privado, sin prometer nada. Nunca inventes precios, plazos, " +
      "clientes, descuentos ni capacidades. Sin datos personales. pregunta_frecuente = cómo cotizar, cómo registrarse, si cobran comisión, dónde están, cómo funciona. " +
      "spam = promociones ajenas, ligas sospechosas, insultos. En Instagram no pongas ligas (di 'liga en el perfil'); en Facebook sí puedes poner la liga.\n\nDatos de HETNA:\n- " +
      DATOS_HETNA.join("\n- "),
    messages: [{ role: "user", content: `Red: ${c.red}\nPublicación: ${contextoPost.slice(0, 600)}\nComentario de ${c.autor || "alguien"}: ${c.texto.slice(0, 1000)}` }],
  } as any)
  if (resp.stop_reason === "refusal") return null
  return JSON.parse(resp.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join(""))
}

/** Manda la respuesta a la red (respuesta debajo del comentario). */
export async function enviarRespuesta(knex: any, id: string, texto?: string) {
  await asegurar(knex)
  const c = await knex(T_COMENTARIO).where({ id }).first()
  if (!c) return { ok: false, error: "No encontré ese comentario." }
  if (c.estado === "respondido") return { ok: false, error: "Ese comentario ya se respondió." }
  const msg = String(texto || c.respuesta || "").trim().slice(0, 1500)
  if (!msg) return { ok: false, error: "No hay respuesta que enviar." }
  const r: any = await enviarAN8n({ red: c.red === "instagram" ? "instagram_responder" : "comentar", objeto: c.externo, texto: msg })
  await knex(T_COMENTARIO).where({ id }).update(r.ok ? { estado: "respondido", respuesta: msg, respondido_en: knex.fn.now(), error: null } : { estado: "error", respuesta: msg, error: String(r.error || "").slice(0, 300) })
  return r
}

export async function ignorar(knex: any, id: string) {
  await asegurar(knex)
  await knex(T_COMENTARIO).where({ id }).whereNot({ estado: "respondido" }).update({ estado: "ignorado" })
}

export async function cambiarRespuesta(knex: any, id: string, texto: string) {
  await asegurar(knex)
  await knex(T_COMENTARIO).where({ id }).whereNot({ estado: "respondido" }).update({ respuesta: String(texto).slice(0, 1500), estado: "propuesta" })
}

const CAMPOS = {
  instagram: "comments.limit(25){id,text,username,timestamp}",
  facebook: "comments.limit(25){id,message,created_time,from}",
}

/** Job: lee comentarios nuevos, los clasifica y responde o los manda a aprobar. */
export async function revisarComentarios(knex: any, logger?: any) {
  await asegurar(knex)
  const cfg = await leerConfig(knex)
  const posts = await knex(T_POST).whereIn("estado", ["publicada", "parcial"]).where("publicada_en", ">=", knex.raw("now() - interval '14 days'")).select("id", "titulo", "texto_base", "resultado", "mercado").limit(60)
  let nuevos = 0
  for (const p of posts) {
    for (const red of ["instagram", "facebook"]) {
      const objeto = p.resultado?.[red]?.ok && p.resultado[red].id
      if (!objeto || !/^[0-9_]+$/.test(String(objeto))) continue
      const r: any = await enviarAN8n({ red: "metricas", objeto: String(objeto), campos: CAMPOS[red], texto: "" })
      if (!r.ok) continue
      for (const k of r.datos?.comments?.data || []) {
        const autor = red === "instagram" ? k.username : k.from?.name
        const propio = red === "instagram" ? k.username === USUARIO_IG : k.from?.id === PAGINA_FB
        const texto = String(k.text || k.message || "").trim()
        if (propio || !texto) continue
        const ins = await knex(T_COMENTARIO).insert({ id: nuevoId("com"), externo: String(k.id), red, post_id: p.id, autor: autor || null, texto: texto.slice(0, 2000), fecha: k.timestamp || k.created_time || null }).onConflict("externo").ignore().returning("id")
        if (!ins?.length) continue
        nuevos++
        const id = ins[0].id || ins[0]
        try {
          const prop = await proponer({ texto, red, autor }, p.texto_base || p.titulo, p.mercado || "mx")
          if (!prop) {
            await mandarPrivado(knex, { texto: `💬 Comentario nuevo en ${red === "instagram" ? "Instagram" : "Facebook"} (${autor || "alguien"}):\n"${texto.slice(0, 500)}"\n\nSin IA configurada: respóndelo en la app.` })
            continue
          }
          await knex(T_COMENTARIO).where({ id }).update({ categoria: prop.categoria, respuesta: prop.respuesta || null, estado: prop.categoria === "spam" || !prop.responder ? "ignorado" : "propuesta" })
          if (prop.categoria === "spam" || !prop.responder) continue
          if (cfg.auto_respuestas && ["pregunta_frecuente", "elogio"].includes(prop.categoria)) {
            const env = await enviarRespuesta(knex, id)
            if (env.ok) continue
          }
          await mandarPrivado(knex, {
            texto: `💬 ${red === "instagram" ? "Instagram" : "Facebook"} · ${autor || "alguien"} comentó en "${String(p.titulo).slice(0, 60)}":\n"${texto.slice(0, 500)}"\n\n🤖 Respuesta propuesta (${prop.categoria.replace("_", " ")}):\n${prop.respuesta}`,
            comentario: id,
          })
        } catch (e) {
          logger?.warn?.(`[social] comentario ${id}: ${(e as Error).message}`)
        }
      }
    }
  }
  if (nuevos) logger?.info?.(`[social] comentarios nuevos: ${nuevos}`)
  return { nuevos }
}

export async function listarComentarios(knex: any, estado?: string) {
  await asegurar(knex)
  const q = knex(`${T_COMENTARIO} as c`).leftJoin(`${T_POST} as p`, "p.id", "c.post_id").orderBy("c.created_at", "desc").limit(100).select("c.*", "p.titulo as post_titulo")
  if (estado) q.where("c.estado", estado)
  return q
}
