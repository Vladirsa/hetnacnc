// @ts-nocheck
// Marketing HETNA — promotor automático de la tienda, el blog y las herramientas.
// Cada día hace imagen + video (con voz si RunPod está listo) de:
//   - un producto de la tienda (nuevos primero; no se repite en 45 días)
//   - martes y viernes: un artículo de Aprendizaje CNC (carrusel + video)
//   - lunes y jueves: una herramienta del sitio (calculadora, cotizador,
//     estudio de diseño, laboratorio CAM, ranking, licitaciones)
// Salen como borradores o programadas según Configuración ("Promociones").
// Sólo datos reales: título, descripción y fotos del producto o del artículo.
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { STORE_URL, nuevoId } from "../licitacion"
import { T_POST, asegurarSocial, crearPublicacion, dentroDeHorario, leerConfig, ligaPara, urlCorta, zonaDe } from "../social-hub"
import { fondoDe, musicaAlAzar, subir, temaDe } from "./index"
import { limpiar, oraciones, palabras } from "./plan-material"
import { cuadroVideo, lamina, tarjeta, carpetaFuentes } from "./render"
import { VOZ, correr, idiomaDe, ligasB2, runpodListo } from "./runpod"
import { corto, ffmpegDisponible, segundosPara } from "./video"

export const T_PROMO = "hetna_promo"
const IMG = (f: string) => `${STORE_URL}/img/herramientas/${f}`

export type Herramienta = { clave: string; nombre: string; ruta: string; imagen: string | null; tema: string; publico: string; gancho: string; frases: string[]; cta: string; texto: string }
export const HERRAMIENTAS: Herramienta[] = [
  {
    clave: "calculadora", nombre: "Calculadora CNC", ruta: "/mx/calculadora-cnc", imagen: IMG("calculadora-router.jpg"), tema: "router", publico: "talleres",
    gancho: "¿Qué RPM y avance le pongo?", frases: ["Calculadora CNC gratis", "Router, láser, fibra, plasma e impresión 3D", "Revisa la potencia y la flexión de tu fresa"], cta: "Úsala gratis en HETNA",
    texto: "¿Dudas con las RPM, el avance o la potencia? La calculadora CNC de HETNA es gratis: router y fresadora, láser CO₂, fibra, plasma e impresión 3D, con tu máquina guardada.",
  },
  {
    clave: "calculadora_laser", nombre: "Calculadora láser", ruta: "/mx/calculadora-cnc", imagen: IMG("calculadora-laser.jpg"), tema: "laser", publico: "talleres",
    gancho: "Velocidad y potencia de tu láser", frases: ["Del K40 al tubo de 300 W", "Velocidad, potencia, foco y kerf", "Gratis y desde el celular"], cta: "Calcula gratis en HETNA",
    texto: "Velocidad, potencia, foco y kerf para tu láser CO₂, del K40 al tubo de 300 W. Gratis en la calculadora CNC de HETNA.",
  },
  {
    clave: "cotizador", nombre: "HETNA Cotizador", ruta: "/mx/herramientas-cnc", imagen: IMG("cotizador-precio.jpg"), tema: "laser", publico: "talleres",
    gancho: "Cotiza en segundos con tu DXF", frases: ["Lee el largo de corte y las perforaciones", "Tres precios con tus costos", "Lo mandas por WhatsApp y PDF"], cta: "Pruébalo en HETNA",
    texto: "Sube el DXF y la app HETNA Cotizador mide el corte, calcula tres precios con tus costos y se lo manda a tu cliente por WhatsApp y PDF.",
  },
  {
    clave: "cotizador_whatsapp", nombre: "Cotización por WhatsApp", ruta: "/mx/herramientas-cnc", imagen: IMG("cotizador-whatsapp.jpg"), tema: "taller", publico: "talleres",
    gancho: "Tu cliente pide precio por WhatsApp", frases: ["Respóndele con una cotización en PDF", "Con tu marca y tus tarifas", "Y todo queda en tu historial"], cta: "Conoce el cotizador",
    texto: "Cuando el cliente pide precio por WhatsApp, respóndele con una cotización en PDF con tu marca y tus tarifas. Todo queda guardado en tu historial.",
  },
  {
    clave: "disenar", nombre: "Estudio de diseño", ruta: "/mx/disenar", imagen: null, tema: "router", publico: "clientes_particulares",
    gancho: "Diseña para CNC gratis", frases: ["De imagen a 3D", "Cajas, vectores y piezas 2D", "Listo para cortar o imprimir"], cta: "Diseña gratis en HETNA",
    texto: "HETNA 3D Studio y 2D Studio: pasa una imagen a 3D, arma cajas, vectoriza y prepara tus piezas para cortar o imprimir. Gratis en el navegador.",
  },
  {
    clave: "cam", nombre: "Laboratorio CAM", ruta: "/mx/laboratorio-cam", imagen: null, tema: "torno", publico: "talleres",
    gancho: "Simula tu G-code antes de cortar", frases: ["Trayectorias de 3 a 5 ejes", "Revisa colisiones y tiempo", "G-code para Mach3, GRBL, LinuxCNC o Fanuc"], cta: "Pruébalo gratis",
    texto: "Simula trayectorias de 3 a 5 ejes, revisa colisiones y tiempo y descarga G-code para Mach3, GRBL, LinuxCNC o Fanuc. Gratis en el Laboratorio CAM de HETNA.",
  },
  {
    clave: "ranking", nombre: "Ranking de talleres", ruta: "/mx/talleres/ranking", imagen: null, tema: "taller", publico: "clientes_empresa",
    gancho: "¿Qué taller CNC es confiable?", frases: ["Ranking con evaluaciones reales", "Por especialidad y estado", "Talleres verificados y certificados"], cta: "Ve el ranking",
    texto: "El ranking de talleres CNC de HETNA se arma con evaluaciones reales de clientes. Filtra por especialidad y estado y encuentra talleres verificados.",
  },
  {
    clave: "licitaciones", nombre: "Licitaciones sin comisión", ruta: "/mx/cotizar", imagen: null, tema: "lamina", publico: "clientes_empresa",
    gancho: "Varios talleres cotizan tu pieza", frases: ["Publica tu solicitud gratis", "Compara propuestas", "Sin comisión"], cta: "Pide cotización",
    texto: "Publica tu pieza en HETNA y recibe propuestas de varios talleres CNC. Compara y elige: sin comisión.",
  },
]

