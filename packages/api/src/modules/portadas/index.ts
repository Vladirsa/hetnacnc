import { Module } from "@medusajs/framework/utils"

import PortadasModuleService from "./service"

export const PORTADAS_MODULE = "portadas"

export { PortadasModuleService }

export default Module(PORTADAS_MODULE, {
  service: PortadasModuleService,
})
