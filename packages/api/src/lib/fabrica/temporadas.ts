// @ts-nocheck
// Videos de productos por fecha especial (Día de las Madres, Día de Muertos,
// Navidad…). En la temporada de cada fecha se buscan los productos de la tienda
// que tengan su ETIQUETA o CATEGORÍA (sólo eso: buscar en los títulos se
// equivoca en un catálogo CNC, p. ej. "tarjeta madre" o "punto muerto") y se
// hace una imagen y un video con el fondo de la fecha.
//
// - Se publica sólo antes de la fecha: cada pieza lleva `vence` (fin del día de
//   la fecha) y lo que no salió a tiempo se descarta solo; tampoco se recicla.
// - Sin precios (pueden cambiar) ni descuentos: sólo el producto real y su liga.
// - Si ningún producto tiene la etiqueta, no se hace nada (el panel lo avisa).
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { STORE_URL, nuevoId } from "../licitacion"
import { T_CONFIG_S, T_POST, asegurarSocial, crearPublicacion, dentroDeHorario, leerConfig, ligaPara, urlCorta, zonaDe } from "../social-hub"
import { FECHAS, type FechaEspecial, fechasActivas, finDelDia, hoyMx, proxima } from "./calendario"
import { hfDisponible, paraVoz, videoHF } from "./hyperframes"
import { fondoDe, musicaAlAzar, subir } from "./index"
import { limpiar, oraciones, palabras } from "./plan-material"
import { T_PROMO, asegurarPromo, vozPara } from "./promociones"
import { corto, ffmpegDisponible, segundosPara } from "./video"
import { cuadroVideo, carpetaFuentes, tarjeta } from "./render"
import { poster } from "./poster"

export type AjusteFecha = { activa: boolean; etiquetas: string[] }

/** Ajustes del dueño por fecha (etiquetas y si está activa), sobre los de calendario.ts. */
export async function leerFechas(knex: any): Promise<Record<string, AjusteFecha>> {
  await asegurarSocial(knex)
  const guardado = (await knex(T_CONFIG_S).where({ clave: "temporadas" }).first())?.valor || {}
  return Object.fromEntries(
    FECHAS.map((f) => {
      const g = guardado[f.clave] || {}
      const etiquetas = Array.isArray(g.etiquetas) ? g.etiquetas.map(normalizar).filter(Boolean) : f.etiquetas
      return [f.clave, { activa: g.activa !== false, etiquetas }]
    }),
  )
}

export async function guardarFecha(knex: any, clave: string, cambios: Partial<AjusteFecha>) {
  if (!FECHAS.some((f) => f.clave === clave)) throw new Error("Fecha desconocida")
  const actual = await leerFechas(knex)
  const nuevo = {
    ...actual,
    [clave]: {
      activa: cambios.activa ?? actual[clave].activa,
      etiquetas: Array.isArray(cambios.etiquetas) ? cambios.etiquetas.map(normalizar).filter(Boolean).slice(0, 12) : actual[clave].etiquetas,
    },
  }
  await knex.raw(`insert into ?? (clave, valor) values ('temporadas', ?::jsonb) on conflict (clave) do update set valor = excluded.valor`, [T_CONFIG_S, JSON.stringify(nuevo)])
  return nuevo
}

