// @ts-nocheck
// Marketing HETNA — biblioteca de referencias y guía de estilo.
// El dueño sube imágenes y videos que le gustan (o pega ligas con una nota).
// Un agente con visión (Claude) analiza cada uno: gancho, estructura, ritmo,
// tipo de imagen (infografía, caricatura, cómic, foto real), textos, colores y
// por qué funciona. Con todos los análisis arma la "Guía de estilo HETNA" que
// siguen los agentes de guion, diseño y revisión.
import { spawnSync } from "child_process"
import fs from "fs"
import os from "os"
import path from "path"
import Anthropic from "@anthropic-ai/sdk"

import { nuevoId } from "./licitacion"
import { T_CONFIG_S, asegurarSocial, iaSocial } from "./social-hub"
import { ffmpegBin } from "./fabrica/video"
import { modeloIA } from "./ia-modelo"

export const T_REF = "hetna_marketing_referencia"
let listo = false
async function asegurar(knex: any) {
  if (listo) return
  await asegurarSocial(knex)
  if (!(await knex.schema.hasTable(T_REF))) {
    await knex.schema.createTable(T_REF, (t: any) => {
      t.text("id").primary()
      t.text("tipo").notNullable() // imagen | video | liga
      t.text("url").notNullable()
      t.text("nota") // lo que le gusta al dueño
      t.jsonb("analisis")
      t.text("estado").notNullable().defaultTo("pendiente") // pendiente | listo | error
      t.text("error")
      t.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now())
    })
  }
  listo = true
}

const ESQUEMA = {
  type: "object", additionalProperties: false,
  required: ["formato", "gancho", "estructura", "estilo_visual", "texto_en_pantalla", "colores", "por_que_funciona", "como_usarlo_en_hetna"],
  properties: {
    formato: { type: "string", description: "infografía, caricatura con humor, cómic de situación, foto real, video de proceso, video con presentador, animación, etc." },
    gancho: { type: "string", description: "qué atrapa en el primer vistazo o primer segundo" },
    estructura: { type: "string", description: "orden de las partes (problema, explicación, prueba, llamado) y ritmo" },
    estilo_visual: { type: "string", description: "ilustración, trazo, iluminación, composición, personajes" },
    texto_en_pantalla: { type: "string", description: "cuánto texto, tamaño, jerarquía, tipografía, globos de diálogo" },
    colores: { type: "string" },
    por_que_funciona: { type: "string", description: "emoción o necesidad que toca y por qué se comparte" },
    como_usarlo_en_hetna: { type: "string", description: "cómo adaptar este formato a talleres, proveedores y clientes CNC" },
  },
}

let ia: Anthropic | null = null
const cliente = () => (ia ??= new Anthropic())

/** Cuadros de un video (6 repartidos) en base64, más duración y cortes de escena. */
function cuadrosDeVideo(url: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hetna-ref-"))
  try {
    const probe = spawnSync(ffmpegBin().replace(/ffmpeg$/, "ffprobe"), ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", url], { encoding: "utf8", timeout: 60_000 })
    const dur = Number(String(probe.stdout).trim()) || 0
    const marcas = [0.3, ...[1, 2, 3, 4, 5].map((k) => (dur * k) / 6)].filter((t) => t < Math.max(dur, 0.5))
    const cuadros: string[] = []
    for (const [i, t] of marcas.entries()) {
      const f = path.join(dir, `c${i}.jpg`)
      spawnSync(ffmpegBin(), ["-hide_banner", "-loglevel", "error", "-y", "-ss", t.toFixed(2), "-i", url, "-frames:v", "1", "-vf", "scale=540:-2", "-q:v", "4", f], { timeout: 60_000 })
      if (fs.existsSync(f)) cuadros.push(fs.readFileSync(f).toString("base64"))
    }
    const esc = spawnSync(ffmpegBin(), ["-hide_banner", "-i", url, "-vf", "select='gt(scene,0.35)',showinfo", "-f", "null", "-"], { encoding: "utf8", timeout: 120_000 })
    const cortes = (String(esc.stderr).match(/showinfo/g) || []).length
    return { dur, cuadros, cortes }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

/** Analiza una referencia con visión. */
export async function analizarReferencia(knex: any, id: string, logger?: any) {
  await asegurar(knex)
  const r = await knex(T_REF).where({ id }).first()
  if (!r) return null
  if (!iaSocial()) {
    await knex(T_REF).where({ id }).update({ estado: "error", error: "Falta la llave de IA (ANTHROPIC_API_KEY) en el servidor." })
    return null
  }
  try {
    const contenido: any[] = []
    let extra = ""
    if (r.tipo === "imagen") contenido.push({ type: "image", source: { type: "url", url: r.url } })
    else if (r.tipo === "video") {
      const v = cuadrosDeVideo(r.url)
      if (!v.cuadros.length) throw new Error("No pude leer el video (formato o tamaño).")
      for (const c of v.cuadros) contenido.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: c } })
      extra = `Es un video de ${v.dur.toFixed(1)} s con ${v.cortes} cambios de escena (aprox. ${v.dur ? (v.cortes / v.dur).toFixed(2) : "?"} cortes por segundo). Los cuadros van en orden de tiempo.`
    } else extra = `Es una liga (${r.url}); no puedes verla: analiza sólo con la descripción del dueño.`
    contenido.push({ type: "text", text: `Referencia que le gusta al dueño de HETNA CNC (marketplace de fabricación CNC: talleres, proveedores y clientes). ${extra}\nNota del dueño: ${r.nota || "(sin nota)"}\nAnaliza qué la hace buena y cómo replicar el FORMATO (no copiar el contenido ni la marca ajena).` })
    const resp = await cliente().beta.messages.create({
      ...modeloIA(),
      max_tokens: 2000,
      output_config: { effort: "medium", format: { type: "json_schema", schema: ESQUEMA } },
      system: "Eres director creativo de una agencia de marketing para la industria. Analizas piezas de redes sociales con mirada profesional y en español de México.",
      messages: [{ role: "user", content: contenido }],
    } as any)
    if (resp.stop_reason === "refusal") throw new Error("La IA no pudo analizar esta referencia.")
    const analisis = JSON.parse(resp.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join(""))
    await knex(T_REF).where({ id }).update({ analisis: JSON.stringify(analisis), estado: "listo", error: null })
    return analisis
  } catch (e) {
    logger?.warn?.(`[referencias] ${id}: ${(e as Error).message}`)
    await knex(T_REF).where({ id }).update({ estado: "error", error: (e as Error).message.slice(0, 300) })
    return null
  }
}

