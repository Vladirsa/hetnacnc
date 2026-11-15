// @ts-nocheck
// Estudio diario de HETNA: un video vertical al día para YouTube Shorts,
// Instagram Reels, TikTok y Facebook, hecho por una cadena de "agentes":
//
//   2. Guionista  — Claude escribe el guion con gancho en el primer segundo,
//                   usando fórmulas de copywriting (AIDA, FAB, titulares, CTA),
//                   lo aprendido en redes y las notas del analista de retención.
//                   Días de novela (mar/jue/sáb): "El Taller", historia FICTICIA
//                   con personajes fijos; los demás días, video educativo.
//   3. Voz        — narración (RunPod o voz local, la misma de la Fábrica).
//   4. Animador   — cada escena: imagen de arranque (FLUX) + animación con IA de
//                   video (MiniMax H3 Max Turbo en fal.ai). Toma y movimiento de
//                   cámara distintos en cada escena; no repite tomas recientes.
//   6. Publicador — arma el corto (subtítulos animados, música, gancho en
//                   pantalla) y lo deja en el Social Hub con título SEO,
//                   descripción y la hora que mejor ha funcionado.
//
// Gasto: cada video cuesta centavos de dólar (imagen ~0.04 + video ~0.0175 por
// segundo); hay un tope diario (ESTUDIO_TOPE_USD, por omisión 1.5) y si se
// pasa, no se hace. Llave: FAL_KEY en el .env del backend.
import Anthropic from "@anthropic-ai/sdk"
import fs from "fs"
import os from "os"
import path from "path"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { STORE_URL, nuevoId } from "../licitacion"
import { T_POST, asegurarSocial, crearPublicacion, dentroDeHorario, iaSocial, leerConfig, zonaDe } from "../social-hub"
import { aprendizaje, horaEn } from "../social-estadisticas"
import { modeloIA } from "../ia-modelo"
import { musicaAlAzar, subir } from "./index"
import { vozPara } from "./promociones"
import { carpetaFuentes } from "./render"
import { assKaraoke, correr, ffmpegDisponible } from "./video"
import { paraVoz } from "./hyperframes"

export const T_ESTUDIO = "hetna_estudio"
const FAL = () => (process.env.FAL_KEY || "").trim()
export const estudioListo = () => !!FAL() && iaSocial() && ffmpegDisponible()
const TOPE_USD = () => Number(process.env.ESTUDIO_TOPE_USD || 1.5)
const MODELO_IMAGEN = () => process.env.ESTUDIO_MODELO_IMAGEN || "fal-ai/flux-pro/v1.1"
const MODELO_VIDEO = () => process.env.ESTUDIO_MODELO_VIDEO || "minimax/h3-max-turbo/image-to-video"
const USD_IMAGEN = 0.04
const USD_VIDEO_SEG = 0.0175

// ---------------------------------------------------------------------
// Fórmulas (de las guías de copywriting que dio el dueño)
// ---------------------------------------------------------------------

