// @ts-nocheck
// Marketing HETNA — material automático para el plan semanal.
// El agente de Estrategia escribe el texto (y el guion) de cada hueco del plan;
// aquí se le hace su imagen o video según el formato del hueco:
//   - reel / short / video / estado vertical -> corto 9:16 con FFmpeg (gancho,
//     frases del guion, cierre con QR) y voz de RunPod si está configurado
//   - carrusel / documento -> láminas 4:5 (portada, puntos y cierre)
//   - imagen / texto / el resto -> tarjeta 4:5 con QR de la liga medida
//   - largo (YouTube) -> miniatura; el video largo se hace en la Fábrica
// Todo sale del texto real del borrador: no se inventan datos.
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import Anthropic from "@anthropic-ai/sdk"

import { nuevoId } from "../licitacion"
import { MERCADOS, T_POST, crearPublicacion, dentroDeHorario, iaSocial, leerConfig, ligaPara, urlCorta, zonaDe } from "../social-hub"
import { T_PLAN, asegurarPlan } from "../estrategia"
import { fondoDe, musicaAlAzar, subir, temaDe } from "./index"
import { cuadroVideo, lamina, miniatura, tarjeta, carpetaFuentes } from "./render"
import { VOZ, correr, idiomaDe, ligasB2, runpodListo } from "./runpod"
import { corto, ffmpegDisponible, segundosPara } from "./video"
import { vozLocal } from "./voz-local"
import { bloquesBasicos, guionista, hfDisponible, horaTranquila, paraVoz, temaPara, videoHF } from "./hyperframes"
import { EMOCIONES, REGLAS_EMOCION } from "../estrategia"

const FORMATOS_VIDEO = ["reel", "short", "video", "estado"]

