// Proyectos guardados del CAM Studio: el trabajo de un cliente (pieza,
// operaciones, máquina, herramienta) para retomarlo después o pasarle la liga a
// alguien. Con la liga se puede ABRIR una copia; sólo el dueño lo cambia.
//
// Cuántos se pueden guardar depende del plan (los mismos de lib/cam-cupo.ts).
import { randomBytes } from "crypto"

import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { NOMBRE_PLAN, type PlanCam, REGLAS_CAM } from "./cam-cupo"
import { planDelCliente } from "./descargas-gratis"

const T = "hetna_cam_proyecto"
export const HERRAMIENTAS_PROYECTO = ["2d", "3d", "torno"] as const
export type HerramientaProyecto = (typeof HERRAMIENTAS_PROYECTO)[number]
// Un DXF con sus operaciones o un diseño de torno con su grabado caben de sobra
export const MAX_BYTES_PROYECTO = 1_500_000
const TOPE: Record<PlanCam, number> = { gratis: 5, taller: 100, pro: 300, industrial: 1000 }

export type ProyectoResumen = { id: string; herramienta: HerramientaProyecto; nombre: string; compartido: boolean; actualizado: string }
export type Proyecto = ProyectoResumen & { datos: unknown; propio: boolean }

export class ProyectoError extends Error {
  constructor(
    public codigo: "tope" | "grande" | "no_existe",
    mensaje: string
  ) {
    super(mensaje)
  }
}

let listo = false
async function tabla(container: MedusaContainer) {
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  if (!listo) {
    if (!(await knex.schema.hasTable(T))) {
      await knex.schema.createTable(T, (t: any) => {
        t.text("id").primary()
        t.text("customer_id").notNullable().index()
        t.text("herramienta").notNullable()
        t.text("nombre").notNullable()
        t.jsonb("datos").notNullable()
        t.boolean("compartido").notNullable().defaultTo(false)
        t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
        t.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
      })
    }
    listo = true
  }
  return knex
}

const resumen = (f: any): ProyectoResumen => ({
  id: f.id,
  herramienta: f.herramienta,
  nombre: f.nombre,
  compartido: !!f.compartido,
  actualizado: new Date(f.updated_at).toISOString(),
})
const limpiarNombre = (n: unknown) => (typeof n === "string" ? n.replace(/[<>]/g, "").trim().slice(0, 80) : "") || "Proyecto sin nombre"

export async function listarProyectos(container: MedusaContainer, customerId: string, herramienta?: HerramientaProyecto): Promise<ProyectoResumen[]> {
  const knex = await tabla(container)
  const q = knex(T).where({ customer_id: customerId }).orderBy("updated_at", "desc").limit(300).select("id", "herramienta", "nombre", "compartido", "updated_at")
  if (herramienta) q.where({ herramienta })
  return (await q).map(resumen)
}

/** Guarda uno nuevo, o reemplaza el del mismo dueño si llega su id. */
export async function guardarProyecto(
  container: MedusaContainer,
  customerId: string,
  p: { id?: string | null; herramienta: HerramientaProyecto; nombre?: unknown; datos: unknown }
): Promise<ProyectoResumen> {
  const knex = await tabla(container)
  const texto = JSON.stringify(p.datos ?? null)
  if (texto.length > MAX_BYTES_PROYECTO) throw new ProyectoError("grande", "El proyecto es demasiado grande para guardarlo. Simplifica el dibujo o el relieve.")
  const nombre = limpiarNombre(p.nombre)

  if (p.id) {
    const [fila] = await knex(T).where({ id: p.id, customer_id: customerId }).update({ nombre, datos: texto, updated_at: knex.fn.now() }).returning("*")
    if (fila) return resumen(fila)
    // el id no es suyo (abrió la liga de otro): se guarda como copia nueva
  }

  const plan = await planDelCliente(container, customerId)
  const tope = TOPE[(plan in REGLAS_CAM ? plan : "gratis") as PlanCam]
  const [{ n }] = await knex(T).where({ customer_id: customerId }).count({ n: "*" })
  if (Number(n) >= tope) {
    const nombrePlan = NOMBRE_PLAN[(plan in REGLAS_CAM ? plan : "gratis") as PlanCam]
    throw new ProyectoError("tope", `Tu plan ${nombrePlan} guarda hasta ${tope} proyectos. Borra alguno o sube de plan.`)
  }
  const [fila] = await knex(T)
    .insert({ id: randomBytes(9).toString("base64url"), customer_id: customerId, herramienta: p.herramienta, nombre, datos: texto })
    .returning("*")
  return resumen(fila)
}

/** Lo abre su dueño, o cualquiera con la liga si está compartido. */
export async function leerProyecto(container: MedusaContainer, id: string, customerId?: string | null): Promise<Proyecto> {
  const knex = await tabla(container)
  const fila = await knex(T).where({ id }).first()
  const propio = !!fila && !!customerId && fila.customer_id === customerId
  if (!fila || (!propio && !fila.compartido)) throw new ProyectoError("no_existe", "Ese proyecto no existe o ya no está compartido.")
  return { ...resumen(fila), datos: fila.datos, propio }
}

export async function compartirProyecto(container: MedusaContainer, customerId: string, id: string, compartido: boolean): Promise<ProyectoResumen> {
  const knex = await tabla(container)
  const [fila] = await knex(T).where({ id, customer_id: customerId }).update({ compartido }).returning("*")
  if (!fila) throw new ProyectoError("no_existe", "Ese proyecto no existe.")
  return resumen(fila)
}

export async function borrarProyecto(container: MedusaContainer, customerId: string, id: string): Promise<void> {
  const knex = await tabla(container)
  await knex(T).where({ id, customer_id: customerId }).del()
}