export const FORMULAS = {
  estructuras: [
    "AIDA: Atención (gancho con el problema) → Interés (detalles, historia o preguntas) → Deseo (cómo cambia su vida, beneficios) → Acción (qué hacer ahora).",
    "FAB: Característica (qué es) → Ventaja (qué hace mejor) → Beneficio (qué gana la persona).",
    "PAS: Problema → Agitación (por qué duele, cuánto cuesta) → Solución.",
    "Antes / Después / Puente: cómo estaba, cómo está ahora, qué lo cambió.",
  ],
  titulares: [
    "X técnicas/trucos/secretos de [rubro] que todo [público] debería conocer",
    "¿No quieres [miedo o problema]? [verbo] [solución]",
    "¿Quieres [resultado deseado]? [verbo] [producto]",
    "No necesitas [objeción] para [resultado deseado]",
    "El/La [producto] que te ayudará a [beneficio]",
    "[Beneficio] en [tiempo] con [producto]",
    "Si no [acción] ahora, vas a [resultado no deseado]",
    "El/La [producto] [3 adjetivos] para [beneficio]",
    "El/La [producto] [adjetivo] para [público ideal]",
    "[Verbo] el/la [producto] que [beneficio]",
  ],
  ganchos: [
    "Error que cuesta dinero: «Si tu fresa hace esto, estás tirando dinero»",
    "Pregunta directa: «¿Sabías que…?»",
    "Resultado primero: mostrar la pieza terminada y luego cómo se hizo",
    "Contradicción: «Todos lo hacen así… y está mal»",
    "Número concreto: «3 ajustes que…»",
    "Suspenso de novela: «Ese día en el taller nadie esperaba lo que pasó…»",
  ],
  cta: [
    "Cotiza gratis tu pieza en hetnacnc.com",
    "Guarda este video para no perderlo",
    "¿Qué otro tip agregarías? Te leo en los comentarios",
    "Síguenos para la siguiente parte",
    "Prueba gratis el Cotizador desde la liga del perfil",
    "Etiqueta a alguien del taller que necesita ver esto",
    "¿Conocías este truco?",
    "Activa las notificaciones para el próximo capítulo",
  ],
}

// Personajes FIJOS de la novela (ficción). La descripción visual es la misma en
// todas las escenas para que se vean consistentes.
export const PERSONAJES = [
  { nombre: "Don Chuy", rol: "maestro tornero y fresador, 58 años, 30 años de oficio", visual: "Mexican man in his late 50s, grey mustache, short grey hair, navy blue work overalls, safety glasses on forehead, strong hands" },
  { nombre: "Vale", rol: "ingeniera de diseño CAD/CAM, 28 años, recién llegada", visual: "Mexican woman in her late 20s, dark hair in a ponytail, black-framed glasses, grey company polo shirt, holding a tablet" },
  { nombre: "Beto", rol: "aprendiz de 19 años, curioso y a veces impulsivo", visual: "young Mexican man around 19, black baseball cap backwards, orange safety vest over a white t-shirt, slim build" },
  { nombre: "Doña Mari", rol: "dueña del taller, 47 años, sabe de números y clientes", visual: "Mexican woman in her late 40s, shoulder-length wavy hair, denim shirt, reading glasses hanging from a cord, confident posture" },
]

const CAMARAS = ["slow push-in", "slow dolly left", "orbit around the subject", "low angle tilt up", "overhead top-down slow rotation", "close-up macro with shallow depth of field", "handheld follow shot", "rack focus from foreground to subject", "slow pull-back reveal", "side tracking shot"]

const LUGAR = "a real small CNC machine shop in Mexico: CNC router, fiber laser, lathe, metal shavings, workbenches, warm practical lights, realistic, cinematic, 35mm film look, vertical 9:16"

// ---------------------------------------------------------------------
// Tabla
// ---------------------------------------------------------------------

let lista = false
export async function asegurarEstudio(knex: any) {
  if (lista) return
  await asegurarSocial(knex)
  if (!(await knex.schema.hasTable(T_ESTUDIO))) {
    await knex.schema.createTable(T_ESTUDIO, (t: any) => {
      t.text("id").primary()
      t.text("dia").notNullable() // YYYY-MM-DD (México)
      t.text("tipo") // educativo | novela
      t.text("estado").defaultTo("haciendo") // haciendo | listo | error
      t.jsonb("guion")
      t.jsonb("escenas")
      t.decimal("costo_usd", 8, 3).defaultTo(0)
      t.text("post_id")
      t.text("video_url")
      t.text("error")
      t.timestamp("created_at").defaultTo(knex.fn.now())
      t.timestamp("updated_at").defaultTo(knex.fn.now())
    })
  }
  // Notas del analista de retención (fase 2) para el guionista
  if (!(await knex.schema.hasTable("hetna_estudio_nota"))) {
    await knex.schema.createTable("hetna_estudio_nota", (t: any) => {
      t.increments("id").primary()
      t.text("nota").notNullable()
      t.text("fuente")
      t.timestamp("created_at").defaultTo(knex.fn.now())
    })
  }
  lista = true
}

