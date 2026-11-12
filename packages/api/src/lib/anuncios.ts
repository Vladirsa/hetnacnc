// @ts-nocheck
// Agente de anuncios de Meta: impulsa (con dinero) las publicaciones que ya
// funcionaron solas. Cuesta dinero, así que:
//   - viene APAGADO y sólo se prende en Social Hub → Configuración → Anuncios
//   - el dueño pone el presupuesto por semana (tope duro en el código)
//   - el agente sólo PROPONE; nada se lanza sin que el dueño apriete "Aprobar"
//   - cada anuncio lleva fecha de fin: Meta lo apaga solo aunque nadie haga nada
//   - un solo anuncio a la vez y nunca la misma publicación dos veces
//
// Qué impulsa: la publicación de Facebook de las últimas 2 semanas que más
// trajo pagos, pruebas del Cotizador o registros (social-estadisticas
// ventasPorPublicacion) y, si no hay, la de más interacción.
//
// Necesita en el .env del backend: META_ADS_TOKEN (token con permiso
// ads_management de la cuenta publicitaria) — nunca se escribe en el chat.
import { nuevoId } from "./licitacion"
import { REDES, T_CONFIG_S, T_POST, asegurarSocial } from "./social-hub"
import { idDe, ventasPorPublicacion } from "./social-estadisticas"

export const T_ANUNCIO = "hetna_social_anuncio"
// v26.0 es la versión vigente (julio 2026); se puede cambiar sin tocar código con META_GRAPH_VERSION
const GRAPH = () => `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || "v26.0"}`
// Página de Facebook de HETNA: para armar el id de la publicación cuando Graph sólo regresó el de la foto o video
const PAGINA = () => process.env.META_PAGE_ID || "109722907076187"
/** Tope duro por semana, pase lo que pase en la configuración (MXN). */
export const TOPE_SEMANAL = 5000
/** Mínimo diario de Meta para cuentas en pesos (redondeado hacia arriba). */
export const MINIMO_DIARIO = 20

export type ConfigAnuncios = { activo: boolean; cuenta: string; presupuesto_semanal: number; dias: number; pais: string }
const INICIAL: ConfigAnuncios = { activo: false, cuenta: "", presupuesto_semanal: 0, dias: 7, pais: "MX" }

export async function asegurarAnuncios(knex: any) {
  await asegurarSocial(knex)
  if (!(await knex.schema.hasTable(T_ANUNCIO))) {
    await knex.schema.createTable(T_ANUNCIO, (t: any) => {
      t.text("id").primary()
      t.text("post_id").index()
      t.text("objeto").notNullable() // id de la publicación en Facebook (pagina_post)
      t.text("estado").notNullable() // propuesta | lanzando | activo | terminado | rechazado | error
      t.decimal("diario", 10, 2)
      t.integer("dias")
      t.text("motivo")
      t.jsonb("meta") // ids de campaña, conjunto, creativo y anuncio
      t.jsonb("resultados") // gasto, alcance, clics
      t.text("error")
      t.timestamp("fin", { useTz: true })
      t.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now())
      t.timestamp("updated_at", { useTz: true }).defaultTo(knex.fn.now())
    })
  }
}

export async function leerAnuncios(knex: any): Promise<ConfigAnuncios> {
  await asegurarSocial(knex)
  const v = (await knex(T_CONFIG_S).where({ clave: "anuncios" }).first())?.valor || {}
  return normalizar(v)
}

export function normalizar(v: any): ConfigAnuncios {
  const semana = Math.max(0, Math.min(TOPE_SEMANAL, Math.round(Number(v.presupuesto_semanal) || 0)))
  return {
    activo: !!v.activo && semana >= MINIMO_DIARIO * 7, // con menos no alcanza el mínimo diario de Meta
    cuenta: String(v.cuenta || "").replace(/^act_/, "").replace(/\D/g, "").slice(0, 20),
    presupuesto_semanal: semana,
    dias: Math.max(3, Math.min(14, Math.round(Number(v.dias) || INICIAL.dias))),
    pais: /^[A-Z]{2}$/.test(String(v.pais || "")) ? String(v.pais) : "MX",
  }
}

