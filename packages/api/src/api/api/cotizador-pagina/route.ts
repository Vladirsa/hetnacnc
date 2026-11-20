import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { guardarPaginaTaller, paginaDelTaller } from "../../../lib/cotizador-en-linea"
import { responder, tokenDe } from "../cotizador-suscripcion/respuesta"
import { estadisticasPagina } from "../../../lib/taller-pagina-visitas"

// Agrega las estadísticas de los últimos 30 días (visitas, widget, solicitudes)
// y la página para compartir (QR y código para su web).
async function conEstadisticas(req: MedusaRequest, d: any) {
  if (!d?.slug || !d?.negocio_id) return d
  const knex = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const estadisticas = await estadisticasPagina(knex, d.slug, d.negocio_id).catch(() => null)
  const { negocio_id, ...resto } = d
  return { ...resto, estadisticas, compartir_url: d.url ? `${d.url}/compartir` : null }
}

// GET  https://hetnacnc.com/api/cotizador-pagina  (sesión de Supabase del administrador)
//      -> { tabla_lista, slug, url, pagina: {...}, servicios: [...] }
// POST { activa?, slug?, titulo?, descripcion?, ciudad?, servicios?, mostrar_precio?, en_directorio? }
export const GET = (req: MedusaRequest, res: MedusaResponse) => responder(req, res, async () => conEstadisticas(req, await paginaDelTaller(tokenDe(req))))

export const POST = (req: MedusaRequest, res: MedusaResponse) =>
  responder(req, res, async () => conEstadisticas(req, await guardarPaginaTaller(tokenDe(req), (req.body || {}) as Record<string, any>)))
