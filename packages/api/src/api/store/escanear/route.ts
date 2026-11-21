// GET  /store/escanear — las solicitudes del cliente y si puede pedir (Fase 1: uso interno)
// POST /store/escanear — nueva solicitud de ingeniería inversa
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"

import { AVISO, SALIDAS, T_ESCANEAR, USOS, aSolicitud, asegurarEscanear, avisarEquipo, crear, folioEscanear, puedePedir, vistaCliente } from "../../../lib/escanear"
import { clienteDe, knexDe } from "./helpers"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const knex = knexDe(req)
  await asegurarEscanear(knex)
  const { correo } = await clienteDe(req)
  const filas = await knex(T_ESCANEAR).where({ customer_id: req.auth_context.actor_id }).orderBy("creado", "desc").limit(100)
  res.json({ puede_pedir: puedePedir(correo), aviso: AVISO, solicitudes: filas.map((f: any) => vistaCliente(aSolicitud(f))) })
}

const texto = (max: number) => z.string().trim().max(max)
const Cuerpo = z.object({
  titulo: texto(120).min(3),
  descripcion: texto(3000).min(10),
  uso: z.enum(USOS),
  salida: z.enum(SALIDAS),
  material_original: texto(120).optional(),
  material_deseado: texto(120).optional(),
  medidas: z.array(z.object({ nombre: texto(60).min(1), mm: z.number().positive().max(100000) })).min(2).max(10),
  zona: texto(500).optional(),
})

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const d = Cuerpo.safeParse(req.body)
  if (!d.success) return res.status(400).json({ message: "Revisa la solicitud: pon qué pieza es, qué le pasó y al menos 2 medidas tomadas a mano." })
  const knex = knexDe(req)
  const { correo, nombre } = await clienteDe(req)
  if (!puedePedir(correo)) return res.status(403).json({ message: "Escanear todavía no está abierto al público." })
  const s = await crear(knex, {
    customer_id: req.auth_context.actor_id,
    correo,
    nombre_cliente: nombre,
    titulo: d.data.titulo,
    descripcion: d.data.descripcion,
    uso: d.data.uso,
    salida: d.data.salida,
    material_original: d.data.material_original || null,
    material_deseado: d.data.material_deseado || null,
    medidas: d.data.medidas,
    zona: d.data.zona || null,
  })
  void avisarEquipo(knex, s, `Nueva solicitud de ${correo || "cliente"}\n${d.data.descripcion.slice(0, 300)}`, req.scope.resolve("logger"))
  res.json({ ok: true, id: s.id, folio: folioEscanear(s.folio) })
}
