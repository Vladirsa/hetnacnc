import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { ExecArgs } from "@medusajs/framework/types"

import { candidatosCam, correoCam, correrCorreosCam, TIPOS_CORREO_CAM } from "../lib/cam-correos"
import { sendEmail } from "../lib/resend"

// Simulacro de los correos automáticos del CAM Studio: dice a quién le
// tocaría cada correo hoy, SIN mandar nada ni registrar envíos.
//   NODE_ENV=production ./node_modules/.bin/medusa exec ./src/scripts/probar-cam-correos.ts
// Con un correo como argumento, además manda una muestra de cada tipo a esa
// dirección (para revisar cómo se ven):
//   NODE_ENV=production ./node_modules/.bin/medusa exec ./src/scripts/probar-cam-correos.ts tu@correo.com
// En el servidor va con NODE_ENV=production: así lee .env.production, que es
// donde están la base de datos real y la clave de Resend. Sin eso lee .env.
export default async function probarCamCorreos({ container, args }: ExecArgs) {
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const logger = container.resolve("logger")
  const cands = await candidatosCam(knex)
  for (const tipo of TIPOS_CORREO_CAM) console.log(`${tipo}: ${cands.filter((c) => c.tipo === tipo).length} con la señal (antes de revisar plan, bajas y envíos previos)`)
  const r = await correrCorreosCam(container, knex, logger, { simular: true })
  console.log("hoy se mandarían:", { ...r, detalle: undefined })
  for (const d of r.detalle) console.log("  ", d)

  const destino = args?.[0]
  if (destino && /@/.test(destino)) {
    const muestras: [(typeof TIPOS_CORREO_CAM)[number], string?][] = [["cam_bloqueo", "torno"], ["cam_bloqueo", "torno_grabado"], ["cam_bloqueo", "multieje"], ["cam_limite"], ["cam_proyecto"], ["cam_primera"]]
    for (const [tipo, que] of muestras) {
      const { asunto, html } = correoCam(tipo, { nombre: "Prueba", que })
      const env = await sendEmail({ to: destino, subject: `[Muestra] ${asunto}`, html })
      console.log(`muestra ${tipo}${que ? ` (${que})` : ""}:`, env.sent ? "enviada" : env.reason)
    }
  }
}
