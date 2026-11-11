// @ts-nocheck
// Marketing HETNA — Threads (API de Meta, graph.threads.net).
// El backend publica directo (no pasa por n8n) porque el token de Threads dura
// 60 días y hay que renovarlo: el primero va en el .env (THREADS_TOKEN) y las
// renovaciones se guardan en la configuración del Social Hub (nunca salen del
// servidor). Publica texto (máx. 500), imagen, carrusel (hasta 20) o video.
import { T_CONFIG_S, asegurarSocial } from "./social-hub"

const API = "https://graph.threads.net/v1.0"
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function leer(knex: any) {
  await asegurarSocial(knex)
  return (await knex(T_CONFIG_S).where({ clave: "threads" }).first())?.valor || {}
}
async function guardar(knex: any, v: any) {
  await knex.raw(`insert into ?? (clave, valor) values ('threads', ?::jsonb) on conflict (clave) do update set valor = excluded.valor`, [T_CONFIG_S, JSON.stringify(v)])
}

/** Token vigente: el renovado (si es del mismo token base) o el del .env. */
export async function tokenThreads(knex: any) {
  const env = process.env.THREADS_TOKEN || ""
  if (!env) return ""
  const v = await leer(knex)
  // Si cambian el token del .env, se usa el nuevo y se olvida el renovado
  if (v.base && v.base === env.slice(-12) && v.token) return v.token
  return env
}
export const threadsListo = () => !!process.env.THREADS_TOKEN

async function llamar(metodo: "GET" | "POST", ruta: string, token: string, params: Record<string, string> = {}) {
  const q = new URLSearchParams({ ...params, access_token: token })
  const r = await fetch(`${API}${ruta}?${q}`, { method: metodo, signal: AbortSignal.timeout(60_000) })
  const d = await r.json().catch(() => ({}))
  if (!r.ok || d.error) throw new Error(`Threads: ${d.error?.message || r.status}`.slice(0, 250))
  return d
}

export async function infoThreads(knex: any) {
  const t = await tokenThreads(knex)
  if (!t) return { ok: false, error: "Falta THREADS_TOKEN en el .env del backend." }
  try {
    const d = await llamar("GET", "/me", t, { fields: "id,username" })
    return { ok: true, usuario: d.username, id: d.id }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

async function esperarListo(id: string, token: string, topeSeg: number) {
  const fin = Date.now() + topeSeg * 1000
  while (Date.now() < fin) {
    const s = await llamar("GET", `/${id}`, token, { fields: "status,error_message" }).catch(() => null)
    if (s?.status === "FINISHED") return
    if (s?.status === "ERROR" || s?.status === "EXPIRED") throw new Error(`Threads no pudo procesar el archivo: ${s.error_message || s.status}`)
    await esperar(5000)
  }
  throw new Error("Threads tardó demasiado en procesar el archivo.")
}

/** Publica en Threads. Devuelve { ok, id, url } o { ok:false, error }. */
export async function publicarThreads(knex: any, d: { texto: string; imagen?: string; video?: string; imagenes?: string[] }) {
  const token = await tokenThreads(knex)
  if (!token) return { ok: false, error: "Threads no está conectado (falta THREADS_TOKEN)." }
  try {
    const texto = String(d.texto || "").slice(0, 500)
    let contenedor: string
    const imgs = (d.imagenes || []).filter(Boolean).slice(0, 20)
    if (d.video) {
      contenedor = (await llamar("POST", "/me/threads", token, { media_type: "VIDEO", video_url: d.video, text: texto })).id
      await esperarListo(contenedor, token, 150)
    } else if (imgs.length >= 2) {
      const hijos: string[] = []
      for (const u of imgs) hijos.push((await llamar("POST", "/me/threads", token, { media_type: "IMAGE", image_url: u, is_carousel_item: "true" })).id)
      contenedor = (await llamar("POST", "/me/threads", token, { media_type: "CAROUSEL", children: hijos.join(","), text: texto })).id
      await esperar(10_000)
    } else if (d.imagen || imgs[0]) {
      contenedor = (await llamar("POST", "/me/threads", token, { media_type: "IMAGE", image_url: d.imagen || imgs[0], text: texto })).id
      await esperar(10_000)
    } else {
      contenedor = (await llamar("POST", "/me/threads", token, { media_type: "TEXT", text: texto })).id
      await esperar(3000)
    }
    const pub = await llamar("POST", "/me/threads_publish", token, { creation_id: contenedor })
    const liga = await llamar("GET", `/${pub.id}`, token, { fields: "permalink" }).catch(() => null)
    return { ok: true, id: String(pub.id), url: liga?.permalink || null }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

/** Job semanal: renueva el token (dura 60 días; se puede renovar si tiene más de 24 h). */
export async function renovarThreads(knex: any, logger?: any) {
  const env = process.env.THREADS_TOKEN || ""
  if (!env) return
  const v = await leer(knex)
  if (v.base === env.slice(-12) && v.renovado && Date.now() - new Date(v.renovado).getTime() < 6 * 86_400_000) return
  try {
    const t = await tokenThreads(knex)
    const r = await fetch(`https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${encodeURIComponent(t)}`, { signal: AbortSignal.timeout(30_000) })
    const d = await r.json().catch(() => ({}))
    if (!d.access_token) throw new Error(d.error?.message || `HTTP ${r.status}`)
    await guardar(knex, { base: env.slice(-12), token: d.access_token, renovado: new Date().toISOString() })
    logger?.info?.("[social] token de Threads renovado")
  } catch (e) {
    logger?.warn?.(`[social] no se pudo renovar el token de Threads: ${(e as Error).message}`)
  }
}
