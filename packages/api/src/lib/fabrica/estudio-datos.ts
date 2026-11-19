// @ts-nocheck
// Estudio diario — Fase 2: los agentes que miran datos.
//
//   1. Tendencias — busca en YouTube los videos recientes de CNC / corte láser /
//      router / impresión 3D en español y compara las vistas de cada uno con la
//      media de su canal. Si un video hace 10 veces (o más) su media, da la
//      alarma por Telegram y el guionista lo usa como idea (adapta el ángulo,
//      no copia). Instagram y TikTok no dejan leer videos ajenos por API: para
//      esos, el dueño pega la liga en el panel ("Referencias") y el guionista la
//      toma en cuenta.
//   7. Retención — lee la curva de retención de YouTube Analytics de cada video
//      del Estudio ya publicado, encuentra dónde se va la gente (p. ej. en el
//      segundo 3) y le deja la nota al guionista con la escena exacta.
//
// Conexión: la cuenta de Google del canal (OAuth). Llaves en el .env del backend:
// GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET (Google Cloud, con YouTube Data API v3
// y YouTube Analytics API activadas). Redirect: https://hetnacnc.com/r/google-callback
import { randomBytes } from "crypto"

import { cifrarCampos, descifrar } from "../cifrado-llaves"
import { STORE_URL } from "../licitacion"
import { T_CONFIG_S, T_POST, asegurarSocial } from "../social-hub"
import { T_ESTUDIO, asegurarEstudio } from "./estudio"

export const T_TENDENCIA = "hetna_tendencia"
const ALCANCES = "https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly"
export const redirectGoogle = () => process.env.GOOGLE_REDIRECT_URI || `${STORE_URL}/r/google-callback`
const cid = () => (process.env.GOOGLE_CLIENT_ID || "").trim()
const csec = () => (process.env.GOOGLE_CLIENT_SECRET || "").trim()
export const googleConfigurado = () => !!(cid() && csec())
export const UMBRAL = Number(process.env.TENDENCIA_UMBRAL || 10)

export const BUSQUEDAS = ["router cnc", "corte laser", "cnc proyectos", "maquina cnc", "impresion 3d ideas", "laser fibra", "carpinteria cnc", "plasma cnc"]

async function leer(knex: any) {
  await asegurarSocial(knex)
  return (await knex(T_CONFIG_S).where({ clave: "google" }).first())?.valor || {}
}
// Los tokens se guardan cifrados (lib/cifrado-llaves.ts) y se descifran sólo
// donde se usan; leer() los deja como están.
const CAMPOS_SECRETOS = ["access", "refresh"]
async function guardar(knex: any, v: any) {
  await knex.raw(`insert into ?? (clave, valor) values ('google', ?::jsonb) on conflict (clave) do update set valor = excluded.valor`, [T_CONFIG_S, JSON.stringify(cifrarCampos(v, CAMPOS_SECRETOS))])
}

export async function asegurarDatos(knex: any) {
  await asegurarEstudio(knex)
  if (!(await knex.schema.hasTable(T_TENDENCIA))) {
    await knex.schema.createTable(T_TENDENCIA, (t: any) => {
      t.text("id").primary() // id del video (o liga, para referencias)
      t.text("red").notNullable() // youtube | referencia
      t.text("titulo")
      t.text("canal")
      t.bigInteger("vistas")
      t.bigInteger("media")
      t.decimal("veces", 8, 1)
      t.text("url")
      t.boolean("alarma").defaultTo(false)
      t.timestamp("created_at").defaultTo(knex.fn.now())
    })
  }
  if (!(await knex.schema.hasColumn(T_ESTUDIO, "retencion"))) await knex.schema.alterTable(T_ESTUDIO, (t: any) => t.jsonb("retencion"))
}

// ---------------------------------------------------------------------
// Google OAuth (cuenta del canal)
// ---------------------------------------------------------------------