export const diaMx = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(d)
const diaSemanaMx = (d = new Date()) => new Date(`${diaMx(d)}T12:00:00Z`).getUTCDay()
export const tocaNovela = (d = new Date()) => [2, 4, 6].includes(diaSemanaMx(d))

// ---------------------------------------------------------------------
// fal.ai (cola: se manda, se espera y se recoge)
// ---------------------------------------------------------------------

export async function fal(modelo: string, input: any, topeMin = 12) {
  const h = { Authorization: `Key ${FAL()}`, "Content-Type": "application/json" }
  const r = await fetch(`https://queue.fal.run/${modelo}`, { method: "POST", headers: h, body: JSON.stringify(input), signal: AbortSignal.timeout(60_000) })
  const d = await r.json().catch(() => ({}))
  if (!r.ok || !d.request_id) throw new Error(`fal ${modelo}: ${d.detail ? JSON.stringify(d.detail).slice(0, 200) : r.status}`)
  const fin = Date.now() + topeMin * 60_000
  while (Date.now() < fin) {
    await new Promise((ok) => setTimeout(ok, 4000))
    const s = await fetch(d.status_url, { headers: h, signal: AbortSignal.timeout(30_000) }).then((x) => x.json()).catch(() => null)
    if (s?.status === "COMPLETED") {
      const out = await fetch(d.response_url, { headers: h, signal: AbortSignal.timeout(60_000) }).then((x) => x.json())
      if (out?.detail) throw new Error(`fal ${modelo}: ${JSON.stringify(out.detail).slice(0, 200)}`)
      return out
    }
    if (s?.status && !["IN_QUEUE", "IN_PROGRESS"].includes(s.status)) throw new Error(`fal ${modelo}: ${s.status}`)
  }
  throw new Error(`fal ${modelo}: tardó más de ${topeMin} min`)
}

// ---------------------------------------------------------------------
// 2. Guionista
// ---------------------------------------------------------------------

const S = (d = "") => ({ type: "string", description: d })
const ESQUEMA = {
  type: "object", additionalProperties: false,
  required: ["tema", "titulo_seo", "descripcion", "hashtags", "gancho_pantalla", "escenas", "cta", "resumen_capitulo"],
  properties: {
    tema: S("tema en 5 a 10 palabras"),
    titulo_seo: S("título para YouTube, máximo 70 caracteres, palabra clave al inicio, sin clickbait falso"),
    descripcion: S("descripción para YouTube/Facebook: 2 a 4 líneas con palabras clave y {{liga}} al final"),
    hashtags: { type: "array", items: S() },
    gancho_pantalla: S("texto grande del primer segundo, máximo 6 palabras"),
    escenas: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["narracion", "toma", "personajes"],
        properties: {
          narracion: S("lo que dice la voz en esta escena, 6 a 18 palabras"),
          toma: S("descripción VISUAL de la toma en inglés para la IA de video: qué se ve, acción, encuadre. Sin texto ni letreros en pantalla."),
          personajes: { type: "array", items: S("nombre exacto del personaje que aparece") },
        },
      },
    },
    cta: S("llamada a la acción final, una frase"),
    resumen_capitulo: S("si es novela: resumen de 1 a 2 líneas de lo que pasó, para el siguiente capítulo; si no, vacío"),
  },
}

