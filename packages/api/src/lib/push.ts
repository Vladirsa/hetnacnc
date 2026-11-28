// Notificaciones al celular (Web Push) para clientes y talleres.
//
// Funcionan desde el navegador, sin instalar ninguna app:
//   · Android (Chrome, Edge, Samsung): con la página abierta o cerrada.
//   · iPhone (iOS 16.4 o más nuevo): sólo si agregaron HETNA a la pantalla de
//     inicio (Compartir > Agregar a inicio). Es una regla de Apple.
//   · Computadora (Chrome, Edge, Firefox, Safari).
//
// Cada navegador que acepta guarda su "suscripción" en hetna_push, ligada al
// cliente, al taller o a los dos (la misma persona puede ser ambas cosas en el
// mismo celular). El service worker de la tienda (apps/storefront/public/sw.js)
// recibe el aviso y lo muestra.
//
// Nunca detiene el flujo que lo llama: si falta la configuración o el envío
// falla, se registra y se sigue.
//
// Variables (.env de packages/api) — se crean con
//   bunx medusa exec ./src/scripts/crear-llaves-push.ts
//   VAPID_PUBLIC_KEY   pública (también la usa el navegador)
//   VAPID_PRIVATE_KEY  privada: nunca sale del servidor
//   VAPID_SUBJECT      mailto: de contacto (por defecto mailto:hola@hetnacnc.com)
import { clientesConCorreoConfiable } from "./verificar-correo"
import webpush from "web-push"
import { parse as parseUrl } from "url"

import { avisarWhatsapp } from "./whatsapp"

export const T_PUSH = "hetna_push"

export type AvisoPush = {
  titulo: string
  cuerpo: string
  url?: string // a dónde lleva al tocarla (ruta o URL completa)
  etiqueta?: string // avisos con la misma etiqueta se reemplazan (no se apilan)
}

type Suscripcion = { endpoint: string; keys: { p256dh: string; auth: string } }

const SITIO = (process.env.STOREFRONT_URL || "https://hetnacnc.com").replace(/\/$/, "")

export const llavePublicaPush = () => (process.env.VAPID_PUBLIC_KEY || "").trim()

let configurado: boolean | null = null
function listo(): boolean {
  if (configurado !== null) return configurado
  const pub = llavePublicaPush()
  const priv = (process.env.VAPID_PRIVATE_KEY || "").trim()
  if (!pub || !priv) return (configurado = false)
  try {
    webpush.setVapidDetails((process.env.VAPID_SUBJECT || "mailto:hola@hetnacnc.com").trim(), pub, priv)
    configurado = true
  } catch {
    configurado = false
  }
  return configurado
}
export const pushListo = () => listo()

