// @ts-nocheck
// Marketing HETNA — Fábrica de contenido (Fase A: en el servidor, sin GPU).
//
// Entra un guion (o un tema) y sale el paquete completo como borradores del
// Social Hub, repartidos en la semana y adaptados a cada red:
//   - 5 cortos verticales 9:16 (TikTok, Reels, Shorts) con gancho, frases,
//     cierre con QR y música de la biblioteca
//   - carrusel de 6 a 8 láminas (Instagram, LinkedIn)
//   - publicación de texto por red con su tarjeta (Facebook, LinkedIn,
//     Telegram, grupos, WhatsApp)
//   - video largo de YouTube: título, descripción, capítulos, guion por escenas
//     y miniatura (el video largo se produce en la Fase B, con RunPod)
//   - artículo en Aprendizaje CNC (borrador)
// También genera las tarjetas de las publicaciones automáticas (licitaciones,
// talleres, productos, foro) y las semanales (taller destacado, opinión de
// cliente e índice de precios del mes).
import Anthropic from "@anthropic-ai/sdk"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

import { STORE_URL, T_PROPUESTA, T_SOLICITUD, nuevoId } from "../licitacion"
import { MERCADOS, T_POST, asegurarSocial, crearPublicacion, iaSocial, ligaPara, urlCorta, zonaDe } from "../social-hub"
import { GUIAS, REGLAS_EMOCION, instanteEn, lunesDe } from "../estrategia"
import { PRINCIPIOS_VIDEO, TEMAS, cuadroVideo, escenaLarga, lamina, miniatura, tarjeta, carpetaFuentes } from "./render"
import { PROMPTS_TEMA, VOZ, bajarB2, correr, idiomaDe, ligasB2, runpodListo } from "./runpod"
import { corto, ffmpegDisponible, segundosPara } from "./video"
import { vozLocal } from "./voz-local"

export const T_TRABAJO = "hetna_fabrica_trabajo"
export const T_FONDO = "hetna_fabrica_fondo"
export const T_MUSICA = "hetna_fabrica_musica"

let listo = false
export async function asegurarFabrica(knex: any) {
  if (listo) return
  await asegurarSocial(knex)
  const crear = async (t: string, fn: (tb: any) => void) => {
    if (!(await knex.schema.hasTable(t))) await knex.schema.createTable(t, fn)
  }
  await crear(T_TRABAJO, (t) => {
    t.text("id").primary()
    t.jsonb("entrada").notNullable()
    t.jsonb("paquete")
    t.jsonb("piezas")
    t.text("estado").notNullable().defaultTo("pendiente") // pendiente | produciendo | listo | error
    t.integer("intentos").notNullable().defaultTo(0)
    t.text("error")
    t.timestamps(true, true)
  })
  await crear(T_FONDO, (t) => {
    t.text("id").primary()
    t.text("tema").notNullable().index()
    t.text("url").notNullable()
    t.text("fuente") // de dónde salió (foto propia, taller, Pexels, IA…)
    t.text("licencia")
    t.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now())
  })
  await crear(T_MUSICA, (t) => {
    t.text("id").primary()
    t.text("titulo").notNullable()
    t.text("url").notNullable()
    t.text("estilo")
    t.text("licencia") // liga a la licencia (p. ej. Pixabay Content License)
    t.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now())
  })
  await knex.raw(`alter table ?? add column if not exists tarjeta_hecha boolean`, [T_POST]).catch(() => {})
  listo = true
}

// ---------------------------------------------------------------------
// Biblioteca
// ---------------------------------------------------------------------

export async function fondoDe(knex: any, tema: string) {
  const r = await knex(T_FONDO).where({ tema }).orderByRaw("random()").first("url").catch(() => null)
  return r?.url || null
}
export async function musicaAlAzar(knex: any) {
  const r = await knex(T_MUSICA).orderByRaw("random()").first("url").catch(() => null)
  return r?.url || null
}

/** Sube bytes al almacenamiento de archivos de la tienda y devuelve la URL pública. */
export async function subir(scope: any, nombre: string, mime: string, buf: Buffer) {
  const [f] = await scope.resolve(Modules.FILE).createFiles([{ filename: nombre, mimeType: mime, content: buf.toString("base64"), access: "public" }])
  return f.url as string
}

/** Tema visual a partir de un texto (para elegir el fondo). */
export function temaDe(texto: string) {
  const t = String(texto || "").toLowerCase()
  if (/plasma/.test(t)) return "plasma"
  if (/router|mdf|madera|triplay/.test(t)) return "router"
  if (/torno|fresad|maquinad|centro de/.test(t)) return "torno"
  if (/3d|impresi/.test(t)) return "impresion3d"
  if (/l[aá]ser|laser/.test(t)) return "laser"
  if (/l[aá]mina|acero|alumin|material|precio/.test(t)) return "lamina"
  return "taller"
}

// ---------------------------------------------------------------------
// Paquete con IA (Claude)
// ---------------------------------------------------------------------