let ia: Anthropic | null = null
export async function guionista(knex: any, tipo: "educativo" | "novela") {
  ia ??= new Anthropic()
  const recientes = await knex(T_ESTUDIO).whereIn("estado", ["listo", "haciendo"]).orderBy("created_at", "desc").limit(30).select("tipo", "guion")
  const temas = recientes.map((r: any) => r.guion?.tema).filter(Boolean)
  const tomas = recientes.flatMap((r: any) => (r.guion?.escenas || []).map((e: any) => e.toma)).slice(0, 60)
  const capitulos = recientes.filter((r: any) => r.tipo === "novela" && r.guion?.resumen_capitulo).map((r: any) => r.guion.resumen_capitulo).slice(0, 6).reverse()
  const notas = await knex("hetna_estudio_nota").orderBy("created_at", "desc").limit(8).pluck("nota").catch(() => [])
  const aprendido = (await aprendizaje(knex, 60).catch(() => null))?.resumen?.slice(0, 6) || []
  const sistema =
    "Eres el guionista de videos cortos verticales de HETNA CNC (marketplace mexicano de fabricación CNC: tienda, talleres que cotizan piezas, Cotizador para talleres, herramientas 3D). " +
    "Escribe en español de México, natural y hablado. Duración total 25 a 40 segundos: de 5 a 7 escenas.\n\n" +
    "REGLA DE ORO: el primer segundo atrapa. La escena 1 abre con el gancho (sin saludos, sin «hola», sin «en este video»). Cada escena deja una pregunta abierta para que sigan viendo.\n" +
    "Enseña algo útil y verdadero de CNC, corte láser, router, plasma, impresión 3D, materiales, costos o cómo cobrar en un taller. Nunca inventes datos técnicos dudosos, precios, clientes ni testimonios.\n" +
    "La última escena es la llamada a la acción. Al final puedes mencionar HETNA de forma natural (cotizar gratis en hetnacnc.com, el Cotizador para talleres).\n\n" +
    `Estructuras: ${FORMULAS.estructuras.join(" | ")}\nFórmulas de títulos: ${FORMULAS.titulares.join(" | ")}\nTipos de gancho: ${FORMULAS.ganchos.join(" | ")}\nIdeas de CTA: ${FORMULAS.cta.join(" | ")}\n\n` +
    "Tomas (campo toma, en inglés): describe una escena real y concreta del taller; cada escena con encuadre y acción DIFERENTES; nada de texto en pantalla. " +
    (tipo === "novela"
      ? "\n\nHOY ES NOVELA: «El Taller», serie FICTICIA de un taller CNC en México. Personajes fijos (usa sólo estos nombres): " +
        PERSONAJES.map((p) => `${p.nombre} (${p.rol})`).join("; ") +
        ". Narra como historia (narrador en tercera persona, puedes citar una frase corta de un personaje). Cada capítulo: conflicto del día a día del taller (un cliente difícil, un error de corte, una cotización mal hecha, una máquina que falla) y una ENSEÑANZA real de CNC o del negocio. Termina con suspenso para el siguiente capítulo." +
        (capitulos.length ? ` Capítulos anteriores (continúa la historia): ${capitulos.join(" / ")}` : " Es el capítulo 1: presenta el taller y a los personajes.")
      : "\n\nHOY ES EDUCATIVO: un tip, error común, comparación o mito de CNC/fabricación. Puedes usar personajes del taller en las tomas, pero no es novela.")
  const usuario = [
    temas.length ? `No repitas estos temas recientes: ${temas.join("; ")}` : "",
    tomas.length ? `No repitas estas tomas recientes: ${tomas.slice(0, 40).join(" | ")}` : "",
    aprendido.length ? `Lo aprendido en redes: ${aprendido.join(" ")}` : "",
    notas.length ? `Notas del analista de retención (aplícalas): ${notas.join(" | ")}` : "",
    "Escribe el guion de hoy.",
  ].filter(Boolean).join("\n")
  const resp = await ia.beta.messages.create({
    ...modeloIA(process.env.IA_MODELO_ESTUDIO || undefined),
    max_tokens: 4000,
    output_config: { effort: "medium", format: { type: "json_schema", schema: ESQUEMA } },
    system: sistema,
    messages: [{ role: "user", content: usuario }],
  } as any)
  if (resp.stop_reason === "refusal") throw new Error("La IA no quiso escribir este guion.")
  const g = JSON.parse(resp.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join(""))
  g.escenas = (g.escenas || []).filter((e: any) => e.narracion && e.toma).slice(0, 7)
  if (g.escenas.length < 3) throw new Error("El guion salió con muy pocas escenas.")
  return g
}

