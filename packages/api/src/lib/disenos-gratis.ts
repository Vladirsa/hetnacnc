// @ts-nocheck
// Agente «Diseños gratis»: busca archivos vectoriales (SVG) con licencia que
// permite redistribuirlos y usarlos comercialmente, y los deja listos para
// publicarlos en la tienda como DESCARGA GRATIS (atraen visitas y registros).
//
// Fuente: Wikimedia Commons (API pública). Sólo pasan:
//   - Dominio público, CC0, CC BY y CC BY-SA (se cita autor y licencia en la ficha).
//   - NO pasan: licencias "no comercial" (NC), "sin derivadas" (ND), logos,
//     escudos, banderas, mapas ni nada con marca registrada.
//   - El SVG se baja, se revisa que sea un dibujo válido (con trazos) y se le
//     quitan scripts y ligas externas antes de guardarlo.
// Nada se publica solo: el dueño revisa cada candidato en
// Dashboard → Diseños gratis y presiona «Publicar gratis» (la ficha la escribe
// Claude con la misma lógica de «Subir diseños»).
//
// Variables: DISENOS_GRATIS_APAGADO=1 · DISENOS_GRATIS_POR_CORRIDA=12
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { ADMIN } from "./centro-control"
import { publicarDiseno } from "./publicar-diseno"
import { mandarPrivado } from "./social-telegram"
import { guardarArchivo, nuevoSku, prepararImagen, proponerFicha, slug } from "./subir-disenos"

export const T_CANDIDATO = "hetna_diseno_candidato"
const UA = "HETNA-CNC-bot/1.0 (https://hetnacnc.com; contacto@hetnacnc.com)"
const API = "https://commons.wikimedia.org/w/api.php"

// Temas que se cortan o graban en CNC y láser (rotan: unos pocos por corrida)
export const TEMAS = [
  "mandala", "celtic knot", "geometric pattern", "floral ornament", "ornamental frame", "arabesque pattern",
  "tree of life", "snowflake", "christmas ornament", "skull ornament", "animal silhouette", "bird silhouette",
  "butterfly silhouette", "cat silhouette", "dog silhouette", "horse silhouette", "deer silhouette", "fish silhouette",
  "islamic geometric pattern", "lattice pattern", "border ornament", "corner ornament", "vintage ornament", "art nouveau ornament",
  "aztec pattern", "mexican pattern", "papel picado", "sugar skull", "dreamcatcher", "compass rose", "zodiac sign", "tribal tattoo",
]
const PROHIBIDO = /\b(logo|logotipo|coat of arms|escudo|flag|bandera|map|mapa|emblem|emblema|seal|sello|trademark|wordmark|icon of|brand)\b/i

export const disenosGratisApagado = () => ["1", "true", "si"].includes(String(process.env.DISENOS_GRATIS_APAGADO || "").toLowerCase())

