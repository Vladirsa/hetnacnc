// Seguimiento de producción por hitos, con fecha planeada contra la real y fotos.
//
// Cuando el cliente paga (etapa "en_produccion"), el pedido tiene 5 hitos:
// archivo aprobado → corte/maquinado → acabado → inspección → empaque y envío.
// Las fechas planeadas se reparten solas entre el pago y la fecha de entrega que
// prometió el taller; él las puede mover. Al marcar un hito como hecho queda la
// fecha real, una nota y hasta 6 fotos (bucket privado de B2). El cliente ve la
// línea de tiempo con "a tiempo / atrasado" y las fotos con ligas firmadas.
import { T_PROPUESTA, nuevoId, ocultarContacto } from "./licitacion"

export const T_HITO = "hetna_solicitud_hito"
export const MAX_FOTOS_HITO = 6
const DIA = 86_400_000

export const HITOS_BASE: { clave: string; nombre: string; fraccion: number }[] = [
  { clave: "archivo_aprobado", nombre: "Archivo aprobado", fraccion: 0.1 },
  { clave: "corte", nombre: "Corte / maquinado", fraccion: 0.55 },
  { clave: "acabado", nombre: "Acabado", fraccion: 0.75 },
  { clave: "inspeccion", nombre: "Inspección de calidad", fraccion: 0.9 },
  { clave: "empaque", nombre: "Empaque y envío", fraccion: 1 },
]

export type FotoHito = { clave: string; nombre: string }

let listo = false
export async function asegurarHitos(knex: any) {
  if (listo) return
  if (!(await knex.schema.hasTable(T_HITO))) {
    await knex.schema.createTable(T_HITO, (t: any) => {
      t.text("id").primary()
      t.text("solicitud_id").notNullable().index()
      t.text("clave").notNullable()
      t.text("nombre").notNullable()
      t.integer("orden").notNullable()
      t.date("fecha_plan").nullable()
      t.timestamp("fecha_real", { useTz: true }).nullable()
      t.text("nota").nullable()
      t.jsonb("fotos").notNullable().defaultTo("[]")
      t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
      t.unique(["solicitud_id", "clave"])
    })
  }
  listo = true
}

const soloFecha = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/** Fechas planeadas: del inicio a la entrega prometida, repartidas por hito. */
export function planInicial(inicio: Date, entrega: Date) {
  const a = inicio.getTime()
  const total = Math.max(DIA, entrega.getTime() - a)
  return HITOS_BASE.map((h, i) => ({ ...h, orden: i + 1, fecha_plan: soloFecha(a + total * h.fraccion) }))
}

/** Los hitos del pedido; si todavía no existen y ya está en producción, se crean. */
export async function hitosDe(knex: any, s: any, inicioProduccion?: Date | string | null) {
  await asegurarHitos(knex)
  let filas = await knex(T_HITO).where({ solicitud_id: s.id }).orderBy("orden")
  if (filas.length) return filas
  const etapa = String(s.etapa || "")
  if (!["en_produccion", "entregada", "cerrada"].includes(etapa) && s.estado !== "pagada" && s.pago_estado !== "pagado") return []
  const p = s.propuesta_elegida ? await knex(T_PROPUESTA).where({ id: s.propuesta_elegida }).first("dias", "fecha_entrega") : null
  if (!p) return []
  const inicio = inicioProduccion ? new Date(inicioProduccion) : new Date()
  const entrega = p.fecha_entrega ? new Date(`${new Date(p.fecha_entrega).toISOString().slice(0, 10)}T12:00:00Z`) : new Date(inicio.getTime() + Number(p.dias || 7) * DIA)
  const plan = planInicial(inicio, entrega.getTime() > inicio.getTime() ? entrega : new Date(inicio.getTime() + Number(p.dias || 7) * DIA))
  await knex(T_HITO).insert(plan.map((h) => ({ id: nuevoId("hito"), solicitud_id: s.id, clave: h.clave, nombre: h.nombre, orden: h.orden, fecha_plan: h.fecha_plan })))
    .onConflict(["solicitud_id", "clave"]).ignore()
  filas = await knex(T_HITO).where({ solicitud_id: s.id }).orderBy("orden")
  return filas
}

