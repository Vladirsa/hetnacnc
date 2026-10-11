import { defineLink } from "@medusajs/framework/utils"
import OrderModule from "@medusajs/medusa/order"

import EnrollmentModule from "../modules/enrollment"

// La orden que generó esta inscripción (una orden puede, en teoría, incluir
// más de un curso, pero cada inscripción apunta a una sola orden).
export default defineLink(EnrollmentModule.linkable.enrollment, OrderModule.linkable.order)