export async function guardarAnuncios(knex: any, c: Partial<ConfigAnuncios>) {
  const v = normalizar({ ...(await leerAnuncios(knex)), ...c })
  await knex.raw(`insert into ?? (clave, valor) values ('anuncios', ?::jsonb) on conflict (clave) do update set valor = excluded.valor`, [T_CONFIG_S, JSON.stringify(v)])
  return v
}

/** Presupuesto diario: lo de la semana repartido en los días del anuncio, nunca menos que el mínimo de Meta. */
export function diarioDe(c: ConfigAnuncios) {
  const d = Math.floor((c.presupuesto_semanal / 7) * 100) / 100
  return d >= MINIMO_DIARIO ? d : 0
}

const token = () => process.env.META_ADS_TOKEN || ""
export const anunciosListos = () => !!token()

async function graph(ruta: string, cuerpo?: Record<string, any>) {
  const url = new URL(`${GRAPH()}/${ruta}`)
  const init: RequestInit = { signal: AbortSignal.timeout(30_000) }
  if (cuerpo) {
    const f = new URLSearchParams()
    for (const [k, v] of Object.entries(cuerpo)) f.set(k, typeof v === "string" ? v : JSON.stringify(v))
    f.set("access_token", token())
    init.method = "POST"
    init.body = f
  } else url.searchParams.set("access_token", token())
  const r = await fetch(url, init)
  const d = await r.json().catch(() => ({}))
  // Nunca se devuelve la liga con el token (paging) ni el token en el error
  if (!r.ok || d.error) throw new Error(String(d?.error?.error_user_msg || d?.error?.message || `Graph ${r.status}`).slice(0, 300))
  delete d.paging
  return d
}

/**
 * Id de la publicación (pagina_post) que Meta necesita para anunciarla. Las fotos
 * y videos a veces sólo regresan el id del archivo: entonces se arma con la página.
 */
export function objetoFacebook(r: any) {
  const post = String(r?.datos?.post_id || "")
  if (/^\d+_\d+$/.test(post)) return post
  const id = idDe("facebook", r)
  if (!id) return null
  return /^\d+_\d+$/.test(id) ? id : /^\d+$/.test(id) ? `${PAGINA()}_${id}` : null
}

/** La mejor publicación de Facebook de las últimas 2 semanas que todavía no se impulsó. */
export async function mejorCandidata(knex: any) {
  await asegurarAnuncios(knex)
  const ya = new Set(await knex(T_ANUNCIO).whereNot("estado", "rechazado").pluck("post_id"))
  const posts = await knex(T_POST)
    .where("estado", "publicada")
    .where("publicada_en", ">=", knex.raw("now() - interval '14 days'"))
    .whereRaw("(vence is null or vence > now() + interval '3 days')") // nada de fechas que ya pasan
    .select("id", "titulo", "resultado", "estadisticas")
  const conId = posts
    .map((p: any) => ({ ...p, objeto: objetoFacebook(p.resultado?.facebook) }))
    .filter((p: any) => p.objeto && /^\d+_\d+$/.test(p.objeto) && !ya.has(p.id))
  if (!conId.length) return null
  const ventas = await ventasPorPublicacion(knex, 14).catch(() => null)
  const v = Object.fromEntries((ventas?.publicaciones || []).map((x: any) => [x.id, x]))
  const puntos = (p: any) => {
    const x = v[p.id] || {}
    const inter = Number(p.estadisticas?.facebook?.interaccion || 0) + Number(p.estadisticas?.instagram?.interaccion || 0)
    return (x.pagos || 0) * 1000 + (x.pruebas || 0) * 300 + (x.registros || 0) * 100 + (x.clics || 0) * 5 + inter
  }
  const lista = conId.map((p: any) => ({ ...p, puntos: puntos(p), datos: v[p.id] || null })).sort((a: any, b: any) => b.puntos - a.puntos)
  const mejor = lista[0]
  if (!mejor || mejor.puntos <= 0) return null
  const x = mejor.datos
  const motivo = x?.pagos
    ? `Trajo ${x.pagos} pagos sin anuncio`
    : x?.pruebas
      ? `Trajo ${x.pruebas} pruebas del Cotizador sin anuncio`
      : x?.registros
        ? `Trajo ${x.registros} registros sin anuncio`
        : `La de más interacción de las últimas 2 semanas (${mejor.puntos})`
  return { post_id: mejor.id, titulo: mejor.titulo, objeto: mejor.objeto, motivo }
}

