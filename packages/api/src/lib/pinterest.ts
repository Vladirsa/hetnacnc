// @ts-nocheck
// Marketing HETNA — Pinterest (API v5).
//
//   1. El dueño aprieta "Conectar Pinterest" y entra con la cuenta de HETNA;
//      Pinterest regresa a hetnacnc.com/r/pinterest-callback y aquí se cambia el
//      código por los tokens (guardados en la configuración del Social Hub; nunca
//      salen del servidor). El de acceso dura 30 días y se renueva solo.
//   2. Cada publicación con imagen que lleve Pinterest se vuelve un pin en el
//      tablero elegido, con su título, descripción y la liga medida a la tienda.
//      Los videos por ahora no (Pinterest pide otra subida): esos quedan a mano.
//
// Llaves en el .env del backend: PINTEREST_APP_ID y PINTEREST_APP_SECRET
// (la clave secreta aparece en developers.pinterest.com cuando aprueban el acceso).
import { randomBytes } from "crypto"

import { STORE_URL } from "./licitacion"
import { T_CONFIG_S, asegurarSocial } from "./social-hub"

const API = "https://api.pinterest.com/v5"
const AUTORIZAR = "https://www.pinterest.com/oauth/"
export const ALCANCES_PIN = "boards:read,pins:read,pins:write,user_accounts:read"
export const redirectPinterest = () => process.env.PINTEREST_REDIRECT_URI || `${STORE_URL}/r/pinterest-callback`

const appId = () => (process.env.PINTEREST_APP_ID || "").trim()
const secreto = () => (process.env.PINTEREST_APP_SECRET || "").trim()
export const pinterestConfigurado = () => !!(appId() && secreto())

async function leer(knex: any) {
  await asegurarSocial(knex)
  return (await knex(T_CONFIG_S).where({ clave: "pinterest" }).first())?.valor || {}
}
async function guardar(knex: any, v: any) {
  await knex.raw(`insert into ?? (clave, valor) values ('pinterest', ?::jsonb) on conflict (clave) do update set valor = excluded.valor`, [T_CONFIG_S, JSON.stringify(v)])
}

export async function ligaConectarPinterest(knex: any) {
  if (!pinterestConfigurado()) throw new Error("Faltan PINTEREST_APP_ID y PINTEREST_APP_SECRET en el .env del backend.")
  const state = randomBytes(16).toString("hex")
  const v = await leer(knex)
  await guardar(knex, { ...v, state, state_hasta: Date.now() + 15 * 60_000 })
  const q = new URLSearchParams({ client_id: appId(), redirect_uri: redirectPinterest(), response_type: "code", scope: ALCANCES_PIN, state })
  return `${AUTORIZAR}?${q}`
}

async function pedirToken(campos: Record<string, string>) {
  const r = await fetch(`${API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${Buffer.from(`${appId()}:${secreto()}`).toString("base64")}` },
    body: new URLSearchParams(campos),
    signal: AbortSignal.timeout(30_000),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok || !d.access_token) throw new Error(`Pinterest: ${d.message || d.error_description || d.error || r.status}`.slice(0, 250))
  return d
}

const conTokens = (v: any, d: any) => ({
  ...v,
  access: d.access_token,
  access_hasta: Date.now() + (Number(d.expires_in) || 30 * 86_400) * 1000 - 3600_000,
  refresh: d.refresh_token || v.refresh,
  alcances: d.scope || v.alcances,
})

export async function conectarPinterest(knex: any, code: string, state: string) {
  const v = await leer(knex)
  if (!v.state || v.state !== state || Date.now() > Number(v.state_hasta || 0)) throw new Error("La liga para conectar ya venció. Vuelve a apretar 'Conectar Pinterest'.")
  const d = await pedirToken({ grant_type: "authorization_code", code, redirect_uri: redirectPinterest() })
  let nuevo = conTokens({ ...v, state: null, state_hasta: null }, d)
  await guardar(knex, nuevo)
  const info = await infoPinterest(knex).catch(() => null)
  // Tablero: el que ya estaba elegido, uno que diga HETNA o el primero
  const tableros = await tablerosPinterest(knex).catch(() => [])
  const tablero = nuevo.tablero && tableros.some((t: any) => t.id === nuevo.tablero) ? nuevo.tablero : (tableros.find((t: any) => /hetna/i.test(t.nombre)) || tableros[0])?.id || null
  nuevo = { ...nuevo, usuario: info?.usuario || null, tablero }
  await guardar(knex, nuevo)
  return { ok: true, usuario: nuevo.usuario }
}

