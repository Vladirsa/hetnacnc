import { MedusaService } from "@medusajs/framework/utils"
import Descarga from "./models/descarga-gratis"

// La llave es "Descarga" y no "DescargaGratis": el pluralizador de Medusa en
// tiempo de ejecución deja "Gratis" igual (listDescargaGratis) y el de los
// tipos le pone "es" (listDescargaGratises), así que el código compilaba y
// tronaba al correr. "Descarga" sale "Descargas" en los dos.
class DescargasModuleService extends MedusaService({
  Descarga,
}) {}

export default DescargasModuleService
