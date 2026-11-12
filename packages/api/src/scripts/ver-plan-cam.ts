import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { ExecArgs } from "@medusajs/framework/types"

import { estadoCam } from "../lib/cam-cupo"
import { esCuentaDeLaCasa } from "../lib/cuentas-casa"
import { estadoVinculo } from "../lib/cotizador-vinculo"
import { planDelCliente } from "../lib/descargas-gratis"

// Qué plan ve el CAM Studio para una cuenta y cuántos programas lleva en el mes. Sólo lee.
// Para las pruebas del candado:
//   NODE_ENV=production ./node_modules/.bin/medusa exec ./src/scripts/ver-plan-cam.ts cliente@correo.com
export default async function verPlanCam({ container, args }: ExecArgs) {
  const correo = String(args?.[0] || "").trim().toLowerCase()
  if (!/@/.test(correo)) {
    console.log("Uso: ... ver-plan-cam.ts cliente@correo.com")
    return
  }
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const cliente = await knex("customer")
    .select("id", "email", "has_account", "created_at")
    .whereRaw("lower(email) = ?", [correo])
    .whereNull("deleted_at")
    .orderBy("has_account", "desc")
    .first()
  if (!cliente) {
    console.log(`No hay cuenta con ${correo}`)
    return
  }
  const [casa, vinculo, plan, cam] = await Promise.all([
    esCuentaDeLaCasa(container, cliente.id),
    estadoVinculo(knex, cliente.id).catch((e: Error) => ({ error: e.message })),
    planDelCliente(container, cliente.id),
    estadoCam(container, cliente.id),
  ])
  const cupo = (c: { incluido: boolean; limite: number | null; usadas: number; restantes: number | null }) =>
    !c.incluido ? "no incluido" : c.limite === null ? `sin límite (lleva ${c.usadas})` : `${c.usadas} de ${c.limite} (quedan ${c.restantes})`
  console.log(`\nCuenta: ${cliente.email} (${cliente.id})${cliente.has_account ? "" : " — SIN cuenta registrada"}`)
  console.log(`Cuenta de la casa: ${casa ? "SÍ (todo abierto: no sirve para probar el candado)" : "no"}`)
  console.log(`App del Cotizador vinculada: ${JSON.stringify(vinculo)}`)
  console.log(`Plan que ve la tienda: ${plan}`)
  console.log(`CAM Studio (${cam.mes}) — plan ${cam.plan_nombre}`)
  console.log(`  2D y 3D: ${cupo(cam.basico)}`)
  console.log(`  Torno:   ${cupo(cam.torno)}`)
  console.log(`  Grabado en torno: ${cam.grabado ? "sí" : "no"} | 4 y 5 ejes: ${cam.multieje ? "sí" : "no"}\n`)
}
