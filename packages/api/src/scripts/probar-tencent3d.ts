// Prueba la conexión con Tencent HY 3D Global.
//
//   Sin costo (sólo revisa llaves y dirección del servicio):
//     NODE_ENV=production ./node_modules/.bin/medusa exec ./src/scripts/probar-tencent3d.ts
//   Generar UN modelo con la foto del último escaneo (gasta créditos):
//     TENCENT_PRUEBA=generar NODE_ENV=production ./node_modules/.bin/medusa exec ./src/scripts/probar-tencent3d.ts
// No imprime las llaves.
import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { getSignedDownloadUrl } from "../lib/backblaze"
import { type Endpoint, consultarModelo, detectarEndpoint, enviarModelo, tencentListo } from "../lib/tencent3d"

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))

export default async function probarTencent3d({ container }: ExecArgs) {
  const log = container.resolve(ContainerRegistrationKeys.LOGGER)
  if (!tencentListo()) {
    log.error("✘ Faltan TENCENT_SECRET_ID / TENCENT_SECRET_KEY en .env.production")
    return
  }

  const pruebas = await detectarEndpoint()
  let bueno: Endpoint | null = null
  for (const p of pruebas) {
    const auth = /AuthFailure|UnsupportedOperation|UnauthorizedOperation|Signature|HTTP4/i.test(p.respuesta)
    log.info(`${auth ? "✘" : "✔"} ${p.ep.host} (${p.ep.version}): ${p.respuesta}`)
    if (!auth && !bueno) bueno = p.ep
  }
  if (!bueno) {
    log.error("✘ Ninguna dirección aceptó las llaves. Revisa que el usuario tenga QcloudHunYuanFullAccess y que la verificación de identidad esté aprobada.")
    return
  }
  log.info(`✔ Usar: TENCENT_3D_ENDPOINT=${bueno.host}|${bueno.servicio}|${bueno.version}`)

  if (process.env.TENCENT_PRUEBA !== "generar") return

  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const fila = await knex("escaneo_3d").whereNull("deleted_at").orderBy("created_at", "desc").first("id", "fotos")
  const llave = Array.isArray(fila?.fotos) ? fila.fotos[0] : null
  if (!llave) {
    log.error("✘ No hay fotos de escaneos para probar")
    return
  }
  const firmada = await getSignedDownloadUrl(llave, 3600)
  if (!firmada.ok) {
    log.error(`✘ No se pudo firmar la foto: ${firmada.reason}`)
    return
  }

  const inicio = Date.now()
  const job = await enviarModelo({ imagenUrl: firmada.url, modelo: "3.1", tipo: "Normal" }, bueno)
  log.info(`✔ Trabajo enviado: ${job} (foto del escaneo ${fila.id})`)
  for (let i = 0; i < 60; i++) {
    await esperar(10000)
    const e = await consultarModelo(job, bueno)
    const seg = Math.round((Date.now() - inicio) / 1000)
    if (e.estado === "DONE") {
      log.info(`✔ Listo en ${seg} s. Archivos (los enlaces duran 1 día):`)
      for (const a of e.archivos) log.info(`   ${a.tipo}: ${a.url}${a.vistaPrevia ? `\n   imagen: ${a.vistaPrevia}` : ""}`)
      return
    }
    if (e.estado === "FAIL") {
      log.error(`✘ Falló a los ${seg} s: ${e.error || "sin detalle"}`)
      return
    }
    log.info(`… ${e.estado} (${seg} s)`)
  }
  log.error("✘ Tardó más de 10 minutos; revisa el trabajo en la consola de Tencent")
}