/** Prompt final de una escena: toma + personajes (descripción fija) + lugar + cámara distinta. */
export function promptEscena(e: { toma: string; personajes?: string[] }, i: number, dia = 0) {
  const gente = (e.personajes || []).map((n) => PERSONAJES.find((p) => p.nombre.toLowerCase() === String(n).toLowerCase())).filter(Boolean)
  const camara = CAMARAS[(i + dia) % CAMARAS.length]
  return {
    imagen: `${e.toma}. ${gente.map((p: any) => `${p.nombre}: ${p.visual}`).join(". ")}${gente.length ? ". " : ""}Setting: ${LUGAR}. No text, no letters, no logos.`,
    video: `${e.toma}. Camera: ${camara}. Natural realistic motion, cinematic lighting.`,
  }
}

// ---------------------------------------------------------------------
// 4. Animador + armado
// ---------------------------------------------------------------------

async function bajar(url: string, archivo: string) {
  const r = await fetch(url, { signal: AbortSignal.timeout(180_000) })
  if (!r.ok) throw new Error(`No se pudo bajar ${url.slice(0, 60)} (${r.status})`)
  fs.writeFileSync(archivo, Buffer.from(await r.arrayBuffer()))
}

/** ASS: subtítulos karaoke + el gancho grande arriba en el primer segundo y la CTA al final. */
export function assEstudio(subs: { texto: string; inicio: number; fin: number }[], gancho: string, cta: { texto: string; inicio: number; fin: number }) {
  const base = assKaraoke(subs)
  const estilo = "Style: Gancho,Archivo ExtraBold,118,&H00FFFFFF,&H00FFFFFF,&H00000000,&HA0000000,-1,0,0,0,100,100,0,0,3,0,0,8,70,70,260,1"
  const t = (s: number) => { const cs = Math.round(s * 100); return `0:${String(Math.floor(cs / 6000)).padStart(2, "0")}:${String(Math.floor((cs % 6000) / 100)).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}` }
  const limpio = (x: string) => String(x || "").replace(/[{}\\\n]/g, " ").trim()
  return base.replace(/(Style: Sub,[^\n]*\n)/, `$1${estilo}\n`) +
    `Dialogue: 1,${t(0)},${t(1.9)},Gancho,,0,0,0,,{\\fad(0,200)\\c&H005FA2F2&}${limpio(gancho).toUpperCase()}\n` +
    `Dialogue: 1,${t(cta.inicio)},${t(cta.fin)},Gancho,,0,0,0,,{\\fad(200,0)}${limpio(cta.texto)}\\N{\\fs80\\c&H005FA2F2&}hetnacnc.com\n`
}