export async function ligaConectarGoogle(knex: any) {
  if (!googleConfigurado()) throw new Error("Faltan GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en el .env del backend.")
  const state = randomBytes(16).toString("hex")
  await guardar(knex, { ...(await leer(knex)), state, state_hasta: Date.now() + 15 * 60_000 })
  const q = new URLSearchParams({ client_id: cid(), redirect_uri: redirectGoogle(), response_type: "code", scope: ALCANCES, access_type: "offline", prompt: "consent", state })
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`
}

async function pedirToken(campos: Record<string, string>) {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: cid(), client_secret: csec(), ...campos }),
    signal: AbortSignal.timeout(30_000),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok || !d.access_token) throw new Error(`Google: ${d.error_description || d.error || r.status}`.slice(0, 250))
  return d
}

export async function conectarGoogle(knex: any, code: string, state: string) {
  const v = await leer(knex)
  if (!v.state || v.state !== state || Date.now() > Number(v.state_hasta || 0)) throw new Error("La liga para conectar ya venció. Vuelve a apretar 'Conectar Google'.")
  const d = await pedirToken({ code, grant_type: "authorization_code", redirect_uri: redirectGoogle() })
  const nuevo = { ...v, state: null, state_hasta: null, access: d.access_token, access_hasta: Date.now() + (Number(d.expires_in) || 3600) * 1000 - 120_000, refresh: d.refresh_token || v.refresh }
  await guardar(knex, nuevo)
  const canal = await api(knex, "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true").catch(() => null)
  const nombre = canal?.items?.[0]?.snippet?.title || null
  await guardar(knex, { ...nuevo, canal: nombre, canal_id: canal?.items?.[0]?.id || null })
  return { ok: true, usuario: nombre }
}

async function token(knex: any) {
  const v = await leer(knex)
  if (v.access && Date.now() < Number(v.access_hasta || 0)) return descifrar(v.access)
  if (!v.refresh || !googleConfigurado()) return ""
  const d = await pedirToken({ grant_type: "refresh_token", refresh_token: descifrar(v.refresh) })
  await guardar(knex, { ...v, access: d.access_token, access_hasta: Date.now() + (Number(d.expires_in) || 3600) * 1000 - 120_000 })
  return d.access_token
}

async function api(knex: any, url: string) {
  const t = await token(knex)
  if (!t) throw new Error("Google no está conectado (Estudio → Conectar Google).")
  const r = await fetch(url, { headers: { Authorization: `Bearer ${t}` }, signal: AbortSignal.timeout(30_000) })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`Google: ${d.error?.message || r.status}`.slice(0, 250))
  return d
}

export async function estadoGoogle(knex: any) {
  const v = await leer(knex)
  return { configurado: googleConfigurado(), conectado: !!v.refresh, canal: v.canal || null, redirect: redirectGoogle() }
}

// ---------------------------------------------------------------------
// 1. Tendencias (YouTube)
// ---------------------------------------------------------------------

/** Veces que un video supera la media de su canal. */
export function vecesSobreMedia(vistas: number, vistasCanal: number, videosCanal: number) {
  const media = videosCanal > 0 ? vistasCanal / videosCanal : 0
  return { media: Math.round(media), veces: media > 0 ? +(vistas / media).toFixed(1) : 0 }
}

export async function revisarTendencias(knex: any, logger?: any) {
  await asegurarDatos(knex)
  const desde = new Date(Date.now() - 10 * 86_400_000).toISOString()
  const ids = new Set<string>()
  // Cada búsqueda gasta 100 unidades de la cuota diaria de YouTube (10,000): 8 búsquedas = 800
  for (const q of BUSQUEDAS) {
    const d = await api(knex, `https://www.googleapis.com/youtube/v3/search?${new URLSearchParams({ part: "id", q, type: "video", order: "viewCount", publishedAfter: desde, relevanceLanguage: "es", maxResults: "15" })}`).catch((e) => {
      logger?.warn?.(`[tendencias] ${q}: ${(e as Error).message}`)
      return null
    })
    for (const it of d?.items || []) if (it.id?.videoId) ids.add(it.id.videoId)
  }
  if (!ids.size) return { revisados: 0, alarmas: [] }
  const videos: any[] = []
  const lista = [...ids]
  for (let i = 0; i < lista.length; i += 50) {
    const d = await api(knex, `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${lista.slice(i, i + 50).join(",")}`)
    videos.push(...(d.items || []))
  }
  const canales = [...new Set(videos.map((v) => v.snippet?.channelId).filter(Boolean))]
  const stats: Record<string, any> = {}
  for (let i = 0; i < canales.length; i += 50) {
    const d = await api(knex, `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${canales.slice(i, i + 50).join(",")}`)
    for (const c of d.items || []) stats[c.id] = c.statistics || {}
  }
  const alarmas: any[] = []
  for (const v of videos) {
    const vistas = Number(v.statistics?.viewCount || 0)
    const c = stats[v.snippet?.channelId] || {}
    const { media, veces } = vecesSobreMedia(vistas, Number(c.viewCount || 0), Number(c.videoCount || 0))
    const fila = { id: v.id, red: "youtube", titulo: String(v.snippet?.title || "").slice(0, 200), canal: v.snippet?.channelTitle || null, vistas, media, veces, url: `https://www.youtube.com/watch?v=${v.id}` }
    const previo = await knex(T_TENDENCIA).where({ id: v.id }).first()
    if (previo) await knex(T_TENDENCIA).where({ id: v.id }).update({ vistas, media, veces })
    else await knex(T_TENDENCIA).insert(fila)
    if (veces >= UMBRAL && vistas >= 5000 && !previo?.alarma) {
      await knex(T_TENDENCIA).where({ id: v.id }).update({ alarma: true })
      alarmas.push(fila)
    }
  }
  if (alarmas.length) {
    try {
      const { mandarPrivado } = require("../social-telegram")
      await mandarPrivado(knex, {
        texto: `🚨 Tendencias en YouTube (${UMBRAL}× o más la media de su canal):\n\n` +
          alarmas.slice(0, 5).map((a) => `• ${a.titulo}\n  ${a.canal} · ${a.vistas.toLocaleString("es-MX")} vistas (${a.veces}× su media)\n  ${a.url}`).join("\n\n") +
          "\n\nEl guionista del Estudio las toma como ideas para los próximos videos.",
      })
    } catch {}
  }
  return { revisados: videos.length, alarmas: alarmas.map((a) => ({ titulo: a.titulo, veces: a.veces, url: a.url })) }
}

