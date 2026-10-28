import { Module } from "@medusajs/framework/utils"
import DescargasModuleService from "./service"

export const DESCARGAS_MODULE = "descargas"

export default Module(DESCARGAS_MODULE, {
  service: DescargasModuleService,
})
