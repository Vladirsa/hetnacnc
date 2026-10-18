import { Module } from "@medusajs/framework/utils"

import CotizadorModuleService from "./service"

export const COTIZADOR_MODULE = "cotizador"

export default Module(COTIZADOR_MODULE, {
  service: CotizadorModuleService,
})
