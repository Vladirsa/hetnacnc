// Licitaciones: versiones de cada propuesta y contraofertas del cliente.
//
//   - Cada vez que el taller corrige su propuesta, la anterior se guarda como
//     versión (antes se sobrescribía y se perdía). El cliente ve "Versión 2" y
//     qué cambió (precio, días, fecha, envío, anticipo, garantía).
//   - El cliente puede mandar una contraoferta a una propuesta (precio y/o días
//     que le funcionan y un mensaje). Una pendiente a la vez y hasta 3 por
//     propuesta. El taller la acepta (la propuesta toma esos valores como versión
//     nueva), la rechaza con una nota, o corrige su propuesta a mano (queda
//     "respondida").
import { T_PROPUESTA, nuevoId, ocultarContacto } from "./licitacion"

export const T_VERSION = "hetna_propuesta_version"
export const T_CONTRA = "hetna_contraoferta"
export const MAX_CONTRAOFERTAS = 3

/** Lo que se guarda de cada versión (lo que el cliente compara) */
export const CAMPOS_VERSION = [
  "precio", "dias", "vigencia_dias", "incluye_envio", "condiciones", "anticipo_pct",
  "moneda", "materiales", "operaciones", "fecha_entrega", "condiciones_pago", "garantia", "observaciones",
] as const

