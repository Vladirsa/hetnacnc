// POST /store/muebles/tableros — convierte la imagen de cualquier mueble de
// tableros (foto, boceto, render o plano) en una lista de tableros a escala.
// El storefront calcula las uniones y lo muestra armado. Cobra 2 créditos y
// los regresa si la lectura falla o si la imagen no es un mueble de tableros.
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { leerTablerosDeImagen } from "../../../../lib/muebles-ia"
import { lecturaConCobro } from "../cobro-ia"

export const POST = (req: AuthenticatedMedusaRequest, res: MedusaResponse) =>
  lecturaConCobro(req, res, { descripcion: "Diseño de mueble desde imagen (IA)", leer: leerTablerosDeImagen, inutil: (l) => l.tipo !== "tableros" || l.tableros.length < 2 })