/** Quita la liga, hashtags y espacios de sobra. */
export function limpiar(t: string) {
  return String(t || "")
    .replace(/\{\{liga\}\}/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .split("\n")
    .filter((l) => !/^\s*(#\S+\s*)+$/.test(l))
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/** Corta a n palabras sin dejar la frase a medias con signos sueltos. */
export function palabras(t: string, n: number) {
  const w = String(t || "").trim().split(/\s+/).filter(Boolean)
  const x = w.slice(0, n).join(" ").replace(/[,;:\-–]+$/, "")
  return w.length > n ? `${x}…` : x
}

/** Oraciones de un texto (para frases de video y láminas). */
export function oraciones(t: string) {
  return limpiar(t)
    .split(/(?<=[.!?¿¡])\s+|\n+/)
    .map((s) => s.replace(/^[-•*\d.)\s]+/, "").trim())
    .filter((s) => s.replace(/[^\p{L}\p{N}]/gu, "").length >= 8)
}

/** Gancho (primera línea), frases y guion a partir del borrador. */
export function piezasDeTexto(texto: string, notas?: string | null) {
  const lineas = limpiar(texto).split("\n").map((l) => l.trim()).filter(Boolean)
  const gancho = palabras(lineas[0] || "", 12)
  const guion = String(notas || "").match(/Guion:\s*([\s\S]+)/i)?.[1] || ""
  const fuente = oraciones(guion).length >= 2 ? oraciones(guion) : oraciones(lineas.slice(1).join("\n"))
  const frases = fuente.filter((f) => palabras(f, 10) !== gancho).slice(0, 4).map((f) => palabras(f, 10))
  return { gancho, frases }
}

const ETIQUETA: Record<string, [string, string]> = {
  talleres: ["Para talleres", "For machine shops"],
  proveedores: ["Para proveedores", "For suppliers"],
  clientes_empresa: ["Para empresas", "For manufacturers"],
  clientes_particulares: ["HETNA CNC", "HETNA CNC"],
  comunidad: ["Comunidad HETNA", "HETNA community"],
}
const LLAMADA: Record<string, [string, string]> = {
  talleres: ["Recibe trabajos sin comisión", "Get CNC jobs, no commission"],
  proveedores: ["Publica tus productos", "List your products"],
  clientes_empresa: ["Cotiza tu pieza", "Get a quote"],
  clientes_particulares: ["Cotiza o compra en HETNA", "Get a quote on HETNA"],
  comunidad: ["Cuéntanos en comentarios", "Tell us in the comments"],
}
export const textosDe = (publico: string, mercado: string) => {
  const en = mercado === "us" ? 1 : 0
  return { cinta: (ETIQUETA[publico] || ETIQUETA.clientes_particulares)[en], cta: (LLAMADA[publico] || LLAMADA.clientes_particulares)[en], perfil: en ? "link in bio" : "liga en el perfil" }
}

// ---------------------------------------------------------------------
// Prueba A/B de ganchos
// ---------------------------------------------------------------------

let ia: Anthropic | null = null
/** Gancho alterno con otro enfoque (pregunta, dato, problema). Sin IA, usa la primera frase. */
export async function ganchoAlterno(gancho: string, frases: string[], mercado: string, logger?: any) {
  const respaldo = frases.find((f) => f && f !== gancho) || ""
  if (!iaSocial()) return respaldo
  try {
    ia ??= new Anthropic()
    const resp = await ia.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 200,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system:
        "Escribe UN gancho alterno para el primer segundo de un video corto de HETNA CNC. Máximo 8 palabras, con otro enfoque que el original " +
        "(si el original es pregunta, usa un problema o un resultado; si es afirmación, usa una pregunta). No inventes cifras, precios ni datos. Devuelve sólo el gancho, sin comillas.",
      messages: [{ role: "user", content: `Mercado: ${MERCADOS[mercado]?.nota || "español de México"}
Gancho original: ${gancho}
Lo que dice el video: ${frases.join(" / ")}` }],
    } as any)
    if (resp.stop_reason === "refusal") return respaldo
    const t = resp.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("").trim().replace(/^["“']|["”']$/g, "")
    return t && t.length <= 80 ? t : respaldo
  } catch (e) {
    logger?.warn?.(`[fabrica] gancho alterno: ${(e as Error).message}`)
    return respaldo
  }
}

/** Crea la variante B (mismo contenido, otro gancho) 4 días después; su video lo hace la siguiente vuelta. */
async function crearVarianteB(knex: any, f: any, g: { gancho: string; frases: string[] }, logger?: any) {
  const ganchoB = await ganchoAlterno(g.gancho, g.frases, f.mercado, logger)
  if (!ganchoB || ganchoB === g.gancho) return null
  const cambiaGancho = (t: string) => {
    const lineas = String(t || "").split("\n")
    const i = lineas.findIndex((l) => l.trim())
    if (i >= 0) lineas[i] = ganchoB
    return lineas.join("\n")
  }
  const cfg = await leerConfig(knex)
  const base = f.programada_para ? new Date(f.programada_para) : new Date(f.fecha)
  const cuando = dentroDeHorario(new Date(base.getTime() + 4 * 86_400_000), cfg.horario, zonaDe(f.mercado))
  const textos = Object.fromEntries(Object.entries(f.textos || {}).map(([r, t]) => [r, cambiaGancho(String(t))]))
  const idB = await crearPublicacion(knex, {
    origen: "manual", fuente: "plan", titulo: `${f.titulo} · gancho B`, texto_base: cambiaGancho(f.texto_base), textos, url: f.url_destino,
    redes: [f.red], estado: "borrador", programada_para: cuando, mercado: f.mercado, notas: f.notas || undefined,
  } as any, logger)
  await knex(T_POST).where({ id: f.id }).update({ ab: JSON.stringify({ variante: "A", pareja: idB, gancho: g.gancho }) })
  await knex(T_POST).where({ id: idB }).update({ ab: JSON.stringify({ variante: "B", pareja: f.id, gancho: ganchoB }) })
  await knex(T_PLAN).insert({ id: nuevoId("plan"), semana: f.semana, fecha: cuando, red: f.red, mercado: f.mercado, publico: f.publico, pilar: f.pilar, formato: f.formato, estado: "falta_material", post_id: idB })
  return idB
}

let ocupado = false

/** Hace el material de los borradores del plan que todavía no tienen. */
export async function materialPlan(scope: any, logger?: any, limite = 6) {
  // El job corre cada 2 minutos; la voz en frío puede tardar más: una vuelta a la vez
  if (ocupado) return { hechos: 0, ocupado: true }
  ocupado = true
  try {
    return await hacerMaterial(scope, logger, limite)
  } finally {
    ocupado = false
  }
}

async function hacerMaterial(scope: any, logger?: any, limite = 6) {
  const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await asegurarPlan(knex)
  await knex.raw(`alter table ?? add column if not exists material text`, [T_PLAN]).catch(() => {})
  // Videos animados: sólo si el dueño los activó en Configuración y HyperFrames está instalado
  const animado = !!(await leerConfig(knex)).video_animado && hfDisponible()
  const filas = await knex(`${T_PLAN} as h`)
    .join(`${T_POST} as p`, "p.id", "h.post_id")
    .whereNull("h.material")
    .whereIn("p.estado", ["borrador", "programada"])
    .whereRaw(`coalesce(jsonb_array_length(p.medios), 0) = 0`)
    // Con HyperFrames, los videos que salen en más de 24 h esperan a la madrugada (2-6 am)
    // para no quitarle procesador a la tienda en horas de visitas
    .modify((q: any) => {
      if (animado && !horaTranquila())
        q.whereNot((w: any) => w.whereRaw(`coalesce(h.formato, '') = any(?)`, [FORMATOS_VIDEO]).whereRaw(`coalesce(p.programada_para, h.fecha) > now() + interval '24 hours'`))
    })
    .orderBy("h.fecha")
    .limit(limite)
    .select("h.id as plan_id", "h.semana", "h.fecha", "h.formato", "h.publico", "h.red", "h.pilar", "h.mercado", "p.id", "p.texto_base", "p.textos", "p.notas", "p.url_destino", "p.titulo", "p.ab", "p.programada_para", "p.emocion")
  if (!filas.length) return { hechos: 0 }
  const hayVideo = ffmpegDisponible()
  const musica = hayVideo ? await musicaAlAzar(knex) : null

  // Voz: una sola llamada a RunPod para todos los videos de esta vuelta
  const videos = filas.filter((f: any) => hayVideo && FORMATOS_VIDEO.includes(f.formato))
  const voces: Record<string, any> = {}
  const guiones: Record<string, { gancho: string; frases: string[]; cierre: string }> = {}
  for (const f of videos) {
    const { gancho, frases } = piezasDeTexto(f.textos?.[f.red] || f.texto_base, f.notas)
    const t = textosDe(f.publico, f.mercado)
    guiones[f.id] = { gancho: gancho || palabras(f.pilar, 9), frases: frases.slice(0, 3), cierre: t.cta }
  }
  // Guion por escenas para HyperFrames (IA; sin IA, a partir del gancho y las frases)
  const bloquesDe: Record<string, any[]> = {}
  if (animado) {
    for (const f of videos) {
      const g = guiones[f.id]
      const comunidad = f.publico === "comunidad"
      const idioma = idiomaDe(f.mercado)
      const emo = EMOCIONES.find((e) => e.clave === f.emocion)
      const cierre = { texto: g.cierre, narracion: comunidad ? g.cierre : idioma === "en" ? `${g.cierre} at hetnacnc.com` : `${g.cierre} en hetnacnc.com` }
      bloquesDe[f.id] =
        (await guionista({ texto: f.textos?.[f.red] || f.texto_base, publico: f.publico, emocion: emo?.nombre, idioma, cierre, reglasEmocion: emo ? `${REGLAS_EMOCION} Aquí: ${emo.como}.` : undefined }, logger)) ||
        bloquesBasicos(g, { comunidad })
    }
  }
  /** Lo que dice la voz: la narración de cada escena (o gancho, frases y cierre). */
  const frasesVoz = (f: any) => {
    const b = bloquesDe[f.id]
    if (b) return b.map((x: any) => paraVoz(x.narracion, idiomaDe(f.mercado)))
    const g = guiones[f.id]
    return [g.gancho, ...g.frases, g.cierre]
  }
  if (videos.length && runpodListo()) {
    // Agrupadas por idioma (cada lote usa la voz de su idioma)
    for (const idioma of [...new Set(videos.map((f: any) => idiomaDe(f.mercado)))]) {
      const grupo = videos.filter((f: any) => idiomaDe(f.mercado) === idioma)
      try {
        const out = await correr({
          tarea: "voz", voz: VOZ(idioma, "hombre"), idioma,
          lotes: grupo.map((f: any) => ({ frases: frasesVoz(f), clave: `fabrica/plan/${f.id}-voz.wav` })),
        }, { logger, topeMin: 15 })
        const lotes = out.lotes || []
        const urls = await ligasB2(lotes.map((v: any) => v.clave), 7200)
        lotes.forEach((v: any, k: number) => (voces[grupo[k].id] = { ...v, url: urls[k] }))
      } catch (e) {
        logger?.warn?.(`[fabrica] voz del plan (${idioma}): ${(e as Error).message}; los videos salen sin voz`)
      }
    }
  }

  // Sin RunPod (o si falló): voz local de respaldo para que no salgan mudos
  for (const f of videos) {
    if (voces[f.id]) continue
    const v = await vozLocal(frasesVoz(f), idiomaDe(f.mercado), logger)
    if (v) voces[f.id] = v
  }

  let hechos = 0
  for (const f of filas) {
    try {
      const texto = f.textos?.[f.red] || f.texto_base
      const tema = temaDe(`${f.pilar} ${texto}`)
      const foto = () => fondoDe(knex, tema)
      const t = textosDe(f.publico, f.mercado)
      const liga = urlCorta(await ligaPara(knex, f.id, f.red, f.url_destino))
      let medios: any[] = []
      if (hayVideo && FORMATOS_VIDEO.includes(f.formato)) {
        const g = guiones[f.id]
        const voz = voces[f.id]
        const bloques = bloquesDe[f.id]
        // 1) Video animado (HyperFrames); 2) si no se puede, el de FFmpeg con la misma voz
        // Fondo distinto en cada video (y foto real de la Biblioteca cuando la hay)
        const fotoFondo = bloques ? await foto().catch(() => null) : null
        let v: any = bloques
          ? await videoHF(bloques, {
              tema: temaPara(f.id, !!fotoFondo, { publico: f.publico, fecha: f.programada_para ? new Date(f.programada_para) : new Date(f.fecha) }), foto: fotoFondo,
              duraciones: voz?.duraciones?.length === bloques.length ? voz.duraciones : bloques.map((b: any) => segundosPara(b.narracion, 1.8, 4.5)),
              voz: voz?.url || null, musica, liga, comunidad: f.publico === "comunidad", idioma: idiomaDe(f.mercado), logger,
            })
          : null
        if (!v) {
          const dur = (k: number, porOmision: number) => (voz?.duraciones?.[k] ? Math.max(1.2, voz.duraciones[k] + 0.15) : porOmision)
          // Mismas escenas que la voz: con guion por bloques, gancho = 1.º bloque, frases = los de en medio, cierre = el último
          const gancho = bloques ? palabras(bloques[0].narracion, 12) : g.gancho
          const frases = bloques ? bloques.slice(1, -1).map((b: any) => b.narracion) : g.frases
          const cierre = bloques ? bloques[bloques.length - 1].texto : g.cierre
          const escenas = [{ png: await cuadroVideo({ tipo: "gancho", texto: gancho, tema, foto_url: await foto(), semilla: 1 }), segundos: dur(0, 2.4) }]
          for (const [k, fr] of frases.entries()) escenas.push({ png: await cuadroVideo({ tipo: "frase", texto: fr, tema, foto_url: await foto(), semilla: k + 2, sinTexto: true }), segundos: dur(k + 1, segundosPara(fr)), subtitulo: fr })
          escenas.push({ png: await cuadroVideo({ tipo: "cierre", texto: cierre, tema, liga }), segundos: dur(frases.length + 1, 2.6) })
          v = await corto(escenas, { fuentes: carpetaFuentes(), musica, voz: voz?.url || null })
        }
        medios = [{ url: await subir(scope, `plan-${f.id}.mp4`, "video/mp4", v.buf), tipo: "video" }]
        // Prueba A/B: otro día sale el mismo video con un gancho distinto (si A no funciona)
        if (!f.ab) await crearVarianteB(knex, f, g, logger).catch((e) => logger?.warn?.(`[fabrica] variante B ${f.id}: ${e.message}`))
      } else if (["carrusel", "documento"].includes(f.formato)) {
        const { gancho, frases } = piezasDeTexto(texto, f.notas)
        const puntos = frases.slice(0, 4)
        const total = puntos.length + 2
        const urls = [await subir(scope, `plan-${f.id}-1.png`, "image/png", await lamina({ num: 1, total, titulo: gancho || palabras(f.pilar, 9), portada: true, tema, foto_url: await foto() }))]
        for (const [k, pt] of puntos.entries()) urls.push(await subir(scope, `plan-${f.id}-${k + 2}.png`, "image/png", await lamina({ num: k + 2, total, titulo: pt, tema })))
        urls.push(await subir(scope, `plan-${f.id}-${total}.png`, "image/png", await lamina({ num: total, total, titulo: t.cta, cierre: { cta: t.cta, liga_texto: f.red === "instagram" ? t.perfil : liga.replace(/^https?:\/\//, "") }, tema, foto_url: await foto() })))
        medios = urls.map((url) => ({ url, tipo: "imagen" }))
      } else if (f.formato === "largo") {
        medios = [{ url: await subir(scope, `plan-${f.id}-mini.png`, "image/png", await miniatura({ titulo: palabras(f.pilar, 8), tema, foto_url: await foto() })), tipo: "imagen" }]
      } else {
        const { gancho } = piezasDeTexto(texto, f.notas)
        const png = await tarjeta({ tema, foto_url: await foto(), cinta: { texto: t.cinta }, titulo: gancho || palabras(f.pilar, 9), cta: t.cta, liga, ...(f.red === "instagram" ? { liga_texto: t.perfil } : {}) })
        medios = [{ url: await subir(scope, `plan-${f.id}.png`, "image/png", png), tipo: "imagen" }]
      }
      await knex(T_POST).where({ id: f.id }).update({ medios: JSON.stringify(medios), updated_at: knex.fn.now() })
      await knex(T_PLAN).where({ id: f.plan_id }).update({ material: "hecho", ...(f.formato === "largo" ? {} : { estado: "borrador" }) })
      hechos++
    } catch (e) {
      logger?.warn?.(`[fabrica] material del plan ${f.id}: ${(e as Error).message}`)
      await knex(T_PLAN).where({ id: f.plan_id }).update({ material: "error" })
    }
  }
  if (hechos) logger?.info?.(`[fabrica] material del plan: ${hechos} piezas`)
  return { hechos }
}