let listo = false
export async function asegurarVersiones(knex: any) {
  if (listo) return
  if (!(await knex.schema.hasTable(T_VERSION))) {
    await knex.schema.createTable(T_VERSION, (t: any) => {
      t.text("id").primary()
      t.text("propuesta_id").notNullable().index()
      t.text("solicitud_id").notNullable().index()
      t.integer("version").notNullable()
      t.jsonb("datos").notNullable()
      t.text("motivo").nullable()
      t.text("origen").notNullable().defaultTo("taller") // taller | contraoferta
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }
  if (!(await knex.schema.hasTable(T_CONTRA))) {
    await knex.schema.createTable(T_CONTRA, (t: any) => {
      t.text("id").primary()
      t.text("propuesta_id").notNullable().index()
      t.text("solicitud_id").notNullable().index()
      t.decimal("precio", 12, 2).nullable()
      t.integer("dias").nullable()
      t.text("mensaje").nullable()
      t.text("estado").notNullable().defaultTo("pendiente") // pendiente | aceptada | rechazada | respondida
      t.text("nota_taller").nullable()
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
      t.timestamp("respondida_en", { useTz: true }).nullable()
    })
  }
  if (await knex.schema.hasTable(T_PROPUESTA)) {
    if (!(await knex.schema.hasColumn(T_PROPUESTA, "version"))) {
      await knex.schema.alterTable(T_PROPUESTA, (t: any) => t.integer("version").notNullable().defaultTo(1))
    }
  }
  listo = true
}

const normal = (k: string, v: any) => {
  if (v == null || v === "") return null
  if (k === "precio") return Number(v)
  if (k === "dias" || k === "vigencia_dias" || k === "anticipo_pct") return Math.round(Number(v))
  if (k === "fecha_entrega") return new Date(v).toISOString().slice(0, 10)
  return String(v)
}

export function fotoDe(p: Record<string, any>) {
  return Object.fromEntries(CAMPOS_VERSION.map((k) => [k, normal(k, p[k])]))
}

/** ¿Cambió algo de lo que el cliente compara? */
export function cambio(antes: Record<string, any>, despues: Record<string, any>) {
  const a = fotoDe(antes), d = fotoDe(despues)
  return CAMPOS_VERSION.some((k) => JSON.stringify(a[k]) !== JSON.stringify(d[k]))
}

const ETIQUETA: Record<string, string> = {
  precio: "Precio", dias: "Días de entrega", fecha_entrega: "Fecha de entrega", incluye_envio: "Envío",
  anticipo_pct: "Anticipo", garantia: "Garantía", materiales: "Materiales", condiciones_pago: "Condiciones de pago",
}
/** "Precio: $5,200 → $4,800" para el cliente y los correos */
export function diferencias(antes: Record<string, any>, despues: Record<string, any>) {
  const a = fotoDe(antes), d = fotoDe(despues)
  const fmt = (k: string, v: any) =>
    v == null ? "—"
      : k === "precio" ? `$${Number(v).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`
      : k === "dias" ? `${v} días`
      : k === "anticipo_pct" ? `${v}%`
      : k === "incluye_envio" ? (v === "si" ? "incluido" : "aparte")
      : String(v)
  return Object.keys(ETIQUETA)
    .filter((k) => JSON.stringify(a[k]) !== JSON.stringify(d[k]))
    .map((k) => ({ campo: ETIQUETA[k], antes: fmt(k, a[k]), despues: fmt(k, d[k]) }))
}

/** Guarda la propuesta actual como versión antes de cambiarla y sube su número de versión. */
export async function guardarVersion(knex: any, p: Record<string, any>, motivo: string | null, origen: "taller" | "contraoferta") {
  await asegurarVersiones(knex)
  const version = Number(p.version || 1)
  await knex(T_VERSION).insert({
    id: nuevoId("pver"), propuesta_id: p.id, solicitud_id: p.solicitud_id, version,
    datos: JSON.stringify(fotoDe(p)), motivo: motivo ? ocultarContacto(motivo.slice(0, 500)) : null, origen,
  })
  return version + 1
}

export type VersionVista = { version: number; precio: number | null; dias: number | null; fecha_entrega: string | null; motivo: string | null; origen: string; fecha: string }
export type ContraVista = { id: string; precio: number | null; dias: number | null; mensaje: string | null; estado: string; nota_taller: string | null; fecha: string; respondida_en: string | null }

/** Versiones anteriores y contraofertas de cada propuesta de una solicitud. */
export async function historialDe(knex: any, solicitudId: string) {
  await asegurarVersiones(knex)
  const [vs, cs] = await Promise.all([
    knex(T_VERSION).where({ solicitud_id: solicitudId }).orderBy("version", "asc"),
    knex(T_CONTRA).where({ solicitud_id: solicitudId }).orderBy("created_at", "asc"),
  ])
  const versiones = new Map<string, VersionVista[]>()
  for (const v of vs) {
    const d = typeof v.datos === "string" ? JSON.parse(v.datos) : v.datos || {}
    const l = versiones.get(v.propuesta_id) || []
    l.push({ version: v.version, precio: d.precio ?? null, dias: d.dias ?? null, fecha_entrega: d.fecha_entrega ?? null, motivo: v.motivo, origen: v.origen, fecha: new Date(v.created_at).toISOString() })
    versiones.set(v.propuesta_id, l)
  }
  const contras = new Map<string, ContraVista[]>()
  for (const c of cs) {
    const l = contras.get(c.propuesta_id) || []
    l.push({
      id: c.id, precio: c.precio != null ? Number(c.precio) : null, dias: c.dias, mensaje: c.mensaje, estado: c.estado, nota_taller: c.nota_taller,
      fecha: new Date(c.created_at).toISOString(), respondida_en: c.respondida_en ? new Date(c.respondida_en).toISOString() : null,
    })
    contras.set(c.propuesta_id, l)
  }
  return { versiones, contras }
}

export class ErrorContra extends Error {
  constructor(public status: number, mensaje: string) { super(mensaje) }
}

/** El cliente manda una contraoferta a una propuesta. */
export async function crearContraoferta(knex: any, s: any, p: any, b: { precio?: unknown; dias?: unknown; mensaje?: unknown }) {
  await asegurarVersiones(knex)
  if (s.estado !== "abierta") throw new ErrorContra(409, "Esta solicitud ya cerró.")
  const precio = b.precio == null || b.precio === "" ? null : Number(String(b.precio).replace(/[^\d.]/g, ""))
  const dias = b.dias == null || b.dias === "" ? null : Math.round(Number(b.dias))
  const mensaje = ocultarContacto(String(b.mensaje ?? "").trim().slice(0, 800))
  if (precio != null && !(precio > 0 && precio < 50_000_000)) throw new ErrorContra(400, "Escribe un precio válido.")
  if (dias != null && !(dias >= 1 && dias <= 365)) throw new ErrorContra(400, "Los días deben ir de 1 a 365.")
  if (precio == null && dias == null && !mensaje) throw new ErrorContra(400, "Escribe el precio, los días o un mensaje para el taller.")
  const previas = await knex(T_CONTRA).where({ propuesta_id: p.id })
  if (previas.some((c: any) => c.estado === "pendiente")) throw new ErrorContra(409, "Ya tienes una contraoferta esperando respuesta de este taller.")
  if (previas.length >= MAX_CONTRAOFERTAS) throw new ErrorContra(409, `Ya mandaste ${MAX_CONTRAOFERTAS} contraofertas a este taller.`)
  const fila = { id: nuevoId("ctra"), propuesta_id: p.id, solicitud_id: s.id, precio, dias, mensaje: mensaje || null, estado: "pendiente" }
  await knex(T_CONTRA).insert(fila)
  return fila
}

/** El taller acepta (la propuesta toma esos valores como versión nueva) o rechaza una contraoferta. */
export async function responderContraoferta(knex: any, s: any, sellerId: string, contraId: string, accion: "aceptar" | "rechazar", nota?: string) {
  await asegurarVersiones(knex)
  if (s.estado !== "abierta") throw new ErrorContra(409, "Esta solicitud ya cerró.")
  const c = await knex(T_CONTRA).where({ id: contraId, solicitud_id: s.id }).first()
  if (!c) throw new ErrorContra(404, "Contraoferta no encontrada.")
  if (c.estado !== "pendiente") throw new ErrorContra(409, "Esa contraoferta ya se respondió.")
  const p = await knex(T_PROPUESTA).where({ id: c.propuesta_id, seller_id: sellerId }).first()
  if (!p) throw new ErrorContra(403, "La contraoferta no es para tu propuesta.")
  const notaLimpia = nota ? ocultarContacto(String(nota).trim().slice(0, 500)) : null
  if (accion === "rechazar") {
    await knex(T_CONTRA).where({ id: c.id }).update({ estado: "rechazada", nota_taller: notaLimpia, respondida_en: knex.fn.now() })
    return { propuesta: p, contra: { ...c, estado: "rechazada", nota_taller: notaLimpia }, cambios: [] as ReturnType<typeof diferencias> }
  }
  const nuevos: Record<string, any> = {}
  if (c.precio != null) nuevos.precio = Number(c.precio)
  if (c.dias != null) nuevos.dias = Number(c.dias)
  const despues = { ...p, ...nuevos }
  const version = await guardarVersion(knex, p, notaLimpia || "Aceptó la contraoferta del cliente", "contraoferta")
  await knex(T_PROPUESTA).where({ id: p.id }).update({ ...nuevos, version, updated_at: knex.fn.now() })
  await knex(T_CONTRA).where({ id: c.id }).update({ estado: "aceptada", nota_taller: notaLimpia, respondida_en: knex.fn.now() })
  return { propuesta: despues, contra: { ...c, estado: "aceptada", nota_taller: notaLimpia }, cambios: diferencias(p, despues) }
}

/** Cuando el taller corrige su propuesta a mano, sus contraofertas pendientes quedan respondidas. */
export async function marcarRespondidas(knex: any, propuestaId: string) {
  await asegurarVersiones(knex)
  await knex(T_CONTRA).where({ propuesta_id: propuestaId, estado: "pendiente" }).update({ estado: "respondida", respondida_en: knex.fn.now() })
}
