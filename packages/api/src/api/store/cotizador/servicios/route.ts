import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { listaServicios } from "../../../../lib/cotizador-config"

// Catálogo de servicios y tipos de trabajo que entiende el motor, para que la
// interfaz (web y móvil) arme sus selectores sin hardcodearlos.
export const GET = async (_req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  res.json({ servicios: listaServicios() })
}
