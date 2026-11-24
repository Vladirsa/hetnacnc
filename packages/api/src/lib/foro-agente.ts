// @ts-nocheck
// Agente del foro y la Academia. Dos trabajos, y NADA se publica sin el dueño:
//
//   1. Respondedor (cada 2 horas): preguntas del foro con 6 horas o más sin
//      ninguna respuesta. Claude redacta una respuesta técnica (o una pregunta
//      para aclarar si falta información) y queda pendiente en
//      Dashboard → Foro e IA, donde el dueño la edita, la publica con la cuenta
//      «equipo-hetna» o la descarta. Aviso a Telegram con la liga.
//   2. Investigador (lunes): con búsqueda web, Claude elige un tema que se esté
//      moviendo (y las dudas que más se repiten en el foro) y escribe:
//        - un artículo para la Academia (queda como BORRADOR, sin publicar);
//        - un tema para abrir conversación en el foro (pendiente de aprobar).
//      Siempre con las fuentes citadas al final del artículo.
//
// El foro vive en otra base (HETNA_FORO_DB, ver lib/foro-actividad.ts). Las
// propuestas se guardan en la base de Medusa (hetna_foro_ia).
// Variables: FORO_AGENTE_APAGADO=1 · FORO_HORAS_SIN_RESPUESTA=6
import Anthropic from "@anthropic-ai/sdk"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { Pool } from "pg"

import { LEARNING_MODULE } from "../modules/learning"
import { ADMIN } from "./centro-control"
import { IA_MODELO, modeloIA } from "./ia-modelo"
import { STORE_URL } from "./licitacion"
import { iaSocial } from "./social-hub"
import { mandarPrivado } from "./social-telegram"

export const T_FORO_IA = "hetna_foro_ia"
const CUENTA = "equipo-hetna"

export const foroAgenteApagado = () => ["1", "true", "si"].includes(String(process.env.FORO_AGENTE_APAGADO || "").toLowerCase())

const urlForo = () => process.env.HETNA_FORO_DB || process.env.HETNA_TALLER_DB || ""
const g = globalThis as any
const foro = (): Pool => {
  if (!g.__hetnaForoAgente) {
    g.__hetnaForoAgente = new Pool({ connectionString: urlForo(), max: 2, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 8_000 })
    g.__hetnaForoAgente.on("error", (e) => console.error("[foro-agente] base", e.message))
  }
  return g.__hetnaForoAgente
}

let listo = false
export async function asegurarTablaForoIa(knex) {
  if (listo) return
  if (!(await knex.schema.hasTable(T_FORO_IA))) {
    await knex.schema.createTable(T_FORO_IA, (t) => {
      t.increments("id").primary()
      t.text("tipo").notNullable() // respuesta | tema
      t.bigInteger("tema_id").nullable().index() // en respuestas: el tema del foro
      t.text("seccion").nullable() // slug de la sección (temas nuevos)
      t.text("titulo").notNullable()
      t.text("pregunta").nullable() // el texto de la pregunta original
      t.text("texto").notNullable()
      t.text("url").nullable()
      t.text("estado").notNullable().defaultTo("pendiente") // pendiente | publicado | descartado
      t.text("articulo_id").nullable()
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
      t.timestamp("resuelto_en", { useTz: true }).nullable()
    })
  }
  listo = true
}

