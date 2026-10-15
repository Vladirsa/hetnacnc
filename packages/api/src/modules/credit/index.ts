import { Module } from "@medusajs/framework/utils"

import CreditModuleService from "./service"

export const CREDIT_MODULE = "credit"

export default Module(CREDIT_MODULE, {
  service: CreditModuleService,
})
