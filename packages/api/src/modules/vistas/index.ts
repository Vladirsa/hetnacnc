import { Module } from "@medusajs/framework/utils"
import VistasModuleService from "./service"

export const VISTAS_MODULE = "vistas"

export default Module(VISTAS_MODULE, {
  service: VistasModuleService,
})
