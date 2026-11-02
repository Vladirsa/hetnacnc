// Cuántas propuestas a licitaciones puede mandar un taller al mes, según su plan.
//
//   Gratis   1 al mes
//   Taller   5 al mes
//   Pro, Industrial, prueba y fundadores (6 meses de Pro): sin límite
//
// Sólo cuentan las propuestas NUEVAS a solicitudes abiertas. Corregir una
// propuesta ya enviada no cuenta, y las solicitudes dirigidas al taller (el
// cliente lo eligió a él) nunca se limitan: ese cliente ya es suyo.
//
// De dónde sale el plan, en orden:
//   1. seller.metadata.plan (si HETNA lo puso a mano), respetando plan_vence.
//   2. Taller fundador: Pro durante 6 meses desde fundador_desde.
//   3. El plan de la app (Supabase, tabla negocios) con el mismo correo del
//      taller: es el plan que se cobra con Mercado Pago o PayPal.
//   4. Si no hay nada: Gratis.
// Si Supabase no responde, no se bloquea a nadie (mejor dejar pasar una
// propuesta que frenar a un taller que sí paga).
import { planEfectivo, supa, type Taller } from "./cotizador-crm"
import { T_PROPUESTA, T_SOLICITUD } from "./licitacion"

export type PlanLicitacion = "gratis" | "taller" | "pro"

export const LIMITE_PROPUESTAS: Record<PlanLicitacion, number | null> = { gratis: 1, taller: 5, pro: null }

export const NOMBRE_PLAN: Record<PlanLicitacion, string> = { gratis: "Gratis", taller: "Taller", pro: "Pro" }

const MESES_FUNDADOR = 6

/** Plan de la app (Supabase negocios) del taller con ese correo. null = no tiene cuenta en la app. */
async function leerPlanApp(correo: string): Promise<string | null> {
  const c = correo.trim().toLowerCase()
  if (!c || !/^[^\s@,()]+@[^\s@,()]+$/.test(c)) return null
  const filas = await supa<Taller[]>(
    `/rest/v1/negocios?select=id,plan,plan_vence,trial_hasta&correo=ilike.${encodeURIComponent(c)}&limit=5`
  )
  if (!filas?.length) return null
  // Si el correo está en varios negocios, manda el plan más alto.
  const orden = ["gratis", "prueba", "taller", "pro", "industrial", "master"]
  return filas
    .map((f) => planEfectivo(f as Taller))
    .sort((a, b) => orden.indexOf(b) - orden.indexOf(a))[0]
}

type SellerPlan = { email?: string | null; metadata?: Record<string, unknown> | null }

const aPlan = (p: string): PlanLicitacion | null => {
  const v = p.trim().toLowerCase()
  if (["pro", "premium", "industrial", "master", "prueba", "trial"].includes(v)) return "pro"
  if (v === "taller") return "taller"
  if (v === "gratis") return "gratis"
  return null
}

export async function planLicitacion(seller: SellerPlan): Promise<{ plan: PlanLicitacion; fuente: string } | null> {
  const m = (seller.metadata || {}) as Record<string, any>

  const manual = aPlan(String(m.plan || ""))
  const vence = m.plan_vence ? Date.parse(String(m.plan_vence)) : NaN
  if (manual && manual !== "gratis" && (Number.isNaN(vence) || vence > Date.now())) return { plan: manual, fuente: "panel" }

  if (m.fundador === true || m.fundador === "true") {
    const desde = Date.parse(String(m.fundador_desde || ""))
    const hasta = new Date(Number.isNaN(desde) ? 0 : desde)
    hasta.setMonth(hasta.getMonth() + MESES_FUNDADOR)
    if (Number.isNaN(desde) || hasta.getTime() > Date.now()) return { plan: "pro", fuente: "fundador" }
  }

  if (seller.email) {
    try {
      const app = await leerPlanApp(seller.email)
      if (app) return { plan: aPlan(app) || "gratis", fuente: "app" }
    } catch {
      return null // Supabase no respondió: no se limita
    }
  }
  return { plan: "gratis", fuente: "sin plan" }
}

/** Propuestas nuevas que el taller mandó este mes (hora de México) a solicitudes abiertas. */
export async function propuestasDelMes(knex: any, sellerId: string): Promise<number> {
  const r = await knex(`${T_PROPUESTA} as p`)
    .join(`${T_SOLICITUD} as s`, "s.id", "p.solicitud_id")
    .where("p.seller_id", sellerId)
    .whereNot("s.modo", "directa")
    .whereRaw(
      "p.created_at >= (date_trunc('month', now() at time zone 'America/Mexico_City') at time zone 'America/Mexico_City')"
    )
    .count("* as n")
    .first()
  return Number(r?.n) || 0
}

export type CupoLicitacion = {
  plan: PlanLicitacion
  nombre: string
  limite: number | null
  usadas: number
  quedan: number | null
}

export async function cupoLicitacion(knex: any, sellerId: string, seller: SellerPlan): Promise<CupoLicitacion | null> {
  const p = await planLicitacion(seller)
  if (!p) return null
  const limite = LIMITE_PROPUESTAS[p.plan]
  const usadas = limite === null ? 0 : await propuestasDelMes(knex, sellerId)
  return {
    plan: p.plan,
    nombre: NOMBRE_PLAN[p.plan],
    limite,
    usadas,
    quedan: limite === null ? null : Math.max(0, limite - usadas),
  }
}

export const mensajeSinCupo = (c: CupoLicitacion) =>
  `Tu plan ${c.nombre} incluye ${c.limite} ${c.limite === 1 ? "propuesta" : "propuestas"} al mes y ya ${
    c.limite === 1 ? "la usaste" : "las usaste"
  }. ` +
  (c.plan === "gratis"
    ? "Con el plan Taller mandas 5 al mes y con Pro, sin límite."
    : "Con el plan Pro mandas propuestas sin límite.") +
  " Puedes cambiar de plan en la app HETNA CNC para talleres (Mi plan). El cupo se renueva el día 1."