export async function agregarReferencia(knex: any, d: { tipo: string; url: string; nota?: string }, logger?: any) {
  await asegurar(knex)
  const tipo = ["imagen", "video", "liga"].includes(d.tipo) ? d.tipo : "liga"
  if (!/^https?:\/\//.test(String(d.url || ""))) throw Object.assign(new Error("Falta la imagen, el video o la liga."), { status: 400 })
  const id = nuevoId("ref")
  await knex(T_REF).insert({ id, tipo, url: String(d.url).slice(0, 1000), nota: String(d.nota || "").slice(0, 1000) || null })
  setImmediate(() => analizarReferencia(knex, id, logger).catch(() => {}))
  return id
}

export async function listarReferencias(knex: any) {
  await asegurar(knex)
  return knex(T_REF).orderBy("created_at", "desc").limit(100)
}
export async function borrarReferencia(knex: any, id: string) {
  await asegurar(knex)
  await knex(T_REF).where({ id }).del()
}

// ---------------------------------------------------------------------
// Guía de estilo
// ---------------------------------------------------------------------

export async function leerGuia(knex: any): Promise<{ texto: string; actualizada?: string }> {
  await asegurar(knex)
  return (await knex(T_CONFIG_S).where({ clave: "guia_estilo" }).first())?.valor || { texto: "" }
}
export async function guardarGuia(knex: any, texto: string) {
  const v = { texto: String(texto).slice(0, 8000), actualizada: new Date().toISOString() }
  await knex.raw(`insert into ?? (clave, valor) values ('guia_estilo', ?::jsonb) on conflict (clave) do update set valor = excluded.valor`, [T_CONFIG_S, JSON.stringify(v)])
  return v
}

/** Sintetiza la guía con todos los análisis (la escribe el agente; el dueño la puede editar). */
export async function generarGuia(knex: any, logger?: any) {
  await asegurar(knex)
  const refs = await knex(T_REF).where({ estado: "listo" }).orderBy("created_at", "desc").limit(40)
  if (!refs.length) throw Object.assign(new Error("Primero agrega referencias y espera a que se analicen."), { status: 400 })
  if (!iaSocial()) throw Object.assign(new Error("Falta la llave de IA (ANTHROPIC_API_KEY)."), { status: 400 })
  const resumen = refs.map((r: any, i: number) => `#${i + 1} (${r.tipo})${r.nota ? ` nota del dueño: ${r.nota}` : ""}\n${JSON.stringify(r.analisis)}`).join("\n\n")
  const resp = await cliente().beta.messages.create({
    ...modeloIA(),
    max_tokens: 3000,
    output_config: { effort: "medium" },
    system:
      "Eres el director creativo de HETNA CNC. Con los análisis de las referencias que le gustan al dueño, escribe la GUÍA DE ESTILO de HETNA para imágenes y videos: " +
      "formatos preferidos y cuándo usar cada uno, estructura de guion (gancho, problema, explicación, prueba, llamado), ritmo y duración de videos, estilo de ilustración, " +
      "cómo poner el texto en pantalla (jerarquía, globos de diálogo, tamaño), colores (la marca usa azul marino #142033 y naranja #C2560A), tono y humor, y lo que NO se hace. " +
      "Incluye siempre estos principios de video del dueño: Propón una acción visual por bloque; máximo 4 palabras en pantalla por escena aparte de subtítulos; convierte ideas en acciones y dibuja literal las analogías; muestra magnitudes con escala, enfoca lo importante y conserva elementos entre escenas; sincroniza cada acción con su palabra y deja una imagen final clara por escena. " +
      "Incluye el mapa emocional del dueño: vender Deseo (taller con trabajos que dan orgullo), Belleza (piezas y diseños bonitos), Tranquilidad (encargar sin miedo), Sueños (emprender; para jóvenes emprendedores y padres, nunca dirigido a menores), Seguridad (proveedores confiables para empresas) y Esperanza (empezar con poco, sin pagar por entrar); siempre a la aspiración, sin prometer riqueza ni cifras. " +
      "Escríbela en viñetas claras en español de México, máximo 700 palabras. Es para que la sigan agentes de IA (guionista, diseñador y revisor).",
    messages: [{ role: "user", content: resumen }],
  } as any)
  const texto = resp.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("").trim()
  if (!texto) throw new Error("La IA no regresó la guía.")
  return guardarGuia(knex, texto)
}

/** Texto corto de la guía para meter en los prompts de los agentes ("" si no hay). */
export async function guiaParaPrompt(knex: any) {
  const g = await leerGuia(knex).catch(() => ({ texto: "" }))
  return g.texto ? `\n\nGUÍA DE ESTILO HETNA (síguela):\n${g.texto.slice(0, 5000)}` : ""
}
