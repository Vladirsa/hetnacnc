// @ts-nocheck
// Videos EXPLICATIVOS de HETNA (estilo motion graphics, 65 a 80 s, 9:16) para
// YouTube, TikTok, Instagram y Facebook. Sin IA de video: se dibujan con las
// plantillas de HETNA, así que cuestan sólo la voz (~0.15 USD por video).
//
//   1. Guionista — Claude escribe escenas TIPADAS (portada, lista, dibujo,
//      comparación, checklist); nunca escribe HTML. El cierre lo pone el código
//      con una oferta real de HETNA y «Guarda este video y síguenos».
//   2. Voz       — una frase a la vez (MiniMax en fal.ai, voz Elegant_Man), así
//      cada subtítulo entra justo cuando se dice.
//   3. Dibujo    — Chrome del servidor dibuja cada escena en una sola página
//      alta (fondo, capas y subtítulos) y se recorta en PNG transparentes.
//   4. Armado    — FFmpeg: acercamiento lento del fondo, capas que entran con
//      fundido y desliz, subtítulos, whoosh en cada cambio y volumen parejo.
//   5. Queda como BORRADOR en el Social Hub y te llega a Telegram para aprobar.
import Anthropic from "@anthropic-ai/sdk"
import fs from "fs"
import os from "os"
import path from "path"
import { spawn, spawnSync } from "child_process"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { STORE_URL, nuevoId } from "../licitacion"
import { crearPublicacion, iaSocial } from "../social-hub"
import { modeloIA } from "../ia-modelo"
import { chromeBin } from "./poster"
import { carpetaFuentes } from "./render"
import { correr, ffmpegBin, ffmpegDisponible } from "./video"
import { DIBUJOS, ICONO, IDS_DIBUJO } from "./explicativo-dibujos"

export const VOZ_EXPLICATIVO = () => process.env.EXPLICATIVO_VOZ || "Elegant_Man"
export const explicativoListo = () => !!(process.env.FAL_KEY || "").trim() && iaSocial() && ffmpegDisponible() && !!chromeBin()
const FPS = 30
const PAUSA = 0.45 // silencio al final de cada escena
const ENTRE_FRASES = 0.22 // silencio entre frases de la misma escena
const MIN_SEG = 62 // duración mínima (monetización en TikTok/Facebook pide más de 1 minuto)

// ---------------------------------------------------------------------
// Cierres: ofertas REALES de HETNA (las mismas del Estudio), en corto
// ---------------------------------------------------------------------

export const CIERRES = [
  { titulo: "Cotiza gratis tu pieza", sub: "Varios talleres te mandan su propuesta", voz: "En hetnacnc.com publicas tu pieza gratis y varios talleres de tu zona te mandan su propuesta." },
  { titulo: "¿Tienes taller CNC?", sub: "Regístrate gratis y recibe trabajos", voz: "¿Tienes taller? Regístrate gratis en hetnacnc.com y recibe solicitudes de trabajo de tu zona." },
  { titulo: "Cotiza con tus costos", sub: "HETNA Cotizador · empieza gratis", voz: "Con el Cotizador de HETNA subes tu DXF y sale el precio con tus costos. Empieza gratis." },
  { titulo: "Calculadora CNC gratis", sub: "RPM, avance y potencia", voz: "Calcula RPM, avance y potencia gratis con la calculadora de hetnacnc.com." },
]
export const FRASE_FINAL = "*Guarda este video* y síguenos para el siguiente."
export const FRASE_FINAL_LARGO = "Si te sirvió, *suscríbete* y déjanos en los comentarios qué tema quieres para el siguiente video."

// ---------------------------------------------------------------------
// 1. Guion (datos tipados)
// ---------------------------------------------------------------------

const S = (d = "", max?: number) => ({ type: "string", description: d + (max ? ` (máximo ${max} caracteres)` : "") })
const TIPOS = ["portada", "lista", "dibujo", "comparacion", "checklist", "foto"] as const
const ESQUEMA = {
  type: "object", additionalProperties: false,
  required: ["tema", "serie", "titulo_seo", "descripcion", "hashtags", "cierre", "escenas"],
  properties: {
    tema: S("tema en 5 a 10 palabras"),
    serie: S("etiqueta corta del tema para el encabezado, en MAYÚSCULAS, ej. ARCHIVOS PARA LÁSER", 24),
    titulo_seo: S("título para YouTube con la palabra clave al inicio, sin clickbait falso", 70),
    descripcion: S("2 a 4 líneas con palabras clave; termina con {{liga}}"),
    hashtags: { type: "array", items: S() },
    cierre: { type: "integer", description: "oferta del cierre que mejor conecta con el tema: 0 = publicar pieza y recibir cotizaciones (clientes); 1 = registro de talleres; 2 = Cotizador para talleres; 3 = calculadora CNC gratis" },
    escenas: {
      type: "array",
      description: "de 7 a 9 escenas; la primera es tipo portada (el gancho)",
      items: {
        type: "object", additionalProperties: false,
        required: ["tipo", "kicker", "titulo", "titulo_naranja", "dibujo", "etiqueta", "puntos", "mal", "bien", "foto", "producto", "frases"],
        properties: {
          tipo: { type: "string", enum: [...TIPOS], description: "portada = gancho con dibujo y sello; lista = 3 puntos numerados; dibujo = un dibujo técnico con su explicación; comparacion = mal contra bien; checklist = 3 pasos para revisar; foto = una fotografía de taller o de producto con un pie corto (usa 2 por video)" },
          kicker: S("etiqueta chica arriba del título, MAYÚSCULAS, ej. ERROR 1, LAS 3 CAUSAS", 20),
          titulo: S("primera línea del título", 16),
          titulo_naranja: S("segunda línea del título (va en naranja)", 16),
          dibujo: { type: "string", enum: IDS_DIBUJO, description: "dibujo de la escena (portada y dibujo): " + IDS_DIBUJO.map((k) => `${k} = ${DIBUJOS[k].nombre}`).join("; ") },
          etiqueta: S("portada: el sello sobre el dibujo (1 a 2 palabras, ej. RECHAZADO); dibujo: lo que se ve (ej. VISTA DEL ARCHIVO); otras: vacío", 22),
          puntos: { type: "array", items: S("", 30), description: "lista y checklist: exactamente 3; dibujo: 2 datos cortos; otras: vacío" },
          mal: S("comparación: lo incorrecto", 26),
          bien: S("comparación: lo correcto", 26),
          foto: S("tipo foto: descripción EN INGLÉS de la fotografía realista (ej. close-up of a CO2 laser cutting MDF in a small Mexican workshop, smoke, sparks); otras: vacío"),
          producto: S("tipo foto, si conviene mostrar un producto de la tienda: 1 o 2 palabras para buscarlo (ej. láser, fresa, letrero, MDF); si no, vacío", 30),
          frases: { type: "array", items: S("", 120), description: "lo que dice la voz: 1 o 2 frases habladas de 8 a 18 palabras; marca con *asteriscos* las 2 a 4 palabras clave que se resaltan en naranja" },
        },
      },
    },
  },
}