let tabla = false
export async function asegurarTablaPush(knex: any) {
  if (tabla) return
  if (!(await knex.schema.hasTable(T_PUSH))) {
    await knex.schema.createTable(T_PUSH, (t: any) => {
      t.text("endpoint").primary()
      t.text("p256dh").notNullable()
      t.text("auth").notNullable()
      t.text("customer_id").nullable().index()
      t.text("seller_id").nullable().index()
      t.text("dispositivo").nullable()
      t.integer("fallos").notNullable().defaultTo(0)
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
      t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }
  // Avisos de productos nuevos (28 nov 2026): también para visitantes sin cuenta
  if (!(await knex.schema.hasColumn(T_PUSH, "novedades"))) {
    try {
      await knex.schema.alterTable(T_PUSH, (t: any) => {
        t.boolean("novedades").notNullable().defaultTo(false).index()
      })
    } catch (e: any) {
      // otro proceso la agregó al mismo tiempo (42701: la columna ya existe)
      if (e?.code !== "42701" && e?.code !== "42P07") throw e
    }
  }
  tabla = true
}

export function validarSuscripcion(b: any): Suscripcion | null {
  const endpoint = String(b?.endpoint || "")
  const p256dh = String(b?.keys?.p256dh || "")
  const auth = String(b?.keys?.auth || "")
  if (!/^https:\/\/[^\s]{10,900}$/.test(endpoint) || p256dh.length < 20 || p256dh.length > 200 || auth.length < 10 || auth.length > 100) return null
  return { endpoint, keys: { p256dh, auth } }
}

/** ¿La dirección es de un servicio de avisos del navegador (Chrome, Firefox, Edge, Safari)? */
export function endpointDePush(endpoint: string): boolean {
  try {
    const u = new URL(endpoint)
    if (u.protocol !== "https:" || u.port || u.username || u.password) return false
    const h = u.hostname.toLowerCase()
    // sólo nombres limpios, y el mismo para el lector viejo de Node (url.parse, el que usa web-push):
    // "https://127.0.0.1;.notify.windows.com" pasaría con uno y se conectaría a otro
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(h)) return false
    // eslint-disable-next-line n/no-deprecated-api
    if ((parseUrl(endpoint).hostname || "").toLowerCase() !== h) return false
    return h === "fcm.googleapis.com" || h === "updates.push.services.mozilla.com" || h === "web.push.apple.com" || h.endsWith(".push.apple.com") || h.endsWith(".notify.windows.com")
  } catch {
    return false
  }
}

/** Guarda (o actualiza) la suscripción de este navegador para un cliente o un taller. */
export async function guardarSuscripcion(
  knex: any,
  s: Suscripcion,
  quien: { customerId?: string | null; sellerId?: string | null; novedades?: boolean },
  dispositivo?: string
) {
  await asegurarTablaPush(knex)
  const fila: Record<string, unknown> = {
    endpoint: s.endpoint,
    p256dh: s.keys.p256dh,
    auth: s.keys.auth,
    dispositivo: dispositivo ? String(dispositivo).slice(0, 120) : null,
    fallos: 0,
    updated_at: knex.fn.now(),
  }
  if (quien.customerId) fila.customer_id = quien.customerId
  if (quien.sellerId) fila.seller_id = quien.sellerId
  if (quien.novedades !== undefined) fila.novedades = quien.novedades
  const actualizar = ["p256dh", "auth", "dispositivo", "fallos", "updated_at"]
  if (quien.customerId) actualizar.push("customer_id")
  if (quien.sellerId) actualizar.push("seller_id")
  if (quien.novedades !== undefined) actualizar.push("novedades")
  // sin cuenta (sólo novedades): si ese navegador ya es de un cliente o taller, sólo se prende el aviso
  // de novedades; las llaves no se tocan (quien conozca el endpoint no puede cortar sus avisos)
  if (!quien.customerId && !quien.sellerId) {
    const ya = await knex(T_PUSH).where({ endpoint: s.endpoint }).first("customer_id", "seller_id")
    if (ya && (ya.customer_id || ya.seller_id)) {
      await knex(T_PUSH).where({ endpoint: s.endpoint }).update({ novedades: !!quien.novedades, updated_at: knex.fn.now() })
      return
    }
  }
  await knex(T_PUSH).insert(fila).onConflict("endpoint").merge(actualizar)
}

/** Quita el aviso de este navegador para el cliente o el taller (o del todo). */
export async function borrarSuscripcion(
  knex: any,
  endpoint: string,
  quien: "cliente" | "taller" | "novedades" | "todo" = "todo",
  // Sólo la suscripción de esa cuenta (antes un taller podía borrar la de otro)
  dueno?: { sellerId?: string; customerId?: string }
) {
  await asegurarTablaPush(knex)
  const q = knex(T_PUSH).where({ endpoint: String(endpoint || "") })
  if (dueno?.sellerId) q.where({ seller_id: dueno.sellerId })
  if (dueno?.customerId) q.where({ customer_id: dueno.customerId })
  if (quien === "todo") return q.delete()
  await q.clone().update(quien === "cliente" ? { customer_id: null } : quien === "taller" ? { seller_id: null } : { novedades: false })
  // sin cuenta, sin taller y sin avisos de novedades ya no sirve
  await knex(T_PUSH).where({ endpoint: String(endpoint || "") }).whereNull("customer_id").whereNull("seller_id").where({ novedades: false }).delete()
}

export async function tieneSuscripcion(knex: any, endpoint: string) {
  await asegurarTablaPush(knex)
  const f = await knex(T_PUSH).where({ endpoint: String(endpoint || "") }).first("customer_id", "seller_id", "novedades")
  return { cliente: !!f?.customer_id, taller: !!f?.seller_id, novedades: !!f?.novedades }
}

async function mandar(knex: any, filas: { endpoint: string; p256dh: string; auth: string }[], aviso: AvisoPush, logger?: any) {
  if (!filas.length || !listo()) return 0
  const url = aviso.url ? (aviso.url.startsWith("http") ? aviso.url : `${SITIO}${aviso.url.startsWith("/") ? "" : "/"}${aviso.url}`) : SITIO
  const carga = JSON.stringify({
    titulo: aviso.titulo.slice(0, 80),
    cuerpo: aviso.cuerpo.slice(0, 220),
    url,
    etiqueta: aviso.etiqueta || undefined,
  })
  let ok = 0
  // Sin repetir el mismo navegador si viene por dos caminos
  const vistos = new Set<string>()
  for (const f of filas) {
    if (vistos.has(f.endpoint)) continue
    vistos.add(f.endpoint)
    try {
      await webpush.sendNotification({ endpoint: f.endpoint, keys: { p256dh: f.p256dh, auth: f.auth } }, carga, { TTL: 60 * 60 * 24 })
      ok++
    } catch (e: any) {
      const codigo = Number(e?.statusCode || 0)
      // 404/410: el navegador ya no existe o quitó el permiso -> se borra
      if (codigo === 404 || codigo === 410) await knex(T_PUSH).where({ endpoint: f.endpoint }).delete().catch(() => undefined)
      else {
        await knex(T_PUSH).where({ endpoint: f.endpoint }).increment("fallos", 1).catch(() => undefined)
        logger?.warn?.(`[push] no se pudo enviar (${codigo || e?.message})`)
      }
    }
  }
  // Los que fallan una y otra vez se limpian
  await knex(T_PUSH).where("fallos", ">=", 5).delete().catch(() => undefined)
  return ok
}

/** Aviso a los celulares de uno o varios talleres. */
export async function pushATalleres(knex: any, sellerIds: (string | null | undefined)[], aviso: AvisoPush, logger?: any) {
  try {
    const ids = [...new Set(sellerIds.filter(Boolean))] as string[]
    // También por WhatsApp a los talleres con número verificado (en segundo plano: no frena a quien avisa)
    if (ids.length) void avisarWhatsapp(knex, { sellerIds: ids }, aviso, logger)
    if (!ids.length || !listo()) return 0
    await asegurarTablaPush(knex)
    const filas = await knex(T_PUSH).whereIn("seller_id", ids).select("endpoint", "p256dh", "auth")
    return await mandar(knex, filas, aviso, logger)
  } catch (e) {
    logger?.warn?.(`[push] taller: ${(e as Error).message}`)
    return 0
  }
}

/** Aviso a los celulares de un cliente (por su id, o por su correo si no se tiene el id). */
export async function pushACliente(
  knex: any,
  cliente: { customerId?: string | null; email?: string | null },
  aviso: AvisoPush,
  logger?: any,
  // whatsapp: false cuando el WhatsApp ya lo manda otro aviso más completo (pedidos: lib/whatsapp-pedidos.ts)
  opciones: { whatsapp?: boolean } = {}
) {
  try {
    const ids = new Set<string>()
    if (cliente.customerId) ids.add(cliente.customerId)
    // Por correo sólo las cuentas con el correo confirmado
    if (cliente.email) for (const id of await clientesConCorreoConfiable(knex, cliente.email)) ids.add(id)
    // También por WhatsApp si el cliente verificó su número (en segundo plano)
    if (ids.size && opciones.whatsapp !== false) void avisarWhatsapp(knex, { customerIds: [...ids] }, aviso, logger)
    if (!listo()) return 0
    await asegurarTablaPush(knex)
    if (!ids.size) return 0
    const filas = await knex(T_PUSH).whereIn("customer_id", [...ids]).select("endpoint", "p256dh", "auth")
    return await mandar(knex, filas, aviso, logger)
  } catch (e) {
    logger?.warn?.(`[push] cliente: ${(e as Error).message}`)
    return 0
  }
}

/** Aviso de promoción a todos los clientes suscritos (ofertas, novedades). */
export async function pushATodosLosClientes(knex: any, aviso: AvisoPush, logger?: any) {
  try {
    if (!listo()) return 0
    await asegurarTablaPush(knex)
    const filas = await knex(T_PUSH).whereNotNull("customer_id").select("endpoint", "p256dh", "auth")
    return await mandar(knex, filas, aviso, logger)
  } catch (e) {
    logger?.warn?.(`[push] todos: ${(e as Error).message}`)
    return 0
  }
}

/** Aviso de productos nuevos a quien lo pidió (con o sin cuenta). */
export async function pushNovedades(knex: any, aviso: AvisoPush, logger?: any) {
  try {
    if (!listo()) return 0
    await asegurarTablaPush(knex)
    const filas = await knex(T_PUSH).where({ novedades: true }).select("endpoint", "p256dh", "auth")
    return await mandar(knex, filas, aviso, logger)
  } catch (e) {
    logger?.warn?.(`[push] novedades: ${(e as Error).message}`)
    return 0
  }
}

/** El texto del aviso diario de productos nuevos (null si no hubo). */
export function avisoNovedades(productos: { title: string; handle: string }[]): AvisoPush | null {
  const p = productos.filter((x) => x.title && x.handle)
  if (!p.length) return null
  // siempre a /mx/novedades (lista lo que la tienda sí muestra): una ficha directa podría ya no estar visible
  if (p.length === 1) return { titulo: "Nuevo en HETNA", cuerpo: p[0].title, url: "/mx/novedades", etiqueta: "novedades" }
  const nombres = p.slice(0, 3).map((x) => x.title).join(", ")
  return { titulo: `${p.length} productos nuevos en HETNA`, cuerpo: p.length > 3 ? `${nombres} y ${p.length - 3} más` : nombres, url: "/mx/novedades", etiqueta: "novedades" }
}