let listo = false
export async function asegurarTablaCandidatos(knex) {
  if (listo) return
  if (!(await knex.schema.hasTable(T_CANDIDATO))) {
    await knex.schema.createTable(T_CANDIDATO, (t) => {
      t.increments("id").primary()
      t.text("fuente").notNullable()
      t.text("fuente_id").notNullable().unique()
      t.text("titulo").notNullable()
      t.text("autor").nullable()
      t.text("licencia").notNullable()
      t.text("licencia_url").nullable()
      t.text("pagina_url").notNullable()
      t.text("archivo_url").notNullable()
      t.text("preview_url").nullable()
      t.integer("bytes").nullable()
      t.text("tema").nullable()
      t.text("estado").notNullable().defaultTo("pendiente") // pendiente | publicado | descartado
      t.text("producto_url").nullable()
      t.text("error").nullable()
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }
  listo = true
}

/** ¿La licencia permite redistribuir y usar comercialmente? Devuelve la etiqueta limpia o null. */
export function licenciaAceptable(corta: string, codigo = ""): string | null {
  const t = `${corta} ${codigo}`.toLowerCase()
  if (!t.trim()) return null
  if (/\bnc\b|non-?commercial|no comercial|\bnd\b|no-?deriv|sin deriv|fair use|copyrighted|all rights/.test(t)) return null
  if (/cc0|public domain|dominio p[uú]blico|\bpd\b|pd-/.test(t)) return /cc0/.test(t) ? "CC0" : "Dominio público"
  const m = t.match(/cc[- ]by(-sa)?[- ]?(\d(\.\d)?)?/)
  if (m) return `CC BY${m[1] ? "-SA" : ""}${m[2] ? ` ${m[2]}` : ""}`
  return null
}

const sinHtml = (s) => String(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()

/** Busca SVG con licencia aceptable para un tema y guarda los nuevos. */
export async function buscarCandidatos(knex, tema: string, max = 8) {
  await asegurarTablaCandidatos(knex)
  const q = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrnamespace: "6",
    gsrsearch: `${tema} filemime:image/svg+xml`,
    gsrlimit: "25",
    prop: "imageinfo",
    iiprop: "url|extmetadata|size",
    iiurlwidth: "1000",
    iiextmetadatafilter: "LicenseShortName|License|LicenseUrl|Artist|ObjectName",
  })
  const r = await fetch(`${API}?${q}`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20_000) })
  if (!r.ok) throw new Error(`Wikimedia respondió ${r.status}`)
  const d = await r.json()
  const paginas = Object.values(d?.query?.pages || {}) as any[]
  let nuevos = 0
  for (const p of paginas) {
    if (nuevos >= max) break
    const ii = p.imageinfo?.[0]
    if (!ii?.url) continue
    const m = ii.extmetadata || {}
    const titulo = String(p.title || "").replace(/^File:/, "").replace(/\.svg$/i, "")
    if (PROHIBIDO.test(titulo)) continue
    const licencia = licenciaAceptable(m.LicenseShortName?.value || "", m.License?.value || "")
    if (!licencia) continue
    if (ii.size < 1500 || ii.size > 3_000_000) continue
    const fuente_id = `wikimedia:${p.pageid}`
    const ya = await knex(T_CANDIDATO).where({ fuente_id }).first("id")
    if (ya) continue
    await knex(T_CANDIDATO).insert({
      fuente: "Wikimedia Commons",
      fuente_id,
      titulo: titulo.slice(0, 200),
      autor: sinHtml(m.Artist?.value).slice(0, 200) || null,
      licencia,
      licencia_url: m.LicenseUrl?.value || null,
      pagina_url: ii.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`,
      archivo_url: ii.url,
      preview_url: ii.thumburl || null,
      bytes: ii.size,
      tema,
    })
    nuevos++
  }
  return nuevos
}

/** Revisa y limpia el SVG: debe tener trazos; sin scripts, eventos ni ligas externas. */
export function limpiarSvg(texto: string): string | null {
  const s = String(texto || "")
  if (!/<svg[\s>]/i.test(s)) return null
  if (!/<(path|polygon|polyline|circle|ellipse|rect|line)\b/i.test(s)) return null
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, "")
    .replace(/(xlink:)?href\s*=\s*("|')\s*(https?:|javascript:|data:text)[^"']*\2/gi, "")
}

export async function listarCandidatos(container) {
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await asegurarTablaCandidatos(knex)
  const pendientes = await knex(T_CANDIDATO).where({ estado: "pendiente" }).orderBy("created_at", "desc").limit(60)
  const publicados = await knex(T_CANDIDATO).where({ estado: "publicado" }).orderBy("created_at", "desc").limit(20)
  return { pendientes, publicados, temas: TEMAS }
}

export async function descartarCandidato(container, id: number) {
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await asegurarTablaCandidatos(knex)
  await knex(T_CANDIDATO).where({ id }).update({ estado: "descartado" })
  return { ok: true }
}

/** Baja el SVG, lo guarda, arma la ficha con Claude y lo publica como descarga gratis. */
export async function publicarCandidato(container, id: number) {
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await asegurarTablaCandidatos(knex)
  const c = await knex(T_CANDIDATO).where({ id, estado: "pendiente" }).first()
  if (!c) return { ok: false, message: "Ya no está pendiente." }
  try {
    const r = await fetch(c.archivo_url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30_000) })
    if (!r.ok) throw new Error(`No se pudo bajar el archivo (${r.status}).`)
    const svg = limpiarSvg(await r.text())
    if (!svg) throw new Error("El archivo no es un dibujo vectorial válido.")
    const nombre = `${slug(c.titulo) || "diseno"}.svg`
    const sku = nuevoSku()
    const archivo = await guardarArchivo(Buffer.from(svg, "utf8"), nombre, sku)
    // Imagen del producto: la vista previa PNG que da Wikimedia, en cuadro blanco
    if (!c.preview_url) throw new Error("No hay vista previa del diseño.")
    const png = Buffer.from(await (await fetch(c.preview_url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30_000) })).arrayBuffer())
    const imagen = await prepararImagen(container, png, nombre, "original")
    const credito = `Diseño de ${c.autor || "autor en Wikimedia Commons"}, publicado en ${c.fuente} con licencia ${c.licencia}${c.licencia_url ? ` (${c.licencia_url})` : ""}. Fuente: ${c.pagina_url}`
    const ficha = await proponerFicha(container, {
      imagen_url: imagen.url,
      nombre_archivo: nombre,
      formatos: "SVG",
      sku,
      nota: `Es una DESCARGA GRATIS. Archivo vectorial SVG listo para corte láser, router o grabado (escálalo a la medida). Menciona que es gratis. Crédito obligatorio: ${credito}`,
    })
    const descripcion = `${ficha.descripcion_larga}\n\nCrédito y licencia: ${credito}. Puedes usarlo, también en trabajos que vendas, dando crédito al autor${/SA/.test(c.licencia) ? " y compartiendo tus versiones modificadas con la misma licencia" : ""}.`
    const p = await publicarDiseno(container, {
      sku,
      titulo: ficha.titulo,
      handle: ficha.handle || slug(`${ficha.titulo} ${sku}`),
      descripcion_corta: ficha.descripcion_corta,
      descripcion_larga: descripcion.slice(0, 3000),
      caracteristicas: ficha.caracteristicas,
      formatos: "SVG",
      subcategoria: ficha.subcategoria || undefined,
      tags: [ficha.tags, "gratis", "svg gratis"].filter(Boolean).join(", ").slice(0, 300),
      imagen_url: imagen.url,
      gratis: true,
      archivo_storage_key: archivo.storage_key,
      titulo_seo: ficha.titulo_seo,
      meta_description: ficha.meta_description,
      keyword_principal: ficha.keyword_principal,
      faq: ficha.faq,
      licencia: "comercial_ampliada",
    })
    const url = `${process.env.STORE_URL || "https://hetnacnc.com"}/mx/products/${p.handle}`
    await knex(T_CANDIDATO).where({ id }).update({ estado: "publicado", producto_url: url, error: null })
    return { ok: true, url }
  } catch (e) {
    await knex(T_CANDIDATO).where({ id }).update({ error: String(e?.message || e).slice(0, 300) })
    return { ok: false, message: String(e?.message || e) }
  }
}

/** Corrida programada: unos cuantos temas (rotando) y aviso a Telegram. */
export async function correrDisenosGratis(container) {
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await asegurarTablaCandidatos(knex)
  const meta = Math.max(1, Number(process.env.DISENOS_GRATIS_POR_CORRIDA) || 12)
  const semana = Math.floor(Date.now() / (7 * 86_400_000))
  const temas = [0, 1, 2, 3].map((k) => TEMAS[(semana * 4 + k) % TEMAS.length])
  let total = 0
  for (const tema of temas) {
    if (total >= meta) break
    try {
      total += await buscarCandidatos(knex, tema, Math.min(5, meta - total))
    } catch {
      /* si Wikimedia no responde, la siguiente corrida lo intenta */
    }
    await new Promise((ok) => setTimeout(ok, 2000))
  }
  if (total) {
    await mandarPrivado(knex, {
      texto: `🎨 Diseños gratis: ${total} archivo(s) SVG nuevo(s) con licencia libre (${temas.join(", ")}).\nRevísalos y publícalos con un clic en <a href="${ADMIN}/disenos-gratis">Dashboard → Diseños gratis</a>.`,
    }).catch(() => undefined)
  }
  return { nuevos: total, temas }
}
