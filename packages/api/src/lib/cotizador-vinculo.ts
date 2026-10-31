// Una sola cuenta: la cuenta de hetnacnc.com (Medusa) vinculada con el taller
// del Cotizador (Supabase).
//
// Por qué con un código y no "por correo": la tienda no confirma el correo al
// crear la cuenta, así que cualquiera podría abrir una cuenta en la tienda con
// el correo de otro taller. Vincular por correo le daría la entrada a un taller
// ajeno. Con el código, la misma persona demuestra que maneja las dos cuentas:
//
//   1. En hetnacnc.com (con su sesión) pide un código de 6 dígitos (15 min).
//   2. En la app del Cotizador (con su sesión de administrador del taller)
//      escribe el código -> POST /api/cotizador-suscripcion/vincular
//
// Ya vinculadas:
//   - El botón "Cotizador" de la tienda entra a la app sin volver a escribir la
//     contraseña (liga de acceso de un solo uso que genera Supabase).
//   - El plan del Cotizador cuenta en la tienda (archivos gratis sin límite).
//
// UNA SOLA CUENTA (31 oct): desde que la tienda confirma el correo, ya se puede
// confiar en él. Con el correo confirmado, el botón Cotizador (entradaCotizador):
//   - si ya hay un taller en el Cotizador con ese mismo correo, lo vincula solo;
//   - si no, lleva a /cotizador/activar, que crea el usuario del Cotizador (con
//     el correo ya confirmado, sin contraseña propia) y su taller con la prueba
//     de 14 días (activarCotizador).
// En los dos casos entra con la liga de un solo uso: la persona nunca escribe
// otra contraseña. El código de 6 dígitos queda para talleres con otro correo.
import { createHash, randomBytes, randomInt } from "crypto"

import { ErrorSuscripcion, RETORNO, adminDesdeToken, supabaseListo } from "./cotizador-suscripciones"
import { planEfectivo, supa, type PlanEfectivo, type Taller } from "./cotizador-crm"
import { correosDeLaCasa } from "./cuentas-casa"
import { mandarCorreoVerificacion } from "./verificar-correo"

export const T_VINCULO = "hetna_cotizador_vinculo"
export const T_CODIGO = "hetna_cotizador_codigo"
const VIGENCIA_MIN = 15

