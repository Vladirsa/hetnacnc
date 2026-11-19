// "Mis diseños": el cliente guarda sus muebles, cocinas y molduras en su
// cuenta (gratis) y los vuelve a abrir para cambiarlos o volver a fabricarlos.
// Se guarda lo que la herramienta necesita para rehacer el diseño (tableros y
// opciones en JSON), no los archivos: los archivos se generan al momento.
import { randomBytes } from "crypto"

import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { MAX_DISENOS_GUARDADOS } from "./precios-diseno"

const T = "hetna_disenos"
export const HERRAMIENTAS = ["mueble", "cocina", "moldura"] as const
export type Herramienta = (typeof HERRAMIENTAS)[number]
export type Diseno = { id: string; herramienta: Herramienta; nombre: string; resumen: string | null; datos: unknown; creado: string; actualizado: string }

const knexDe = (c: MedusaContainer) => c.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
let lista = false
async function tabla(knex: any) {
  if (lista) return
  if (!(await knex.schema.hasTable(T))) {
    await knex.schema.createTable(T, (t: any) => {
      t.text("id").primary()
      t.text("customer_id").notNullable().index()
      t.text("herramienta").notNullable()
      t.text("nombre").notNullable()
      t.text("resumen")
      t.jsonb("datos").notNullable()
      t.timestamp("creado").notNullable().defaultTo(knex.fn.now())
      t.timestamp("actualizado").notNullable().defaultTo(knex.fn.now())
    })
  }
  lista = true
}

export class ErrorDiseno extends Error {
  constructor(mensaje: string, public status = 400) {
    super(mensaje)
  }
}

export async function listarDisenos(c: MedusaContainer, customerId: string, herramienta?: string) {
  const knex = knexDe(c)
  await tabla(knex)
  const q = knex(T).select("id", "herramienta", "nombre", "resumen", "creado", "actualizado").where({ customer_id: customerId }).orderBy("actualizado", "desc").limit(MAX_DISENOS_GUARDADOS)
  if (herramienta) q.andWhere({ herramienta })
  return (await q) as Omit<Diseno, "datos">[]
}

export async function leerDiseno(c: MedusaContainer, customerId: string, id: string) {
  const knex = knexDe(c)
  await tabla(knex)
  const fila = await knex(T).where({ id, customer_id: customerId }).first()
  if (!fila) throw new ErrorDiseno("No encontré ese diseño.", 404)
  return fila as Diseno
}

// guarda uno nuevo o, con id, actualiza el del cliente
export async function guardarDiseno(c: MedusaContainer, customerId: string, d: { id?: string; herramienta: Herramienta; nombre: string; resumen?: string; datos: unknown }) {
  const knex = knexDe(c)
  await tabla(knex)
  const ahora = new Date()
  if (d.id) {
    const n = await knex(T).where({ id: d.id, customer_id: customerId }).update({ nombre: d.nombre, resumen: d.resumen ?? null, datos: JSON.stringify(d.datos), actualizado: ahora })
    if (!n) throw new ErrorDiseno("No encontré ese diseño.", 404)
    return d.id
  }
  const [{ total }] = await knex(T).where({ customer_id: customerId }).count({ total: "*" })
  if (Number(total) >= MAX_DISENOS_GUARDADOS) throw new ErrorDiseno(`Ya tienes ${MAX_DISENOS_GUARDADOS} diseños guardados: borra alguno para guardar otro.`, 409)
  const id = `dis_${randomBytes(10).toString("hex")}`
  await knex(T).insert({ id, customer_id: customerId, herramienta: d.herramienta, nombre: d.nombre, resumen: d.resumen ?? null, datos: JSON.stringify(d.datos), creado: ahora, actualizado: ahora })
  return id
}

export async function borrarDiseno(c: MedusaContainer, customerId: string, id: string) {
  const knex = knexDe(c)
  await tabla(knex)
  await knex(T).where({ id, customer_id: customerId }).delete()
}
