// Qué puede descargar cada plan en el CAM Studio y cuánto lleva en el mes.
//
// Usar las herramientas (subir la pieza, calcular, simular) es libre. Lo que
// se cuenta es DESCARGAR el programa. La regla vive aquí, en el API, para que
// la web y cualquier otro cliente decidan igual.
//
//   Gratis      2D y 3D (3 ejes): 5 programas al mes
//   Taller      2D y 3D sin límite + torno: 30 programas al mes
//   Pro         + torno sin límite, con grabado 2D y 3D
//   Industrial  + 4 y 5 ejes; todo sin límite
//
// La prueba del Cotizador cuenta como plan Taller (ver planDelCliente).
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { mesActual } from "./cotizador-plan"
import { anotarIntentoCam } from "./cam-correos"
import { planDelCliente } from "./descargas-gratis"

export const TIPOS_CAM = ["2d", "3d", "torno", "torno_grabado", "multieje"] as const
export type TipoCam = (typeof TIPOS_CAM)[number]
export type PlanCam = "gratis" | "taller" | "pro" | "industrial"

// null = sin límite. `torno: false` = el plan no incluye el torno.
type Regla = { basico: number | null; torno: number | null | false; grabado: boolean; multieje: boolean }
export const REGLAS_CAM: Record<PlanCam, Regla> = {
  gratis: { basico: 5, torno: false, grabado: false, multieje: false },
  taller: { basico: null, torno: 30, grabado: false, multieje: false },
  pro: { basico: null, torno: null, grabado: true, multieje: false },
  industrial: { basico: null, torno: null, grabado: true, multieje: true },
}
export const NOMBRE_PLAN: Record<PlanCam, string> = { gratis: "Gratis", taller: "Taller", pro: "Pro", industrial: "Industrial" }
// El plan más barato que incluye cada cosa: es el que se le ofrece al que no la tiene.
const PLAN_MINIMO: Record<TipoCam, PlanCam> = { "2d": "gratis", "3d": "gratis", torno: "taller", torno_grabado: "pro", multieje: "industrial" }

const T_USO = "hetna_cam_uso"
type Cubeta = "basico" | "torno"
const cubetaDe = (tipo: TipoCam): Cubeta => (tipo === "torno" || tipo === "torno_grabado" ? "torno" : "basico")

export type Cupo = { incluido: boolean; limite: number | null; usadas: number; restantes: number | null }
export type EstadoCam = {
  plan: PlanCam
  plan_nombre: string
  mes: string
  basico: Cupo // 2D y 3D de 3 ejes
  torno: Cupo
  grabado: boolean
  multieje: boolean
}

export class CamCupoError extends Error {
  constructor(
    public codigo: "plan" | "cupo",
    mensaje: string,
    public plan_necesario: PlanCam
  ) {
    super(mensaje)
  }
}

let listo = false
async function asegurarTabla(knex: any) {
  if (listo) return
  if (!(await knex.schema.hasTable(T_USO))) {
    await knex.schema.createTable(T_USO, (t: any) => {
      t.bigIncrements("id").primary()
      t.text("customer_id").notNullable()
      t.text("tipo").notNullable()
      t.text("mes").notNullable()
      // Huella del programa: volver a bajar el mismo no gasta otro del cupo
      t.text("ref").nullable()
      t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now())
      t.index(["customer_id", "mes"])
    })
  }
  listo = true
}

const esPlan = (p: string): p is PlanCam => p in REGLAS_CAM

function cupo(limite: number | null | false, usadas: number): Cupo {
  if (limite === false) return { incluido: false, limite: 0, usadas, restantes: 0 }
  return { incluido: true, limite, usadas, restantes: limite === null ? null : Math.max(0, limite - usadas) }
}

function armar(plan: PlanCam, usadas: Record<Cubeta, number>): EstadoCam {
  const r = REGLAS_CAM[plan]
  return {
    plan,
    plan_nombre: NOMBRE_PLAN[plan],
    mes: mesActual(),
    basico: cupo(r.basico, usadas.basico),
    torno: cupo(r.torno, usadas.torno),
    grabado: r.grabado,
    multieje: r.multieje,
  }
}

/** Lo que ve quien no ha entrado a su cuenta: las reglas del plan Gratis, sin uso. */
export const estadoCamAnonimo = (): EstadoCam => armar("gratis", { basico: 0, torno: 0 })

async function usoDelMes(knex: any, customerId: string): Promise<Record<Cubeta, number>> {
  await asegurarTabla(knex)
  const filas: { tipo: string; n: string | number }[] = await knex(T_USO)
    .where({ customer_id: customerId, mes: mesActual() })
    .groupBy("tipo")
    .select("tipo")
    .count({ n: "*" })
  const usadas: Record<Cubeta, number> = { basico: 0, torno: 0 }
  for (const f of filas) usadas[cubetaDe(f.tipo as TipoCam)] += Number(f.n)
  return usadas
}

export async function estadoCam(container: MedusaContainer, customerId: string): Promise<EstadoCam> {
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const [plan, usadas] = await Promise.all([planDelCliente(container, customerId), usoDelMes(knex, customerId)])
  return armar(esPlan(plan) ? plan : "gratis", usadas)
}

/**
 * Autoriza la descarga de un programa y la anota. Lanza CamCupoError si el
 * plan no incluye ese tipo de trabajo o si ya se acabó el cupo del mes.
 */
export async function consumirCam(
  container: MedusaContainer,
  customerId: string,
  tipo: TipoCam,
  ref?: string | null
): Promise<{ estado: EstadoCam; repetida: boolean }> {
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const estado = await estadoCam(container, customerId)
  const minimo = PLAN_MINIMO[tipo]

  if ((tipo === "multieje" && !estado.multieje) || (tipo === "torno_grabado" && !estado.grabado) || (cubetaDe(tipo) === "torno" && !estado.torno.incluido)) {
    await anotarIntentoCam(knex, customerId, tipo, "plan", minimo) // para el correo "te falta el plan X"
    const que = tipo === "multieje" ? "Los programas de 4 y 5 ejes vienen" : tipo === "torno_grabado" ? "El grabado en el torno viene" : "El torno CNC viene"
    throw new CamCupoError("plan", `${que} desde el plan ${NOMBRE_PLAN[minimo]}. Tu plan es ${estado.plan_nombre}.`, minimo)
  }

  const huella = ref ? ref.slice(0, 80) : null
  if (huella) {
    const ya = await knex(T_USO).where({ customer_id: customerId, mes: estado.mes, ref: huella }).first("id")
    if (ya) return { estado, repetida: true }
  }

  const c = estado[cubetaDe(tipo)]
  if (c.restantes !== null && c.restantes <= 0) {
    const siguiente: PlanCam = cubetaDe(tipo) === "torno" ? "pro" : "taller"
    await anotarIntentoCam(knex, customerId, tipo, "cupo", siguiente)
    throw new CamCupoError(
      "cupo",
      `Ya bajaste los ${c.limite} programas de este mes de tu plan ${estado.plan_nombre}. Con el plan ${NOMBRE_PLAN[siguiente]} no tienen límite.`,
      siguiente
    )
  }

  await knex(T_USO).insert({ customer_id: customerId, tipo, mes: estado.mes, ref: huella })
  return { estado: await estadoCam(container, customerId), repetida: false }
}
