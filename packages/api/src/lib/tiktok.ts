// @ts-nocheck
// Marketing HETNA — TikTok (Content Posting API de TikTok for Developers).
//
// Cómo funciona:
//   1. El dueño aprieta "Conectar TikTok" en el panel y entra con la cuenta de
//      HETNA; TikTok regresa a hetnacnc.com/r/tiktok-callback y aquí se cambia
//      el código por los tokens (se guardan en la configuración del Social Hub;
//      nunca salen del servidor). El de acceso dura 24 h y se renueva solo con
//      el de renovación (dura 1 año).
//   2. Mientras TikTok no apruebe la auditoría de la app, los videos se mandan
//      como BORRADOR a la bandeja de la app de TikTok (subida "inbox"): al dueño
//      le llega la notificación, pone sonido y publica con un toque. El texto
//      para pegar le llega por Telegram.
//   3. Con la auditoría aprobada se podrá publicar directo (video.publish).
//
// Llaves en el .env del backend: TIKTOK_CLIENT_KEY y TIKTOK_CLIENT_SECRET.
import { randomBytes } from "crypto"

import { STORE_URL } from "./licitacion"
import { T_CONFIG_S, asegurarSocial } from "./social-hub"

const API = "https://open.tiktokapis.com/v2"
const AUTORIZAR = "https://www.tiktok.com/v2/auth/authorize/"
export const ALCANCES = "user.info.basic,video.upload,video.publish"
export const redirectTikTok = () => process.env.TIKTOK_REDIRECT_URI || `${STORE_URL}/r/tiktok-callback`

const llave = () => process.env.TIKTOK_CLIENT_KEY || ""
const secreto = () => process.env.TIKTOK_CLIENT_SECRET || ""
export const tiktokConfigurado = () => !!(llave() && secreto())

async function leer(knex: any) {
  await asegurarSocial(knex)
  return (await knex(T_CONFIG_S).where({ clave: "tiktok" }).first())?.valor || {}
}
async function guardar(knex: any, v: any) {
  await knex.raw(`insert into ?? (clave, valor) values ('tiktok', ?::jsonb) on conflict (clave) do update set valor = excluded.valor`, [T_CONFIG_S, JSON.stringify(v)])
}

/** Liga para entrar con la cuenta de TikTok de HETNA (con "state" para que nadie más pueda conectar la suya). */
export async function ligaConectar(knex: any) {
  if (!tiktokConfigurado()) throw new Error("Faltan TIKTOK_CLIENT_KEY y TIKTOK_CLIENT_SECRET en el .env del backend.")
  const state = randomBytes(16).toString("hex")
  const v = await leer(knex)
  await guardar(knex, { ...v, state, state_hasta: Date.now() + 15 * 60_000 })
  const q = new URLSearchParams({ client_key: llave(), scope: ALCANCES, response_type: "code", redirect_uri: redirectTikTok(), state })
  return `${AUTORIZAR}?${q}`
}