export async function tokenPinterest(knex: any) {
  const v = await leer(knex)
  if (!v.access) return ""
  if (Date.now() < Number(v.access_hasta || 0)) return v.access
  if (!v.refresh || !pinterestConfigurado()) return ""
  const d = await pedirToken({ grant_type: "refresh_token", refresh_token: v.refresh })
  const nuevo = conTokens(v, d)
  await guardar(knex, nuevo)
  return nuevo.access
}

async function api(knex: any, ruta: string, cuerpo?: any, metodo = "GET") {
  const t = await tokenPinterest(knex)
  if (!t) throw new Error("Pinterest no está conectado. Aprieta 'Conectar Pinterest' en Configuración.")
  const r = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    signal: AbortSignal.timeout(60_000),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`Pinterest: ${d.message || r.status}`.slice(0, 250))
  return d
}

export async function pinterestConectado(knex: any) {
  if (!pinterestConfigurado()) return false
  const v = await leer(knex)
  return !!((v.access || v.refresh) && v.tablero)
}

export async function infoPinterest(knex: any) {
  try {
    const d = await api(knex, "/user_account")
    return { ok: true, usuario: d.username || null }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export async function tablerosPinterest(knex: any) {
  const d = await api(knex, "/boards?page_size=50")
  return (d.items || []).map((b: any) => ({ id: b.id, nombre: b.name }))
}

export async function elegirTablero(knex: any, id: string) {
  const ts = await tablerosPinterest(knex)
  if (!ts.some((t: any) => t.id === id)) throw new Error("Ese tablero no es de la cuenta conectada.")
  const v = await leer(knex)
  await guardar(knex, { ...v, tablero: id })
}

export async function desconectarPinterest(knex: any) {
  const v = await leer(knex)
  await guardar(knex, { tablero: v.tablero || null, desconectado: new Date().toISOString() })
}

export async function estadoPinterest(knex: any) {
  const v = await leer(knex)
  const conectado = !!(v.access || v.refresh)
  return {
    configurado: pinterestConfigurado(),
    conectado,
    usuario: v.usuario || null,
    tablero: v.tablero || null,
    tableros: conectado ? await tablerosPinterest(knex).catch(() => []) : [],
    redirect: redirectPinterest(),
  }
}

/** Texto del pin: título (100) y descripción (800) a partir del texto de la publicación. */
export function textoPin(texto: string, titulo: string) {
  const limpio = String(texto || "").replace(/https?:\/\/\S+/g, "").replace(/\n{3,}/g, "\n\n").trim()
  const primera = limpio.split("\n").find((l) => l.trim()) || titulo || "HETNA CNC"
  return { titulo: (titulo || primera).replace(/[#*]/g, "").trim().slice(0, 100), descripcion: limpio.slice(0, 800) }
}

export async function publicarPinterest(knex: any, d: { texto: string; titulo: string; imagen: string; liga: string }) {
  try {
    const v = await leer(knex)
    if (!v.tablero) throw new Error("Elige el tablero de Pinterest en Configuración.")
    if (!d.imagen) throw new Error("Pinterest necesita una imagen.")
    const { titulo, descripcion } = textoPin(d.texto, d.titulo)
    const pin = await api(knex, "/pins", { board_id: v.tablero, title: titulo, description: descripcion, link: d.liga, alt_text: titulo, media_source: { source_type: "image_url", url: d.imagen } }, "POST")
    return { ok: true, id: pin.id || null }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}
