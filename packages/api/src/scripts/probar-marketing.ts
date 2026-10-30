import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { ExecArgs } from "@medusajs/framework/types"

import { sendEmail } from "../lib/resend"
import { candidatos, correoPromo, correrMarketing, edicionSemanal, productosParaCorreo, type TipoPromo } from "../lib/marketing-correos"

// Simulacro del marketing automático: dice a quién le tocaría cada correo hoy,
// SIN mandar nada ni registrar envíos.
//   ./node_modules/.bin/medusa exec ./src/scripts/probar-marketing.ts
// Con un correo como argumento, además manda una muestra de cada tipo a esa
// dirección (para revisar cómo se ven):
//   ./node_modules/.bin/medusa exec ./src/scripts/probar-marketing.ts tu@correo.com
export default async function probarMarketing({ container, args }: ExecArgs) {
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const logger = container.resolve("logger")
  const edicion = edicionSemanal()
  for (const tipo of ["recompra", "primeros_pasos", "reactivacion", "novedades"] as TipoPromo[]) {
    const lista = await candidatos(knex, tipo, edicion)
    console.log(`${tipo}: ${lista.length} candidato(s)`, lista.slice(0, 5).map((c) => c.correo).join(", "))
  }
  console.log("simulación:", await correrMarketing(knex, logger, { simular: true }))

  const destino = args?.[0]
  if (destino && /@/.test(destino)) {
    const productos = await productosParaCorreo(knex, { limite: 4 })
    for (const tipo of ["recompra", "primeros_pasos", "reactivacion", "novedades"] as TipoPromo[]) {
      const { asunto, html } = correoPromo(tipo, { nombre: "Prueba", productos, display_id: 1001 })
      const r = await sendEmail({ to: destino, subject: `[Muestra] ${asunto}`, html })
      console.log(`muestra ${tipo}:`, r.sent ? "enviada" : r.reason)
    }
  }
}