/** Job semanal: si está prendido y no hay otro anuncio, deja UNA propuesta para que el dueño la apruebe. */
export async function proponerAnuncio(knex: any, logger?: any) {
  const c = await leerAnuncios(knex)
  if (!c.activo || !c.cuenta || !anunciosListos()) return null
  await asegurarAnuncios(knex)
  const abierto = await knex(T_ANUNCIO).whereIn("estado", ["propuesta", "lanzando", "activo"]).first("id")
  if (abierto) return null
  const cand = await mejorCandidata(knex)
  const diario = diarioDe(c)
  if (!cand || !diario) return null
  const id = nuevoId("anu")
  await knex(T_ANUNCIO).insert({ id, post_id: cand.post_id, objeto: cand.objeto, estado: "propuesta", diario, dias: c.dias, motivo: cand.motivo })
  logger?.info?.(`[anuncios] propuesta ${id}: ${cand.titulo} (${cand.motivo}), $${diario} al día por ${c.dias} días`)
  // Aviso por Telegram (si está vinculado); la aprobación es en el panel
  try {
    const { mandarPrivado } = await import("./social-telegram")
    await mandarPrivado(knex, { texto: `📣 Propuesta de anuncio: "${cand.titulo}"\n${cand.motivo}.\n$${diario} MXN al día por ${c.dias} días (total máx. $${Math.round(diario * c.dias)}).\nApruébala o recházala en Social Hub → Resultados → Anuncios.` })
  } catch {}
  return id
}

/**
 * El dueño aprobó: se crea en Meta la campaña de interacción con la publicación,
 * su conjunto con presupuesto diario y FECHA DE FIN, el creativo con la misma
 * publicación y el anuncio. Todo se crea en pausa y se prende al final; si algo
 * falla, se queda en pausa (no gasta).
 */
export async function lanzarAnuncio(knex: any, id: string, logger?: any) {
  const c = await leerAnuncios(knex)
  if (!anunciosListos()) throw new Error("Falta META_ADS_TOKEN en el servidor")
  if (!c.cuenta) throw new Error("Falta la cuenta publicitaria en Configuración")
  const a = await knex(T_ANUNCIO).where({ id, estado: "propuesta" }).first()
  if (!a) throw new Error("Esa propuesta ya no está pendiente")
  // Tope duro: lo de la semana nunca pasa de TOPE_SEMANAL
  const diario = Math.min(Number(a.diario), Math.floor((TOPE_SEMANAL / 7) * 100) / 100)
  await knex(T_ANUNCIO).where({ id }).update({ estado: "lanzando", updated_at: knex.fn.now() })
  const meta: any = {}
  try {
    const act = `act_${c.cuenta}`
    const nombre = `HETNA · ${String(a.motivo).slice(0, 40)} · ${new Date().toISOString().slice(0, 10)}`
    const fin = new Date(Date.now() + Number(a.dias) * 86_400_000)
    meta.campana = (await graph(`${act}/campaigns`, { name: nombre, objective: "OUTCOME_ENGAGEMENT", status: "PAUSED", special_ad_categories: [] })).id
    meta.conjunto = (
      await graph(`${act}/adsets`, {
        name: nombre, campaign_id: meta.campana, daily_budget: String(Math.round(diario * 100)), billing_event: "IMPRESSIONS",
        optimization_goal: "POST_ENGAGEMENT", bid_strategy: "LOWEST_COST_WITHOUT_CAP", end_time: fin.toISOString(), status: "PAUSED",
        targeting: { geo_locations: { countries: [c.pais] }, age_min: 18 },
      })
    ).id
    meta.creativo = (await graph(`${act}/adcreatives`, { name: nombre, object_story_id: a.objeto })).id
    meta.anuncio = (await graph(`${act}/ads`, { name: nombre, adset_id: meta.conjunto, creative: { creative_id: meta.creativo }, status: "PAUSED" })).id
    // Todo listo: se prende de abajo hacia arriba
    for (const obj of [meta.anuncio, meta.conjunto, meta.campana]) await graph(obj, { status: "ACTIVE" })
    await knex(T_ANUNCIO).where({ id }).update({ estado: "activo", diario, meta: JSON.stringify(meta), fin, error: null, updated_at: knex.fn.now() })
    logger?.info?.(`[anuncios] ${id} activo hasta ${fin.toISOString()} ($${diario}/día)`)
    return { ok: true, fin }
  } catch (e) {
    // Lo que se alcanzó a crear se pone en pausa (por si ya se había prendido): no gasta
    if (meta.campana) await graph(meta.campana, { status: "PAUSED" }).catch(() => null)
    await knex(T_ANUNCIO).where({ id }).update({ estado: "error", meta: JSON.stringify(meta), error: (e as Error).message, updated_at: knex.fn.now() })
    throw e
  }
}

