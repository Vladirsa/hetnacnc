import { Module } from "@medusajs/framework/utils"
import TableroModuleService from "./service"

export const TABLERO_MODULE = "tablero"

export default Module(TABLERO_MODULE, {
  service: TableroModuleService,
})
