// POST /vendor/hetna-cloud/proyectos/:id/archivos  (multipart: archivo, pieza_id, notas)
// Sube un archivo al bucket privado de B2. Si ya hay uno con el mismo nombre
// en la misma pieza, éste es la revisión siguiente (el anterior se queda).
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { randomBytes } from "crypto"

import { listaDeArchivos } from "../../../../../cam-multipart"
import { uploadFile } from "../../../../../../lib/backblaze"
import {
  EXT_CLOUD,
  GB,
  T_ARCHIVO,
  T_PIEZA,
  T_PROYECTO,
  asegurarCloud,
  categoriaDe,
  nombreSeguro,
  nuevoId,
  proyectoDe,
  siguienteRevision,
  textoCloud as texto,
  usoCloud,
} from "../../../../../../lib/cloud"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const logger = req.scope.resolve("logger") as any
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })
  await asegurarCloud(knex)
  const p = await proyectoDe(knex, sellerId, String(req.params.id))
  if (!p) return res.status(404).json({ message: "Proyecto no encontrado." })

  const [archivo] = listaDeArchivos(req)
  if (!archivo?.size) return res.status(400).json({ message: "No llegó ningún archivo." })
  const ext = (archivo.originalname.split(".").pop() || "").toLowerCase()
  if (!EXT_CLOUD.includes(ext)) return res.status(400).json({ message: `Los archivos .${ext} no se aceptan en HetNa Cloud.` })

  const b = (req.body || {}) as Record<string, string>
  let piezaId: string | null = b.pieza_id ? String(b.pieza_id) : null
  if (piezaId && !(await knex(T_PIEZA).where({ id: piezaId, proyecto_id: p.id, seller_id: sellerId }).first("id"))) {
    return res.status(404).json({ message: "Esa pieza no es de este proyecto." })
  }

  const nombre = archivo.originalname.slice(0, 120)
  const clave = `cloud/${sellerId}/${p.id}/${randomBytes(10).toString("hex")}/${nombreSeguro(nombre)}`
  const id = nuevoId("car")
  const { plan, cupo } = await usoCloud(knex, sellerId, logger)

  // Se aparta el lugar antes de subir, con un candado por taller: así dos
  // subidas al mismo tiempo no pasan juntas el cupo ni toman la misma revisión.
  let revision = 1
  let lleno = null as { usado: number } | null
  await knex.transaction(async (trx: any) => {
    await trx.raw("select pg_advisory_xact_lock(hashtext(?))", [`cloud:${sellerId}`])
    // Subidas que se quedaron a medias (el servidor se reinició): liberan su lugar
    await trx(T_ARCHIVO).where({ seller_id: sellerId, subido: false }).where("created_at", "<", new Date(Date.now() - 3600_000)).delete()
    const fila = await trx(T_ARCHIVO).where({ seller_id: sellerId, cuenta_cupo: true }).whereNull("deleted_at").sum({ n: "tamano" }).first()
    const usado = Number(fila?.n) || 0
    if (usado + archivo.size > cupo) {
      lleno = { usado }
      return
    }
    revision = await siguienteRevision(trx, p.id, piezaId, nombre)
    await trx(T_ARCHIVO).insert({
      id,
      seller_id: sellerId,
      proyecto_id: p.id,
      pieza_id: piezaId,
      nombre,
      ext,
      clave,
      tamano: archivo.size,
      cuenta_cupo: true,
      categoria: categoriaDe(ext),
      revision,
      estado: "borrador",
      notas: texto(b.notas, 1000) || null,
      subido: false,
    })
  })
  if (lleno) {
    return res.status(413).json({
      message: `Tu nube está llena (${(lleno.usado / GB).toFixed(2)} de ${cupo / GB} GB del plan ${plan}). Borra archivos viejos o sube de plan.`,
      uso: { plan, cupo, usado: lleno.usado },
    })
  }

  // El tipo lo decide B2 por la extensión, no el navegador de quien sube.
  const r = await uploadFile(archivo.buffer, clave, "b2/x-auto")
  if (!r.ok) {
    await knex(T_ARCHIVO).where({ id }).delete().catch(() => {})
    logger.error(`[cloud] no se pudo subir ${clave}: ${r.reason}`)
    return res.status(503).json({ message: "No pudimos guardar tu archivo. Intenta de nuevo en un momento." })
  }
  await knex(T_ARCHIVO).where({ id }).update({ subido: true })
  await knex(T_PROYECTO).where({ id: p.id }).update({ updated_at: knex.fn.now() })
  return res.status(201).json({ archivo: await knex(T_ARCHIVO).where({ id }).first("id", "nombre", "revision", "estado", "categoria", "tamano") })
}
