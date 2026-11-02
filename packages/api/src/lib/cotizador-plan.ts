// Planes del Cotizador. Es la misma regla que ya corría en
// apps/storefront/src/lib/taller/acciones.ts, traída al backend para que la
// decida el API y no cada cliente (web y celular tienen que coincidir).
//
// Modelo de cobro: el plan da un cupo mensual y los créditos sirven para
// pasarse de él. Hoy el taller gratis que llega a 5 queda bloqueado; con
// créditos puede seguir cotizando sin tener que subir de plan.

// Igual que el plan Gratis de la app (lib/services/planes.dart): 5 al mes.
export const LIMITE_GRATIS = 5

const PLANES_PAGO = ["taller", "pro", "industrial"]

export type PlanEfectivo = "gratis" | "prueba" | "taller" | "pro" | "industrial"

export type PerfilParaPlan = {
  plan?: string | null
  plan_hasta?: Date | string | null
  prueba_hasta?: Date | string | null
  uso_mes?: string | null
  uso_n?: number | null
}

// Mes en hora de México, p. ej. "2026-10". Tiene que ser el mismo criterio que
// usa el sistema viejo o el cupo se reiniciaría en otro momento al migrar.
export function mesActual(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
  }).format(new Date())
}

export function planEfectivo(perfil: PerfilParaPlan): PlanEfectivo {
  const vigente = !perfil.plan_hasta || fechaEnMs(perfil.plan_hasta) > Date.now()
  if (perfil.plan && PLANES_PAGO.includes(perfil.plan) && vigente) {
    return perfil.plan as PlanEfectivo
  }
  if (perfil.prueba_hasta && fechaEnMs(perfil.prueba_hasta) > Date.now()) {
    return "prueba"
  }
  return "gratis"
}

export type ResumenPlan = {
  plan: PlanEfectivo
  usadas: number
  // null = sin límite (prueba y planes de pago)
  limite: number | null
  prueba_dias: number
}

export function resumenPlan(perfil: PerfilParaPlan): ResumenPlan {
  const plan = planEfectivo(perfil)
  // El contador sólo cuenta si es del mes en curso; si cambió el mes, arranca
  // de cero sin tener que correr ningún job de reinicio.
  const usadas = perfil.uso_mes === mesActual() ? Number(perfil.uso_n) || 0 : 0
  const pruebaDias = perfil.prueba_hasta
    ? Math.max(0, Math.ceil((fechaEnMs(perfil.prueba_hasta) - Date.now()) / 86_400_000))
    : 0

  return {
    plan,
    usadas,
    limite: plan === "gratis" ? LIMITE_GRATIS : null,
    prueba_dias: plan === "prueba" ? pruebaDias : 0,
  }
}

function fechaEnMs(v: Date | string): number {
  const fecha = v instanceof Date ? v : new Date(v)
  const ms = fecha.getTime()
  return Number.isNaN(ms) ? 0 : ms
}
