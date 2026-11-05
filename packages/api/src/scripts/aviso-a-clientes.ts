// Manda una notificación al celular a TODOS los clientes que activaron avisos
// (ofertas, novedades, temporada). Úsalo con medida: más de 1 o 2 por semana
// hace que la gente los apague.
//
//   cd /root/hetnacnc/packages/api
//   TITULO="Buen Fin en HETNA" TEXTO="Fresas y refacciones con hasta 20% menos" URL="/mx/categories" \
//     NODE_ENV=production bunx medusa exec ./src/scripts/aviso-a-clientes.ts
//
// Sin ENVIAR=1 sólo dice a cuántos les llegaría.
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_PUSH, asegurarTablaPush, pushATodosLosClientes, pushListo } from "../lib/push"

export default async function avisoAClientes({ container }: ExecArgs) {
  const titulo = String(process.env.TITULO || "").trim()
  const texto = String(process.env.TEXTO || "").trim()
  const url = String(process.env.URL || "/mx").trim()
  if (!titulo || !texto) {
    console.log('✘ Falta TITULO y TEXTO. Ejemplo: TITULO="Oferta" TEXTO="20% en fresas" ...')
    return
  }
  if (!pushListo()) {
    console.log("✘ Faltan las llaves de notificaciones. Corre primero src/scripts/crear-llaves-push.ts")
    return
  }
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await asegurarTablaPush(knex)
  const r = await knex(T_PUSH).whereNotNull("customer_id").count("* as n").first()
  const total = Number(r?.n || 0)
  if (process.env.ENVIAR !== "1") {
    console.log(`Le llegaría a ${total} celulares/navegadores de clientes. Para mandarlo agrega ENVIAR=1`)
    return
  }
  const ok = await pushATodosLosClientes(knex, { titulo, cuerpo: texto, url, etiqueta: "promo" })
  console.log(`✔ Enviado a ${ok} de ${total}`)
}
