import { Module } from "@medusajs/framework/utils"
import VerificacionModuleService from "./service"

export const VERIFICACION_MODULE = "verificacion"

export default Module(VERIFICACION_MODULE, {
  service: VerificacionModuleService,
})