let listo = false
async function asegurarPromo(knex: any) {
  if (listo) return
  await asegurarSocial(knex)
  if (!(await knex.schema.hasTable(T_PROMO))) {
    await knex.schema.createTable(T_PROMO, (t: any) => {
      t.text("id").primary()
      t.text("tipo").notNullable() // producto | blog | herramienta
      t.text("ref").notNullable()
      t.jsonb("posts")
      t.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now())
      t.index(["tipo", "ref"])
    })
  }
  listo = true
}

/** Voz de RunPod para una lista de frases (null si no hay RunPod o falla: el video sale sin voz). */
export async function vozPara(nombre: string, frases: string[], mercado: string, logger?: any) {
  if (!runpodListo()) return null
  try {
    const idioma = idiomaDe(mercado)
    const out = await correr({ tarea: "voz", voz: VOZ(idioma, "hombre"), idioma, lotes: [{ frases, clave: `fabrica/promo/${nombre}-voz.wav` }] }, { logger, topeMin: 15 })
    const l = out.lotes?.[0]
    return l ? { ...l, url: (await ligasB2([l.clave], 7200))[0] } : null
  } catch (e) {
    logger?.warn?.(`[promo] voz: ${(e as Error).message}`)
    return null
  }
}

export async function cuandoPromo(knex: any, horas: number, mercado = "mx") {
  return cuando(knex, horas, mercado)
}