let listo = false
async function asegurarTablas(knex: any) {
  if (listo) return
  if (!(await knex.schema.hasTable(T_VINCULO))) {
    await knex.schema.createTable(T_VINCULO, (t: any) => {
      t.text("customer_id").primary()
      t.text("negocio_id").notNullable().index()
      // Correo de la cuenta de Supabase que vinculó (el administrador del taller):
      // a ésa se le genera la liga de acceso.
      t.text("correo_app").notNullable()
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }
  if (!(await knex.schema.hasTable(T_CODIGO))) {
    await knex.schema.createTable(T_CODIGO, (t: any) => {
      t.text("codigo").primary()
      t.text("customer_id").notNullable().index()
      t.timestamp("expira", { useTz: true }).notNullable()
    })
  }
  listo = true
}

async function tallerPorId(id: string): Promise<Taller | null> {
  const filas = await supa<Taller[]>(
    `/rest/v1/negocios?id=eq.${encodeURIComponent(id)}&select=id,nombre,correo,telefono,plan,plan_estado,plan_renueva,plan_vence,pago_proveedor,trial_hasta`
  )
  return filas[0] ? { ...filas[0], created_at: null } : null
}

export type EstadoVinculo =
  | { vinculado: false }
  | { vinculado: true; taller: string; plan: PlanEfectivo; correo_app: string; desde: string }

export async function estadoVinculo(knex: any, customerId: string): Promise<EstadoVinculo> {
  await asegurarTablas(knex)
  const v = await knex(T_VINCULO).where({ customer_id: customerId }).first()
  if (!v || !supabaseListo()) return { vinculado: false }
  const t = await tallerPorId(v.negocio_id).catch(() => null)
  if (!t) return { vinculado: false }
  return {
    vinculado: true,
    taller: t.nombre || "Tu taller",
    plan: planEfectivo(t),
    correo_app: v.correo_app,
    desde: new Date(v.created_at).toISOString(),
  }
}

/** Plan del Cotizador del taller vinculado ("gratis" si no hay). Para la tienda. */
export async function planVinculado(knex: any, customerId: string): Promise<PlanEfectivo> {
  try {
    const e = await estadoVinculo(knex, customerId)
    return e.vinculado ? e.plan : "gratis"
  } catch {
    return "gratis"
  }
}

/** Código de 6 dígitos para escribir en la app. Reemplaza al anterior del mismo cliente. */
export async function crearCodigo(knex: any, customerId: string): Promise<{ codigo: string; expira: string }> {
  await asegurarTablas(knex)
  await knex(T_CODIGO).where({ customer_id: customerId }).orWhere("expira", "<", new Date()).del()
  for (let i = 0; i < 5; i++) {
    const codigo = String(randomInt(0, 1_000_000)).padStart(6, "0")
    const expira = new Date(Date.now() + VIGENCIA_MIN * 60_000)
    const ins = await knex(T_CODIGO).insert({ codigo, customer_id: customerId, expira }).onConflict("codigo").ignore().returning("codigo")
    if (ins.length) return { codigo, expira: expira.toISOString() }
  }
  throw new Error("No se pudo generar el código")
}

// Intentos fallidos por taller, para que nadie pruebe códigos a lo loco
const fallos = new Map<string, { n: number; desde: number }>()
const MAX_FALLOS = 8

/** La app manda el código (con la sesión del administrador del taller). */
export async function vincularDesdeApp(knex: any, token: string | undefined, codigoCrudo: string) {
  if (!supabaseListo()) throw new ErrorSuscripcion("La vinculación todavía no está activa.", 503)
  const { correo, negocio } = await adminDesdeToken(token)
  await asegurarTablas(knex)

  const f = fallos.get(negocio.id)
  if (f && Date.now() - f.desde < 3_600_000 && f.n >= MAX_FALLOS)
    throw new ErrorSuscripcion("Demasiados intentos. Espera una hora y pide un código nuevo en hetnacnc.com.", 429)

  const codigo = String(codigoCrudo || "").replace(/\D/g, "")
  const fila = codigo.length === 6 ? await knex(T_CODIGO).where({ codigo }).first() : null
  if (!fila || new Date(fila.expira).getTime() < Date.now()) {
    const actual = f && Date.now() - f.desde < 3_600_000 ? f : { n: 0, desde: Date.now() }
    fallos.set(negocio.id, { ...actual, n: actual.n + 1 })
    throw new ErrorSuscripcion("Ese código no existe o ya venció. Pide uno nuevo en hetnacnc.com → Mi cuenta.")
  }

  await knex(T_CODIGO).where({ codigo }).del()
  await knex(T_VINCULO)
    .insert({ customer_id: fila.customer_id, negocio_id: negocio.id, correo_app: correo.toLowerCase(), created_at: new Date() })
    .onConflict("customer_id")
    .merge()
  fallos.delete(negocio.id)
  return { ok: true, taller: negocio.nombre || "Tu taller" }
}

export async function desvincular(knex: any, customerId: string) {
  await asegurarTablas(knex)
  await knex(T_VINCULO).where({ customer_id: customerId }).del()
}

/**
 * Liga de acceso de un solo uso a la app para la cuenta vinculada: Supabase la
 * genera con la llave de servicio, y al abrirla la app queda con la sesión
 * iniciada (igual que la liga de "recuperar contraseña").
 */
export async function ligaEntrada(knex: any, customerId: string, destino?: string): Promise<string | null> {
  if (!supabaseListo()) return null
  await asegurarTablas(knex)
  const v = await knex(T_VINCULO).where({ customer_id: customerId }).first()
  if (!v) return null
  const r = await supa<any>("/auth/v1/admin/generate_link", {
    method: "POST",
    body: JSON.stringify({ type: "magiclink", email: v.correo_app, redirect_to: destino || RETORNO }),
  })
  return r?.action_link || r?.properties?.action_link || null
}

/**
 * Huella del correo de la cuenta de la tienda (16 letras de su SHA-256) para
 * cuando la cuenta NO está vinculada: el botón Cotizador abre
 * /cotizador/?cuenta=<huella> y la app cierra la sesión que haya en ese
 * navegador si es de OTRO correo. Así una cuenta nueva de la tienda no cae en
 * el taller de la persona que usó antes ese navegador. Va la huella y no el
 * correo para no dejar el correo en la barra de direcciones ni en el historial.
 * La app calcula lo mismo en lib/main.dart (_cerrarSesionAjena).
 */
export function huellaCorreo(correo: string): string {
  return createHash("sha256").update(correo.trim().toLowerCase()).digest("hex").slice(0, 16)
}

export async function huellaCliente(knex: any, customerId: string): Promise<string | null> {
  const c = await knex("customer").where({ id: customerId }).whereNull("deleted_at").first("email")
  return c?.email ? huellaCorreo(c.email) : null
}

// ---------------------------------------------------------------------------
// Una sola cuenta
// ---------------------------------------------------------------------------

type ClienteTienda = {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  phone: string | null
  company_name: string | null
  metadata: Record<string, unknown> | null
}

async function clienteTienda(knex: any, customerId: string): Promise<ClienteTienda | null> {
  return (
    (await knex("customer")
      .where({ id: customerId })
      .whereNull("deleted_at")
      .first("id", "email", "first_name", "last_name", "phone", "company_name", "metadata")) || null
  )
}

/** ¿Está comprobado que el correo es de quien tiene la cuenta? */
export function correoConfirmado(c: Pick<ClienteTienda, "email" | "metadata"> | null): boolean {
  if (!c?.email) return false
  if (correosDeLaCasa().includes(c.email.toLowerCase())) return true
  return c.metadata?.correo_verificado === true
}

async function guardarVinculo(knex: any, customerId: string, negocioId: string, correo: string) {
  await asegurarTablas(knex)
  await knex(T_VINCULO)
    .insert({ customer_id: customerId, negocio_id: negocioId, correo_app: correo.toLowerCase(), created_at: new Date() })
    .onConflict("customer_id")
    .merge()
}

async function correoDeUsuarioApp(userId: string): Promise<string | null> {
  const u = await supa<any>(`/auth/v1/admin/users/${encodeURIComponent(userId)}`).catch(() => null)
  return u?.email ? String(u.email).toLowerCase() : null
}

/**
 * Usuario del Cotizador que nunca confirmó su correo: alguien pudo abrirlo con
 * ese correo y SU contraseña. Antes de dárselo al dueño real del correo (que sí
 * lo confirmó en la tienda) se confirma y se le cambia la contraseña por una al
 * azar, para que esa otra persona ya no pueda entrar.
 */
async function asegurarUsuarioConfirmado(userId: string) {
  const u = await supa<any>(`/auth/v1/admin/users/${encodeURIComponent(userId)}`)
  if (u?.email_confirmed_at || u?.confirmed_at) return
  await supa(`/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: "PUT",
    body: JSON.stringify({ email_confirm: true, password: randomBytes(24).toString("base64url") }),
  })
}

/**
 * Taller del Cotizador de ese correo (el del administrador primero). Se revisa
 * que el usuario de Supabase tenga ese mismo correo, porque la liga de acceso
 * se genera por correo y tiene que caer en la cuenta que tiene el taller.
 */
async function tallerPorCorreo(correo: string): Promise<{ negocio_id: string; user_id: string } | null> {
  const filas = await supa<any[]>(
    `/rest/v1/usuarios_negocio?correo=ilike.${encodeURIComponent(correo)}&activo=eq.true&select=negocio_id,user_id,rol,correo`
  )
  const mias = (filas || []).filter((f) => String(f.correo || "").trim().toLowerCase() === correo)
  mias.sort((a, b) => Number(["administrador", "super_admin"].includes(b.rol)) - Number(["administrador", "super_admin"].includes(a.rol)))
  for (const f of mias) {
    if (f.negocio_id && f.user_id && (await correoDeUsuarioApp(f.user_id)) === correo) return f
  }
  return null
}

export type Entrada =
  | { url: string }
  | { confirmar: string }
  | { activar: { taller: string; telefono: string } }
  | { cuenta: string | null }

/** Qué hace el botón Cotizador para esta cuenta de la tienda. */
export async function entradaCotizador(knex: any, customerId: string): Promise<Entrada> {
  const liga = await ligaEntrada(knex, customerId)
  if (liga) return { url: liga }

  const c = await clienteTienda(knex, customerId)
  const huella = c?.email ? huellaCorreo(c.email) : null
  if (!c?.email || !supabaseListo()) return { cuenta: huella }

  if (!correoConfirmado(c)) {
    // Cuentas de antes del 31 de octubre: nunca confirmaron. Se manda la liga.
    await mandarCorreoVerificacion({ id: c.id, email: c.email, first_name: c.first_name }).catch(() => null)
    return { confirmar: c.email }
  }

  const correo = c.email.trim().toLowerCase()
  const t = await tallerPorCorreo(correo)
  if (t) {
    await asegurarUsuarioConfirmado(t.user_id)
    await guardarVinculo(knex, customerId, t.negocio_id, correo)
    const url = await ligaEntrada(knex, customerId)
    return url ? { url } : { cuenta: huella }
  }
  return { activar: { taller: c.company_name || "", telefono: c.phone || "" } }
}

/** Usuario del Cotizador (Supabase) con ese correo: lo crea ya confirmado si no existe. */
async function usuarioApp(correo: string, nombre: string): Promise<string> {
  try {
    const u = await supa<any>("/auth/v1/admin/users", {
      method: "POST",
      // Sin contraseña: entra con la liga de un solo uso desde la tienda (y si
      // algún día quiere una, la pone con "¿Olvidaste tu contraseña?").
      body: JSON.stringify({ email: correo, email_confirm: true, user_metadata: { nombre } }),
    })
    if (u?.id) return u.id
  } catch (e) {
    if (!/already|exists|registered|422/i.test((e as Error).message)) throw e
  }
  // Ya existía: la liga de acceso trae su id
  const r = await supa<any>("/auth/v1/admin/generate_link", {
    method: "POST",
    body: JSON.stringify({ type: "magiclink", email: correo }),
  })
  const id = r?.id || r?.user?.id
  if (!id) throw new Error("No se encontró el usuario del Cotizador")
  return id
}

/**
 * Crea el taller del Cotizador para esta cuenta de la tienda (prueba de 14
 * días, igual que registrar_taller en supabase/prueba_14_dias.sql de la app),
 * lo vincula y devuelve la liga para entrar.
 */
export async function activarCotizador(
  knex: any,
  customerId: string,
  datos: { taller?: string; telefono?: string }
): Promise<{ url: string }> {
  if (!supabaseListo()) throw new ErrorSuscripcion("El Cotizador todavía no está listo. Intenta más tarde.", 503)
  const c = await clienteTienda(knex, customerId)
  if (!c?.email) throw new ErrorSuscripcion("Vuelve a iniciar sesión.", 401)
  if (!correoConfirmado(c)) throw new ErrorSuscripcion("Primero confirma tu correo con la liga que te mandamos.", 403)

  const nombreTaller = String(datos.taller || "").replace(/\s+/g, " ").trim().slice(0, 80)
  if (nombreTaller.length < 2) throw new ErrorSuscripcion("Escribe el nombre de tu taller.")

  // Si ya tiene (vinculado o con el mismo correo), sólo entra
  const antes = await entradaCotizador(knex, customerId)
  if ("url" in antes) return antes

  const correo = c.email.trim().toLowerCase()
  const nombre = [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || nombreTaller
  const telefono = String(datos.telefono ?? c.phone ?? "").trim().slice(0, 30) || null
  const userId = await usuarioApp(correo, nombre)
  await asegurarUsuarioConfirmado(userId)

  // ¿Ese usuario ya pertenece a un taller (registrado con otro correo en la ficha)?
  const propio = await supa<any[]>(
    `/rest/v1/usuarios_negocio?user_id=eq.${encodeURIComponent(userId)}&activo=eq.true&select=negocio_id&limit=1`
  )
  let negocioId: string | null = propio?.[0]?.negocio_id || null

  if (!negocioId) {
    const slug =
      (nombreTaller.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") ||
        "taller") +
      "-" +
      randomBytes(3).toString("hex")
    const [negocio] = await supa<any[]>("/rest/v1/negocios", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        nombre: nombreTaller,
        slug,
        telefono,
        correo,
        plan: "trial",
        trial_hasta: new Date(Date.now() + 14 * 86_400_000).toISOString(),
        activo: true,
      }),
    })
    if (!negocio?.id) throw new Error("Supabase no devolvió el taller nuevo")
    try {
      await supa("/rest/v1/usuarios_negocio", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ user_id: userId, negocio_id: negocio.id, rol: "administrador", nombre, correo, activo: true }),
      })
    } catch (e) {
      await supa(`/rest/v1/negocios?id=eq.${encodeURIComponent(negocio.id)}`, { method: "DELETE" }).catch(() => null)
      throw e
    }
    negocioId = negocio.id as string
  }

  await guardarVinculo(knex, customerId, negocioId, correo)
  const url = await ligaEntrada(knex, customerId)
  if (!url) throw new Error("No se pudo generar la liga de acceso")
  return { url }
}

/** Vuelve a mandar la liga para confirmar el correo (cuentas de antes del 31 de octubre). */
export async function reenviarConfirmacionCotizador(knex: any, customerId: string) {
  const c = await clienteTienda(knex, customerId)
  if (c?.email && !correoConfirmado(c)) {
    await mandarCorreoVerificacion({ id: c.id, email: c.email, first_name: c.first_name })
  }
}