const S = (desc?: string) => ({ type: "string", ...(desc ? { description: desc } : {}) })
const ESQUEMA = {
  type: "object",
  additionalProperties: false,
  required: ["titulo", "tema_visual", "cortos", "carrusel", "publicaciones", "youtube", "articulo"],
  properties: {
    titulo: S("título corto del paquete"),
    tema_visual: { type: "string", enum: [...TEMAS] },
    cortos: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["gancho", "frases", "textos"],
        properties: {
          gancho: S("frase de máximo 8 palabras para el primer segundo"),
          frases: { type: "array", items: S("frase en pantalla de máximo 10 palabras") },
          textos: {
            type: "object", additionalProperties: false, required: ["tiktok", "instagram", "facebook", "youtube"],
            properties: { tiktok: S(), instagram: S(), facebook: S(), youtube: S() },
          },
        },
      },
    },
    carrusel: {
      type: "object", additionalProperties: false, required: ["portada", "laminas", "cierre"],
      properties: {
        portada: S("título de la portada"),
        laminas: { type: "array", items: { type: "object", additionalProperties: false, required: ["titulo", "texto"], properties: { titulo: S(), texto: S() } } },
        cierre: S("llamada a la acción final"),
      },
    },
    publicaciones: {
      type: "object", additionalProperties: false, required: ["facebook", "linkedin", "telegram", "grupos_facebook", "whatsapp", "instagram_carrusel", "linkedin_carrusel"],
      properties: { facebook: S(), linkedin: S(), telegram: S(), grupos_facebook: S(), whatsapp: S(), instagram_carrusel: S(), linkedin_carrusel: S() },
    },
    youtube: {
      type: "object", additionalProperties: false, required: ["titulo", "descripcion", "capitulos", "escenas"],
      properties: {
        titulo: S(), descripcion: S(),
        capitulos: { type: "array", items: { type: "object", additionalProperties: false, required: ["tiempo", "titulo"], properties: { tiempo: S("mm:ss"), titulo: S() } } },
        escenas: { type: "array", items: { type: "object", additionalProperties: false, required: ["narracion", "visual", "imagen_en", "capitulo"], properties: { narracion: S("lo que dice la voz en esta escena (2 a 4 oraciones)"), visual: S("qué se ve en pantalla"), imagen_en: S("descripción en inglés de una foto realista para esta escena, sin texto ni logotipos"), capitulo: S("título del capítulo si esta escena lo abre; si no, cadena vacía") } } },
      },
    },
    articulo: {
      type: "object", additionalProperties: false, required: ["titulo", "resumen", "html"],
      properties: { titulo: S(), resumen: S(), html: S("artículo en HTML simple (h2, p, ul) con respuestas directas al inicio") },
    },
  },
}

let ia: Anthropic | null = null
export async function generarPaquete(entrada: { guion?: string; tema?: string; mercado?: string; publico?: string }, contexto: string) {
  if (!iaSocial()) throw new Error("Falta la llave de Claude (ANTHROPIC_API_KEY) en el servidor.")
  ia ??= new Anthropic()
  const m = MERCADOS[entrada.mercado || "mx"] || MERCADOS.mx
  const reglas = Object.entries(GUIAS).map(([r, g]) => `- ${r}: ${g.claves} Liga: ${g.liga === "perfil" ? "no pongas URL, di 'liga en el perfil'" : g.liga === "primer_comentario" ? "no pongas URL en el texto" : "incluye {{liga}}"}; hashtags ${g.hashtags[0]}-${g.hashtags[1]}.`).join("\n")
  const resp = await ia.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    output_config: { effort: "medium", format: { type: "json_schema", schema: ESQUEMA } },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system:
      "Eres el director de contenido de HETNA CNC, marketplace de fabricación CNC (talleres, clientes industriales, makers y proveedores). " +
      `Escribe para el mercado ${m.nombre}: ${m.nota}. ` +
      "A partir del guion o tema, crea un paquete para redes. Reglas: usa sólo hechos del guion y del contexto; no inventes precios, cifras, clientes ni promociones; " +
      "nada de teléfonos ni correos. Exactamente 5 cortos (cada uno con un gancho distinto y 2 o 3 frases), carrusel de 4 a 6 láminas, capítulos y escenas del video largo que sigan el guion, " +
      "y un artículo útil. Cada texto respeta la guía de su red:\n" + reglas +
      "\nMapa emocional: cada corto vende UNA emoción distinta (deseo, belleza, tranquilidad, sueños, seguridad o esperanza) según el público. " + REGLAS_EMOCION +
      "\nPrincipios de video (cortos y escenas del video largo): " + PRINCIPIOS_VIDEO +
      " En los cortos, el gancho y cada frase en pantalla son de máximo 4 palabras (la narración completa va en la voz y los subtítulos); en 'visual' e 'imagen_en' describe la acción visual concreta de la escena.",
    messages: [{ role: "user", content: `Público: ${entrada.publico || "clientes y talleres"}.\n${entrada.guion ? `Guion:\n${entrada.guion}` : `Tema: ${entrada.tema}`}\n\nContexto real de HETNA:\n${contexto}` }],
  } as any)
  if (resp.stop_reason === "refusal") throw new Error("La IA no quiso trabajar este guion.")
  const txt = resp.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("")
  const p = JSON.parse(txt)
  p.cortos = (p.cortos || []).slice(0, 5)
  p.carrusel.laminas = (p.carrusel.laminas || []).slice(0, 6)
  return p
}

async function contexto(knex: any) {
  const partes = ["HETNA no cobra comisión en licitaciones; talleres verificados y con certificaciones; ranking público por evaluaciones reales; contratos SafeDeal opcionales; ligas en hetnacnc.com."]
  const n = await knex("seller").whereNull("deleted_at").count({ n: "*" }).first().catch(() => null)
  if (n) partes.push(`Talleres registrados: ${n.n}.`)
  const { guiaParaPrompt } = await import("../referencias")
  const guia = await guiaParaPrompt(knex)
  if (guia) partes.push(guia.trim())
  return partes.join("\n")
}

// ---------------------------------------------------------------------
// Producción
// ---------------------------------------------------------------------

