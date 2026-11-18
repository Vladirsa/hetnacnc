// POST /store/muebles/imagen — lee un exhibidor desde una foto, boceto o plano
// con IA y regresa las medidas para el constructor de ensamble. Cobra los
// créditos antes de llamar a la IA y los regresa si la lectura falla o si la
// imagen no es un exhibidor.
import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { leerMuebleDeImagen } from "../../../../lib/muebles-ia"
import { lecturaConCobro } from "../cobro-ia"

export { CREDITOS_IMAGEN_MUEBLE } from "../cobro-ia"

export const POST = (req: AuthenticatedMedusaRequest, res: MedusaResponse) =>
  lecturaConCobro(req, res, { descripcion: "Diseño de exhibidor desde imagen (IA)", leer: leerMuebleDeImagen, inutil: (l) => l.tipo !== "exhibidor" })
