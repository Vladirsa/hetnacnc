// @ts-nocheck
// Aplica YA (sin esperar los 5 minutos) los envíos automáticos a todos los talleres y
// revisa el perfil de envío de TODOS los productos existentes (digitales vs físicos).
//
// Uso (en /root/hetnacnc/packages/api):
//   Probar sin cambiar nada:  DRY_RUN=1 NODE_ENV=production bunx medusa exec ./src/scripts/aplicar-envios-y-digitales.ts
//   Aplicar:                  NODE_ENV=production bunx medusa exec ./src/scripts/aplicar-envios-y-digitales.ts
//   Precio inicial distinto:  ENVIO_PRECIO_INICIAL=120 NODE_ENV=production bunx medusa exec ./src/scripts/aplicar-envios-y-digitales.ts
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { ajustarPerfilDeProducto, aprovisionarEnvios } from "../lib/envios-automaticos"

export default async function aplicar({ container }: ExecArgs) {
  const log = (m: string) => console.log("[envios-auto] " + m)
  const dry = process.env.DRY_RUN === "1"
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  log(dry ? "PRUEBA (no se cambia nada)" : "APLICANDO")
  const creadas = await aprovisionarEnvios(container, { dry, log })
  log(`Opciones de envío creadas: ${creadas}`)

  const { data: productos } = await query.graph({ entity: "product", fields: ["id", "title"] })
  let digitales = 0
  let fisicos = 0
  for (const p of productos) {
    try {
      const r = await ajustarPerfilDeProducto(container, p.id, { dry })
      if (r === "digital") {
        digitales++
        log(`  digital: ${p.title}`)
      } else if (r === "fisico") {
        fisicos++
        log(`  vuelve a físico: ${p.title}`)
      }
    } catch (e) {
      log(`  ERROR con ${p.title}: ${e?.message || e}`)
    }
  }
  log(`Productos revisados: ${productos.length} | pasados a digital: ${digitales} | vueltos a físico: ${fisicos}`)
}