/** Fecha para la pieza i del paquete: reparte la semana a la hora sugerida de la red. */
function fechaPara(mercado: string, diaOffset: number, red: string) {
  const zona = zonaDe(mercado)
  const hoy = new Date(Date.now() + 86_400_000).toLocaleDateString("en-CA", { timeZone: zona })
  const [y, m, d] = hoy.split("-").map(Number)
  const dia = new Date(Date.UTC(y, m - 1, d + diaOffset)).toISOString().slice(0, 10)
  return instanteEn(dia, GUIAS[red]?.horas?.[0] ?? 12, zona)
}

export async function producir(scope: any, id: string, logger?: any) {
  const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await asegurarFabrica(knex)
  const n = await knex(T_TRABAJO).where({ id, estado: "pendiente" }).update({ estado: "produciendo", intentos: knex.raw("intentos + 1"), updated_at: knex.fn.now() })
  if (!n) return
  const tr = await knex(T_TRABAJO).where({ id }).first()
  const e = tr.entrada || {}
  const mercado = e.mercado && MERCADOS[e.mercado] ? e.mercado : "mx"
  const piezas: any = { cortos: [], carrusel: [], posts: [] }
  if (e.tipo === "video") {
    try {
      const pz = await producirVideo(scope, tr, logger)
      await knex(T_TRABAJO).where({ id }).update({ estado: "listo", piezas: JSON.stringify(pz), error: null, updated_at: knex.fn.now() })
    } catch (er) {
      const msg = (er as Error).message
      await knex(T_TRABAJO).where({ id }).update({ estado: tr.intentos + 1 >= 2 ? "error" : "pendiente", error: msg.slice(0, 500), updated_at: knex.fn.now() })
    }
    return
  }
  try {
    const p = tr.paquete || (await generarPaquete(e, await contexto(knex)))
    await knex(T_TRABAJO).where({ id }).update({ paquete: JSON.stringify(p) })
    const tema = e.tema_visual || p.tema_visual || temaDe(`${e.guion || ""} ${e.tema || ""}`)
    const foto = () => fondoDe(knex, tema)
    const musica = await musicaAlAzar(knex)
    const destino = `${STORE_URL}${mercado === "us" ? "/us" : "/mx"}${e.publico === "talleres" ? "/talleres/unete" : "/cotizar"}`

    // 1) Carrusel
    const lams: string[] = []
    const total = p.carrusel.laminas.length + 2
    lams.push(await subir(scope, `fabrica-${id}-l1.png`, "image/png", await lamina({ num: 1, total, titulo: p.carrusel.portada, portada: true, tema, foto_url: await foto() })))
    for (let i = 0; i < p.carrusel.laminas.length; i++) {
      const l = p.carrusel.laminas[i]
      lams.push(await subir(scope, `fabrica-${id}-l${i + 2}.png`, "image/png", await lamina({ num: i + 2, total, titulo: l.titulo, texto: l.texto, tema })))
    }
    lams.push(await subir(scope, `fabrica-${id}-l${total}.png`, "image/png", await lamina({ num: total, total, titulo: p.titulo, cierre: { cta: p.carrusel.cierre, liga_texto: "liga en el perfil" }, tema, foto_url: await foto() })))
    piezas.carrusel = lams
    const pc = await crearPublicacion(knex, {
      origen: "manual", fuente: "fabrica", titulo: `Fábrica · Carrusel · ${p.titulo}`, texto_base: p.publicaciones.instagram_carrusel, url: destino, redes: ["instagram", "linkedin"],
      textos: { instagram: p.publicaciones.instagram_carrusel, linkedin: p.publicaciones.linkedin_carrusel }, medios: lams.map((url) => ({ url, tipo: "imagen" })),
      estado: "borrador", programada_para: fechaPara(mercado, 2, "instagram"), mercado, notas: "Carrusel: las redes conectadas publican la primera lámina; descarga todas para subir el carrusel completo.",
    }, logger)
    piezas.posts.push(pc)

    // 2) Publicación de texto por red, con tarjeta
    const pt = await crearPublicacion(knex, {
      origen: "manual", fuente: "fabrica", titulo: `Fábrica · ${p.titulo}`, texto_base: p.publicaciones.facebook, url: destino, redes: ["facebook", "linkedin", "telegram", "grupos_facebook", "whatsapp"],
      textos: { facebook: p.publicaciones.facebook, linkedin: p.publicaciones.linkedin, telegram: p.publicaciones.telegram, grupos_facebook: p.publicaciones.grupos_facebook, whatsapp: p.publicaciones.whatsapp },
      estado: "borrador", programada_para: fechaPara(mercado, 3, "facebook"), mercado,
    }, logger)
    const ligaT = urlCorta(await ligaPara(knex, pt, "facebook", destino))
    const tarj = await subir(scope, `fabrica-${id}-tarjeta.png`, "image/png", await tarjeta({ tema, foto_url: await foto(), cinta: { texto: e.publico === "talleres" ? "Para talleres" : "HETNA CNC" }, titulo: p.titulo, cta: e.publico === "talleres" ? "Recibe trabajos sin comisión" : "Cotiza tu pieza", liga: ligaT }))
    await knex(T_POST).where({ id: pt }).update({ medios: JSON.stringify([{ url: tarj, tipo: "imagen" }]) })
    piezas.posts.push(pt)

    // 3) Cortos (si hay FFmpeg). Con RunPod llevan voz; si falla, salen sin voz.
    const idioma = idiomaDe(mercado)
    const cierreTxt = e.publico === "talleres" ? "¿Tienes taller? Recibe trabajos sin comisión" : "¿Necesitas algo así? Cotízalo en HETNA"
    let voces: any[] = []
    if (ffmpegDisponible() && runpodListo() && e.voz !== "ninguna") {
      try {
        const out = await correr({
          tarea: "voz", voz: VOZ(idioma, e.voz), idioma,
          lotes: p.cortos.map((c: any, i: number) => ({ frases: [c.gancho, ...(c.frases || []).slice(0, 3), cierreTxt], clave: `fabrica/${id}/voz-${i + 1}.wav` })),
        }, { logger, topeMin: 15 })
        voces = out.lotes || []
        const urls = await ligasB2(voces.map((v: any) => v.clave), 7200)
        voces = voces.map((v: any, k: number) => ({ ...v, url: urls[k] }))
      } catch (er) {
        piezas.aviso_voz = `La voz no se pudo generar (${(er as Error).message}); los cortos salieron sin voz.`
      }
    }
    // Sin voz de RunPod: voz local de respaldo (Piper) para que los cortos no salgan mudos
    if (ffmpegDisponible() && e.voz !== "ninguna") {
      for (let i = 0; i < p.cortos.length; i++) {
        if (voces[i]?.url) continue
        const c = p.cortos[i]
        const v = await vozLocal([c.gancho, ...(c.frases || []).slice(0, 3), cierreTxt], idioma, logger)
        if (v) voces[i] = v
      }
    }
    if (ffmpegDisponible()) {
      for (let i = 0; i < p.cortos.length; i++) {
        const c = p.cortos[i]
        const pid = await crearPublicacion(knex, {
          origen: "manual", fuente: "fabrica", titulo: `Fábrica · Corto ${i + 1} · ${c.gancho}`, texto_base: c.textos.facebook, url: destino, redes: ["tiktok", "instagram", "facebook", "youtube"],
          textos: c.textos, estado: "borrador", programada_para: fechaPara(mercado, i, "tiktok"), mercado,
        }, logger)
        const liga = urlCorta(await ligaPara(knex, pid, "instagram", destino))
        const voz = voces[i]
        const dur = (k: number, porOmision: number) => (voz?.duraciones?.[k] ? Math.max(1.2, voz.duraciones[k] + 0.15) : porOmision)
        const frases = (c.frases || []).slice(0, 3)
        const escenas = [{ png: await cuadroVideo({ tipo: "gancho", texto: c.gancho, tema, foto_url: await foto(), semilla: i * 7 + 1 }), segundos: dur(0, 2.2) }]
        for (const [k, f] of frases.entries()) escenas.push({ png: await cuadroVideo({ tipo: "frase", texto: f, tema, foto_url: await foto(), semilla: i * 7 + k + 2, sinTexto: true }), segundos: dur(k + 1, segundosPara(f)), subtitulo: f })
        escenas.push({ png: await cuadroVideo({ tipo: "cierre", texto: cierreTxt, tema, liga }), segundos: dur(frases.length + 1, 2.5) })
        const v = await corto(escenas, { fuentes: carpetaFuentes(), musica, voz: voz?.url || null })
        const url = await subir(scope, `fabrica-${id}-corto${i + 1}.mp4`, "video/mp4", v.buf)
        await knex(T_POST).where({ id: pid }).update({ medios: JSON.stringify([{ url, tipo: "video" }]) })
        piezas.cortos.push({ post: pid, url, segundos: Math.round(v.segundos) })
      }
    } else {
      piezas.aviso = "Falta FFmpeg en el servidor: los cortos no se produjeron (instálalo con: apt-get install -y ffmpeg)."
    }

    // 4) YouTube: miniatura y guion del video largo (el video se produce en la Fase B)
    const mini = await subir(scope, `fabrica-${id}-miniatura.png`, "image/png", await miniatura({ titulo: p.youtube.titulo, tema, foto_url: await foto() }))
    const capitulos = (p.youtube.capitulos || []).map((c: any) => `${c.tiempo} ${c.titulo}`).join("\n")
    const py = await crearPublicacion(knex, {
      origen: "manual", fuente: "fabrica", titulo: `Fábrica · YouTube · ${p.youtube.titulo}`, texto_base: `${p.youtube.descripcion}\n\n${capitulos}`, url: destino, redes: ["youtube"],
      textos: { youtube: `${p.youtube.titulo}\n\n${p.youtube.descripcion}\n\n${capitulos}` }, medios: [{ url: mini, tipo: "imagen" }],
      estado: "borrador", programada_para: fechaPara(mercado, 0, "youtube"), mercado,
      notas: `Guion del video largo por escenas:\n${(p.youtube.escenas || []).map((s: any, k: number) => `${k + 1}. ${s.narracion}\n   [En pantalla: ${s.visual}]`).join("\n")}`,
    }, logger)
    piezas.posts.push(py)
    piezas.miniatura = mini

    // 4b) Video largo en RunPod: imagen por escena (IA), voz, subtítulos y música
    if (runpodListo() && (p.youtube.escenas || []).length) {
      try {
        const escenas = p.youtube.escenas.slice(0, 16)
        let fotos: string[] = []
        if (e.ia_escenas !== false) {
          const img = await correr({ tarea: "imagen", prompts: escenas.map((x: any) => `${x.imagen_en}, photorealistic, cinematic light, no text, no logos`), ancho: 1344, alto: 768, prefijo: `fabrica/${id}/escenas/` }, { logger, topeMin: 25 })
          fotos = await ligasB2(img.claves || [], 7200)
        }
        const urls: string[] = []
        for (let k = 0; k < escenas.length; k++) {
          const png = await escenaLarga({ foto_url: fotos[k] || (await foto()), tema, capitulo: escenas[k].capitulo || null, semilla: k + 3 })
          urls.push(await subir(scope, `fabrica-${id}-escena${k + 1}.png`, "image/png", png))
        }
        const largo = await correr({
          tarea: "video_largo", escenas: escenas.map((x: any, k: number) => ({ imagen_url: urls[k], narracion: x.narracion })),
          voz: VOZ(idioma, e.voz === "ninguna" ? "hombre" : e.voz), idioma, musica_url: musica, clave: `fabrica/${id}/video-largo.mp4`, subtitulos: true,
        }, { logger, topeMin: 40 })
        piezas.largo = { clave: largo.clave, segundos: largo.segundos }
        await knex(T_POST).where({ id: py }).update({ notas: knex.raw(`'✅ Video largo listo (${Math.round(largo.segundos / 60)} min): descárgalo en la Fábrica y súbelo a YouTube con este texto.' || chr(10) || coalesce(notas, '')`) })
      } catch (er) {
        piezas.aviso_largo = `El video largo no se pudo producir: ${(er as Error).message}`
      }
    }

    // 5) Artículo (borrador en Aprendizaje CNC)
    try {
      const { createLearningArticleWorkflow } = await import("../../workflows/create-learning-article")
      const slug = `${p.articulo.titulo}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) + `-${id.slice(-5)}`
      await (createLearningArticleWorkflow as any)(scope).run({ input: { slug, title: p.articulo.titulo, excerpt: p.articulo.resumen, content_html: p.articulo.html, cover_image_url: mini, source: "fabrica", published_at: null } })
      piezas.articulo = slug
    } catch (er) {
      piezas.articulo_error = (er as Error).message
    }

    await knex(T_TRABAJO).where({ id }).update({ estado: "listo", piezas: JSON.stringify(piezas), error: null, updated_at: knex.fn.now() })
    logger?.info?.(`[fabrica] ${id} listo: ${piezas.cortos.length} cortos, ${piezas.carrusel.length} láminas`)
  } catch (er) {
    const msg = (er as Error).message
    logger?.warn?.(`[fabrica] ${id}: ${msg}`)
    await knex(T_TRABAJO).where({ id }).update({ estado: tr.intentos + 1 >= 2 ? "error" : "pendiente", error: msg.slice(0, 500), piezas: JSON.stringify(piezas), updated_at: knex.fn.now() })
  }
}

export async function crearTrabajo(scope: any, entrada: any, logger?: any) {
  const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await asegurarFabrica(knex)
  const guion = String(entrada.guion || "").trim().slice(0, 30000)
  const tema = String(entrada.tema || "").trim().slice(0, 300)
  const video_url = /^https:\/\//.test(String(entrada.video_url || "")) ? String(entrada.video_url) : ""
  const video_clave = /^fabrica\/videos\//.test(String(entrada.video_clave || "")) ? String(entrada.video_clave) : ""
  if ((video_url || video_clave) && !runpodListo()) throw Object.assign(new Error("Para trabajar tu video hace falta RunPod (RUNPOD_FABRICA_ENDPOINT_ID)."), { status: 400 })
  if (!guion && !tema && !video_url && !video_clave) throw Object.assign(new Error("Escribe un guion o un tema, o sube tu video."), { status: 400 })
  const id = nuevoId("fab")
  await knex(T_TRABAJO).insert({
    id,
    entrada: JSON.stringify({
      guion, tema, video_url, video_clave, tipo: video_url || video_clave ? "video" : "guion", mercado: MERCADOS[entrada.mercado] ? entrada.mercado : "mx",
      voz: ["hombre", "mujer", "ninguna"].includes(entrada.voz) ? entrada.voz : "hombre", ia_escenas: entrada.ia_escenas !== false,
      publico: ["clientes", "talleres", "proveedores", "empresas"].includes(entrada.publico) ? entrada.publico : "clientes",
      tema_visual: (TEMAS as readonly string[]).includes(entrada.tema_visual) ? entrada.tema_visual : null,
    }),
  })
  // Se produce en segundo plano; el job de la cola lo retoma si el servidor se reinicia
  setImmediate(() => producir(scope, id, logger).catch(() => {}))
  return id
}

/** Job: retoma trabajos pendientes o que se quedaron a medias. */
export async function procesarCola(scope: any, logger?: any) {
  const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await asegurarFabrica(knex)
  await knex(T_TRABAJO).where({ estado: "produciendo" }).where("updated_at", "<", knex.raw("now() - interval '30 minutes'")).update({ estado: "pendiente" })
  const t = await knex(T_TRABAJO).where({ estado: "pendiente" }).where("created_at", "<", knex.raw("now() - interval '2 minutes'")).orderBy("created_at").first("id")
  if (t) await producir(scope, t.id, logger)
}

// ---------------------------------------------------------------------
// Tarjetas de las publicaciones automáticas
// ---------------------------------------------------------------------

const lineaDe = (texto: string, emoji: string) => (String(texto || "").split("\n").find((l) => l.includes(emoji)) || "").replace(emoji, "").trim()

/** Job: pone tarjeta a las publicaciones automáticas que no tienen imagen. */
export async function tarjetasAutomaticas(scope: any, logger?: any) {
  const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await asegurarFabrica(knex)
  const posts = await knex(T_POST)
    .whereIn("origen", ["licitacion", "taller", "producto", "foro"])
    .whereIn("estado", ["borrador", "programada"])
    .where((q: any) => q.whereNull("tarjeta_hecha").orWhere("tarjeta_hecha", false))
    .where("created_at", ">", knex.raw("now() - interval '3 days'"))
    .limit(10)
  for (const p of posts) {
    try {
      const medio = (p.medios || [])[0]
      const esVideo = medio && (medio.tipo === "video" || /\.(mp4|mov|webm)/i.test(medio.url))
      if (esVideo) {
        await knex(T_POST).where({ id: p.id }).update({ tarjeta_hecha: true })
        continue
      }
      const red = (p.redes || [])[0] || "facebook"
      const liga = urlCorta(await ligaPara(knex, p.id, red, p.url_destino))
      const tema = temaDe(`${p.titulo} ${p.texto_base}`)
      const foto = await fondoDe(knex, tema)
      // Licitación: ficha "Se busca taller" con los datos reales de la solicitud
      const { fichaSolicitud } = await import("./oportunidades")
      const ficha = p.origen === "licitacion" && p.origen_id ? await fichaSolicitud(knex, p.origen_id).catch(() => null) : null
      const spec =
        ficha
          ? { cinta: ficha.cinta, titulo: ficha.titulo, datos: ficha.datos, sub: ficha.sub, cta: ficha.cta }
          : p.origen === "licitacion"
          ? { cinta: { texto: "Se busca taller" }, titulo: p.titulo, sub: lineaDe(p.texto_base, "📍") || undefined, cta: "Envía tu propuesta sin comisión" }
          : p.origen === "taller"
            ? { cinta: { texto: "Nuevo taller en HETNA", tono: "oro" }, titulo: p.titulo, sub: lineaDe(p.texto_base, "📍") || undefined, cta: "Conoce sus trabajos y cotiza" }
            : p.origen === "producto"
              ? { cinta: { texto: "Nuevo en la tienda", tono: "verde" }, titulo: p.titulo, producto_url: medio?.url || null, cta: "Velo en HETNA" }
              : { cinta: { texto: "Foro CNC México" }, titulo: p.titulo, cta: "Participa en la conversación" }
      const png = await tarjeta({ tema, foto_url: foto, liga, ...spec })
      const url = await subir(scope, `tarjeta-${p.id}.png`, "image/png", png)
      await knex(T_POST).where({ id: p.id }).update({ medios: JSON.stringify([{ url, tipo: "imagen" }]), tarjeta_hecha: true })
    } catch (e) {
      logger?.warn?.(`[fabrica] tarjeta ${p.id}: ${(e as Error).message}`)
      await knex(T_POST).where({ id: p.id }).update({ tarjeta_hecha: true })
    }
  }
}

// ---------------------------------------------------------------------
// Piezas semanales: taller destacado, opinión de cliente e índice de precios
// ---------------------------------------------------------------------

const bayes = (v: number, n: number) => (4 * 3 + v * n) / (3 + n)

export async function piezasSemanales(scope: any, logger?: any) {
  const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await asegurarFabrica(knex)
  const semana = lunesDe()
  const creadas: string[] = []
  const conTarjeta = async (postId: string, spec: any, tema: string, red = "facebook") => {
    const p = await knex(T_POST).where({ id: postId }).first()
    const liga = urlCorta(await ligaPara(knex, postId, red, p.url_destino))
    const url = await subir(scope, `semanal-${postId}.png`, "image/png", await tarjeta({ tema, foto_url: await fondoDe(knex, tema), liga, ...spec }))
    await knex(T_POST).where({ id: postId }).update({ medios: JSON.stringify([{ url, tipo: "imagen" }]), tarjeta_hecha: true })
  }

  // Taller destacado (sólo evaluaciones reales; no repite en 8 semanas)
  try {
    const recientes = (await knex(T_POST).where({ origen: "manual" }).where("titulo", "like", "Taller destacado%").where("created_at", ">", knex.raw("now() - interval '56 days'")).select("notas")).map((x: any) => x.notas)
    const talleres = (await knex("seller").whereNull("deleted_at").select("id", "name", "handle", "metadata"))
      .filter((t: any) => !t.metadata?.prueba && (t.metadata?.perfil?.resenas || 0) > 0 && !recientes.some((n: string) => n?.includes(t.id)))
      .sort((a: any, b: any) => bayes(b.metadata.perfil.calificacion, b.metadata.perfil.resenas) - bayes(a.metadata.perfil.calificacion, a.metadata.perfil.resenas))
    const t = talleres[0]
    if (t && !(await knex(T_POST).where({ origen: "manual" }).where("titulo", `Taller destacado · ${t.name} · ${semana}`).first("id"))) {
      const pf = t.metadata.perfil
      const lugar = [pf.ciudad, pf.estado].filter(Boolean).join(", ")
      const id = await crearPublicacion(knex, {
        origen: "manual", titulo: `Taller destacado · ${t.name} · ${semana}`,
        texto_base: `⭐ Taller destacado de la semana: ${t.name}${lugar ? ` (${lugar})` : ""}\n\n${pf.calificacion} de 5 con ${pf.resenas} trabajos evaluados por clientes reales en HETNA. ${(pf.servicios || []).slice(0, 3).join(", ")}\n\nPídele cotización: {{liga}}`,
        url: `${STORE_URL}/mx/talleres/${t.handle}`, estado: "borrador", programada_para: fechaPara("mx", 1, "facebook"), notas: `taller:${t.id}`,
      }, logger)
      await conTarjeta(id, { cinta: { texto: "Taller destacado", tono: "oro" }, titulo: t.name, sub: [(pf.servicios || []).slice(0, 2).join(" y "), lugar].filter(Boolean).join(" · "), estrellas: Math.round(pf.calificacion), datos: [["Calificación", `${pf.calificacion} de 5 · ${pf.resenas} trabajos`]], cta: "Pídele cotización" }, temaDe((pf.servicios || []).join(" ")))
      creadas.push("taller destacado")
    }
  } catch (e) {
    logger?.warn?.(`[fabrica] taller destacado: ${(e as Error).message}`)
  }

  // Opinión de cliente (reseña real, publicada, con comentario, 4 o 5 estrellas)
  try {
    const r = await knex("hetna_resena_taller as r")
      .join("seller as v", "v.id", "r.seller_id")
      .where("r.visible", true)
      .where("r.promedio", ">=", 4)
      .whereNotNull("r.comentario")
      .where((q: any) => q.whereNot("r.simultanea", true).orWhereNull("r.simultanea").orWhereNotNull("r.publicada_en"))
      .where("r.created_at", ">", knex.raw("now() - interval '14 days'"))
      .orderBy("r.promedio", "desc")
      .first("r.id", "r.comentario", "r.autor", "r.promedio", "v.name as taller", "v.handle")
    if (r && !(await knex(T_POST).where({ origen: "manual" }).where("notas", `resena:${r.id}`).first("id"))) {
      const id = await crearPublicacion(knex, {
        origen: "manual", titulo: `Opinión de cliente · ${r.taller}`,
        texto_base: `“${r.comentario}”\n\n— ${r.autor || "Cliente"}, sobre ${r.taller}. Trabajo pagado y entregado en HETNA.\n\nCotiza tu pieza con talleres evaluados: {{liga}}`,
        url: `${STORE_URL}/mx/talleres/${r.handle}`, estado: "borrador", programada_para: fechaPara("mx", 3, "instagram"), notas: `resena:${r.id}`,
      }, logger)
      await conTarjeta(id, { cinta: { texto: "Opinión de cliente", tono: "oro" }, titulo: r.taller, estrellas: Math.round(Number(r.promedio)), cita: String(r.comentario).slice(0, 180), sub: `${r.autor || "Cliente"} · trabajo pagado y entregado en HETNA`, cta: "Cotiza tu pieza" }, "taller")
      creadas.push("opinión de cliente")
    }
  } catch (e) {
    logger?.warn?.(`[fabrica] opinión: ${(e as Error).message}`)
  }

  // Índice de precios del mes (primer lunes del mes; mínimo 3 propuestas por grupo)
  try {
    const hoy = new Date()
    if (hoy.getUTCDate() <= 7) {
      const mes = hoy.toLocaleDateString("es-MX", { month: "long", timeZone: "America/Mexico_City" })
      if (!(await knex(T_POST).where({ origen: "manual" }).where("titulo", `Índice de precios CNC · ${mes} ${hoy.getUTCFullYear()}`).first("id"))) {
        const filas = await knex(`${T_PROPUESTA} as p`).join(`${T_SOLICITUD} as s`, "s.id", "p.solicitud_id").where("p.created_at", ">", knex.raw("now() - interval '60 days'")).where((q: any) => q.where("p.moneda", "MXN").orWhereNull("p.moneda")).select("p.precio", "s.trabajo")
        const grupos: Record<string, number[]> = {}
        for (const f of filas) {
          const k = [f.trabajo?.servicio, f.trabajo?.material].filter(Boolean).join(" · ")
          if (k) (grupos[k] ||= []).push(Number(f.precio))
        }
        const med = (xs: number[]) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)]
        const lista = Object.entries(grupos).filter(([, xs]) => xs.length >= 3).map(([k, xs]) => ({ k, v: med(xs), n: xs.length })).sort((a, b) => b.n - a.n).slice(0, 5)
        if (lista.length >= 2) {
          const max = Math.max(...lista.map((x) => x.v))
          const id = await crearPublicacion(knex, {
            origen: "manual", titulo: `Índice de precios CNC · ${mes} ${hoy.getUTCFullYear()}`,
            texto_base: `📊 Índice de precios CNC de ${mes}: precio mediano por trabajo según las cotizaciones en HETNA (últimos 60 días).\n\n${lista.map((x) => `• ${x.k}: $${Math.round(x.v).toLocaleString("es-MX")} MXN (${x.n} cotizaciones)`).join("\n")}\n\nGuárdalo y cotiza tu pieza: {{liga}}`,
            url: `${STORE_URL}/mx/cotizar`, estado: "borrador", programada_para: fechaPara("mx", 2, "linkedin"),
          }, logger)
          await conTarjeta(id, { cinta: { texto: `Índice de precios CNC · ${mes}` }, titulo: "¿Cuánto cuesta fabricar en México?", sub: "Precio mediano por trabajo, según cotizaciones reales en HETNA", barras: lista.map((x) => ({ etiqueta: x.k, pct: Math.round((x.v / max) * 100), valor: `$${Math.round(x.v).toLocaleString("es-MX")}` })), cta: "Guárdalo para tu próximo proyecto" }, "lamina")
          creadas.push("índice de precios")
        }
      }
    }
  } catch (e) {
    logger?.warn?.(`[fabrica] índice: ${(e as Error).message}`)
  }
  return creadas
}

// ---------------------------------------------------------------------
// Fase B: biblioteca de fondos con IA
// ---------------------------------------------------------------------

export async function fondosConIa(scope: any, tema: string, cantidad = 4, logger?: any) {
  const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await asegurarFabrica(knex)
  const base = PROMPTS_TEMA[tema] || PROMPTS_TEMA.general
  const prompts = Array.from({ length: Math.max(1, Math.min(8, cantidad)) }, (_, i) => base[i % base.length])
  const lote = nuevoId("ia")
  const out = await correr({ tarea: "imagen", prompts, ancho: 1088, alto: 1920, prefijo: `fabrica/fondos/${tema}/${lote}/`, semilla: Date.now() % 100000 }, { logger, topeMin: 20 })
  const urls: string[] = []
  for (const [i, clave] of (out.claves || []).entries()) {
    const url = await subir(scope, `fondo-${tema}-${lote}-${i}.jpg`, "image/jpeg", await bajarB2(clave))
    await knex(T_FONDO).insert({ id: nuevoId("fon"), tema, url, fuente: "IA · FLUX.1 schnell", licencia: "Apache 2.0 (FLUX.1 schnell)" })
    urls.push(url)
  }
  return urls
}

// ---------------------------------------------------------------------
// Fase B: "sube tu video" -> subtítulos y 5 cortos de tu propio video
// ---------------------------------------------------------------------

const ESQUEMA_CORTES = {
  type: "object", additionalProperties: false, required: ["titulo", "descripcion", "cortes"],
  properties: {
    titulo: S("título del video completo"),
    descripcion: S("descripción para YouTube y Facebook, con {{liga}}"),
    cortes: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["inicio", "fin", "gancho", "textos"],
        properties: {
          inicio: { type: "number" }, fin: { type: "number" },
          gancho: S("máximo 6 palabras para el primer segundo"),
          textos: { type: "object", additionalProperties: false, required: ["tiktok", "instagram", "facebook", "youtube"], properties: { tiktok: S(), instagram: S(), facebook: S(), youtube: S() } },
        },
      },
    },
  },
}

async function elegirCortes(segmentos: any[], e: any) {
  ia ??= new Anthropic()
  const m = MERCADOS[e.mercado || "mx"] || MERCADOS.mx
  const transcripcion = segmentos.map((s) => `[${s.inicio.toFixed(1)}-${s.fin.toFixed(1)}] ${s.texto}`).join("\n").slice(0, 60000)
  const resp = await ia.beta.messages.create({
    model: "claude-opus-5-5", max_tokens: 6000,
    output_config: { effort: "medium", format: { type: "json_schema", schema: ESQUEMA_CORTES } },
    betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
    system:
      `Eres el editor de video de HETNA CNC. Escribe para ${m.nombre} (${m.nota}). De la transcripción con tiempos, elige los 5 mejores momentos para cortos verticales ` +
      "de 15 a 45 segundos: que se entiendan solos, que empiecen con algo que atrape y terminen en una idea completa. Usa los tiempos exactos de la transcripción (inicio de una línea y fin de otra). " +
      "Escribe el texto de cada red con su estilo (Instagram y TikTok sin URL: 'liga en el perfil'; Facebook y YouTube con {{liga}}). No inventes datos que no estén en el video.",
    messages: [{ role: "user", content: `Público: ${e.publico}.\nTranscripción:\n${transcripcion}` }],
  } as any)
  if (resp.stop_reason === "refusal") throw new Error("La IA no quiso trabajar este video.")
  return JSON.parse(resp.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join(""))
}

export async function producirVideo(scope: any, tr: any, logger?: any) {
  const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const e = tr.entrada || {}
  const id = tr.id
  const mercado = e.mercado && MERCADOS[e.mercado] ? e.mercado : "mx"
  const destino = `${STORE_URL}${mercado === "us" ? "/us" : "/mx"}${e.publico === "talleres" ? "/talleres/unete" : "/cotizar"}`
  const piezas: any = { cortos: [], posts: [] }
  // El video vive en el B2 privado: liga firmada de 3 horas para el trabajador
  const videoUrl = e.video_url || (await ligasB2([e.video_clave], 3 * 3600))[0]
  if (!videoUrl) throw new Error("No se pudo leer el video subido.")
  const tx = await correr({ tarea: "transcribir", media_url: videoUrl, idioma: idiomaDe(mercado) }, { logger, topeMin: 30 })
  const segs = tx.segmentos || []
  if (!segs.length) throw new Error("No se entendió voz en el video (¿tiene audio?).")
  const plan = await elegirCortes(segs, e)
  await knex(T_TRABAJO).where({ id }).update({ paquete: JSON.stringify({ titulo: plan.titulo, ...plan, transcripcion: segs }) })
  const cortes = (plan.cortes || []).slice(0, 5).map((c: any, i: number) => ({ inicio: c.inicio, fin: Math.min(c.fin, c.inicio + 60), gancho: c.gancho, clave: `fabrica/${id}/corte-${i + 1}.mp4` }))
  const out = await correr({ tarea: "cortes", video_url: videoUrl, segmentos: cortes, subtitulos: segs, completo: `fabrica/${id}/subtitulado.mp4` }, { logger, topeMin: 40 })
  for (const [i, c] of (out.cortes || []).entries()) {
    const url = await subir(scope, `fabrica-${id}-corte${i + 1}.mp4`, "video/mp4", await bajarB2(c.clave))
    const info = plan.cortes[i]
    const pid = await crearPublicacion(knex, {
      origen: "manual", fuente: "fabrica", titulo: `Fábrica · Tu video · Corte ${i + 1} · ${info.gancho}`, texto_base: info.textos.facebook, url: destino, redes: ["tiktok", "instagram", "facebook", "youtube"],
      textos: info.textos, medios: [{ url, tipo: "video" }], estado: "borrador", programada_para: fechaPara(mercado, i, "tiktok"), mercado,
    }, logger)
    piezas.cortos.push({ post: pid, url, segundos: c.segundos })
  }
  if (out.completo) {
    piezas.completo = out.completo
    const pid = await crearPublicacion(knex, {
      origen: "manual", fuente: "fabrica", titulo: `Fábrica · Tu video subtitulado · ${plan.titulo}`, texto_base: plan.descripcion, url: destino, redes: ["youtube", "facebook"],
      textos: { youtube: `${plan.titulo}\n\n${plan.descripcion}`, facebook: plan.descripcion }, estado: "borrador", programada_para: fechaPara(mercado, 0, "youtube"), mercado,
      notas: "Video completo con subtítulos: descárgalo en la Fábrica (botón Descargar) para subirlo.",
    }, logger)
    piezas.posts.push(pid)
  }
  return piezas
}
