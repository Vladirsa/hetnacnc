import { Module } from "@medusajs/framework/utils"
import LearningModuleService from "./service"

export const LEARNING_MODULE = "learning"

export default Module(LEARNING_MODULE, {
  service: LearningModuleService,
})