/** Corto 9:16 con fotos propias (producto, portada o captura) y voz si se puede. */
async function videoCon(scope: any, nombre: string, d: { gancho: string; frases: string[]; cierre: string; fotos: (string | null)[]; tema: string; liga: string; mercado: string }, logger?: any) {
  if (!ffmpegDisponible()) return null
  const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const frases = d.frases.slice(0, 3)
  let voz: any = null
  if (runpodListo()) {
    try {
      const idioma = idiomaDe(d.mercado)
      const out = await correr({ tarea: "voz", voz: VOZ(idioma, "hombre"), idioma, lotes: [{ frases: [d.gancho, ...frases, d.cierre], clave: `fabrica/promo/${nombre}-voz.wav` }] }, { logger, topeMin: 15 })
      const l = out.lotes?.[0]
      if (l) voz = { ...l, url: (await ligasB2([l.clave], 7200))[0] }
    } catch (e) {
      logger?.warn?.(`[promo] voz: ${(e as Error).message}`)
    }
  }
  const foto = async (k: number) => d.fotos[k % Math.max(1, d.fotos.length)] || (await fondoDe(knex, d.tema))
  const dur = (k: number, porOmision: number) => (voz?.duraciones?.[k] ? Math.max(1.2, voz.duraciones[k] + 0.15) : porOmision)
  const escenas = [{ png: await cuadroVideo({ tipo: "gancho", texto: d.gancho, tema: d.tema, foto_url: await foto(0), semilla: 1 }), segundos: dur(0, 2.4) }]
  for (const [k, f] of frases.entries()) escenas.push({ png: await cuadroVideo({ tipo: "frase", texto: f, tema: d.tema, foto_url: await foto(k + 1), semilla: k + 2, sinTexto: true }), segundos: dur(k + 1, segundosPara(f)), subtitulo: f })
  escenas.push({ png: await cuadroVideo({ tipo: "cierre", texto: d.cierre, tema: d.tema, liga: d.liga }), segundos: dur(frases.length + 1, 2.6) })
  const v = await corto(escenas, { fuentes: carpetaFuentes(), musica: await musicaAlAzar(knex), voz: voz?.url || null })
  return subir(scope, `${nombre}.mp4`, "video/mp4", v.buf)
}

async function cuando(knex: any, horas: number, mercado = "mx") {
  const cfg = await leerConfig(knex)
  return { estado: cfg.automatico.promociones ? "programada" : "borrador", fecha: dentroDeHorario(new Date(Date.now() + horas * 3600_000), cfg.horario, zonaDe(mercado)) }
}