/** Lo que el guionista ve: lo que más está pegando y las referencias del dueño. */
export async function ideasParaGuion(knex: any) {
  await asegurarDatos(knex)
  const top = await knex(T_TENDENCIA).where({ red: "youtube" }).where("created_at", ">=", knex.raw("now() - interval '14 days'")).where("veces", ">=", Math.min(UMBRAL, 5)).orderBy("veces", "desc").limit(6).select("titulo", "veces")
  const refs = await knex(T_TENDENCIA).where({ red: "referencia" }).orderBy("created_at", "desc").limit(5).select("titulo", "canal")
  return {
    tendencias: top.map((t: any) => `«${t.titulo}» (${t.veces}× la media de su canal)`),
    referencias: refs.map((r: any) => `«${r.titulo}»${r.canal ? ` de ${r.canal}` : ""}`),
  }
}

/** Referencia del dueño (TikTok, YouTube o Instagram): se guarda el título para el guionista. */
export async function agregarReferencia(knex: any, url: string, nota = "") {
  await asegurarDatos(knex)
  const u = String(url || "").trim()
  if (!/^https:\/\/(www\.|m\.|vm\.)?(tiktok\.com|youtube\.com|youtu\.be|instagram\.com)\//i.test(u)) throw new Error("Pega una liga de TikTok, YouTube o Instagram.")
  let titulo = "", canal = ""
  const oembed = /tiktok/i.test(u) ? `https://www.tiktok.com/oembed?url=${encodeURIComponent(u)}` : /youtu/i.test(u) ? `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(u)}` : ""
  if (oembed) {
    const d = await fetch(oembed, { signal: AbortSignal.timeout(15_000) }).then((r) => r.json()).catch(() => null)
    titulo = d?.title || ""
    canal = d?.author_name || ""
  }
  titulo = [titulo, nota].filter(Boolean).join(" — ").slice(0, 300) || nota || u
  await knex(T_TENDENCIA).insert({ id: `ref:${u}`.slice(0, 300), red: "referencia", titulo, canal: canal || null, url: u }).onConflict("id").merge()
  return { titulo, canal }
}

// ---------------------------------------------------------------------
// 7. Retención (YouTube Analytics)
// ---------------------------------------------------------------------

export function idYoutube(r: any) {
  if (!r) return null
  if (r.id && /^[\w-]{11}$/.test(String(r.id))) return String(r.id)
  const m = String(r.url || "").match(/(?:shorts\/|watch\?v=|youtu\.be\/)([\w-]{11})/)
  return m ? m[1] : null
}

/** Dónde se va la gente: la caída más fuerte de la curva (proporción vista → segundo). */
export function dondeSeVan(curva: [number, number][], duracion: number) {
  if (curva.length < 3) return null
  let peor = { en: 0, caida: 0 }
  for (let i = 1; i < curva.length; i++) {
    const caida = curva[i - 1][1] - curva[i][1]
    if (caida > peor.caida) peor = { en: curva[i][0], caida }
  }
  const alFinal = curva[curva.length - 1][1]
  return { segundo: +(peor.en * duracion).toFixed(1), caida: +(peor.caida * 100).toFixed(0), al_final: +(alFinal * 100).toFixed(0) }
}

export async function revisarRetencion(knex: any, logger?: any) {
  await asegurarDatos(knex)
  const filas = await knex(T_ESTUDIO).where({ estado: "listo" }).whereNull("retencion").whereNotNull("post_id").where("created_at", "<=", knex.raw("now() - interval '2 days'")).where("created_at", ">=", knex.raw("now() - interval '40 days'")).limit(6)
  const notas: string[] = []
  for (const f of filas) {
    const post = await knex(T_POST).where({ id: f.post_id }).first("resultado", "publicada_en")
    const vid = idYoutube(post?.resultado?.youtube)
    if (!vid) continue
    const hasta = new Date().toISOString().slice(0, 10)
    const desde = new Date(post?.publicada_en || f.created_at).toISOString().slice(0, 10)
    const d = await api(knex, `https://youtubeanalytics.googleapis.com/v2/reports?${new URLSearchParams({ ids: "channel==MINE", startDate: desde, endDate: hasta, metrics: "audienceWatchRatio", dimensions: "elapsedVideoTimeRatio", filters: `video==${vid}` })}`).catch((e) => {
      logger?.warn?.(`[retencion] ${vid}: ${(e as Error).message}`)
      return null
    })
    const curva: [number, number][] = (d?.rows || []).map((r: any) => [Number(r[0]), Number(r[1])])
    const escenas = f.guion?.escenas || []
    const dur = (f.escenas || []).reduce((a: number, e: any) => a + Number(e?.segundos || 0), 0) || 30
    const dv = dondeSeVan(curva, dur)
    if (!dv) continue
    // ¿En qué escena cae ese segundo?
    let t = 0, escena = 0
    for (const [i, e] of (f.escenas || []).entries()) { t += Number(e?.segundos || 0); if (dv.segundo <= t) { escena = i; break } }
    const dicho = escenas[escena]?.narracion || ""
    const nota = dv.segundo <= 3
      ? `En «${f.guion?.titulo_seo}» se fue el ${dv.caida}% de la gente en el segundo ${dv.segundo} (el gancho «${f.guion?.gancho_pantalla}» no atrapó). Abre con algo más fuerte: el resultado, un error que cuesta dinero o una pregunta directa.`
      : `En «${f.guion?.titulo_seo}» la gente se fue en el segundo ${dv.segundo} (escena ${escena + 1}: «${dicho}»), cayó ${dv.caida}%. Haz esa parte más corta o con más tensión. Llegó al final el ${dv.al_final}%.`
    await knex(T_ESTUDIO).where({ id: f.id }).update({ retencion: JSON.stringify({ video: vid, curva: curva.slice(0, 100), ...dv }) })
    await knex("hetna_estudio_nota").insert({ nota, fuente: "retencion" })
    notas.push(nota)
  }
  if (notas.length) {
    try {
      const { mandarPrivado } = require("../social-telegram")
      await mandarPrivado(knex, { texto: `📉 Analista de retención:\n\n${notas.map((n) => `• ${n}`).join("\n\n")}\n\nYa se lo dije al guionista.` })
    } catch {}
  }
  return { revisados: filas.length, notas }
}

export async function resumenDatos(knex: any) {
  await asegurarDatos(knex)
  const tendencias = await knex(T_TENDENCIA).where({ red: "youtube" }).where("created_at", ">=", knex.raw("now() - interval '14 days'")).orderBy("veces", "desc").limit(8).select("titulo", "canal", "vistas", "veces", "url", "alarma")
  const referencias = await knex(T_TENDENCIA).where({ red: "referencia" }).orderBy("created_at", "desc").limit(8).select("id", "titulo", "url")
  const notas = await knex("hetna_estudio_nota").orderBy("created_at", "desc").limit(6).select("nota", "fuente", "created_at")
  return { google: await estadoGoogle(knex), umbral: UMBRAL, tendencias, referencias, notas }
}
