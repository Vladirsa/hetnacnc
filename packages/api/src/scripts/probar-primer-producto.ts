// Muestra qué talleres sin productos recibirían hoy el correo "publica tu
// primer producto", sin mandar nada.
//   npx medusa exec ./src/scripts/probar-primer-producto.ts
import type { ExecArgs } from "@medusajs/framework/types"

import { DIAS_CORREO, talleresSinProductos } from "../lib/primer-producto"

export default async function probarPrimerProducto({ container }: ExecArgs) {
  const lista = await talleresSinProductos(container)
  if (!lista.length) {
    console.log("✔ Nadie pendiente hoy: todos los talleres abiertos tienen productos o ya recibieron sus correos.")
    return
  }
  console.log(`${lista.length} talleres recibirían correo hoy:`)
  for (const { taller, n } of lista) console.log(`· ${taller.name || taller.id} — correo ${n + 1} de ${DIAS_CORREO.length}`)
}