const SISTEMA =
  "Eres el guionista de videos EXPLICATIVOS de HETNA CNC (marketplace mexicano de fabricación CNC). Formato: motion graphics vertical con voz en off, 65 a 80 segundos, para YouTube, TikTok, Instagram y Facebook.\n" +
  "Escribe en español de México, hablado y claro, como un experto de taller que explica sin rodeos. Sin saludos ni «en este video».\n" +
  "ESTRUCTURA: escena 1 portada = el gancho (un problema o pregunta que duele). Luego desarrollas: causas, cómo se ve cada error con un dibujo, comparaciones mal/bien y al final un checklist para que lo apliquen. El cierre con la oferta lo pone el sistema: tú NO escribas la escena de cierre ni menciones HETNA.\n" +
  "LONGITUD: en total entre 175 y 200 palabras sumando todas las frases (eso da 70 a 80 segundos); cuenta las palabras antes de terminar. Cada escena deja con ganas de la siguiente.\n" +
  "VERDAD: sólo enseña técnica ampliamente aceptada en CNC, láser, router, plasma, impresión 3D, materiales y archivos. No inventes cifras, precios, porcentajes, marcas, clientes ni testimonios. Si un dato depende de la máquina, dilo así («depende de tu máquina», «haz una prueba»).\n" +
  "TEXTOS EN PANTALLA: muy cortos, respeta los máximos de caracteres. Los dibujos son de una biblioteca fija: elige el que mejor ilustre la escena.\n" +
  "NUNCA pongas «a la venta», precios ni promociones en los textos: el cierre con la oferta lo pone el sistema.\n" +
  "FOTOS: incluye 2 escenas tipo foto (no seguidas, no la primera): una del taller o la máquina haciendo lo que explicas y, si el tema lo permite, otra de un producto (pon la palabra en producto). En la escena foto, etiqueta = pie de foto corto."

// Versión LARGA para YouTube (16:9, 4 a 6 minutos, con capítulos): mismas plantillas
// y reglas de verdad, más escenas agrupadas en capítulos.
const ESQUEMA_LARGO = (() => {
  const e = JSON.parse(JSON.stringify(ESQUEMA))
  const it = e.properties.escenas.items
  e.properties.escenas.description = "de 22 a 32 escenas agrupadas en 4 a 6 capítulos; la primera es tipo portada (el gancho)"
  it.required.push("capitulo")
  it.properties.capitulo = S("nombre corto del capítulo de la escena (el mismo en todas las escenas de ese capítulo), ej. Por qué pasa", 40)
  it.properties.frases.description = "lo que dice la voz: 2 frases habladas de 10 a 22 palabras; marca con *asteriscos* las 2 a 4 palabras clave"
  return e
})()

const SISTEMA_LARGO =
  "Eres el guionista de videos EXPLICATIVOS LARGOS de HETNA CNC (marketplace mexicano de fabricación CNC) para YouTube: motion graphics horizontal con voz en off, de 4 a 6 minutos, dividido en capítulos.\n" +
  "Escribe en español de México, hablado y claro, como un experto de taller que enseña a fondo sin rodeos. Sin saludos ni «en este video».\n" +
  "ESTRUCTURA: capítulo 1 = el gancho y qué va a aprender (la escena 1 es portada). Después 3 a 4 capítulos que desarrollan el tema a fondo (causas, cómo se ve cada caso con dibujos, comparaciones mal/bien, fotos del taller) y un capítulo final con el checklist para aplicarlo. El cierre con la oferta lo pone el sistema: tú NO escribas la escena de cierre ni menciones HETNA.\n" +
  "LONGITUD: en total entre 650 y 850 palabras sumando todas las frases (eso da 4 a 6 minutos); cuenta las palabras antes de terminar. Varía los tipos de escena para que no se vuelva monótono.\n" +
  "VERDAD: sólo enseña técnica ampliamente aceptada en CNC, láser, router, plasma, impresión 3D, materiales y archivos. No inventes cifras, precios, porcentajes, marcas, clientes ni testimonios. Si un dato depende de la máquina, dilo así («depende de tu máquina», «haz una prueba»).\n" +
  "TEXTOS EN PANTALLA: muy cortos, respeta los máximos de caracteres. Los dibujos son de una biblioteca fija: elige el que mejor ilustre la escena.\n" +
  "NUNCA pongas «a la venta», precios ni promociones en los textos: el cierre con la oferta lo pone el sistema.\n" +
  "FOTOS: incluye 4 a 6 escenas tipo foto repartidas en el video (del taller o la máquina haciendo lo que explicas y, si el tema lo permite, de productos: pon la palabra en producto). En la escena foto, etiqueta = pie de foto corto."

let ia: Anthropic | null = null
export async function guionExplicativo(knex: any, tema?: string, largo = false) {
  ia ??= new Anthropic()
  const recientes = await knex("hetna_estudio").whereIn("tipo", ["explicativo", "explicativo_largo"]).orderBy("created_at", "desc").limit(30).select("guion").catch(() => [])
  const temas = recientes.map((r: any) => r.guion?.tema).filter(Boolean)
  const ideas = await require("./estudio-datos").ideasParaGuion(knex).catch(() => ({ tendencias: [], referencias: [] }))
  const usuario = [
    tema ? `Tema pedido: ${tema}` : "Elige un tema útil que la gente busque (errores comunes, cómo elegir, cómo preparar archivos, materiales, mantenimiento, cómo cobrar).",
    temas.length ? `No repitas estos temas recientes: ${temas.join("; ")}` : "",
    ideas.tendencias?.length ? `Videos que están pegando (toma el ángulo, NO copies): ${ideas.tendencias.join("; ")}` : "",
    "Escribe el guion.",
  ].filter(Boolean).join("\n")
  let ultimo: any = null
  for (let intento = 0; intento < 2; intento++) {
    // Con streaming: el SDK no permite pedir respuestas largas (guion de 4 a 6 min) sin él
    const r: any = await ia.beta.messages.stream({
      ...modeloIA(process.env.IA_MODELO_ESTUDIO || undefined),
      max_tokens: largo ? 24000 : 8000,
      output_config: { effort: "medium", format: { type: "json_schema", schema: largo ? ESQUEMA_LARGO : ESQUEMA } },
      system: largo ? SISTEMA_LARGO : SISTEMA,
      messages: [{ role: "user", content: intento ? `${usuario}\n\nEl intento anterior quedó corto (${ultimo?.palabras || 0} palabras): escribe entre ${largo ? "650 y 850" : "175 y 200"} palabras en total (agrega escenas si hace falta).` : usuario }],
    } as any).finalMessage()
    if (r.stop_reason === "refusal") throw new Error("La IA no quiso escribir este guion.")
    let g: any
    try {
      g = JSON.parse(r.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join(""))
    } catch {
      continue
    }
    const v = validarGuion(g, { largo })
    ultimo = v
    if (v.palabras >= (largo ? 600 : 165)) return v
  }
  if (ultimo && ultimo.escenas.length >= 5 && ultimo.palabras >= (largo ? 450 : 120)) return ultimo
  throw new Error("La IA no entregó un guion completo.")
}

const corta = (s: any, n: number) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim()
  return t.length <= n ? t : t.slice(0, n).replace(/\s+\S*$/, "").trim()
}
export const sinMarcas = (s: string) => String(s || "").replace(/\*/g, "")
const contarPalabras = (s: string) => sinMarcas(s).split(/\s+/).filter(Boolean).length

