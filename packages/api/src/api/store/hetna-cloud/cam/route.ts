// POST /store/hetna-cloud/cam  (cliente con sesión; multipart: dxf, gcode, nombre)
// "Guardar en HetNa Cloud" del CAM Studio 2D: si quien calcula el G-code
// también tiene taller en HETNA (su cuenta de vendedor usa el mismo correo),
// se crea un proyecto en su nube con el dibujo y el programa. Mismo cupo que
// las demás subidas de la nube.
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { randomBytes } from "crypto"

import { archivosDe } from "../../../cam-multipart"
import { uploadFile } from "../../../../lib/backblaze"
import {
  GB,
  T_ARCHIVO,
  T_PIEZA,
  T_PROYECTO,
  asegurarCloud,
  categoriaDe,
  nombreSeguro,
  nuevoId,
  textoCloud as texto,
  usoCloud,
} from "../../../../lib/cloud"

const EXT_GCODE = ["tap", "nc", "ngc", "gcode"]

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const logger = req.scope.resolve("logger") as any
  const customerId = req.auth_context?.actor_id
  if (!customerId) return res.status(401).json({ message: "Entra a tu cuenta para guardar en tu nube." })

  const cliente = await knex("customer").where({ id: customerId }).whereNull("deleted_at").first("email")
  const correo = String(cliente?.email || "").trim().toLowerCase()
  const seller = correo ? await knex("seller").whereRaw("lower(email) = ?", [correo]).whereNull("deleted_at").first("id", "name") : null
  if (!seller) {
    return res.status(403).json({ message: "HetNa Cloud es para talleres. Abre tu taller en HETNA con este mismo correo para guardar aquí tus trabajos.", sin_taller: true })
  }

  const f = archivosDe(req)
  const dxf = f.dxf?.[0]
  const gcode = f.gcode?.[0]
  if (!gcode?.size) return res.status(400).json({ message: "No llegó el G-code." })
  const extG = (gcode.originalname.split(".").pop() || "").toLowerCase()
  if (!EXT_GCODE.includes(extG)) return res.status(400).json({ message: "El programa debe ser .tap, .nc, .ngc o .gcode." })
  if (dxf && (dxf.originalname.split(".").pop() || "").toLowerCase() !== "dxf") return res.status(400).json({ message: "El dibujo debe ser .dxf." })

  const nombre = texto((req.body as any)?.nombre, 90) || "Pieza"
  await asegurarCloud(knex)
  const { plan, cupo } = await usoCloud(knex, seller.id, logger)
  const archivos = [dxf, gcode].filter(Boolean) as { originalname: string; size: number; buffer: Buffer }[]
  const total = archivos.reduce((n, a) => n + a.size, 0)

  const proyectoId = nuevoId("cpr")
  const piezaId = nuevoId("cpz")
  const filas: { id: string; clave: string; buffer: Buffer }[] = []
  let lleno = null as { usado: number } | null
  await knex.transaction(async (trx: any) => {
    await trx.raw("select pg_advisory_xact_lock(hashtext(?))", [`cloud:${seller.id}`])
    const fila = await trx(T_ARCHIVO).where({ seller_id: seller.id, cuenta_cupo: true }).whereNull("deleted_at").sum({ n: "tamano" }).first()
    const usado = Number(fila?.n) || 0
    if (usado + total > cupo) {
      lleno = { usado }
      return
    }
    await trx(T_PROYECTO).insert({
      id: proyectoId, seller_id: seller.id, nombre: `CAM Studio · ${nombre}`, estado: "activo",
      notas: "Guardado desde el CAM Studio 2D de HETNA.", origen_tipo: "cam_studio", origen_ref: null,
    })
    await trx(T_PIEZA).insert({ id: piezaId, seller_id: seller.id, proyecto_id: proyectoId, nombre })
    for (const a of archivos) {
      const nom = a.originalname.slice(0, 120)
      const ext = (nom.split(".").pop() || "").toLowerCase().slice(0, 10)
      const id = nuevoId("car")
      const clave = `cloud/${seller.id}/${proyectoId}/${randomBytes(10).toString("hex")}/${nombreSeguro(nom)}`
      await trx(T_ARCHIVO).insert({
        id, seller_id: seller.id, proyecto_id: proyectoId, pieza_id: piezaId, nombre: nom, ext, clave,
        tamano: a.size, cuenta_cupo: true, categoria: categoriaDe(ext), revision: 1, estado: "borrador", subido: false,
      })
      filas.push({ id, clave, buffer: a.buffer })
    }
  })
  if (lleno) {
    return res.status(413).json({ message: `Tu nube está llena (${((lleno as any).usado / GB).toFixed(2)} de ${cupo / GB} GB del plan ${plan}). Borra archivos viejos o sube de plan.` })
  }
  for (const f of filas) {
    const r = await uploadFile(f.buffer, f.clave, "b2/x-auto")
    if (!r.ok) {
      logger.error(`[cloud] CAM Studio: no se pudo subir ${f.clave}: ${r.reason}`)
      await knex(T_ARCHIVO).where({ proyecto_id: proyectoId }).delete().catch(() => {})
      await knex(T_PIEZA).where({ proyecto_id: proyectoId }).delete().catch(() => {})
      await knex(T_PROYECTO).where({ id: proyectoId }).delete().catch(() => {})
      return res.status(503).json({ message: "No pudimos guardar en tu nube. Intenta de nuevo en un momento." })
    }
    await knex(T_ARCHIVO).where({ id: f.id }).update({ subido: true })
  }
  return res.status(201).json({ ok: true, proyecto: { id: proyectoId, nombre: `CAM Studio · ${nombre}` }, taller: seller.name })
}
