import { MedusaService } from "@medusajs/framework/utils"

import Escaneo3d from "./models/escaneo"

// La llave que se le pasa a MedusaService decide los nombres de los métodos
// generados (list…, create…, update…). Con "Escaneo" salían como
// "listEscaneoes", que no es español ni inglés; "Escaneo3d" genera
// "listEscaneo3ds" y además coincide con el nombre de la tabla.
class EscaneoModuleService extends MedusaService({
  Escaneo3d,
}) {}

export default EscaneoModuleService