/** "Día de Muertos" -> "dia-de-muertos" (así se comparan etiquetas y categorías). */
export function normalizar(t: string) {
  return String(t || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

/** ¿El producto corresponde a la fecha? Sólo por etiqueta o categoría exacta (normalizada). */
export function coincide(p: { etiquetas?: string[]; categorias?: string[] }, etiquetas: string[]) {
  const buscadas = new Set(etiquetas.map(normalizar))
  const suyas = [...(p.etiquetas || []), ...(p.categorias || [])].map(normalizar)
  return suyas.some((x) => buscadas.has(x))
}

/** Productos publicados con foto que tienen alguna de las etiquetas o categorías de la fecha. */
export async function productosDeFecha(knex: any, etiquetas: string[], o: { excluir?: string[]; limite?: number } = {}) {
  const buscadas = etiquetas.map(normalizar).filter(Boolean)
  if (!buscadas.length) return []
  // Compara contra el valor de la etiqueta y el nombre o handle de la categoría, normalizados igual que arriba
  const norm = (col: string) => `regexp_replace(lower(translate(${col}, 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')), '[^a-z0-9]+', '-', 'g')`
  const filas = await knex("product as p")
    .whereNull("p.deleted_at")
    .where("p.status", "published")
    .whereNotNull("p.thumbnail")
    .whereRaw("coalesce(p.metadata->>'producto_creditos_3d', 'false') <> 'true'")
    .modify((q: any) => o.excluir?.length && q.whereNotIn("p.id", o.excluir))
    .where((w: any) =>
      w
        .whereExists(function (this: any) {
          this.select(knex.raw("1")).from("product_tags as pt").join("product_tag as t", "t.id", "pt.product_tag_id").whereRaw("pt.product_id = p.id").whereNull("t.deleted_at").whereRaw(`trim(both '-' from ${norm("t.value")}) = any(?)`, [buscadas])
        })
        .orWhereExists(function (this: any) {
          this.select(knex.raw("1")).from("product_category_product as pc").join("product_category as c", "c.id", "pc.product_category_id").whereRaw("pc.product_id = p.id").whereNull("c.deleted_at")
            .whereRaw(`(trim(both '-' from ${norm("c.handle")}) = any(?) or trim(both '-' from ${norm("c.name")}) = any(?))`, [buscadas, buscadas])
        }),
    )
    .orderBy("p.created_at", "desc")
    .limit(o.limite || 20)
    .select("p.id", "p.title", "p.handle", "p.thumbnail", "p.description")
  return filas
}

/** Nombre corto y sin códigos (los títulos de vendedores traen SKU y medidas). */
export function nombreCorto(titulo: string, n = 5) {
  const t = String(titulo || "")
    .replace(/[([][^)\]]*[)\]]/g, " ") // (lo que va entre paréntesis)
    .replace(/\b(?=[A-Za-z0-9-]*\d)(?=[A-Za-z0-9-]*[A-Za-z])[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+\b/g, " ") // AB-1234, MDF-3MM-X
    .replace(/\b[A-Z]{1,4}\d{2,}[A-Z0-9]*\b/g, " ") // SKU tipo AB1234
    .replace(/[|/_#*•·]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return palabras(t || String(titulo || ""), n).replace(/…$/, "")
}

const VUELTA: Record<string, number> = {} // evita dos vueltas a la vez

/**
 * Hace (si toca) la pieza de temporada de hoy: imagen + video con hasta 3
 * productos de la fecha más cercana. `forzar` (botón del panel) ignora la
 * frecuencia, pero nunca la etiqueta ni la fecha de vencimiento.
 */
export async function promoTemporada(scope: any, logger?: any, o: { clave?: string; forzar?: boolean; ahora?: Date } = {}) {
  const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await asegurarPromo(knex)
  const ajustes = await leerFechas(knex)
  const ahora = o.ahora || new Date()
  const candidatas = o.clave
    ? FECHAS.filter((f) => f.clave === o.clave).map((f) => ({ f, p: proxima(f, ahora)! }))
    : fechasActivas(ahora).filter(({ f }) => ajustes[f.clave]?.activa)
  for (const { f, p } of candidatas) {
    if (VUELTA[f.clave]) continue
    // Frecuencia: diario la última semana; antes, cada 3 días
    const tipo = `temporada:${f.clave}`
    const ultima = await knex(T_PROMO).where({ tipo }).max({ en: "created_at" }).first().catch(() => null)
    const dias = ultima?.en ? (ahora.getTime() - new Date(ultima.en).getTime()) / 86_400_000 : 999
    if (!o.forzar && dias < (p.faltan <= 7 ? 0.9 : 2.9)) continue
    const recientes = await knex(T_PROMO).where({ tipo }).where("created_at", ">=", knex.raw("now() - interval '6 days'")).pluck("ref")
    const prods = await productosDeFecha(knex, ajustes[f.clave].etiquetas, { excluir: recientes, limite: 3 })
    if (!prods.length) {
      logger?.info?.(`[temporada] ${f.nombre}: ningún producto con sus etiquetas (${ajustes[f.clave].etiquetas.join(", ")})`)
      if (o.clave) return { hecho: false, motivo: `Ningún producto tiene las etiquetas o categorías de ${f.nombre}: ${ajustes[f.clave].etiquetas.join(", ")}` }
      continue
    }
    VUELTA[f.clave] = 1
    try {
      const posts = await piezaDeFecha(scope, f, p, prods, logger)
      for (const pr of prods) await knex(T_PROMO).insert({ id: nuevoId("promo"), tipo, ref: pr.id, posts: JSON.stringify(posts) })
      logger?.info?.(`[temporada] ${f.nombre}: ${prods.length} productos, ${posts.length} publicaciones`)
      return { hecho: true, fecha: f.nombre, productos: prods.map((x: any) => x.title), posts }
    } finally {
      delete VUELTA[f.clave]
    }
  }
  return { hecho: false, motivo: candidatas.length ? "Ya se hizo la pieza de hoy" : "Ninguna fecha especial en temporada" }
}

/** Horario de publicación sin pasarse del día de la fecha. */
async function cuandoAntesDe(knex: any, horas: number, vence: Date) {
  const cfg = await leerConfig(knex)
  let fecha = dentroDeHorario(new Date(Date.now() + horas * 3600_000), cfg.horario, zonaDe("mx"))
  if (fecha.getTime() > vence.getTime() - 2 * 3600_000) fecha = dentroDeHorario(new Date(Date.now() + 3600_000), cfg.horario, zonaDe("mx"))
  if (fecha.getTime() > vence.getTime() - 3600_000) return null // ya no alcanza
  return { estado: cfg.automatico.promociones ? "programada" : "borrador", fecha }
}

/** Liga completa de una foto de producto (las que guarda el servidor pueden venir como /static/…). */
export function fotoAbsoluta(u: string | null | undefined) {
  const x = String(u || "").trim()
  if (/^https?:\/\//.test(x)) return x
  if (x.startsWith("/")) {
    const base = (process.env.FILE_BACKEND_URL || "http://localhost:9000/static").replace(/\/static\/?$/, "").replace(/\/$/, "")
    return `${base}${x}`
  }
  return null
}

async function piezaDeFecha(scope: any, f: FechaEspecial, p: { anio: number; mes: number; dia: number }, prods: any[], logger?: any) {
  const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  prods = prods.map((x) => ({ ...x, thumbnail: fotoAbsoluta(x.thumbnail) })).filter((x) => x.thumbnail)
  if (!prods.length) return []
  const vence = finDelDia(p)
  const nombres = prods.map((x) => nombreCorto(x.title))
  const fotos = prods.map((x) => x.thumbnail)
  const url = `${STORE_URL}/mx/products/${prods[0].handle}`
  const lista = nombres.map((n) => `• ${n}`).join("\n")
  const texto = `${f.narracion}\n\n${lista}\n\nHechos por talleres y vendedores de HETNA CNC. ${f.cta}: {{liga}}`
  const posts: string[] = []

  // 1) Imagen con el primer producto
  const c1 = await cuandoAntesDe(knex, 2, vence)
  if (c1) {
    const p1 = await crearPublicacion(knex, { origen: "manual", fuente: "temporada", vence, titulo: `${f.nombre} · ${nombres[0]}`, texto_base: texto, url, redes: ["facebook", "instagram", "telegram"], estado: c1.estado, programada_para: c1.fecha, mercado: "mx" } as any, logger)
    const liga = urlCorta(await ligaPara(knex, p1, "facebook", url))
    const titulo = palabras(nombres.length > 1 ? `${f.gancho}: ${nombres[0]} y más` : `${f.gancho}: ${nombres[0]}`, 10)
    const cfgImg = await leerConfig(knex)
    const png =
      (cfgImg.imagen_nueva !== false && (await poster({ tema: f.tema, cinta: f.nombre, titulo, foto: fotos[0] || null, icono: f.icono, cta: f.cta, liga }, logger))) ||
      (await tarjeta({ tema: "taller", foto_url: await fondoDe(knex, "taller"), producto_url: fotos[0] || null, cinta: { texto: f.nombre, tono: "naranja" }, titulo, cta: f.cta, liga }))
    await knex(T_POST).where({ id: p1 }).update({ medios: JSON.stringify([{ url: await subir(scope, `temporada-${p1}.png`, "image/png", png), tipo: "imagen" }]) })
    posts.push(p1)
  }

  // 2) Video vertical con los productos (HyperFrames si está encendido; si no, FFmpeg)
  const c2 = await cuandoAntesDe(knex, 26, vence)
  if (c2 && ffmpegDisponible()) {
    const p2 = await crearPublicacion(knex, { origen: "manual", fuente: "temporada", vence, titulo: `${f.nombre} · video`, texto_base: texto, url, redes: ["instagram", "instagram_historia", "facebook", "tiktok", "youtube"], estado: c2.estado, programada_para: c2.fecha, mercado: "mx" } as any, logger)
    const liga = urlCorta(await ligaPara(knex, p2, "instagram", url))
    const descr = (x: any) => palabras(oraciones(limpiar(String(x.description || "").replace(/<[^>]+>/g, " ")))[0] || "", 12)
    const bloques: any[] = [
      { tipo: "gancho", texto: f.gancho, narracion: f.narracion, icono: f.icono },
      ...prods.map((x, i) => ({ tipo: "producto", texto: nombres[i], narracion: [nombres[i], descr(x)].filter(Boolean).join(". "), foto: x.thumbnail })),
      { tipo: "cierre", texto: f.cta, narracion: `${f.cta} en hetnacnc.com` },
    ]
    const voz: any = await vozPara(`temporada-${p2}`, bloques.map((b) => paraVoz(b.narracion)), "mx", logger)
    const musica = await musicaAlAzar(knex)
    const cfg = await leerConfig(knex)
    let v: any = cfg.video_animado && hfDisponible()
      ? await videoHF(bloques, { duraciones: voz?.duraciones?.length === bloques.length ? voz.duraciones : bloques.map((b) => segundosPara(b.narracion, 1.8, 4.5)), voz: voz?.url || null, musica, liga, tema: f.tema, logger })
      : null
    if (!v) {
      const dur = (k: number, d: number) => (voz?.duraciones?.[k] ? Math.max(1.2, voz.duraciones[k] + 0.15) : d)
      const escenas = [{ png: await cuadroVideo({ tipo: "gancho", texto: f.gancho, tema: "taller", foto_url: fotos[0] || null, semilla: 1 }), segundos: dur(0, 2.4) }]
      for (const [i, x] of prods.entries()) escenas.push({ png: await cuadroVideo({ tipo: "frase", texto: nombres[i], tema: "taller", foto_url: x.thumbnail, semilla: i + 2, sinTexto: true }), segundos: dur(i + 1, 3), subtitulo: bloques[i + 1].narracion })
      escenas.push({ png: await cuadroVideo({ tipo: "cierre", texto: f.cta, tema: "taller", liga }), segundos: dur(prods.length + 1, 2.6) })
      v = await corto(escenas, { fuentes: carpetaFuentes(), musica, voz: voz?.url || null })
    }
    await knex(T_POST).where({ id: p2 }).update({ medios: JSON.stringify([{ url: await subir(scope, `temporada-${p2}.mp4`, "video/mp4", v.buf), tipo: "video" }]) })
    posts.push(p2)
  }
  return posts
}

/** Para el panel: cada fecha, cuándo cae, si está en temporada y qué productos coinciden. */
export async function resumenFechas(knex: any, ahora = new Date()) {
  const ajustes = await leerFechas(knex)
  await asegurarPromo(knex)
  const activas = new Set(fechasActivas(ahora).map(({ f }) => f.clave))
  const out = []
  for (const f of FECHAS) {
    const p = proxima(f, ahora)!
    const prods = await productosDeFecha(knex, ajustes[f.clave].etiquetas, { limite: 6 }).catch(() => [])
    const ultima = await knex(T_PROMO).where({ tipo: `temporada:${f.clave}` }).max({ en: "created_at" }).first().catch(() => null)
    out.push({
      clave: f.clave, nombre: f.nombre, fecha: `${p.anio}-${String(p.mes).padStart(2, "0")}-${String(p.dia).padStart(2, "0")}`, faltan: p.faltan,
      anticipacion: f.anticipacion, en_temporada: activas.has(f.clave), tema: f.tema,
      activa: ajustes[f.clave].activa, etiquetas: ajustes[f.clave].etiquetas, sugeridas: f.etiquetas,
      productos: prods.map((x: any) => ({ id: x.id, titulo: x.title, foto: x.thumbnail })), ultima: ultima?.en || null,
    })
  }
  return out
}

export { hoyMx }
