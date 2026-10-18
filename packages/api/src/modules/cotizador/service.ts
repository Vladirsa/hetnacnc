import { MedusaService } from "@medusajs/framework/utils"

import TallerPerfil from "./models/taller-perfil"
import Cotizacion from "./models/cotizacion"
import CotizacionPartida from "./models/cotizacion-partida"

class CotizadorModuleService extends MedusaService({
  TallerPerfil,
  Cotizacion,
  CotizacionPartida,
}) {}

export default CotizadorModuleService