async function pedirToken(campos: Record<string, string>) {
  const r = await fetch(`${API}/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
    body: new URLSearchParams({ client_key: llave(), client_secret: secreto(), ...campos }),
    signal: AbortSignal.timeout(30_000),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok || d.error || !d.access_token) throw new Error(`TikTok: ${d.error_description || d.error || r.status}`.slice(0, 250))
  return d
}

const guardarTokens = (v: any, d: any) => ({
  ...v,
  access: d.access_token,
  access_hasta: Date.now() + (Number(d.expires_in) || 86_400) * 1000 - 5 * 60_000,
  refresh: d.refresh_token || v.refresh,
  refresh_hasta: d.refresh_expires_in ? Date.now() + Number(d.refresh_expires_in) * 1000 : v.refresh_hasta,
  open_id: d.open_id || v.open_id,
  alcances: d.scope || v.alcances,
})

/** Regreso de TikTok (/r/tiktok-callback): cambia el código por los tokens. */
export async function conectarConCodigo(knex: any, code: string, state: string) {
  const v = await leer(knex)
  if (!v.state || v.state !== state || Date.now() > Number(v.state_hasta || 0)) throw new Error("La liga para conectar ya venció. Vuelve a apretar 'Conectar TikTok'.")
  const d = await pedirToken({ code, grant_type: "authorization_code", redirect_uri: redirectTikTok() })
  const nuevo = guardarTokens({ ...v, state: null, state_hasta: null }, d)
  await guardar(knex, nuevo)
  const info = await infoTikTok(knex).catch(() => null)
  if (info?.ok) await guardar(knex, { ...nuevo, usuario: info.usuario })
  return { ok: true, usuario: info?.usuario || null }
}

/** Token de acceso vigente (se renueva solo). */
export async function tokenTikTok(knex: any) {
  const v = await leer(knex)
  if (!v.access) return ""
  if (Date.now() < Number(v.access_hasta || 0)) return v.access
  if (!v.refresh || !tiktokConfigurado()) return ""
  const d = await pedirToken({ grant_type: "refresh_token", refresh_token: v.refresh })
  const nuevo = guardarTokens(v, d)
  await guardar(knex, nuevo)
  return nuevo.access
}

export async function tiktokConectado(knex: any) {
  if (!tiktokConfigurado()) return false
  const v = await leer(knex)
  return !!(v.access || v.refresh)
}

export async function desconectarTikTok(knex: any) {
  const v = await leer(knex)
  await guardar(knex, { usuario: null, access: null, refresh: null, open_id: null, desconectado: new Date().toISOString(), modo: v.modo || "borrador" })
}

async function api(knex: any, ruta: string, cuerpo?: any, metodo = "POST") {
  const t = await tokenTikTok(knex)
  if (!t) throw new Error("TikTok no está conectado. Aprieta 'Conectar TikTok' en Configuración.")
  const r = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json; charset=UTF-8" },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    signal: AbortSignal.timeout(60_000),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok || (d.error && d.error.code && d.error.code !== "ok")) throw new Error(`TikTok: ${d.error?.message || d.error?.code || r.status}`.slice(0, 250))
  return d.data || {}
}

export async function infoTikTok(knex: any) {
  try {
    const d = await api(knex, "/user/info/?fields=open_id,display_name,avatar_url", undefined, "GET")
    return { ok: true, usuario: d.user?.display_name || null, id: d.user?.open_id || null }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export async function estadoTikTok(knex: any) {
  const v = await leer(knex)
  return {
    configurado: tiktokConfigurado(),
    conectado: !!(v.access || v.refresh),
    usuario: v.usuario || null,
    alcances: v.alcances || null,
    modo: v.modo || "borrador",
    redirect: redirectTikTok(),
  }
}

/**
 * Partes de la subida según las reglas de TikTok: hasta 64 MB va en una sola
 * parte; más grande, en partes de 10 MB (la última se lleva el sobrante).
 */
export function partes(tam: number) {
  const MB = 1024 * 1024
  if (tam <= 64 * MB) return { chunk: tam, total: 1 }
  const chunk = 10 * MB
  return { chunk, total: Math.floor(tam / chunk) }
}

/** Manda el video como borrador a la bandeja de la app de TikTok (no necesita auditoría aprobada). */
export async function borradorTikTok(knex: any, video: string) {
  try {
    const r = await fetch(video, { signal: AbortSignal.timeout(120_000) })
    if (!r.ok) throw new Error(`No se pudo bajar el video (${r.status})`)
    const buf = Buffer.from(await r.arrayBuffer())
    const { chunk, total } = partes(buf.length)
    const ini = await api(knex, "/post/publish/inbox/video/init/", { source_info: { source: "FILE_UPLOAD", video_size: buf.length, chunk_size: chunk, total_chunk_count: total } })
    if (!ini.upload_url) throw new Error("TikTok no dio dónde subir el video")
    for (let i = 0; i < total; i++) {
      const desde = i * chunk
      const hasta = i === total - 1 ? buf.length - 1 : desde + chunk - 1
      const parte = buf.subarray(desde, hasta + 1)
      const s = await fetch(ini.upload_url, {
        method: "PUT",
        headers: { "Content-Type": "video/mp4", "Content-Length": String(parte.length), "Content-Range": `bytes ${desde}-${hasta}/${buf.length}` },
        body: parte,
        signal: AbortSignal.timeout(180_000),
      })
      if (!s.ok && s.status !== 201 && s.status !== 206) throw new Error(`TikTok no aceptó el video (${s.status})`)
    }
    return { ok: true, id: ini.publish_id || null, borrador: true, aviso: "Llegó como borrador a la app de TikTok: ábrela, pon sonido y publícalo." }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}
