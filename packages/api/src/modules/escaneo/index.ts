import { Module } from "@medusajs/framework/utils"

import EscaneoModuleService from "./service"

export const ESCANEO_MODULE = "escaneo"

export default Module(ESCANEO_MODULE, {
  service: EscaneoModuleService,
})
