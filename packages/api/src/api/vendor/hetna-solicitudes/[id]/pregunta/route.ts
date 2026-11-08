import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { T_SOLICITUD, asegurarTablas, recibePropuestas } from "../../../../../lib/licitacion"
import { relacionTaller, tallerPuedeVer } from "../../../../../lib/licitacion-privacidad"
import { preguntar } from "../../../../../lib/licitacion-extra"

// POST /vendor/hetna-solicitudes/:id/pregunta  { texto }
// El taller pregunta algo al cliente antes de proponer. La respuesta la ven
// todos los talleres. Hasta 3 preguntas por taller y solicitud.
export const POST = async (req: AuthenticatedMedusaRequest<{ texto?: string }>, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const sellerId = (req as any).seller_context?.seller_id as string | undefined
  if (!sellerId) return res.status(401).json({ message: "Sin taller." })

  await asegurarTablas(knex)
  const s = await knex(T_SOLICITUD).where({ id: String(req.params.id) }).first()
  if (!s) return res.status(404).json({ message: "Solicitud no encontrada." })
  if (s.modo === "directa" && s.taller_id !== sellerId) return res.status(403).json({ message: "Esta solicitud es para otro taller." })
  // Licitación privada: sólo los talleres invitados
  if (!tallerPuedeVer(s, await relacionTaller(knex, s, sellerId))) return res.status(403).json({ message: "Esta licitación es privada: sólo participan los talleres invitados." })
  if (!recibePropuestas(s)) return res.status(409).json({ message: "Esta solicitud ya cerró." })
  try {
    const id = await preguntar(knex, s, sellerId, String((req.body as any)?.texto || ""), logger)
    return res.json({ ok: true, id })
  } catch (e) {
    const err = e as Error & { status?: number }
    return res.status(err.status || 500).json({ message: err.status ? err.message : "No se pudo enviar tu pregunta." })
  }
}
