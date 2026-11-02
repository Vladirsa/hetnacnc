// Un solo plan por taller.
//
// Había dos: el del Cotizador viejo de la web (cotizador_perfil.plan, con 10
// cotizaciones gratis) y el de la app HETNA CNC para talleres (Supabase,
// negocios.plan, con 5). El que se cobra con Mercado Pago o PayPal es el de la
// app, así que ése manda: si la cuenta de la tienda está vinculada a un taller
// de la app con plan de pago o en prueba, la web lo respeta. El perfil viejo
// sólo cuenta si él mismo tiene un plan de pago o prueba vigente (cuentas que
// HETNA activó a mano antes de la app). El cupo gratis es el mismo en los dos
// lados: LIMITE_GRATIS de lib/cotizador-plan.ts = 5, igual que la app.
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { resumenPlan, type PerfilParaPlan, type PlanEfectivo, type ResumenPlan } from "./cotizador-plan"
import { planVinculado } from "./cotizador-vinculo"

export async function resumenPlanUnificado(
  scope: { resolve: (k: string) => unknown },
  customerId: string,
  perfil: PerfilParaPlan
): Promise<ResumenPlan> {
  const web = resumenPlan(perfil)
  if (web.plan !== "gratis") return web
  const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const app = await planVinculado(knex, customerId).catch(() => "gratis" as const)
  if (app === "gratis") return web
  const plan: PlanEfectivo = app === "master" ? "industrial" : app
  return { ...web, plan, limite: null, prueba_dias: 0 }
}