/** Arma imagen + video de un tema y deja dos publicaciones. */
async function publicarPar(scope: any, d: { tipo: string; ref: string; titulo: string; texto: string; url: string; tema: string; cinta: string; cta: string; producto_url?: string | null; fotos: (string | null)[]; gancho: string; frases: string[]; carrusel?: { titulo: string; puntos: string[]; portada?: string | null } }, logger?: any) {
  const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const c1 = await cuando(knex, 2)
  const posts: string[] = []
  // 1) Imagen (tarjeta) o carrusel
  const p1 = await crearPublicacion(knex, { origen: "manual", fuente: "promo", titulo: `Promo · ${d.titulo}`, texto_base: d.texto, url: d.url, redes: d.carrusel ? ["instagram", "facebook", "linkedin"] : ["facebook", "instagram", "telegram"], estado: c1.estado, programada_para: c1.fecha, mercado: "mx" }, logger)
  const liga1 = urlCorta(await ligaPara(knex, p1, "facebook", d.url))
  let medios: any[]
  if (d.carrusel) {
    const total = d.carrusel.puntos.length + 2
    const urls = [await subir(scope, `promo-${p1}-1.png`, "image/png", await lamina({ num: 1, total, titulo: d.carrusel.titulo, portada: true, tema: d.tema, foto_url: d.carrusel.portada || (await fondoDe(knex, d.tema)) }))]
    for (const [k, pt] of d.carrusel.puntos.entries()) urls.push(await subir(scope, `promo-${p1}-${k + 2}.png`, "image/png", await lamina({ num: k + 2, total, titulo: pt, tema: d.tema })))
    urls.push(await subir(scope, `promo-${p1}-${total}.png`, "image/png", await lamina({ num: total, total, titulo: d.cta, cierre: { cta: d.cta, liga_texto: "liga en el perfil" }, tema: d.tema, foto_url: await fondoDe(knex, d.tema) })))
    medios = urls.map((url) => ({ url, tipo: "imagen" }))
  } else {
    const png = await tarjeta({ tema: d.tema, foto_url: d.producto_url ? await fondoDe(knex, d.tema) : d.fotos[0] || (await fondoDe(knex, d.tema)), producto_url: d.producto_url || null, cinta: { texto: d.cinta, tono: d.tipo === "producto" ? "verde" : "naranja" }, titulo: palabras(d.titulo, 10), cta: d.cta, liga: liga1 })
    medios = [{ url: await subir(scope, `promo-${p1}.png`, "image/png", png), tipo: "imagen" }]
  }
  await knex(T_POST).where({ id: p1 }).update({ medios: JSON.stringify(medios) })
  posts.push(p1)
  // 2) Video vertical (Reels, TikTok, Shorts) al día siguiente
  if (ffmpegDisponible()) {
    const c2 = await cuando(knex, 26)
    const p2 = await crearPublicacion(knex, { origen: "manual", fuente: "promo", titulo: `Promo video · ${d.titulo}`, texto_base: d.texto, url: d.url, redes: ["instagram", "instagram_historia", "facebook", "tiktok", "youtube"], estado: c2.estado, programada_para: c2.fecha, mercado: "mx" }, logger)
    const liga2 = urlCorta(await ligaPara(knex, p2, "instagram", d.url))
    const v = await videoCon(scope, `promo-${p2}`, { gancho: d.gancho, frases: d.frases, cierre: d.cta, fotos: d.fotos, tema: d.tema, liga: liga2, mercado: "mx" }, logger)
    if (v) await knex(T_POST).where({ id: p2 }).update({ medios: JSON.stringify([{ url: v, tipo: "video" }]) })
    posts.push(p2)
  }
  await knex(T_PROMO).insert({ id: nuevoId("promo"), tipo: d.tipo, ref: d.ref, posts: JSON.stringify(posts) })
  return posts
}

const yaPromovidos = (knex: any, tipo: string, dias: number) => knex(T_PROMO).where({ tipo }).where("created_at", ">=", knex.raw(`now() - (? || ' days')::interval`, [String(dias)])).select("ref")

