import { Module } from "@medusajs/framework/utils"
import SimuladorModuleService from "./service"

export const SIMULADOR_MODULE = "simulador"

export default Module(SIMULADOR_MODULE, {
  service: SimuladorModuleService,
})
