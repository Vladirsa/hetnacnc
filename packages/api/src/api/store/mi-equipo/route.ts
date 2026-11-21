// GET  /store/mi-equipo → { empresa, rol, miembros, por_aprobar }
// POST /store/mi-equipo { accion: crear{nombre} | invitar{email, rol} | quitar{email}
//                         | aprobacion{activa} | aprobar{folio} | rechazar{folio} | unirse{token} }
// Empresas, parte 2 (lib/empresa-equipo.ts).
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { ErrorEquipo, T_EMPRESA, crearEmpresa, decidirPedido, invitar, miembroDe, porAprobarDelEquipo, quitar, unirse, verEquipo } from "../../../lib/empresa-equipo"

async function cliente(knex: any, id: string) {
  return (await knex("customer").where({ id }).first("email", "first_name", "last_name")) || {}
}

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const id = req.auth_context?.actor_id
  if (!id) return res.status(401).json({ message: "Inicia sesión." })
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const eq = await verEquipo(knex, id)
  const m = eq.empresa ? await miembroDe(knex, id) : null
  res.json({ ...eq, por_aprobar: m?.rol === "admin" ? await porAprobarDelEquipo(knex, m) : [] })
}

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const id = req.auth_context?.actor_id
  if (!id) return res.status(401).json({ message: "Inicia sesión." })
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const logger = req.scope.resolve("logger")
  const b: any = req.body || {}
  try {
    const c = await cliente(knex, id)
    if (b.accion === "crear") return res.json(await crearEmpresa(knex, id, c.email, b.nombre))
    if (b.accion === "unirse") return res.json(await unirse(knex, id, c.email, b.token))
    const m = await miembroDe(knex, id)
    if (!m) throw new ErrorEquipo("Primero crea tu empresa o acepta una invitación.")
    if (m.rol !== "admin") throw new ErrorEquipo("Sólo un administrador de la empresa puede hacer esto.", 403)
    const quien = [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email
    if (b.accion === "invitar") return res.json(await invitar(knex, m, b.email, b.rol, quien))
    if (b.accion === "quitar") return res.json(await quitar(knex, m, b.email))
    if (b.accion === "aprobacion") {
      await knex(T_EMPRESA).where({ id: m.empresa_id }).update({ aprobacion: b.activa === true })
      return res.json({ ok: true })
    }
    if (b.accion === "aprobar" || b.accion === "rechazar") return res.json(await decidirPedido(knex, logger, m, b.folio, b.accion === "aprobar"))
    throw new ErrorEquipo("Acción desconocida.")
  } catch (e) {
    if (e instanceof ErrorEquipo) return res.status(e.status).json({ message: e.message })
    logger.warn(`[mi-equipo] ${(e as Error).message}`)
    res.status(500).json({ message: "No se pudo. Intenta de nuevo." })
  }
}
