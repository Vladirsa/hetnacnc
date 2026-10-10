import { defineLink } from "@medusajs/framework/utils"
import CustomerModule from "@medusajs/medusa/customer"

import EnrollmentModule from "../modules/enrollment"

// Muchas inscripciones por cliente (uno por cada curso comprado).
export default defineLink(
  { linkable: EnrollmentModule.linkable.enrollment, isList: true },
  CustomerModule.linkable.customer
)
