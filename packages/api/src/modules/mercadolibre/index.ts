import { Module } from "@medusajs/framework/utils"
import MercadoLibreModuleService from "./service"

export const MERCADOLIBRE_MODULE = "mercadolibre"

export default Module(MERCADOLIBRE_MODULE, {
  service: MercadoLibreModuleService,
})
