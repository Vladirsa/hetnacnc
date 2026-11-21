// Empresas, parte 2 (estrategia 2.4): varios usuarios en la misma empresa y
// aprobación de pedidos.
//
//   · El que crea la empresa es administrador. Invita por correo a compras,
//     ingeniería o almacén como "comprador" o "administrador".
//   · Todos ven las mismas piezas (Mis piezas) y pueden repetir pedidos con
//     los archivos de cualquiera del equipo.
//   · Con "aprobación de pedidos" activa, lo que pide un comprador nace en
//     estado "por_aprobar": no llega a ningún taller hasta que un
//     administrador lo aprueba (nunca se aprueba solo).
import { randomBytes, randomUUID } from "crypto"

import { sendEmail } from "./resend"
import { T_SOLICITUD, folioTexto } from "./licitacion"

export const T_EMPRESA = "hetna_empresa"
export const T_MIEMBRO = "hetna_empresa_miembro"
const STORE = (process.env.STOREFRONT_URL || process.env.STORE_URL || "https://hetnacnc.com").replace(/\/$/, "")

let listas = false
export async function asegurarEquipo(knex: any) {
  if (listas) return
  if (!(await knex.schema.hasTable(T_EMPRESA))) {
    await knex.schema.createTable(T_EMPRESA, (t: any) => {
      t.text("id").primary()
      t.text("nombre").notNullable()
      t.text("owner_id").notNullable()
      t.boolean("aprobacion").notNullable().defaultTo(false)
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }
  if (!(await knex.schema.hasTable(T_MIEMBRO))) {
    await knex.schema.createTable(T_MIEMBRO, (t: any) => {
      t.text("empresa_id").notNullable().index()
      t.text("email").notNullable()
      t.text("customer_id").nullable().index()
      t.text("rol").notNullable().defaultTo("comprador") // admin | comprador
      t.text("estado").notNullable().defaultTo("invitado") // invitado | activo
      t.text("token").nullable().unique()
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
      t.primary(["empresa_id", "email"])
    })
  }
  listas = true
}

export class ErrorEquipo extends Error {
  constructor(msg: string, public status = 400) {
    super(msg)
  }
}

const CORREO = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/
const esc = (s: string) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string)

export type MiembroActivo = { empresa_id: string; customer_id: string; rol: "admin" | "comprador"; aprobacion: boolean; nombre: string }

/** La empresa activa del cliente (si pertenece a una). */
export async function miembroDe(knex: any, customerId: string): Promise<MiembroActivo | null> {
  if (!customerId) return null
  await asegurarEquipo(knex)
  const f = await knex(`${T_MIEMBRO} as m`)
    .join(`${T_EMPRESA} as e`, "e.id", "m.empresa_id")
    .where({ "m.customer_id": customerId, "m.estado": "activo" })
    .first("m.empresa_id", "m.customer_id", "m.rol", "e.aprobacion", "e.nombre")
  return f ? { empresa_id: f.empresa_id, customer_id: f.customer_id, rol: f.rol === "admin" ? "admin" : "comprador", aprobacion: !!f.aprobacion, nombre: f.nombre } : null
}

/** Clientes cuyas piezas ve este cliente: él y, si tiene empresa, todo el equipo activo. */
export async function clientesDelEquipo(knex: any, customerId: string): Promise<string[]> {
  const m = await miembroDe(knex, customerId).catch(() => null)
  if (!m) return [customerId]
  const ids = (await knex(T_MIEMBRO).where({ empresa_id: m.empresa_id, estado: "activo" }).whereNotNull("customer_id").pluck("customer_id")) as string[]
  return [...new Set([customerId, ...ids])]
}

/** ¿Lo que pide este cliente necesita aprobación de un administrador? */
export async function necesitaAprobacion(knex: any, customerId?: string | null): Promise<MiembroActivo | null> {
  if (!customerId) return null
  const m = await miembroDe(knex, customerId).catch(() => null)
  return m && m.aprobacion && m.rol === "comprador" ? m : null
}

export async function crearEmpresa(knex: any, customerId: string, email: string, nombre: string) {
  await asegurarEquipo(knex)
  if (await miembroDe(knex, customerId)) throw new ErrorEquipo("Ya perteneces a una empresa.")
  const n = String(nombre || "").replace(/[\u0000-\u001f<>]/g, " ").trim().slice(0, 120)
  if (n.length < 2) throw new ErrorEquipo("Escribe el nombre de la empresa.")
  const id = randomUUID()
  await knex(T_EMPRESA).insert({ id, nombre: n, owner_id: customerId })
  await knex(T_MIEMBRO).insert({ empresa_id: id, email: String(email || "").toLowerCase(), customer_id: customerId, rol: "admin", estado: "activo" })
  return { id }
}

export async function invitar(knex: any, admin: MiembroActivo, emailCrudo: string, rolCrudo: string, quien: string) {
  const email = String(emailCrudo || "").trim().toLowerCase()
  if (!CORREO.test(email)) throw new ErrorEquipo("Escribe un correo válido.")
  const rol = rolCrudo === "admin" ? "admin" : "comprador"
  const total = await knex(T_MIEMBRO).where({ empresa_id: admin.empresa_id }).count({ n: "*" }).first()
  if (Number(total?.n || 0) >= 25) throw new ErrorEquipo("Tu empresa ya tiene 25 usuarios.")
  const token = randomBytes(24).toString("base64url")
  await knex(T_MIEMBRO)
    .insert({ empresa_id: admin.empresa_id, email, rol, estado: "invitado", token })
    .onConflict(["empresa_id", "email"])
    .merge({ rol, token, estado: knex.raw(`case when ${T_MIEMBRO}.estado = 'activo' then 'activo' else 'invitado' end`) })
  const liga = `${STORE}/mx/user/empresa/unirse?token=${token}`
  await sendEmail({
    to: email,
    subject: `${quien || "Tu equipo"} te invitó a ${admin.nombre} en HETNA CNC`,
    html: `<div style="font-family:Arial,sans-serif;max-width:540px;color:#222"><p>Hola:</p><p>${esc(quien || "Un compañero")} te invitó a la empresa <b>${esc(admin.nombre)}</b> en HETNA CNC como <b>${rol === "admin" ? "administrador" : "comprador"}</b>. Verán juntos las piezas que mandan a fabricar y podrán repetir pedidos.</p><p><a href="${liga}" style="display:inline-block;background:#C2560A;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">Unirme a ${esc(admin.nombre)}</a></p><p style="color:#666;font-size:13px">Entra (o crea tu cuenta) con este mismo correo: ${esc(email)}.</p></div>`,
  }).catch(() => null)
  return { ok: true }
}

export async function unirse(knex: any, customerId: string, emailCliente: string, token: string) {
  await asegurarEquipo(knex)
  const inv = await knex(T_MIEMBRO).where({ token: String(token || "") }).first()
  if (!inv) throw new ErrorEquipo("La invitación ya no es válida.", 404)
  if (String(emailCliente || "").toLowerCase() !== inv.email) throw new ErrorEquipo(`Esta invitación es para ${inv.email}. Entra con esa cuenta.`, 403)
  const otra = await miembroDe(knex, customerId)
  if (otra && otra.empresa_id !== inv.empresa_id) throw new ErrorEquipo("Ya perteneces a otra empresa.")
  await knex(T_MIEMBRO).where({ empresa_id: inv.empresa_id, email: inv.email }).update({ customer_id: customerId, estado: "activo", token: null })
  return { ok: true }
}

export async function quitar(knex: any, admin: MiembroActivo, emailCrudo: string) {
  const email = String(emailCrudo || "").trim().toLowerCase()
  const m = await knex(T_MIEMBRO).where({ empresa_id: admin.empresa_id, email }).first()
  if (!m) throw new ErrorEquipo("No encontré a esa persona.", 404)
  if (m.customer_id === admin.customer_id) throw new ErrorEquipo("No te puedes quitar a ti mismo.")
  const e = await knex(T_EMPRESA).where({ id: admin.empresa_id }).first("owner_id")
  if (m.customer_id && m.customer_id === e?.owner_id) throw new ErrorEquipo("No se puede quitar a quien creó la empresa.")
  await knex(T_MIEMBRO).where({ empresa_id: admin.empresa_id, email }).delete()
  return { ok: true }
}

export async function verEquipo(knex: any, customerId: string) {
  const m = await miembroDe(knex, customerId)
  if (!m) return { empresa: null }
  const miembros = await knex(T_MIEMBRO).where({ empresa_id: m.empresa_id }).orderBy("created_at", "asc").select("email", "rol", "estado")
  return { empresa: { id: m.empresa_id, nombre: m.nombre, aprobacion: m.aprobacion }, rol: m.rol, miembros }
}

/** Avisa a los administradores que hay un pedido por aprobar. */
export async function avisarPorAprobar(knex: any, m: MiembroActivo, folio: string, resumen: string, quien: string) {
  const admins = (await knex(T_MIEMBRO).where({ empresa_id: m.empresa_id, rol: "admin", estado: "activo" }).pluck("email")) as string[]
  for (const to of admins)
    await sendEmail({
      to,
      subject: `[${folio}] Pedido por aprobar en ${m.nombre}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:540px;color:#222"><p>${esc(quien)} pidió un trabajo de fabricación que necesita tu aprobación:</p><p style="background:#F5F3EE;padding:12px;border-radius:8px">${esc(resumen)}</p><p><a href="${STORE}/mx/user/empresa" style="display:inline-block;background:#C2560A;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">Revisar y aprobar</a></p><p style="color:#666;font-size:13px">No llega a ningún taller hasta que lo apruebes.</p></div>`,
    }).catch(() => null)
}

// ── Aprobación de pedidos ─────────────────────────────────────────────────

/** Pedidos del equipo que esperan aprobación (para los administradores). */
export async function porAprobarDelEquipo(knex: any, admin: MiembroActivo) {
  const ids = (await knex(T_MIEMBRO).where({ empresa_id: admin.empresa_id, estado: "activo" }).whereNotNull("customer_id").pluck("customer_id")) as string[]
  if (!ids.length) return []
  const filas = (await knex(T_SOLICITUD).where({ estado: "por_aprobar" }).whereIn("cliente_id", ids).orderBy("created_at", "desc").limit(50).select("folio", "trabajo", "contacto", "created_at")) as any[]
  return filas.map((f) => ({
    folio: folioTexto(f.folio),
    quien: f.contacto?.nombre || f.contacto?.email || "",
    resumen: [f.trabajo?.servicio, f.trabajo?.material, f.trabajo?.cantidad, f.trabajo?.orden_compra && `OC ${f.trabajo.orden_compra}`].filter(Boolean).join(" · "),
    descripcion: String(f.trabajo?.descripcion || "").slice(0, 300),
    creada: f.created_at,
  }))
}

/**
 * Un administrador aprueba o rechaza un pedido de su equipo. Al aprobar sigue
 * el camino normal: a revisión de HETNA si está activa o directo a los talleres.
 */
export async function decidirPedido(knex: any, logger: any, admin: MiembroActivo, folioTxt: string, aprobar: boolean) {
  const n = Number(String(folioTxt || "").replace(/\D/g, ""))
  if (!n) throw new ErrorEquipo("Folio inválido.")
  const ids = (await knex(T_MIEMBRO).where({ empresa_id: admin.empresa_id, estado: "activo" }).whereNotNull("customer_id").pluck("customer_id")) as string[]
  const s = await knex(T_SOLICITUD).where({ folio: n, estado: "por_aprobar" }).whereIn("cliente_id", ids).first()
  if (!s) throw new ErrorEquipo("Ese pedido ya no está por aprobar.", 404)
  const { cambiarEtapa, revisionActiva } = require("./seguimiento")
  if (!aprobar) {
    const k = await knex(T_SOLICITUD).where({ id: s.id, estado: "por_aprobar" }).update({ estado: "cerrada", updated_at: knex.fn.now() })
    if (k) await cambiarEtapa(knex, s, "cancelada", { actor: "cliente", nota: `No lo aprobó ${admin.nombre}.`, logger }).catch(() => null)
    return { ok: true, estado: "rechazado" }
  }
  if (revisionActiva()) {
    await knex(T_SOLICITUD).where({ id: s.id, estado: "por_aprobar" }).update({ estado: "revision", updated_at: knex.fn.now() })
    return { ok: true, estado: "en_revision" }
  }
  const k = await knex(T_SOLICITUD)
    .where({ id: s.id, estado: "por_aprobar" })
    .update({ estado: "abierta", cierra_en: new Date(Date.now() + 7 * 864e5), updated_at: knex.fn.now() })
  if (!k) return { ok: true, estado: "ya_decidido" }
  const { difundirSolicitud } = require("./difusion")
  await cambiarEtapa(knex, s, "enviada_talleres", { actor: "cliente", nota: `Aprobado por ${admin.nombre}.`, logger }).catch(() => null)
  await difundirSolicitud(knex, logger, s).catch((e: Error) => logger?.warn?.(`[empresa] difundir ${s.id}: ${e.message}`))
  return { ok: true, estado: "enviada_talleres" }
}
