// Número de afiliación de clientes HETNA (HC-000001, HC-000002…).
//
// Decidido por Vlado el 14 nov 2026:
//   - Todo cliente con cuenta tiene su número (se le da al crear la cuenta, y a
//     las cuentas de antes la primera vez que entran a «Mi cuenta»).
//   - Quien pide una cotización SIN cuenta y deja marcada la casilla «Crear mi
//     cuenta» recibe su número al instante y un correo con «Activar mi cuenta»:
//     entra, su correo ya viene puesto y sólo elige su contraseña.
//
// Dos ligas de activación por persona:
//   - token_correo: sólo va en el correo. Abrirla prueba que el correo es suyo,
//     así que la cuenta queda con el correo confirmado (sin otro paso).
//   - token_pantalla: la ve en la pantalla de «Recibimos tu solicitud» para
//     activar ya mismo. No prueba nada del correo, así que esa cuenta sigue el
//     camino normal de «confirma tu correo».
// Al activar, las solicitudes que mandó con ese correo pasan a «Mis solicitudes».
import { randomBytes } from "crypto"

import { STORE_URL, T_SOLICITUD } from "./licitacion"

export const T_AFILIADO = "hetna_afiliado"
export const DIAS_VIGENCIA_LIGA = 60

let listo = false
export async function asegurarTablaAfiliado(knex: any) {
  if (listo) return
  if (!(await knex.schema.hasTable(T_AFILIADO))) {
    await knex.schema.createTable(T_AFILIADO, (t: any) => {
      t.increments("id").primary()
      t.text("email").notNullable().unique()
      t.text("nombre").nullable()
      t.text("telefono").nullable()
      t.text("origen").notNullable().defaultTo("registro")
      t.text("customer_id").nullable().index()
      t.text("token_correo").notNullable().unique()
      t.text("token_pantalla").notNullable().unique()
      t.timestamp("activado_en", { useTz: true }).nullable()
      // Abrió la liga del correo: la cuenta que cree en los próximos minutos no
      // necesita el correo de «confirma tu correo» (la activación lo confirma)
      t.timestamp("activando_en", { useTz: true }).nullable()
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }
  listo = true
}

/** ¿Abrió la liga del correo hace poco? (ver activando_en) */
export async function activandoDesdeCorreo(knex: any, email: string): Promise<boolean> {
  await asegurarTablaAfiliado(knex)
  const fila = await knex(T_AFILIADO)
    .where({ email: limpiarCorreo(email) })
    .where("activando_en", ">", knex.raw("now() - interval '30 minutes'"))
    .first("id")
  return !!fila
}

export const numeroAfiliado = (id: number) => `HC-${String(id).padStart(6, "0")}`
const nuevoToken = () => randomBytes(18).toString("base64url")
const limpiarCorreo = (e: unknown) => String(e || "").trim().toLowerCase()

export type Afiliado = {
  id: number
  numero: string
  email: string
  nombre: string | null
  telefono: string | null
  customer_id: string | null
  token_correo: string
  token_pantalla: string
  activado_en: Date | null
  created_at: Date
}

const aAfiliado = (f: any): Afiliado => ({ ...f, numero: numeroAfiliado(Number(f.id)) })

/** Da (o devuelve el que ya tenía) el número de afiliación de un correo. */
export async function afiliar(
  knex: any,
  d: { email: string; nombre?: string | null; telefono?: string | null; origen?: string; customerId?: string | null }
): Promise<Afiliado | null> {
  const email = limpiarCorreo(d.email)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  await asegurarTablaAfiliado(knex)
  await knex(T_AFILIADO)
    .insert({
      email,
      nombre: d.nombre || null,
      telefono: d.telefono || null,
      origen: d.origen || "registro",
      customer_id: d.customerId || null,
      token_correo: nuevoToken(),
      token_pantalla: nuevoToken(),
      ...(d.customerId ? { activado_en: knex.fn.now() } : {}),
    })
    .onConflict("email")
    .ignore()
  const fila = await knex(T_AFILIADO).where({ email }).first()
  if (!fila) return null
  // Completa lo que falte sin pisar lo que ya había
  const cambios: Record<string, unknown> = {}
  if (!fila.nombre && d.nombre) cambios.nombre = d.nombre
  if (!fila.telefono && d.telefono) cambios.telefono = d.telefono
  if (!fila.customer_id && d.customerId) {
    cambios.customer_id = d.customerId
    cambios.activado_en = knex.fn.now()
  }
  if (Object.keys(cambios).length) {
    await knex(T_AFILIADO).where({ id: fila.id }).update(cambios)
    Object.assign(fila, cambios)
  }
  return aAfiliado(fila)
}

export async function afiliadoPorToken(knex: any, token: string): Promise<{ afiliado: Afiliado; deCorreo: boolean } | null> {
  const t = String(token || "").trim()
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(t)) return null
  await asegurarTablaAfiliado(knex)
  const fila = await knex(T_AFILIADO).where({ token_correo: t }).orWhere({ token_pantalla: t }).first()
  if (!fila) return null
  const vence = new Date(fila.created_at).getTime() + DIAS_VIGENCIA_LIGA * 86_400_000
  if (!fila.activado_en && vence < Date.now()) return null
  return { afiliado: aAfiliado(fila), deCorreo: fila.token_correo === t }
}

/** ¿Ese correo ya tiene cuenta de cliente con contraseña? */
export async function tieneCuenta(knex: any, email: string): Promise<boolean> {
  const fila = await knex("customer")
    .whereRaw("lower(email) = ?", [limpiarCorreo(email)])
    .where({ has_account: true })
    .whereNull("deleted_at")
    .first("id")
  return !!fila
}

/** Pasa a «Mis solicitudes» las solicitudes que se mandaron con ese correo. */
export async function ligarSolicitudesPorCorreo(knex: any, email: string, customerId: string): Promise<number> {
  if (!(await knex.schema.hasColumn(T_SOLICITUD, "cliente_id"))) return 0
  return knex(T_SOLICITUD)
    .whereNull("cliente_id")
    .whereRaw("lower(contacto->>'email') = ?", [limpiarCorreo(email)])
    .update({ cliente_id: customerId })
}

export const ligaActivar = (token: string) => `${STORE_URL}/mx/activar?t=${encodeURIComponent(token)}`