export async function promoProducto(scope: any, logger?: any) {
  const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await asegurarPromo(knex)
  const p = await knex("product").whereNull("deleted_at").where({ status: "published" }).whereNotNull("thumbnail").whereNotIn("id", yaPromovidos(knex, "producto", 45)).orderBy("created_at", "desc").first("id", "title", "handle", "thumbnail", "description")
  if (!p) return null
  const imgs = await knex("image").where({ product_id: p.id }).whereNull("deleted_at").orderBy("rank").limit(4).pluck("url").catch(() => [])
  const fotos = [...new Set([p.thumbnail, ...imgs])].filter((u) => /^https:\/\//.test(String(u)))
  const desc = limpiar(String(p.description || "").replace(/<[^>]+>/g, " "))
  const ors = oraciones(desc)
  return publicarPar(scope, {
    tipo: "producto", ref: p.id, titulo: p.title, url: `${STORE_URL}/mx/products/${p.handle}`, tema: temaDe(`${p.title} ${desc}`),
    texto: `${p.title}${ors[0] ? `\n\n${ors.slice(0, 2).join(" ")}` : ""}\n\nVelo en la tienda HETNA: {{liga}}`,
    cinta: "En la tienda HETNA", cta: "Cómpralo en HETNA", producto_url: fotos[0] || null, fotos,
    gancho: palabras(p.title, 8), frases: ors.length ? ors.slice(0, 3).map((o) => palabras(o, 10)) : ["Disponible en la tienda HETNA"],
  }, logger)
}

export async function promoBlog(scope: any, logger?: any) {
  const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await asegurarPromo(knex)
  const a = await knex("learning_article").whereNull("deleted_at").whereNotNull("published_at").where("published_at", "<=", knex.fn.now()).whereNotIn("id", yaPromovidos(knex, "blog", 120)).orderBy("published_at", "desc").first("id", "slug", "title", "excerpt", "content_html", "cover_image_url")
  if (!a) return null
  const html = String(a.content_html || "")
  const subtitulos = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => limpiar(m[1].replace(/<[^>]+>/g, " "))).filter(Boolean)
  const ors = oraciones(`${a.excerpt || ""} ${html.replace(/<[^>]+>/g, " ")}`)
  const puntos = (subtitulos.length >= 3 ? subtitulos : ors).slice(0, 4).map((x) => palabras(x, 12))
  const portada = /^https:\/\//.test(String(a.cover_image_url || "")) ? a.cover_image_url : null
  return publicarPar(scope, {
    tipo: "blog", ref: a.id, titulo: a.title, url: `${STORE_URL}/mx/aprendizaje-cnc/${a.slug}`, tema: temaDe(`${a.title} ${a.excerpt}`),
    texto: `${a.title}\n\n${limpiar(a.excerpt || ors[0] || "")}\n\nLéelo completo en Aprendizaje CNC: {{liga}}`,
    cinta: "Aprendizaje CNC", cta: "Lee la guía completa", fotos: [portada], gancho: palabras(a.title, 8), frases: ors.slice(0, 3).map((o) => palabras(o, 10)),
    carrusel: { titulo: palabras(a.title, 10), puntos, portada },
  }, logger)
}

export async function promoHerramienta(scope: any, logger?: any, clave?: string) {
  const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await asegurarPromo(knex)
  let h = clave ? HERRAMIENTAS.find((x) => x.clave === clave) : null
  if (!h) {
    // La que tiene más tiempo sin promoverse
    const ult = await knex(T_PROMO).where({ tipo: "herramienta" }).groupBy("ref").select("ref").max({ en: "created_at" })
    const fecha = Object.fromEntries(ult.map((u: any) => [u.ref, new Date(u.en).getTime()]))
    h = [...HERRAMIENTAS].sort((a, b) => (fecha[a.clave] || 0) - (fecha[b.clave] || 0))[0]
  }
  return publicarPar(scope, {
    tipo: "herramienta", ref: h.clave, titulo: h.nombre, url: `${STORE_URL}${h.ruta}`, tema: h.tema, texto: `${h.texto}\n\n${h.cta}: {{liga}}`,
    cinta: h.nombre, cta: h.cta, producto_url: h.imagen, fotos: h.imagen ? [h.imagen] : [], gancho: h.gancho, frases: h.frases,
  }, logger)
}

/** Job diario: producto todos los días; blog martes y viernes; herramienta lunes y jueves. */
export async function promocionesDelDia(scope: any, logger?: any) {
  const dia = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" })).getDay()
  const hechos: string[] = []
  const intenta = async (nombre: string, fn: () => Promise<any>) => {
    try {
      if (await fn()) hechos.push(nombre)
    } catch (e) {
      logger?.warn?.(`[promo] ${nombre}: ${(e as Error).message}`)
    }
  }
  await intenta("producto", () => promoProducto(scope, logger))
  if (dia === 2 || dia === 5) await intenta("blog", () => promoBlog(scope, logger))
  if (dia === 1 || dia === 4) await intenta("herramienta", () => promoHerramienta(scope, logger))
  // Plantillas de dos lados (lib/fabrica/oportunidades): radar para talleres y talleres listos para clientes
  const op = await import("./oportunidades")
  if (dia === 3 || dia === 6) await intenta("radar por estado", () => op.radarEstado(scope, logger))
  if (dia === 0 || dia === 2) await intenta("talleres listos", () => op.talleresListos(scope, logger))
  if (hechos.length) logger?.info?.(`[promo] hechas: ${hechos.join(", ")}`)
  return hechos
}
