import { Module } from "@medusajs/framework/utils"

import EnrollmentModuleService from "./service"

export const ENROLLMENT_MODULE = "enrollment"

export default Module(ENROLLMENT_MODULE, {
  service: EnrollmentModuleService,
})
