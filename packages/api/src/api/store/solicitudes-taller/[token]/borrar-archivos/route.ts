// POST /store/solicitudes-taller/:token/borrar-archivos
// El cliente borra para siempre sus planos y modelos, en cuanto la solicitud
// se cierra o se cancela (lib/conservacion-archivos). Antes de eso los
// necesitan los talleres para cotizar y fabricar.
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { borrarArchivosSolicitud, etapaTerminada } from "../../../../../lib/conservacion-archivos"
import { T_SOLICITUD } from "../../../../../lib/licitacion"
import { asegurarSeguimiento } from "../../../../../lib/seguimiento"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger") as any
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const token = String(req.params.token || "")
  if (token.length < 32) return res.status(404).json({ message: "Solicitud no encontrada." })
  await asegurarSeguimiento(knex)
  const s = await knex(T_SOLICITUD).where({ token }).first()
  if (!s) return res.status(404).json({ message: "Solicitud no encontrada." })
  if (!etapaTerminada(s)) {
    return res.status(409).json({ message: "Podrás borrar tus archivos cuando la solicitud se cierre o se cancele: el taller los necesita para cotizar y fabricar." })
  }
  if (s.disputa) return res.status(409).json({ message: "Tienes un problema abierto: los archivos se conservan como evidencia hasta que HETNA lo resuelva." })
  const r = await borrarArchivosSolicitud(knex, s, "cliente", logger)
  if (!r.ok) return res.status(503).json({ message: "No pudimos borrar tus archivos ahora. Intenta de nuevo en unos minutos." })
  return res.json({ ok: true, borrados: r.borrados })
}
