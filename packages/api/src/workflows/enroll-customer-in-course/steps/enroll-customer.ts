import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

import { ENROLLMENT_MODULE } from "../../../modules/enrollment"
import EnrollmentModuleService from "../../../modules/enrollment/service"

export type EnrollCustomerStepInput = {
  customer_id: string
  course_id: string
  order_id?: string | null
}

export const enrollCustomerStep = createStep(
  "enroll-customer-step",
  async (input: EnrollCustomerStepInput, { container }) => {
    const enrollmentModuleService = container.resolve<EnrollmentModuleService>(ENROLLMENT_MODULE)

    const enrollment = await enrollmentModuleService.createEnrollments({
      ...input,
      enrolled_at: new Date(),
    })

    return new StepResponse(enrollment, enrollment.id)
  },
  async (enrollmentId: string | undefined, { container }) => {
    if (!enrollmentId) return

    const enrollmentModuleService = container.resolve<EnrollmentModuleService>(ENROLLMENT_MODULE)
    await enrollmentModuleService.deleteEnrollments(enrollmentId)
  }
)
