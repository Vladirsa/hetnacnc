import { Module } from "@medusajs/framework/utils"
import CamModuleService from "./service"

export const CAM_MODULE = "cam"

export default Module(CAM_MODULE, {
  service: CamModuleService,
})
