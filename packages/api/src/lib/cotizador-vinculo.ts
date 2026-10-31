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
import { createHash, randomInt } from "crypto"

import { ErrorSuscripcion, RETORNO, adminDesdeToken, supabaseListo } from "./cotizador-suscripciones"
import { planEfectivo, supa, type PlanEfectivo, type Taller } from "./cotizador-crm"

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