/** Limpia y acota el guion de la IA; agrega el cierre fijo con la oferta. Pura (se prueba). */
export function validarGuion(g: any, o: { largo?: boolean } = {}) {
  const escenas = (Array.isArray(g?.escenas) ? g.escenas : [])
    .map((e: any, i: number) => {
      let tipo = TIPOS.includes(e?.tipo) ? e.tipo : "lista"
      if (i === 0) tipo = "portada"
      const puntos = (Array.isArray(e?.puntos) ? e.puntos : []).map((p: any) => corta(sinMarcas(p), 30)).filter(Boolean)
      const dibujo = DIBUJOS[e?.dibujo] ? e.dibujo : null
      // Sin lo que necesita su plantilla, la escena se vuelve lista (o se descarta si tampoco hay puntos)
      if (tipo === "dibujo" && !dibujo) tipo = "lista"
      if (tipo === "comparacion" && (!corta(e?.mal, 26) || !corta(e?.bien, 26))) tipo = "lista"
      if (tipo === "foto" && !String(e?.foto || "").trim() && !String(e?.producto || "").trim()) tipo = "lista"
      const frases = (Array.isArray(e?.frases) ? e.frases : []).map((f: any) => corta(f, 140)).filter((f: string) => contarPalabras(f) >= 2).slice(0, 2)
      return {
        tipo,
        kicker: corta(sinMarcas(e?.kicker), 20).toUpperCase(),
        titulo: corta(sinMarcas(e?.titulo), 16),
        titulo_naranja: corta(sinMarcas(e?.titulo_naranja), 16),
        dibujo: dibujo || (tipo === "portada" ? "engrane" : null),
        etiqueta: corta(sinMarcas(e?.etiqueta), 22).toUpperCase(),
        puntos: tipo === "dibujo" ? puntos.slice(0, 2) : puntos.slice(0, 3),
        mal: corta(sinMarcas(e?.mal), 26),
        bien: corta(sinMarcas(e?.bien), 26),
        foto: tipo === "foto" ? String(e?.foto || "").slice(0, 400) : "",
        producto: tipo === "foto" ? corta(sinMarcas(e?.producto), 30) : "",
        capitulo: o.largo ? corta(sinMarcas(e?.capitulo), 40) : "",
        frases,
      }
    })
    .filter((e: any) => e.frases.length && (e.titulo || e.titulo_naranja) && (["portada", "dibujo", "comparacion", "foto"].includes(e.tipo) || e.puntos.length >= 2))
    // Máximo 3 fotos por video; las que sobran se vuelven lista (si tienen puntos) o se quitan
    .map((e: any, _i: number, arr: any[]) => (e.tipo === "foto" && arr.filter((x: any) => x.tipo === "foto").indexOf(e) >= (o.largo ? 6 : 3) ? { ...e, tipo: e.puntos.length >= 2 ? "lista" : "quitar" } : e))
    .filter((e: any) => e.tipo !== "quitar")
    .slice(0, o.largo ? 34 : 9)
  const ci = Number.isInteger(g?.cierre) && CIERRES[g.cierre] ? g.cierre : 0
  const c = CIERRES[ci]
  escenas.push({ tipo: "cierre", kicker: "HETNA CNC", titulo: "¿Te sirvió?", titulo_naranja: "Hay más", dibujo: null, etiqueta: "", puntos: [c.titulo, c.sub], mal: "", bien: "", capitulo: o.largo ? "Cierre" : "", boton: o.largo ? "SUSCRÍBETE" : "GUARDA Y SÍGUENOS", frases: [c.voz, o.largo ? FRASE_FINAL_LARGO : FRASE_FINAL] })
  return {
    formato: o.largo ? "largo" : "corto",
    tema: corta(g?.tema, 90) || "Explicativo CNC",
    serie: corta(sinMarcas(g?.serie), 24).toUpperCase() || "CNC EXPLICADO",
    titulo_seo: corta(g?.titulo_seo, 70) || corta(g?.tema, 70),
    descripcion: String(g?.descripcion || "").slice(0, 600),
    hashtags: (Array.isArray(g?.hashtags) ? g.hashtags : []).map((h: any) => String(h).replace(/^#/, "").replace(/\s+/g, "")).filter(Boolean).slice(0, 8),
    cierre: ci,
    escenas,
    palabras: escenas.reduce((n: number, e: any) => n + e.frases.reduce((m: number, f: string) => m + contarPalabras(f), 0), 0),
  }
}

// ---------------------------------------------------------------------
// 3. Plantillas (HTML puro, se prueba sin Chrome)
// ---------------------------------------------------------------------

const esc = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
/** Escapa y convierte *palabras* en resaltado naranja. */
export const conEnfasis = (s: string) => esc(s).replace(/\*([^*]+)\*/g, "<em>$1</em>").replace(/\*/g, "")
const tamTitulo = (l: string) => Math.max(84, Math.min(118, Math.floor(118 * 13 / Math.max(13, l.length))))
const tamFila = (l: string) => (l.length > 26 ? 36 : l.length > 20 ? 40 : 46)

// Lienzo de cada formato
export const LIENZO = { corto: { w: 1080, h: 1920 }, largo: { w: 1920, h: 1080 } }
// En el horizontal, las capas (diseñadas para la tarjeta vertical: x 64..1016, y 580..1360)
// se escalan dentro de la tarjeta de la derecha (x 840..1840, y 190..890).
const TARJETA_H = { x: 840, y: 190, w: 1000, h: 700 }
const ESCALA_H = Math.min(TARJETA_H.w / 952, TARJETA_H.h / 780)
const envolverH = (html: string) => {
  const x = TARJETA_H.x + (TARJETA_H.w - 952 * ESCALA_H) / 2 - 64 * ESCALA_H
  const y = TARJETA_H.y + (TARJETA_H.h - 780 * ESCALA_H) / 2 - 580 * ESCALA_H
  return `<div style="position:absolute;left:0;top:0;width:1080px;height:1920px;transform-origin:0 0;transform:translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${ESCALA_H.toFixed(4)})">${html}</div>`
}

function css(fuentes: string, largo = false) {
  const f = (n: string) => `file://${path.join(fuentes, n)}`
  const L = largo ? LIENZO.largo : LIENZO.corto
  return `<style>
@font-face{font-family:Anton;src:url("${f("Anton-Regular.ttf")}")}
@font-face{font-family:ArchivoN;font-weight:900;src:url("${f("Archivo-900.ttf")}")}
@font-face{font-family:Archivo;font-weight:800;src:url("${f("Archivo-800.ttf")}")}
@font-face{font-family:Archivo;font-weight:500;src:url("${f("Archivo-500.ttf")}")}
@font-face{font-family:JBM;src:url("${f("JetBrainsMono-700.ttf")}")}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${L.w}px;background:transparent;font-family:Archivo,sans-serif;color:#fff}
.hoja{position:relative;width:${L.w}px;height:${L.h}px;overflow:hidden}
.hcab{position:absolute;top:44px;left:90px;right:80px;display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid rgba(255,255,255,.12);padding-bottom:18px}
.hcab img{height:54px;background:#fff;border-radius:12px;padding:6px 12px}
.hcab span{font:24px JBM;color:rgba(255,255,255,.55);letter-spacing:2px}
.hizq{position:absolute;top:200px;left:90px;width:700px}
.hizq .kick,.hizq .tit,.hizq .raya{position:static}
.hizq .tit{margin-top:14px}.hizq .raya{margin-top:28px}
.hcap{position:absolute;left:90px;width:700px;top:700px;font:30px JBM;color:rgba(255,255,255,.5);letter-spacing:2px;line-height:1.4}
.hcap b{display:block;font:800 44px Archivo;color:#fff;letter-spacing:0;margin-top:6px}
.hcard{position:absolute;left:${TARJETA_H.x}px;top:${TARJETA_H.y}px;width:${TARJETA_H.w}px;height:${TARJETA_H.h}px;border:2px solid rgba(255,255,255,.14);border-radius:28px;background:rgba(18,30,54,.85);box-shadow:0 30px 60px rgba(0,0,0,.35)}
.hsub{position:absolute;left:90px;right:80px;top:918px;min-height:116px;border:2px solid rgba(255,255,255,.14);border-left:10px solid #FF8A2B;border-radius:18px;background:rgba(8,14,28,.92);padding:22px 30px;font-weight:800;line-height:1.22}
.hsub em{font-style:normal;color:#FF8A2B}
.fondo{position:absolute;inset:0;background:radial-gradient(120% 70% at 50% 35%,#13203A 0%,#0A1120 70%)}
.rejilla{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:54px 54px}
.cab{position:absolute;top:70px;left:64px;right:64px;display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid rgba(255,255,255,.12);padding-bottom:22px}
.cab img{height:58px;background:#fff;border-radius:12px;padding:6px 12px}
.cab span{font:26px JBM;color:rgba(255,255,255,.55);letter-spacing:2px}
.kick{position:absolute;top:210px;left:64px;font:26px JBM;color:#FF8A2B;letter-spacing:3px}
.tit{position:absolute;top:252px;left:64px;right:64px;font-family:Anton;text-transform:uppercase;line-height:1;letter-spacing:1px}
.tit b{color:#FF8A2B;font-weight:400;display:block}
.raya{position:absolute;top:510px;left:64px;width:120px;height:8px;background:#FF8A2B;border-radius:4px}
.card{position:absolute;top:580px;left:64px;right:64px;height:780px;border:2px solid rgba(255,255,255,.14);border-radius:28px;background:rgba(18,30,54,.85);box-shadow:0 30px 60px rgba(0,0,0,.35)}
.etq{font:24px JBM;color:rgba(255,255,255,.55);letter-spacing:2px}
.sub{position:absolute;left:64px;right:64px;top:1440px;min-height:190px;border:2px solid rgba(255,255,255,.14);border-left:10px solid #FF8A2B;border-radius:20px;background:rgba(8,14,28,.92);padding:30px 36px;font-weight:800;line-height:1.22}
.sub em{font-style:normal;color:#FF8A2B}
.pie{position:absolute;bottom:90px;left:64px;right:64px;display:flex;justify-content:space-between;font:26px JBM;color:rgba(255,255,255,.4);letter-spacing:2px}
.fila{display:flex;align-items:center;gap:26px;font-weight:800;padding:28px 34px;border-radius:20px;border:2px solid rgba(255,255,255,.12);background:rgba(255,255,255,.03)}
.num{width:76px;height:76px;border-radius:18px;display:grid;place-items:center;font:42px ArchivoN;background:#FF8A2B;color:#0A1120;flex:none}
.en{position:absolute;left:64px;right:64px}
.sello{display:inline-block;transform:rotate(-10deg);border:10px solid #FF8A2B;border-radius:20px;color:#FF8A2B;font-family:Anton;letter-spacing:6px;padding:4px 34px;background:rgba(10,17,32,.75)}
.ok{color:#3EE07A}.mal{color:#FF5A4E}
</style>`
}

const en = (top: number, html: string, extra = "") => `<div class="en" style="top:${top}px;${extra}">${html}</div>`
const fila = (icono: string, texto: string, extra = "") => `<div class="fila" style="font-size:${tamFila(texto)}px;${extra}">${icono}<span>${esc(texto)}</span></div>`

/** Fondo de la escena (opaco): encabezado, título, tarjeta y pie. */
export function htmlBase(e: any, i: number, total: number, serie: string, logo: string) {
  const largo = Math.max(e.titulo.length, e.titulo_naranja.length)
  return `<div class="fondo"></div><div class="rejilla"></div>
<div class="cab"><img src="${logo}"><span>${esc(serie)}</span></div>
<div class="kick">${esc(e.kicker)}</div>
<div class="tit" style="font-size:${tamTitulo("x".repeat(largo))}px">${esc(e.titulo)}<b>${esc(e.titulo_naranja)}</b></div><div class="raya"></div>
<div class="card"></div>
<div class="pie"><span>hetnacnc.com</span><span>${String(i + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}</span></div>`
}

/** Fondo horizontal (YouTube): título a la izquierda, tarjeta a la derecha, capítulo abajo. */
export function htmlBaseLargo(e: any, i: number, total: number, serie: string, logo: string, capitulo?: { n: number; nombre: string }) {
  const largo = Math.max(e.titulo.length, e.titulo_naranja.length)
  const tam = Math.max(70, Math.min(104, Math.floor(104 * 12 / Math.max(12, largo))))
  return `<div class="fondo"></div><div class="rejilla"></div>
<div class="hcab"><img src="${logo}"><span>${esc(serie)} · hetnacnc.com · ${String(i + 1).padStart(2, "0")}/${String(total).padStart(2, "0")}</span></div>
<div class="hizq"><div class="kick">${esc(e.kicker)}</div><div class="tit" style="font-size:${tam}px">${esc(e.titulo)}<b>${esc(e.titulo_naranja)}</b></div><div class="raya"></div></div>
${capitulo?.nombre ? `<div class="hcap">CAPÍTULO ${capitulo.n}<b>${esc(capitulo.nombre)}</b></div>` : ""}
<div class="hcard"></div>`
}

/** Capas que entran una por una: [fracción de la escena en que aparece, html]. */
export function capasDe(e: any, logo: string): [number, string][] {
  const dib = (id: string) => DIBUJOS[id]?.svg || ""
  switch (e.tipo) {
    case "portada":
      return [
        [0.04, en(700, dib(e.dibujo))],
        ...(e.etiqueta ? [[0.45, en(1120, `<div style="text-align:center"><div class="sello" style="font-size:${e.etiqueta.length > 12 ? 70 : 96}px">${esc(e.etiqueta)}</div></div>`)] as [number, string]] : []),
      ]
    case "dibujo":
      return [
        [0.0, en(630, `<div class="etq" style="padding:0 40px">${esc(e.etiqueta)}</div>`)],
        [0.05, en(690, dib(e.dibujo))],
        ...(e.puntos.length ? [[0.4, en(1170, `<div style="display:flex;gap:22px;padding:0 36px">${e.puntos.map((p: string) => `<div class="fila" style="flex:1;font-size:${p.length > 18 ? 30 : 34}px;padding:22px 24px;gap:14px">${ICONO.punto}<span>${esc(p)}</span></div>`).join("")}</div>`)] as [number, string]] : []),
      ]
    case "foto": {
      if (!e.foto_archivo) return []
      const url = `file://${encodeURI(e.foto_archivo)}`
      return [
        [0.03, en(600, `<div style="margin:0 20px;height:740px;border-radius:22px;background:#0A1120 url('${url}') center/cover no-repeat;box-shadow:0 20px 40px rgba(0,0,0,.45)"></div>`)],
        ...(e.foto_pie ? [[0.35, en(1236, `<div style="margin:0 50px;display:flex;align-items:center;gap:16px;background:rgba(8,14,28,.9);border:2px solid rgba(255,255,255,.18);border-radius:16px;padding:16px 24px;font:800 ${e.foto_pie.length > 34 ? 30 : 36}px Archivo">${ICONO.punto}<span>${esc(e.foto_pie)}</span></div>`)] as [number, string]] : []),
        ...(e.foto_ia ? [[0.0, en(612, `<div style="margin:0 34px;text-align:right"><span style="font:20px JBM;color:rgba(255,255,255,.8);background:rgba(0,0,0,.45);padding:6px 12px;border-radius:8px">IMAGEN ILUSTRATIVA</span></div>`)] as [number, string]] : []),
      ]
    }
    case "comparacion": {
      const lado = (mal: boolean, t: string) => `<div style="flex:none;width:420px;border:2px solid ${mal ? "rgba(255,90,78,.6)" : "rgba(62,224,122,.7)"};border-radius:22px;padding:40px 26px;text-align:center;background:rgba(18,30,54,.95);height:640px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:36px">
<div class="etq">${mal ? "ASÍ NO" : "ASÍ SÍ"}</div><div style="transform:scale(2.6);margin:40px 0">${mal ? ICONO.mal : ICONO.ok}</div><div class="${mal ? "mal" : "ok"}" style="font:800 ${t.length > 18 ? 40 : 48}px/1.15 Archivo">${esc(t)}</div></div>`
      return [
        [0.05, en(650, `<div style="display:flex;justify-content:flex-start;padding:0 36px">${lado(true, e.mal)}</div>`)],
        [0.45, en(650, `<div style="display:flex;justify-content:flex-end;padding:0 36px">${lado(false, e.bien)}</div>`)],
      ]
    }
    case "checklist":
      return e.puntos.map((p: string, k: number) => [[0.08, 0.35, 0.6][k], en(660 + k * 180, fila(ICONO.ok, p), "padding:0 36px")])
    case "cierre":
      return [
        [0.05, en(640, `<div style="padding:0 40px;text-align:center"><div style="display:inline-block;background:#fff;border-radius:26px;padding:22px 40px;margin:30px 0 44px"><img src="${logo}" style="height:110px;display:block"></div>
<div style="background:#FF8A2B;border-radius:24px;padding:34px 20px;box-shadow:0 14px 30px rgba(0,0,0,.4)"><div style="font:900 ${e.puntos[0].length > 22 ? 50 : 58}px ArchivoN;color:#0A1120">${esc(e.puntos[0])}</div><div style="font:800 40px Archivo;color:#fff;margin-top:10px">${esc(e.puntos[1] || "")}</div><div style="font:800 44px Archivo;color:#0A1120;margin-top:14px">hetnacnc.com</div></div></div>`)],
        [0.55, en(1200, `<div style="margin:0 40px;display:flex;align-items:center;justify-content:center;gap:22px;border:3px solid #fff;border-radius:22px;padding:22px;font:900 46px ArchivoN">${ICONO.guardar}${esc(e.boton || "GUARDA Y SÍGUENOS")}</div>`)],
      ]
    default: // lista
      return e.puntos.map((p: string, k: number) => [[0.05, 0.28, 0.5][k], en(660 + k * 180, fila(`<div class="num" style="${k ? "background:#3A4A6B;color:#fff" : ""}">${k + 1}</div>`, p, k ? "" : "border-color:#FF8A2B;background:rgba(255,138,43,.1)"), "padding:0 36px")])
  }
}

export const htmlSub = (t: string) => `<div class="sub" style="font-size:${sinMarcas(t).length > 95 ? 44 : 52}px">${conEnfasis(t)}</div>`
export const htmlSubLargo = (t: string) => `<div class="hsub" style="font-size:${sinMarcas(t).length > 110 ? 34 : 40}px">${conEnfasis(t)}</div>`

/** Página alta de la escena: base + capas + subtítulos, cada uno en su hoja de 1920 px. */
export function paginaEscena(e: any, i: number, total: number, serie: string, o: { fuentes: string; logo: string; largo?: boolean; capitulo?: { n: number; nombre: string } }) {
  const capas = capasDe(e, o.logo)
  const hojas = o.largo
    ? [htmlBaseLargo(e, i, total, serie, o.logo, o.capitulo), ...capas.map((c) => envolverH(c[1])), ...e.frases.map((f: string) => htmlSubLargo(f))]
    : [htmlBase(e, i, total, serie, o.logo), ...capas.map((c) => c[1]), ...e.frases.map((f: string) => htmlSub(f))]
  return {
    html: `<!doctype html><html><head><meta charset="utf-8">${css(o.fuentes, o.largo)}</head><body>${hojas.map((h) => `<div class="hoja">${h}</div>`).join("")}</body></html>`,
    hojas: hojas.length,
    tiempos: capas.map((c) => c[0]),
  }
}

// ---------------------------------------------------------------------
// Dibujo con Chrome (una apertura por escena) y recorte con sharp
// ---------------------------------------------------------------------

function capturar(html: string, alto: number, salida: string, ancho = 1080) {
  return new Promise<void>((ok, mal) => {
    const bin = chromeBin()
    if (!bin) return mal(new Error("No hay Chrome en el servidor"))
    const args = ["--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1", `--window-size=${ancho},${alto}`, "--default-background-color=00000000", "--virtual-time-budget=8000", `--screenshot=${salida}`, `file://${html}`]
    const usaNice = fs.existsSync("/usr/bin/nice")
    const c = spawn(usaNice ? "/usr/bin/nice" : bin, usaNice ? ["-n", "10", bin, ...args] : args, { stdio: "ignore", detached: true })
    const t = setTimeout(() => { try { process.kill(-c.pid!, "SIGKILL") } catch {} ; mal(new Error("Chrome tardó demasiado")) }, 90_000)
    c.on("close", () => { clearTimeout(t); try { process.kill(-c.pid!, "SIGKILL") } catch {} ; fs.existsSync(salida) ? ok() : mal(new Error("Chrome no dibujó la escena")) })
    c.on("error", (err) => { clearTimeout(t); mal(err) })
  })
}

async function dibujarEscena(e: any, i: number, total: number, serie: string, dir: string, logo: string, o: { largo?: boolean; capitulo?: { n: number; nombre: string } } = {}) {
  const sharp = require("sharp")
  const L = o.largo ? LIENZO.largo : LIENZO.corto
  const p = paginaEscena(e, i, total, serie, { fuentes: carpetaFuentes(), logo, largo: o.largo, capitulo: o.capitulo })
  const html = path.join(dir, `e${i}.html`)
  fs.writeFileSync(html, p.html)
  const alto = p.hojas * L.h
  const todo = path.join(dir, `e${i}-todo.png`)
  await capturar(html, alto, todo, L.w)
  const pngs: string[] = []
  for (let k = 0; k < p.hojas; k++) {
    const f = path.join(dir, `e${i}-${k}.png`)
    await sharp(todo).extract({ left: 0, top: k * L.h, width: L.w, height: L.h }).png().toFile(f)
    pngs.push(f)
  }
  const nc = p.tiempos.length
  return { base: pngs[0], capas: pngs.slice(1, 1 + nc).map((png, k) => ({ png, t: p.tiempos[k] })), subs: pngs.slice(1 + nc) }
}

// ---------------------------------------------------------------------
// Fotos: producto real de la tienda → foto con IA (FLUX, ~0.05 USD) → biblioteca
// ---------------------------------------------------------------------

const FOTOS_IA = () => Number(process.env.EXPLICATIVO_FOTOS_IA ?? 3)
const USD_FOTO = 0.05

// Palabras que casi cualquier producto trae: con ellas salía un producto al azar
// ("Plantilla CNC para…" en un video sobre cómo cobrar)
const GENERICAS = new Set("cnc pieza piezas taller talleres diseño diseños maquina máquina archivo archivos corte cortes router laser láser plantilla kit hetna herramienta herramientas producto productos".split(" "))
export const palabraProducto = (palabra: string) => {
  const p = String(palabra || "").trim().toLowerCase()
  return p.length >= 3 && !GENERICAS.has(p) ? p : ""
}

async function productoDeTienda(knex: any, palabra: string, usados: Set<string>) {
  const p = palabraProducto(palabra)
  if (!p) return null
  // Sólo por el nombre (la descripción traía coincidencias que no tenían que ver) y sin repetir en el mismo video
  const filas = await knex("product").whereNull("deleted_at").where({ status: "published" }).whereNotNull("thumbnail")
    .whereILike("title", `%${p}%`).orderByRaw("random()").limit(5).select("id", "title", "thumbnail").catch(() => [])
  return filas.find((f: any) => !usados.has(f.id)) || null
}

/** Pie de foto del producto: el nombre completo si cabe; si no, cortado en una palabra que no deje la frase colgando. Pura. */
export function pieProducto(titulo: string, max = 52) {
  const limpio = String(titulo || "").replace(/\s+/g, " ").trim()
  const t = `En la tienda: ${limpio}`
  if (t.length <= max) return t
  let corto = t.slice(0, max).replace(/\s+\S*$/, "")
  corto = corto.replace(/(\s+(para|de|del|con|y|en|a|la|el|los|las|por|sin|tu))+$/i, "")
  return `${corto}…`
}

/** Pone foto_archivo / foto_pie / foto_ia a cada escena foto (o la vuelve lista si no hubo foto). Regresa el costo. */
export async function resolverFotos(knex: any, g: any, dir: string, logger?: any) {
  let costo = 0
  let ia = 0
  const usados = new Set<string>()
  for (const [i, e] of g.escenas.entries()) {
    if (e.tipo !== "foto") continue
    const archivo = path.join(dir, `foto${i}.jpg`)
    try {
      const prod = await productoDeTienda(knex, e.producto, usados)
      if (prod?.thumbnail) {
        await bajarImagen(prod.thumbnail, archivo)
        usados.add(prod.id)
        e.foto_archivo = archivo
        e.foto_pie = pieProducto(prod.title)
        continue
      }
      if (e.foto && ia < FOTOS_IA()) {
        const out = await require("./fal").fal(process.env.ESTUDIO_MODELO_IMAGEN || "fal-ai/flux-pro/v1.1", {
          prompt: `${e.foto}. Realistic photo, small CNC workshop in Mexico, natural light, sharp detail, 35mm. No text, no letters, no logos, no watermarks.`,
          image_size: { width: 1024, height: 832 }, num_images: 1, output_format: "jpeg",
        }, 5)
        ia++
        costo += USD_FOTO
        const url = out?.images?.[0]?.url
        if (url) {
          await bajarImagen(url, archivo)
          e.foto_archivo = archivo
          e.foto_pie = e.etiqueta ? corta(e.etiqueta.charAt(0) + e.etiqueta.slice(1).toLowerCase(), 46) : ""
          e.foto_ia = true
          continue
        }
      }
      const { fondoDe, temaDe } = require("./index")
      const fondo = await fondoDe(knex, temaDe(`${g.tema} ${e.titulo} ${e.titulo_naranja}`)).catch(() => null)
      if (fondo) {
        await bajarImagen(fondo, archivo)
        e.foto_archivo = archivo
        e.foto_pie = e.etiqueta ? corta(e.etiqueta.charAt(0) + e.etiqueta.slice(1).toLowerCase(), 46) : ""
        continue
      }
    } catch (err) {
      logger?.warn?.(`[explicativo] foto ${i}: ${(err as Error).message}`)
    }
  }
  // Escenas foto sin foto: lista si tienen puntos; si no, se quitan (el cierre siempre queda)
  g.escenas = g.escenas.map((e: any) => (e.tipo === "foto" && !e.foto_archivo ? (e.puntos.length >= 2 ? { ...e, tipo: "lista" } : null) : e)).filter(Boolean)
  return costo
}

async function bajarImagen(url: string, archivo: string) {
  const r = await fetch(url, { signal: AbortSignal.timeout(60_000) })
  if (!r.ok) throw new Error(`No se pudo bajar la foto (${r.status})`)
  const sharp = require("sharp")
  // Se normaliza a JPG de 1024 px (algunas fotos de la tienda vienen en WebP o muy pesadas)
  await sharp(Buffer.from(await r.arrayBuffer())).rotate().resize({ width: 1024, height: 832, fit: "cover" }).jpeg({ quality: 88 }).toFile(archivo)
}

// ---------------------------------------------------------------------
// 2. Voz (una frase a la vez)
// ---------------------------------------------------------------------

export function duracion(f: string) {
  const r = spawnSync(ffmpegBin().replace(/ffmpeg$/, "ffprobe"), ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" })
  return Number(String(r.stdout || "").trim()) || 0
}

async function bajar(url: string, archivo: string) {
  const r = await fetch(url, { signal: AbortSignal.timeout(120_000) })
  if (!r.ok) throw new Error(`No se pudo bajar la voz (${r.status})`)
  fs.writeFileSync(archivo, Buffer.from(await r.arrayBuffer()))
}

async function voces(g: any, dir: string) {
  const { vozEscena } = require("./estudio")
  const { paraVoz } = require("./hyperframes")
  const lista = g.escenas.flatMap((e: any, i: number) => e.frases.map((f: string, k: number) => ({ i, k, texto: paraVoz(sinMarcas(f)) })))
  const out: string[][] = g.escenas.map(() => [])
  let costo = 0
  for (let a = 0; a < lista.length; a += 4) {
    await Promise.all(lista.slice(a, a + 4).map(async (x: any) => {
      const v = await vozEscena(x.texto, VOZ_EXPLICATIVO(), Number(process.env.EXPLICATIVO_VELOCIDAD || 1))
      const f = path.join(dir, `v${x.i}-${x.k}.mp3`)
      await bajar(v.url, f)
      out[x.i][x.k] = f
      costo += v.costo
    }))
  }
  return { voces: out, costo }
}

// ---------------------------------------------------------------------
// Tiempos (puros): cuándo entra cada frase y cuánto dura cada escena
// ---------------------------------------------------------------------

/**
 * dvoz[i] = duraciones de las voces de la escena i. Si una escena trae menos
 * voces que frases (una sola voz para dos frases), los subtítulos se reparten
 * por largo del texto. Si el total queda abajo de `min`, se alargan las pausas.
 */
export function tiempos(escenas: any[], dvoz: number[][], min = MIN_SEG) {
  const r = escenas.map((e: any, i: number) => {
    const d = dvoz[i] || []
    let inicios: number[] = []
    let habla = 0
    if (d.length >= e.frases.length) {
      let t = 0
      for (let k = 0; k < e.frases.length; k++) { inicios.push(+t.toFixed(2)); t += d[k] + (k < e.frases.length - 1 ? ENTRE_FRASES : 0) }
      habla = t
    } else {
      habla = d.reduce((a: number, b: number) => a + b, 0)
      const largos = e.frases.map((f: string) => sinMarcas(f).length)
      const tot = largos.reduce((a: number, b: number) => a + b, 0) || 1
      let acc = 0
      inicios = largos.map((l: number) => { const s = +(habla * acc / tot).toFixed(2); acc += l; return s })
    }
    return { inicios, habla, dur: habla + PAUSA + (i === escenas.length - 1 ? 0.6 : 0) }
  })
  const total = r.reduce((a, x) => a + x.dur, 0)
  if (total < min && r.length) {
    const extra = Math.min(1.6, (min - total) / r.length)
    for (const x of r) x.dur += extra
  }
  for (const x of r) x.dur = +x.dur.toFixed(2)
  return r
}

// ---------------------------------------------------------------------
// 4. Armado (port del prototipo aprobado)
// ---------------------------------------------------------------------

async function armarEscena(esc: any, vocesEscena: string[], t: any, salida: string, largo = false) {
  const L = largo ? LIENZO.largo : LIENZO.corto
  const dur = t.dur
  const habla = Math.max(t.habla, 0.5)
  const ins = ["-loop", "1", "-t", String(dur), "-i", esc.base]
  const fc = [`[0:v]format=yuv420p,fps=${FPS},zoompan=z='1+0.018*on/${Math.round(dur * FPS)}':d=1:x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':s=${L.w}x${L.h}:fps=${FPS}[b]`]
  let actual = "b"
  let k = 1
  esc.capas.forEach((c: any, j: number) => {
    const t0 = +(c.t * habla).toFixed(2)
    ins.push("-loop", "1", "-t", String(dur), "-i", c.png)
    fc.push(`[${k}:v]format=rgba,fade=in:st=${t0}:d=0.28:alpha=1[c${j}]`)
    fc.push(`[${actual}][c${j}]overlay=0:'if(lt(t,${t0}+0.35),max(0,1-(t-${t0})/0.35)*45,0)'[o${j}]`)
    actual = `o${j}`
    k++
  })
  esc.subs.forEach((png: string, j: number) => {
    const t0 = t.inicios[j] ?? 0
    const t1 = j + 1 < esc.subs.length ? t.inicios[j + 1] : dur + 1
    ins.push("-loop", "1", "-t", String(dur), "-i", png)
    fc.push(`[${k}:v]format=rgba,fade=in:st=${t0}:d=0.15:alpha=1[s${j}]`)
    fc.push(`[${actual}][s${j}]overlay=0:0:enable='between(t,${t0},${(t1 - 0.01).toFixed(2)})'[p${j}]`)
    actual = `p${j}`
    k++
  })
  fc.push(`[${actual}]format=yuv420p,trim=duration=${dur}[vv]`)
  // Voces en su lugar (si una escena trae una sola voz para dos frases, empieza en 0)
  const mezcla: string[] = []
  vocesEscena.forEach((v: string, j: number) => {
    ins.push("-i", v)
    const ms = Math.round((vocesEscena.length >= esc.subs.length ? t.inicios[j] || 0 : 0) * 1000)
    fc.push(`[${k}:a]aresample=48000,aformat=channel_layouts=mono,adelay=${ms}[a${j}]`)
    mezcla.push(`[a${j}]`)
    k++
  })
  if (mezcla.length) fc.push(`${mezcla.join("")}amix=inputs=${mezcla.length}:normalize=0,apad=whole_dur=${dur},atrim=duration=${dur}[aa]`)
  else fc.push(`anullsrc=r=48000:cl=mono,atrim=duration=${dur}[aa]`)
  await correr([...ins, "-filter_complex", fc.join(";"), "-map", "[vv]", "-map", "[aa]", "-t", String(dur),
    // El largo son ~30 escenas: preset más rápido para no ocupar el servidor de la tienda por una hora
    "-c:v", "libx264", "-crf", largo ? "20" : "18", "-preset", largo ? "veryfast" : "medium", "-r", String(FPS), "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "48000", "-ac", "2", salida], 10 * 60_000)
}

/**
 * Del guion (y voces ya hechas) al MP4. `voces[i]` = archivos de voz de la escena i.
 * Se puede llamar sin IA ni gasto (con voces de prueba) para revisar el diseño.
 */
export async function producirExplicativo(g: any, vocesArchivos: string[][], dir: string) {
  const largo = g.formato === "largo"
  const logoPng = path.resolve(carpetaFuentes(), "..", "marca", "logo-hetna.png")
  const logo = `data:image/png;base64,${fs.readFileSync(logoPng).toString("base64")}`
  const dvoz = vocesArchivos.map((vs) => (vs || []).filter(Boolean).map(duracion))
  // El largo no se rellena con pausas: su duración la da el guion
  const tt = tiempos(g.escenas, dvoz, largo ? 0 : MIN_SEG)
  const caps = numerarCapitulos(g.escenas)
  const partes: string[] = []
  for (const [i, e] of g.escenas.entries()) {
    const capas = await dibujarEscena(e, i, g.escenas.length, g.serie, dir, logo, { largo, capitulo: caps[i] })
    const out = path.join(dir, `esc${i}.mp4`)
    await armarEscena(capas, (vocesArchivos[i] || []).filter(Boolean), tt[i], out, largo)
    partes.push(out)
    for (const f of [capas.base, ...capas.capas.map((c: any) => c.png), ...capas.subs, path.join(dir, `e${i}-todo.png`)]) fs.rmSync(f, { force: true })
  }
  const lista = path.join(dir, "lista.txt")
  fs.writeFileSync(lista, partes.map((p) => `file '${p}'\n`).join(""))
  const unido = path.join(dir, "unido.mp4")
  await correr(["-f", "concat", "-safe", "0", "-i", lista, "-c", "copy", unido])
  const whoosh = path.join(dir, "whoosh.wav")
  await correr(["-f", "lavfi", "-i", "anoisesrc=d=0.4:c=pink:a=0.6", "-af", "highpass=f=700,lowpass=f=4500,afade=t=in:d=0.15,afade=t=out:st=0.15:d=0.25,volume=0.3", "-ar", "48000", "-ac", "2", whoosh])
  const cortes: number[] = []
  let t = 0
  for (const x of tt.slice(0, -1)) { t += x.dur; cortes.push(t) }
  const total = t + tt[tt.length - 1].dur
  const ins = ["-i", unido]
  const fc: string[] = []
  cortes.forEach((c, i) => {
    ins.push("-i", whoosh)
    const ms = Math.round(Math.max(c - 0.18, 0) * 1000)
    fc.push(`[${i + 1}:a]adelay=${ms}|${ms}[w${i}]`)
  })
  fc.push(`[0:a]${cortes.map((_, i) => `[w${i}]`).join("")}amix=inputs=${cortes.length + 1}:normalize=0,afade=t=out:st=${(total - 0.5).toFixed(2)}:d=0.5,loudnorm=I=-15:TP=-1.5[a]`)
  const final = path.join(dir, "final.mp4")
  // El video ya está codificado: sólo se mezcla el audio (no se vuelve a codificar la imagen)
  await correr([...ins, "-filter_complex", fc.join(";"), "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-movflags", "+faststart", final], 10 * 60_000)
  // Capítulos para la descripción de YouTube (inicio de la primera escena de cada uno)
  let acc = 0
  const inicios = tt.map((x) => { const a = acc; acc += x.dur; return a })
  const capitulos = largo ? capitulosYoutube(g.escenas.map((e: any, i: number) => ({ nombre: caps[i]?.nombre || "", inicio: inicios[i] })), total) : []
  return { archivo: final, segundos: +total.toFixed(1), capitulos }
}

/** Número y nombre del capítulo de cada escena (cambia cuando cambia el nombre). Pura. */
export function numerarCapitulos(escenas: any[]): ({ n: number; nombre: string } | undefined)[] {
  let n = 0
  let previo = ""
  return escenas.map((e) => {
    const nombre = String(e?.capitulo || "").trim()
    if (!nombre) return undefined
    if (nombre !== previo) { n++; previo = nombre }
    return { n, nombre }
  })
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`
/**
 * Capítulos con las reglas de YouTube: el primero en 0:00, al menos 3 y cada uno de 10 s
 * o más (los muy cortos se juntan con el anterior). Si no se cumplen, no se ponen. Pura.
 */
export function capitulosYoutube(escenas: { nombre: string; inicio: number }[], total: number): string[] {
  const caps: { nombre: string; inicio: number }[] = []
  for (const e of escenas) {
    if (!e.nombre || caps[caps.length - 1]?.nombre === e.nombre) continue
    caps.push({ nombre: e.nombre, inicio: caps.length ? e.inicio : 0 })
  }
  // Se queda un capítulo sólo si el anterior ya duró 10 s; el último también debe durar 10 s
  const buenos: { nombre: string; inicio: number }[] = []
  for (const c of caps) if (!buenos.length || c.inicio - buenos[buenos.length - 1].inicio >= 10) buenos.push(c)
  if (buenos.length > 1 && total - buenos[buenos.length - 1].inicio < 10) buenos.pop()
  return buenos.length >= 3 ? buenos.map((c) => `${mmss(c.inicio)} ${c.nombre}`) : []
}

// ---------------------------------------------------------------------
// La cadena completa: guion → voz → video → borrador en el Social Hub
// ---------------------------------------------------------------------

export function textosRedes(g: any) {
  const tags = (g.hashtags || []).slice(0, 5).map((h: string) => `#${h}`).join(" ")
  const capitulos = (g.capitulos || []).length ? `\n\nCapítulos:\n${g.capitulos.join("\n")}` : ""
  return {
    youtube: `${g.titulo_seo}\n${g.descripcion}${capitulos}\n\n${tags}`,
    facebook: `${g.titulo_seo}\n\n${g.descripcion}`,
    instagram: `${g.titulo_seo}\n\n${String(g.descripcion).replace(/\{\{liga\}\}/g, "liga en el perfil")}\n\n${tags}`,
    tiktok: `${g.titulo_seo} ${tags}`,
  }
}

/** Crea el BORRADOR en el Social Hub (nunca programado: lo apruebas tú) y lo manda a Telegram. */
export async function borradorExplicativo(knex: any, f: { id: string; guion: any; video_url: string; miniatura?: string | null }, logger?: any) {
  const g = f.guion
  const largo = g.formato === "largo"
  const textos = textosRedes(g)
  const post = await crearPublicacion(knex, {
    origen: "manual", fuente: "estudio", titulo: `${largo ? "🎬 YouTube largo" : "📐 Explicativo"} · ${g.tema}`, texto_base: textos.facebook,
    textos, url: `${STORE_URL}/mx`,
    // El horizontal no sirve para Reels, TikTok ni Shorts: sólo YouTube (video normal) y Facebook
    redes: largo ? ["youtube", "facebook"] : ["youtube", "instagram", "tiktok", "facebook"],
    medios: [{ url: f.video_url, tipo: "video", ...(largo ? { formato: "horizontal" } : {}) }],
    estado: "borrador", mercado: "mx",
  } as any, logger)
  await knex("hetna_estudio").where({ id: f.id }).update({ estado: "listo", post_id: post, error: null, updated_at: new Date() })
  try {
    const { mandarPrivado } = require("../social-telegram")
    const dur = g.segundos ? ` (${mmss(g.segundos)} min)` : ""
    await mandarPrivado(knex, {
      texto: largo
        ? `🎬 Video largo para YouTube listo para revisar${dur}\n«${g.titulo_seo}»\n\nQuedó en Pendientes del Social Hub.${f.miniatura ? `\nMiniatura sugerida: ${f.miniatura}` : ""}`
        : `📐 Video explicativo listo para revisar\n«${g.titulo_seo}»\n\nQuedó en Pendientes del Social Hub. Si te gusta, apruébalo ahí.`,
      video: f.video_url, post,
    })
  } catch {}
  return { post }
}

export async function hacerExplicativo(scope: any, logger?: any, o: { forzar?: boolean; tema?: string; largo?: boolean } = {}) {
  const tipo = o.largo ? "explicativo_largo" : "explicativo"
  const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const est = require("./estudio")
  await est.asegurarEstudio(knex)
  if (!explicativoListo()) return { hecho: false, motivo: "Falta FAL_KEY, la IA, FFmpeg o Chrome en el servidor" }
  if (est.VUELTA.activa) return { hecho: false, motivo: "Ya se está haciendo un video" }
  if (!o.forzar) {
    if (o.largo) {
      // El largo es semanal: si ya hay uno de los últimos 6 días, no se hace otro
      if (await knex("hetna_estudio").where({ tipo }).whereIn("estado", ["listo", "haciendo"]).where("created_at", ">", new Date(Date.now() - 6 * 86_400_000)).first()) return { hecho: false, motivo: "Ya se hizo el video largo de esta semana" }
    } else if (await knex("hetna_estudio").where({ tipo, dia: est.diaMx() }).whereIn("estado", ["listo", "haciendo"]).first()) return { hecho: false, motivo: "Ya se hizo el explicativo de hoy" }
    const ult = await knex("hetna_estudio").where({ tipo }).orderBy("created_at", "desc").limit(2).pluck("estado")
    if (ult.length === 2 && ult.every((x: string) => x === "error")) return { hecho: false, motivo: "Los dos últimos explicativos fallaron: el automático se detuvo. Revisa el error y aprieta el botón." }
  }
  est.VUELTA.activa = true
  const id = nuevoId("estudio")
  await knex("hetna_estudio").insert({ id, dia: est.diaMx(), tipo, estado: "haciendo" })
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hetna-explicativo-"))
  let costo = 0
  try {
    const g = await guionExplicativo(knex, o.tema, !!o.largo)
    await knex("hetna_estudio").where({ id }).update({ guion: JSON.stringify(g), updated_at: new Date() })
    logger?.info?.(`[explicativo] guion: ${g.tema} (${g.palabras} palabras, ${g.escenas.length} escenas)`)
    // Fotos antes de la voz: si una escena foto se queda sin foto, se quita y no se paga su voz
    costo += await resolverFotos(knex, g, dir, logger)
    const v = await voces(g, dir)
    costo += v.costo
    await knex("hetna_estudio").where({ id }).update({ costo_usd: costo, updated_at: new Date() })
    const r = await producirExplicativo(g, v.voces, dir)
    const url = await require("./index").subir(scope, `estudio-${id}.mp4`, "video/mp4", fs.readFileSync(r.archivo))
    g.segundos = r.segundos
    g.capitulos = r.capitulos
    // Miniatura sugerida para YouTube: el cuadro del gancho (segundo 2.5)
    let miniatura: string | null = null
    if (o.largo) {
      try {
        const jpg = path.join(dir, "miniatura.jpg")
        await correr(["-ss", "2.5", "-i", r.archivo, "-frames:v", "1", "-q:v", "2", jpg])
        miniatura = await require("./index").subir(scope, `estudio-${id}-miniatura.jpg`, "image/jpeg", fs.readFileSync(jpg))
        g.miniatura = miniatura
      } catch {}
    }
    // Se guarda antes de crear el borrador: si algo falla después, no se pierde
    await knex("hetna_estudio").where({ id }).update({ guion: JSON.stringify(g), video_url: url, costo_usd: costo, updated_at: new Date() })
    const { post } = await borradorExplicativo(knex, { id, guion: g, video_url: url, miniatura }, logger)
    logger?.info?.(`[explicativo] listo: ${g.tema} · ${r.segundos} s · ${costo.toFixed(2)} USD`)
    return { hecho: true, id, tema: g.tema, segundos: r.segundos, costo_usd: +costo.toFixed(2), post }
  } catch (e) {
    await knex("hetna_estudio").where({ id }).update({ estado: "error", costo_usd: costo, error: (e as Error).message.slice(0, 500), updated_at: new Date() })
    try {
      const { mandarPrivado } = require("../social-telegram")
      await mandarPrivado(knex, { texto: `⚠️ El video explicativo falló: ${(e as Error).message.slice(0, 300)}` })
    } catch {}
    logger?.warn?.(`[explicativo] ${(e as Error).message}`)
    return { hecho: false, motivo: (e as Error).message }
  } finally {
    est.VUELTA.activa = false
    fs.rmSync(dir, { recursive: true, force: true })
  }
}