async function armar(clips: string[], durs: number[], voz: string | null, musica: string | null, ass: string, dir: string) {
  const fps = 30
  const entradas: string[] = []
  const filtros: string[] = []
  clips.forEach((c, i) => {
    entradas.push("-i", c)
    filtros.push(`[${i}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=${fps},setsar=1,tpad=stop_mode=clone:stop_duration=6,trim=0:${durs[i].toFixed(2)},setpts=PTS-STARTPTS,format=yuv420p[v${i}]`)
  })
  filtros.push(`${clips.map((_, i) => `[v${i}]`).join("")}concat=n=${clips.length}:v=1:a=0[vb]`)
  const assArchivo = path.join(dir, "subs.ass")
  fs.writeFileSync(assArchivo, ass)
  const esc = (x: string) => x.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'")
  filtros.push(`[vb]ass='${esc(assArchivo)}':fontsdir='${esc(carpetaFuentes())}'[vout]`)
  const total = durs.reduce((a, b) => a + b, 0)
  let idx = clips.length
  const audio: string[] = []
  if (musica) {
    entradas.push("-stream_loop", "-1", "-i", musica)
    audio.push(`[${idx}:a]atrim=0:${total.toFixed(2)},asetpts=PTS-STARTPTS,volume=${voz ? 0.16 : 0.6},afade=t=in:d=0.4,afade=t=out:st=${Math.max(0, total - 1.5).toFixed(2)}:d=1.5[mus]`)
    idx++
  }
  if (voz) {
    entradas.push("-i", voz)
    audio.push(`[${idx}:a]apad,atrim=0:${total.toFixed(2)},volume=1.0[voz]`)
  }
  let mapa: string[] = []
  if (musica && voz) {
    audio.push(`[mus][voz]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[musb]`, `[musb][voz]amix=inputs=2:duration=first:dropout_transition=0[aout]`)
    mapa = ["-map", "[aout]"]
  } else if (musica) mapa = ["-map", "[mus]"]
  else if (voz) mapa = ["-map", "[voz]"]
  const salida = path.join(dir, "estudio.mp4")
  await correr([
    ...entradas, "-filter_complex", [...filtros, ...audio].join(";"), "-map", "[vout]", ...mapa,
    "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", "-r", String(fps), "-maxrate", "12M", "-bufsize", "24M",
    ...(mapa.length ? ["-c:a", "aac", "-b:a", "192k", "-ar", "48000"] : []),
    "-movflags", "+faststart", "-t", total.toFixed(2), salida,
  ], 15 * 60_000)
  return fs.readFileSync(salida)
}

// ---------------------------------------------------------------------
// 6. Publicador: la hora que mejor ha funcionado
// ---------------------------------------------------------------------

export async function mejorHora(knex: any) {
  const a = await aprendizaje(knex, 90).catch(() => null)
  const h = (a?.por_hora || []).filter((g: any) => ["youtube", "instagram", "tiktok"].includes(g.red) && g.n >= 3)
  return h.length ? Number(h[0].hora) : 19
}

async function cuandoPublicar(knex: any) {
  const cfg = await leerConfig(knex)
  const hora = await mejorHora(knex)
  const zona = zonaDe("mx")
  let d = new Date(Date.now() + 60 * 60_000)
  for (let i = 0; i < 30 && horaEn(d, zona) !== hora; i++) d = new Date(d.getTime() + 60 * 60_000)
  return { estado: cfg.automatico.promociones ? "programada" : "borrador", fecha: dentroDeHorario(d, cfg.horario, zona), hora }
}

// ---------------------------------------------------------------------
// La cadena completa
// ---------------------------------------------------------------------

const VUELTA = { activa: false }

export async function gastoDeHoy(knex: any) {
  const r = await knex(T_ESTUDIO).where({ dia: diaMx() }).sum({ s: "costo_usd" }).first().catch(() => null)
  return Number(r?.s || 0)
}