export async function rechazarAnuncio(knex: any, id: string) {
  return knex(T_ANUNCIO).where({ id, estado: "propuesta" }).update({ estado: "rechazado", updated_at: knex.fn.now() })
}

/** Apagar ya (el dueño cambió de opinión): pausa la campaña en Meta. */
export async function pausarAnuncio(knex: any, id: string) {
  const a = await knex(T_ANUNCIO).where({ id }).first()
  if (!a?.meta?.campana) throw new Error("Ese anuncio no tiene campaña en Meta")
  await graph(a.meta.campana, { status: "PAUSED" })
  await knex(T_ANUNCIO).where({ id }).update({ estado: "terminado", updated_at: knex.fn.now() })
  return true
}

/** Job diario: lee gasto, alcance y clics de los anuncios activos y cierra los que ya terminaron. */
export async function revisarAnuncios(knex: any, logger?: any) {
  if (!anunciosListos()) return 0
  await asegurarAnuncios(knex)
  const activos = await knex(T_ANUNCIO).where({ estado: "activo" })
  for (const a of activos) {
    try {
      const d = await graph(`${a.meta?.anuncio}/insights?fields=spend,reach,impressions,clicks,inline_link_clicks&date_preset=maximum`)
      const r = d?.data?.[0] || {}
      const resultados = { gasto: Number(r.spend || 0), alcance: Number(r.reach || 0), impresiones: Number(r.impressions || 0), clics: Number(r.clicks || 0), clics_liga: Number(r.inline_link_clicks || 0) }
      // Seguridad: si gastó más de lo aprobado (+10%), se pausa
      const aprobado = Number(a.diario) * Number(a.dias) * 1.1
      const terminado = new Date(a.fin).getTime() < Date.now() || resultados.gasto > aprobado
      if (resultados.gasto > aprobado) await graph(a.meta.campana, { status: "PAUSED" }).catch(() => null)
      await knex(T_ANUNCIO).where({ id: a.id }).update({ resultados: JSON.stringify(resultados), ...(terminado ? { estado: "terminado" } : {}), updated_at: knex.fn.now() })
    } catch (e) {
      logger?.warn?.(`[anuncios] ${a.id}: ${(e as Error).message}`)
    }
  }
  return activos.length
}

/** Para el panel. */
export async function listarAnuncios(knex: any) {
  await asegurarAnuncios(knex)
  const filas = await knex(`${T_ANUNCIO} as a`).leftJoin(`${T_POST} as p`, "p.id", "a.post_id").orderBy("a.created_at", "desc").limit(20).select("a.*", "p.titulo")
  return { config: await leerAnuncios(knex), listo: anunciosListos(), anuncios: filas, minimo_diario: MINIMO_DIARIO, tope_semanal: TOPE_SEMANAL }
}
