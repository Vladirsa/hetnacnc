// "Programas probados": lo que reportan los talleres después de correr en su
// máquina un programa hecho en el CAM Studio. Es la evidencia de que un
// posprocesador funciona en un control de verdad, y la que se enseña en la
// página (cuántos lo probaron y cómo les fue).
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

const T = "hetna_cam_prueba"
export const HERRAMIENTAS = ["2d", "3d", "torno"] as const
export const RESULTADOS = ["bien", "ajustes", "mal"] as const
export type Prueba = {
  herramienta: (typeof HERRAMIENTAS)[number]
  controlador: string
  resultado: (typeof RESULTADOS)[number]
  maquina?: string | null
  material?: string | null
  ejes?: number | null
  notas?: string | null
}

let listo = false
async function asegurarTabla(knex: any) {
  if (listo) return
  if (!(await knex.schema.hasTable(T))) {
    await knex.schema.createTable(T, (t: any) => {
      t.bigIncrements("id").primary()
      t.text("customer_id").notNullable().index()
      t.text("herramienta").notNullable()
      t.text("controlador").notNullable().index()
      t.text("resultado").notNullable()
      t.text("maquina").nullable()
      t.text("material").nullable()
      t.integer("ejes").nullable()
      t.text("notas").nullable()
      // La casa la marca cuando revisó el reporte: sólo ésas cuentan como "verificado"
      t.boolean("revisada").notNullable().defaultTo(false)
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
    })
  }
  listo = true
}

const limpio = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[<>]/g, "").trim().slice(0, max) || null : null)

export async function registrarPrueba(container: MedusaContainer, customerId: string, p: Prueba) {
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await asegurarTabla(knex)
  // Un reporte por persona, herramienta y control al día: quien corrige el suyo lo reemplaza
  const hoy = new Date(Date.now() - 24 * 3600 * 1000)
  await knex(T).where({ customer_id: customerId, herramienta: p.herramienta, controlador: p.controlador }).where("created_at", ">", hoy).del()
  await knex(T).insert({
    customer_id: customerId,
    herramienta: p.herramienta,
    controlador: limpio(p.controlador, 40) || "otro",
    resultado: p.resultado,
    maquina: limpio(p.maquina, 80),
    material: limpio(p.material, 40),
    ejes: p.ejes && p.ejes >= 3 && p.ejes <= 5 ? p.ejes : null,
    notas: limpio(p.notas, 600),
  })
}

export type ResumenPrueba = { controlador: string; herramienta: string; bien: number; ajustes: number; mal: number; talleres: number }

/** Cómo le ha ido a cada control, sin datos de quién lo reportó. */
export async function resumenPruebas(container: MedusaContainer): Promise<ResumenPrueba[]> {
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await asegurarTabla(knex)
  const filas = await knex(T)
    .groupBy("controlador", "herramienta")
    .select("controlador", "herramienta")
    .select(knex.raw("count(*) filter (where resultado = 'bien')::int as bien"))
    .select(knex.raw("count(*) filter (where resultado = 'ajustes')::int as ajustes"))
    .select(knex.raw("count(*) filter (where resultado = 'mal')::int as mal"))
    .select(knex.raw("count(distinct customer_id)::int as talleres"))
  return filas as ResumenPrueba[]
}