export async function videoDelDia(scope: any, logger?: any, o: { forzar?: boolean; tipo?: "educativo" | "novela" } = {}) {
  const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await asegurarEstudio(knex)
  if (!estudioListo()) return { hecho: false, motivo: !FAL() ? "Falta FAL_KEY en el .env del backend" : !iaSocial() ? "Falta la IA (ANTHROPIC_API_KEY)" : "Falta FFmpeg en el servidor" }
  if (VUELTA.activa) return { hecho: false, motivo: "Ya se está haciendo uno" }
  const hoy = diaMx()
  if (!o.forzar && (await knex(T_ESTUDIO).where({ dia: hoy }).whereIn("estado", ["listo", "haciendo"]).first())) return { hecho: false, motivo: "Ya se hizo el video de hoy" }
  const tipo = o.tipo || (tocaNovela() ? "novela" : "educativo")
  const estimado = 7 * (USD_IMAGEN + 6 * USD_VIDEO_SEG)
  if ((await gastoDeHoy(knex)) + estimado > TOPE_USD()) return { hecho: false, motivo: `Se pasaría del tope diario de ${TOPE_USD()} USD (ESTUDIO_TOPE_USD)` }
  VUELTA.activa = true
  const id = nuevoId("estudio")
  await knex(T_ESTUDIO).insert({ id, dia: hoy, tipo, estado: "haciendo" })
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hetna-estudio-"))
  let costo = 0
  try {
    // 2. Guion
    const g = await guionista(knex, tipo)
    await knex(T_ESTUDIO).where({ id }).update({ guion: JSON.stringify(g), updated_at: new Date() })
    logger?.info?.(`[estudio] guion (${tipo}): ${g.tema}`)
    // 3. Voz (una frase por escena; la duración de cada escena sale de la voz)
    const narraciones = g.escenas.map((e: any) => e.narracion)
    const voz: any = await vozPara(`estudio-${id}`, narraciones.map((n: string) => paraVoz(n)), "mx", logger).catch(() => null)
    const durs = narraciones.map((n: string, i: number) => Math.max(1.6, Math.min(7, voz?.duraciones?.[i] ? voz.duraciones[i] + 0.1 : n.split(/\s+/).length * 0.42)))
    // 4. Escenas: imagen de arranque + animación (en paralelo de 3 en 3)
    const ndia = Number(hoy.slice(-2))
    const escenas: any[] = []
    const clips: string[] = new Array(g.escenas.length)
    for (let k = 0; k < g.escenas.length; k += 3) {
      await Promise.all(g.escenas.slice(k, k + 3).map(async (e: any, j: number) => {
        const i = k + j
        const p = promptEscena(e, i, ndia)
        const img = await fal(MODELO_IMAGEN(), { prompt: p.imagen, image_size: { width: 768, height: 1344 }, num_images: 1, output_format: "jpeg" }, 5)
        costo += USD_IMAGEN
        const imagen = img?.images?.[0]?.url
        if (!imagen) throw new Error("La IA de imagen no regresó imagen")
        const seg = Math.min(10, Math.max(3, Math.ceil(durs[i] + 0.5)))
        const vid = await fal(MODELO_VIDEO(), { prompt: p.video, image_url: imagen, duration: seg, resolution: "768P", prompt_expansion_mode: "balanced" }, 15)
        costo += seg * USD_VIDEO_SEG
        const url = vid?.video?.url
        if (!url) throw new Error("La IA de video no regresó video")
        const archivo = path.join(dir, `c${i}.mp4`)
        await bajar(url, archivo)
        clips[i] = archivo
        escenas[i] = { imagen, video: url, segundos: seg, toma: e.toma, camara: p.video.match(/Camera: ([^.]+)/)?.[1] || null }
      }))
      await knex(T_ESTUDIO).where({ id }).update({ costo_usd: costo, escenas: JSON.stringify(escenas), updated_at: new Date() })
    }
    // Armado: subtítulos karaoke, gancho arriba, CTA al final, música y voz
    let t = 0
    const subs = narraciones.map((n: string, i: number) => { const s = { texto: n, inicio: t + 0.1, fin: t + durs[i] }; t += durs[i]; return s })
    const ultimo = t - durs[durs.length - 1]
    const ass = assEstudio(subs.slice(0, -1).concat([{ ...subs[subs.length - 1], fin: ultimo + 0.01 }]).filter((s) => s.fin > s.inicio), g.gancho_pantalla, { texto: g.cta, inicio: ultimo, fin: t })
    const musica = await musicaAlAzar(knex).catch(() => null)
    const mp4 = await armar(clips, durs, voz?.url || null, musica, ass, dir)
    const videoUrl = await subir(scope, `estudio-${id}.mp4`, "video/mp4", mp4)
    // 6. Publicación (título SEO, descripción, hashtags, mejor hora)
    const c = await cuandoPublicar(knex)
    const etiqueta = tipo === "novela" ? "\n\n(Historia ficticia: personajes y situaciones inventados para enseñar.)" : ""
    const tags = (g.hashtags || []).slice(0, 5).map((h: string) => `#${String(h).replace(/^#/, "").replace(/\s+/g, "")}`).join(" ")
    const textos = {
      youtube: `${g.titulo_seo}\n${g.descripcion}${etiqueta}\n\n${tags}`,
      facebook: `${g.titulo_seo}\n\n${g.descripcion}${etiqueta}`,
      instagram: `${g.titulo_seo}\n\n${String(g.descripcion).replace(/\{\{liga\}\}/g, "liga en el perfil")}${etiqueta}\n\n${tags}`,
      instagram_historia: g.titulo_seo,
      tiktok: `${g.titulo_seo} ${tags}${tipo === "novela" ? " (historia ficticia)" : ""}`,
    }
    const post = await crearPublicacion(knex, {
      origen: "manual", fuente: "estudio", titulo: `${tipo === "novela" ? "🎬 El Taller" : "🎓 Estudio"} · ${g.tema}`, texto_base: textos.facebook,
      textos, url: `${STORE_URL}/mx`, redes: ["youtube", "instagram", "tiktok", "facebook"], medios: [{ url: videoUrl, tipo: "video" }],
      estado: c.estado, programada_para: c.fecha, mercado: "mx",
    } as any, logger)
    await knex(T_ESTUDIO).where({ id }).update({ estado: "listo", costo_usd: costo, post_id: post, video_url: videoUrl, updated_at: new Date() })
    logger?.info?.(`[estudio] listo: ${g.tema} · ${costo.toFixed(2)} USD · sale a las ${c.hora}:00`)
    return { hecho: true, id, tipo, tema: g.tema, costo_usd: +costo.toFixed(2), post, hora: c.hora }
  } catch (e) {
    await knex(T_ESTUDIO).where({ id }).update({ estado: "error", costo_usd: costo, error: (e as Error).message.slice(0, 500), updated_at: new Date() })
    logger?.warn?.(`[estudio] ${(e as Error).message}`)
    return { hecho: false, motivo: (e as Error).message }
  } finally {
    VUELTA.activa = false
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

// ---------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------

export async function leerEstudioCfg(knex: any) {
  await asegurarEstudio(knex)
  const { T_CONFIG_S } = require("../social-hub")
  return (await knex(T_CONFIG_S).where({ clave: "estudio" }).first())?.valor || { activo: false }
}
export async function guardarEstudioCfg(knex: any, v: any) {
  const { T_CONFIG_S } = require("../social-hub")
  await knex.raw(`insert into ?? (clave, valor) values ('estudio', ?::jsonb) on conflict (clave) do update set valor = excluded.valor`, [T_CONFIG_S, JSON.stringify({ activo: !!v.activo })])
}

export async function resumenEstudio(knex: any) {
  await asegurarEstudio(knex)
  const videos = await knex(T_ESTUDIO).orderBy("created_at", "desc").limit(10).select("id", "dia", "tipo", "estado", "costo_usd", "video_url", "post_id", "error", "guion")
  const mes = await knex(T_ESTUDIO).where("created_at", ">=", knex.raw("date_trunc('month', now())")).sum({ s: "costo_usd" }).first().catch(() => null)
  return {
    listo: estudioListo(),
    falta: !FAL() ? "FAL_KEY" : !iaSocial() ? "ANTHROPIC_API_KEY" : !ffmpegDisponible() ? "FFmpeg" : null,
    activo: !!(await leerEstudioCfg(knex)).activo,
    tope_dia: TOPE_USD(),
    gasto_hoy: +(await gastoDeHoy(knex)).toFixed(2),
    gasto_mes: +Number(mes?.s || 0).toFixed(2),
    toca_hoy: tocaNovela() ? "novela" : "educativo",
    personajes: PERSONAJES.map((p) => ({ nombre: p.nombre, rol: p.rol })),
    videos: videos.map((v: any) => ({ id: v.id, dia: v.dia, tipo: v.tipo, estado: v.estado, costo: Number(v.costo_usd || 0), video: v.video_url, post: v.post_id, error: v.error, tema: v.guion?.tema || null, titulo: v.guion?.titulo_seo || null })),
  }
}