let ia: Anthropic | null = null
const textoDe = (resp) => (resp?.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim()
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

// ---------------------------------------------------------------- 1. Respondedor

/** Quita restos de JSON que a veces quedan al final del texto («…tornillos.}»). */
export function limpiarTexto(v: unknown): string {
  let t = String(v ?? "").trim()
  const cuenta = (c: string) => t.split(c).length - 1
  // Sólo se quitan cierres sin pareja: «[1, 2]» se queda igual
  for (let i = 0; i < 4; i++) {
    const m = t.match(/[\s"'`,]*([}\]])[\s"'`,]*$/)
    if (!m) break
    const abre = m[1] === "}" ? "{" : "["
    if (cuenta(abre) >= cuenta(m[1])) break
    t = t.slice(0, t.length - m[0].length).trim()
  }
  return t.replace(/^["'`]+|["'`]+$/g, "").trim()
}

export async function redactarRespuesta(p: { titulo: string; cuerpo: string; seccion: string }): Promise<string> {
  ia ??= new Anthropic()
  const resp = await ia.beta.messages.create({
    ...modeloIA(IA_MODELO()),
    max_tokens: 1500,
    output_config: { effort: "medium" },
    system:
      "Eres parte del equipo de HETNA CNC y contestas en su foro de router, láser, plasma, torno, fresadora, impresión 3D y CAD/CAM. " +
      "Respuesta técnica, específica y útil, en español de México, tono cercano y profesional, máximo 180 palabras, sin markdown ni títulos. " +
      "Si falta información para responder bien (material, espesor, máquina, potencia, software), da lo que sí se puede decir y termina con una o dos preguntas concretas. " +
      "No inventes datos ni cifras que no sean de conocimiento general. No promociones HETNA salvo que una herramienta del sitio de verdad le sirva.",
    messages: [{ role: "user", content: `Sección: ${p.seccion}\nTítulo: ${p.titulo}\n\n${String(p.cuerpo || "").slice(0, 4000)}` }],
  })
  if (resp.stop_reason === "refusal") return ""
  return textoDe(resp).slice(0, 3000)
}

export async function correrRespondedor(container, o: { probar?: boolean } = {}) {
  const r = { nuevas: 0, revisadas: 0 }
  if (!urlForo() || !iaSocial()) return r
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await asegurarTablaForoIa(knex)
  const horas = Math.max(1, Number(process.env.FORO_HORAS_SIN_RESPUESTA) || 6)
  const { rows } = await foro().query(
    `select t.id, t.titulo, t.cuerpo, t.slug, s.slug as seccion, s.nombre as seccion_nombre
       from foro.temas t
       join foro.secciones s on s.id = t.seccion_id
       join foro.perfiles p on p.id = t.autor_id
      where t.estado = 'publicado' and t.respuestas = 0
        and t.tipo in ('pregunta', 'busco')
        and t.creado < now() - ($1 || ' hours')::interval
        and t.creado > now() - interval '10 days'
        and p.usuario <> $2
      order by t.creado asc
      limit 15`,
    [String(horas), CUENTA]
  )
  const vistos = new Set((await knex(T_FORO_IA).whereIn("tema_id", rows.map((t) => t.id)).select("tema_id")).map((x) => String(x.tema_id)))
  const nuevas = []
  for (const t of rows) {
    if (vistos.has(String(t.id))) continue
    r.revisadas++
    if (r.nuevas >= 5) break
    const texto = limpiarTexto(await redactarRespuesta({ titulo: t.titulo, cuerpo: t.cuerpo, seccion: t.seccion_nombre }).catch(() => ""))
    if (!texto) continue
    const url = `${STORE_URL}/mx/foro-cnc/${t.seccion}/${t.slug}`
    if (!o.probar) await knex(T_FORO_IA).insert({ tipo: "respuesta", tema_id: t.id, titulo: t.titulo, pregunta: String(t.cuerpo || "").slice(0, 4000), texto, url })
    nuevas.push({ titulo: t.titulo, url })
    r.nuevas++
  }
  if (nuevas.length && !o.probar) {
    await mandarPrivado(knex, {
      texto:
        `💬 Foro: ${nuevas.length} pregunta(s) sin respuesta con borrador listo\n\n` +
        nuevas.map((n) => `• <a href="${esc(n.url)}">${esc(n.titulo)}</a>`).join("\n") +
        `\n\nRevísalas, edítalas y publícalas en <a href="${ADMIN}/foro-ia">Dashboard → Foro e IA</a>.`,
    }).catch(() => undefined)
  }
  return r
}

// ---------------------------------------------------------------- 2. Investigador

const SECCIONES = ["router-cnc", "corte-laser", "plasma", "torno-fresadora", "impresion-3d", "diseno-cam", "controladores-electronica", "materiales-herramientas", "precios-negocio"]
const ESQUEMA_ARTICULO = {
  type: "object",
  additionalProperties: false,
  required: ["tema", "seccion", "titulo", "seo_title", "seo_description", "excerpt", "secciones_html", "fuentes", "tema_foro_titulo", "tema_foro_cuerpo"],
  properties: {
    tema: { type: "string", description: "El tema elegido y por qué ahora, una línea para el dueño." },
    seccion: { type: "string", enum: SECCIONES, description: "Sección del foro (y categoría de la Academia) a la que pertenece." },
    titulo: { type: "string", description: "Título del artículo, claro, con la búsqueda principal." },
    seo_title: { type: "string", description: "Máx. 60 caracteres." },
    seo_description: { type: "string", description: "Máx. 155 caracteres." },
    excerpt: { type: "string", description: "Resumen de 1 o 2 frases." },
    secciones_html: { type: "string", description: "Cuerpo del artículo en HTML simple (<h2>, <p>, <ul>, <li>, <strong>), 700 a 1200 palabras, práctico, con pasos y valores típicos cuando apliquen." },
    fuentes: { type: "array", items: { type: "object", additionalProperties: false, required: ["titulo", "url"], properties: { titulo: { type: "string" }, url: { type: "string" } } }, description: "Las páginas que consultaste." },
    tema_foro_titulo: { type: "string", description: "Pregunta para abrir conversación en el foro sobre el mismo tema (máx. 110 caracteres)." },
    tema_foro_cuerpo: { type: "string", description: "Cuerpo del tema del foro: contexto breve y 2 o 3 preguntas a la comunidad, 60 a 120 palabras, sin markdown." },
  },
}

const slug = (s: string) =>
  String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80)

export async function correrInvestigador(container, o: { probar?: boolean } = {}) {
  if (!iaSocial()) return { ok: false, motivo: "sin IA" }
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await asegurarTablaForoIa(knex)
  // Dudas recientes del foro, para escribir de lo que de verdad pregunta la gente
  let dudas: string[] = []
  if (urlForo()) {
    dudas = (
      await foro()
        .query(`select titulo from foro.temas where estado = 'publicado' and creado > now() - interval '45 days' order by respuestas desc, creado desc limit 25`)
        .catch(() => ({ rows: [] }))
    ).rows.map((x) => x.titulo)
  }
  const anteriores = (await knex(T_FORO_IA).where({ tipo: "tema" }).orderBy("created_at", "desc").limit(20).select("titulo")).map((x) => x.titulo)
  ia ??= new Anthropic()
  const resp = await ia.beta.messages.create({
    ...modeloIA(IA_MODELO()),
    max_tokens: 16000,
    output_config: { effort: "medium", format: { type: "json_schema", schema: ESQUEMA_ARTICULO } },
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5, user_location: { type: "approximate", country: "MX" } }],
    messages: [
      {
        role: "user",
        content:
          "Eres el investigador técnico de HETNA CNC (marketplace y comunidad mexicana de CNC: router, láser, plasma, torno, fresadora, impresión 3D, CAD/CAM). " +
          "Busca en la web qué tema práctico de CNC conviene explicar esta semana a talleres y aficionados de México (técnicas, materiales, parámetros, software, seguridad, costos, novedades de máquinas). " +
          "Prefiere un tema que responda las dudas del foro. Escribe un artículo original para la Academia (no copies textos) y un tema para el foro.\n\n" +
          (dudas.length ? `Dudas recientes del foro: ${dudas.join(" | ")}\n` : "") +
          (anteriores.length ? `Temas que ya se escribieron (no los repitas): ${anteriores.join(" | ")}\n` : ""),
      },
    ],
  })
  if (resp.stop_reason === "refusal") return { ok: false, motivo: "rechazado" }
  const a = JSON.parse(textoDe(resp))
  if (o.probar) return { ok: true, tema: a.tema, titulo: a.titulo }

  const fuentes = (a.fuentes || []).filter((f) => /^https?:\/\//.test(f.url)).slice(0, 8)
  const html =
    String(a.secciones_html || "") +
    (fuentes.length ? `<h2>Fuentes consultadas</h2><ul>${fuentes.map((f) => `<li><a href="${esc(f.url)}" rel="nofollow noopener" target="_blank">${esc(f.titulo)}</a></li>`).join("")}</ul>` : "")
  const blog = container.resolve(LEARNING_MODULE)
  const [art] = await blog.createLearningArticles([
    {
      slug: `${slug(a.titulo)}-${Date.now().toString(36).slice(-4)}`,
      title: String(a.titulo).slice(0, 160),
      excerpt: String(a.excerpt).slice(0, 400),
      content_html: html,
      seo_title: String(a.seo_title).slice(0, 70),
      seo_description: String(a.seo_description).slice(0, 160),
      source: "agente",
      categoria: SECCIONES.includes(a.seccion) ? a.seccion : null,
      autor: "Equipo HETNA",
      published_at: null, // borrador: lo publica el dueño
      external_links: fuentes,
    },
  ])
  await knex(T_FORO_IA).insert({ tipo: "tema", seccion: SECCIONES.includes(a.seccion) ? a.seccion : "router-cnc", titulo: limpiarTexto(a.tema_foro_titulo).slice(0, 140), texto: limpiarTexto(a.tema_foro_cuerpo).slice(0, 3000), articulo_id: art?.id || null })
  await mandarPrivado(knex, {
    texto:
      `📚 Investigador de la Academia\n\n<b>${esc(a.titulo)}</b>\n${esc(a.tema)}\n\n` +
      `• Artículo guardado como borrador: revísalo y publícalo en <a href="${ADMIN}/blog">Dashboard → Blog</a>.\n` +
      `• Tema para el foro: «${esc(a.tema_foro_titulo)}», pendiente en <a href="${ADMIN}/foro-ia">Dashboard → Foro e IA</a>.`,
  }).catch(() => undefined)
  return { ok: true, titulo: a.titulo }
}

// ---------------------------------------------------------------- Panel

export async function listarForoIa(container) {
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await asegurarTablaForoIa(knex)
  const pendientes = await knex(T_FORO_IA).where({ estado: "pendiente" }).orderBy("created_at", "desc").limit(50)
  const recientes = await knex(T_FORO_IA).whereNot({ estado: "pendiente" }).orderBy("resuelto_en", "desc").limit(20)
  const { rows: secciones } = urlForo() ? await foro().query(`select slug, nombre from foro.secciones order by orden`).catch(() => ({ rows: [] })) : { rows: [] }
  return { pendientes, recientes, secciones, foro_configurado: Boolean(urlForo()) }
}

async function perfilEquipo() {
  const { rows } = await foro().query(`select id from foro.perfiles where usuario = $1 limit 1`, [CUENTA])
  if (!rows[0]) throw new Error(`No existe el perfil «${CUENTA}» en el foro.`)
  return rows[0].id
}

export async function resolverForoIa(container, id: number, accion: string, cambios: { texto?: string; titulo?: string; seccion?: string } = {}) {
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await asegurarTablaForoIa(knex)
  const p = await knex(T_FORO_IA).where({ id, estado: "pendiente" }).first()
  if (!p) return { ok: false, message: "Ya no está pendiente." }
  if (accion === "descartar") {
    await knex(T_FORO_IA).where({ id }).update({ estado: "descartado", resuelto_en: new Date() })
    return { ok: true }
  }
  const texto = String(cambios.texto ?? p.texto).trim()
  if (texto.length < 10) return { ok: false, message: "El texto es muy corto." }
  if (!urlForo()) return { ok: false, message: "Falta HETNA_FORO_DB en el .env del API." }
  const autor = await perfilEquipo()
  let url = p.url
  if (p.tipo === "respuesta") {
    await foro().query(`select foro.responder($1, $2, $3) as id`, [autor, p.tema_id, texto])
  } else {
    const titulo = String(cambios.titulo ?? p.titulo).trim().slice(0, 140)
    const seccion = String(cambios.seccion || p.seccion || "router-cnc")
    const { rows } = await foro().query(`select * from foro.crear_tema($1, $2, 'pregunta', $3, $4)`, [autor, seccion, titulo, texto])
    if (rows[0]) url = `${STORE_URL}/mx/foro-cnc/${rows[0].seccion}/${rows[0].slug}`
  }
  await knex(T_FORO_IA).where({ id }).update({ estado: "publicado", texto, url, resuelto_en: new Date() })
  return { ok: true, url }
}