export type HitoVista = {
  clave: string; nombre: string; orden: number; fecha_plan: string | null; fecha_real: string | null
  estado: "hecho" | "pendiente" | "atrasado"; dias_diferencia: number | null; nota: string | null; fotos: FotoHito[]
}

/** Estado de cada hito: hecho (y con cuántos días de diferencia), pendiente o atrasado. */
export function vistaHitos(filas: any[], hoy = new Date()): HitoVista[] {
  return filas.map((h) => {
    const plan = h.fecha_plan ? new Date(`${new Date(h.fecha_plan).toISOString().slice(0, 10)}T23:59:59Z`) : null
    const real = h.fecha_real ? new Date(h.fecha_real) : null
    const dif = plan && real ? Math.round((real.getTime() - plan.getTime()) / DIA) : null
    const estado: HitoVista["estado"] = real ? "hecho" : plan && hoy.getTime() > plan.getTime() ? "atrasado" : "pendiente"
    return {
      clave: h.clave, nombre: h.nombre, orden: h.orden,
      fecha_plan: h.fecha_plan ? new Date(h.fecha_plan).toISOString().slice(0, 10) : null,
      fecha_real: real ? real.toISOString() : null,
      estado, dias_diferencia: dif, nota: h.nota || null,
      fotos: Array.isArray(h.fotos) ? h.fotos : typeof h.fotos === "string" ? JSON.parse(h.fotos) : [],
    }
  })
}

export class ErrorHito extends Error {
  constructor(public status: number, mensaje: string) { super(mensaje) }
}

/** El taller mueve la fecha planeada, marca hecho (o lo desmarca) y deja una nota. */
export async function actualizarHito(knex: any, s: any, clave: string, b: { fecha_plan?: unknown; hecho?: unknown; nota?: unknown }) {
  await asegurarHitos(knex)
  const h = await knex(T_HITO).where({ solicitud_id: s.id, clave }).first()
  if (!h) throw new ErrorHito(404, "Ese hito no existe en este pedido.")
  const cambios: Record<string, any> = { updated_at: knex.fn.now() }
  if (b.fecha_plan !== undefined) {
    const f = String(b.fecha_plan || "")
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) throw new ErrorHito(400, "Escribe la fecha como AAAA-MM-DD.")
    cambios.fecha_plan = f
  }
  if (b.nota !== undefined) cambios.nota = ocultarContacto(String(b.nota || "").trim().slice(0, 600)) || null
  let recienHecho = false
  if (b.hecho !== undefined) {
    const hecho = b.hecho === true || b.hecho === "true"
    if (hecho && !h.fecha_real) { cambios.fecha_real = knex.fn.now(); recienHecho = true }
    if (!hecho) cambios.fecha_real = null
  }
  await knex(T_HITO).where({ id: h.id }).update(cambios)
  const nuevo = await knex(T_HITO).where({ id: h.id }).first()
  return { hito: nuevo, recienHecho }
}

/** Agrega una foto (ya subida a B2) a un hito. */
export async function agregarFoto(knex: any, s: any, clave: string, foto: FotoHito) {
  await asegurarHitos(knex)
  const h = await knex(T_HITO).where({ solicitud_id: s.id, clave }).first()
  if (!h) throw new ErrorHito(404, "Ese hito no existe en este pedido.")
  const fotos: FotoHito[] = Array.isArray(h.fotos) ? h.fotos : JSON.parse(h.fotos || "[]")
  if (fotos.length >= MAX_FOTOS_HITO) throw new ErrorHito(400, `Máximo ${MAX_FOTOS_HITO} fotos por hito.`)
  const lista = [...fotos, foto]
  await knex(T_HITO).where({ id: h.id }).update({ fotos: JSON.stringify(lista), updated_at: knex.fn.now() })
  return lista
}
