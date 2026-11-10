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

import { T_POST, ligaPara, urlCorta } from "../social-hub"
import { T_PLAN, asegurarPlan } from "../estrategia"
import { fondoDe, musicaAlAzar, subir, temaDe } from "./index"
import { cuadroVideo, lamina, miniatura, tarjeta } from "./render"
import { VOZ, correr, idiomaDe, ligasB2, runpodListo } from "./runpod"
import { corto, ffmpegDisponible, segundosPara } from "./video"

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
}
const LLAMADA: Record<string, [string, string]> = {
  talleres: ["Recibe trabajos sin comisión", "Get CNC jobs, no commission"],
  proveedores: ["Publica tus productos", "List your products"],
  clientes_empresa: ["Cotiza tu pieza", "Get a quote"],
  clientes_particulares: ["Cotiza o compra en HETNA", "Get a quote on HETNA"],
}
export const textosDe = (publico: string, mercado: string) => {
  const en = mercado === "us" ? 1 : 0
  return { cinta: (ETIQUETA[publico] || ETIQUETA.clientes_particulares)[en], cta: (LLAMADA[publico] || LLAMADA.clientes_particulares)[en], perfil: en ? "link in bio" : "liga en el perfil" }
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
  const filas = await knex(`${T_PLAN} as h`)
    .join(`${T_POST} as p`, "p.id", "h.post_id")
    .whereNull("h.material")
    .whereIn("p.estado", ["borrador", "programada"])
    .whereRaw(`coalesce(jsonb_array_length(p.medios), 0) = 0`)
    .orderBy("h.fecha")
    .limit(limite)
    .select("h.id as plan_id", "h.formato", "h.publico", "h.red", "h.pilar", "h.mercado", "p.id", "p.texto_base", "p.textos", "p.notas", "p.url_destino", "p.titulo")
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
  if (videos.length && runpodListo()) {
    // Agrupadas por idioma (cada lote usa la voz de su idioma)
    for (const idioma of [...new Set(videos.map((f: any) => idiomaDe(f.mercado)))]) {
      const grupo = videos.filter((f: any) => idiomaDe(f.mercado) === idioma)
      try {
        const out = await correr({
          tarea: "voz", voz: VOZ(idioma, "hombre"), idioma,
          lotes: grupo.map((f: any) => ({ frases: [guiones[f.id].gancho, ...guiones[f.id].frases, guiones[f.id].cierre], clave: `fabrica/plan/${f.id}-voz.wav` })),
        }, { logger, topeMin: 15 })
        const lotes = out.lotes || []
        const urls = await ligasB2(lotes.map((v: any) => v.clave), 7200)
        lotes.forEach((v: any, k: number) => (voces[grupo[k].id] = { ...v, url: urls[k] }))
      } catch (e) {
        logger?.warn?.(`[fabrica] voz del plan (${idioma}): ${(e as Error).message}; los videos salen sin voz`)
      }
    }
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
        const dur = (k: number, porOmision: number) => (voz?.duraciones?.[k] ? Math.max(1.2, voz.duraciones[k] + 0.15) : porOmision)
        const escenas = [{ png: await cuadroVideo({ tipo: "gancho", texto: g.gancho, tema, foto_url: await foto(), semilla: 1 }), segundos: dur(0, 2.4) }]
        for (const [k, fr] of g.frases.entries()) escenas.push({ png: await cuadroVideo({ tipo: "frase", texto: fr, tema, foto_url: await foto(), semilla: k + 2 }), segundos: dur(k + 1, segundosPara(fr)) })
        escenas.push({ png: await cuadroVideo({ tipo: "cierre", texto: g.cierre, tema, liga }), segundos: dur(g.frases.length + 1, 2.6) })
        const v = await corto(escenas, { musica, voz: voz?.url || null })
        medios = [{ url: await subir(scope, `plan-${f.id}.mp4`, "video/mp4", v.buf), tipo: "video" }]
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
