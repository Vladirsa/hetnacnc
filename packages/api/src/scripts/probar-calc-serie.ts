import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { ExecArgs } from "@medusajs/framework/types"

import { correoCalc, correrSerieCalc } from "../lib/calc-correos"
import { sendEmail } from "../lib/resend"

// Simulacro de la serie de la calculadora: a quién le tocaría hoy, SIN mandar nada.
//   NODE_ENV=production ./node_modules/.bin/medusa exec ./src/scripts/probar-calc-serie.ts
// Con un correo como argumento manda además una muestra de cada uno:
//   NODE_ENV=production ./node_modules/.bin/medusa exec ./src/scripts/probar-calc-serie.ts tu@correo.com
export default async function probarCalcSerie({ container, args }: ExecArgs) {
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const r = await correrSerieCalc(knex, container.resolve("logger"), { simular: true })
  console.log("hoy se mandarían:", { ...r, detalle: undefined })
  for (const d of r.detalle) console.log("  ", d)
  const destino = args?.[0]
  if (destino && /@/.test(destino)) {
    for (const [tipo, proceso] of [["calc_consejo", "router"], ["calc_consejo", "laser_co2"], ["calc_app", "router"]] as const) {
      const { asunto, html } = correoCalc(tipo, proceso)
      const env = await sendEmail({ to: destino, subject: `[Muestra] ${asunto}`, html })
      console.log(`muestra ${tipo} (${proceso}):`, env.sent ? "enviada" : env.reason)
    }
  }
}
