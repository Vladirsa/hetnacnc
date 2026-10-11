import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { createRemoteLinkStep } from "@medusajs/medusa/core-flows"
import { Modules } from "@medusajs/framework/utils"
import type { LinkDefinition } from "@medusajs/framework/types"

import { COURSE_MODULE } from "../../modules/course"
import { ENROLLMENT_MODULE } from "../../modules/enrollment"
import { enrollCustomerStep, EnrollCustomerStepInput } from "./steps/enroll-customer"

export const enrollCustomerInCourseWorkflow = createWorkflow(
  "enroll-customer-in-course",
  function (input: EnrollCustomerStepInput) {
    const enrollment = enrollCustomerStep(input)

    const links = transform({ enrollment, input }, ({ enrollment, input }): LinkDefinition[] => {
      const defs: LinkDefinition[] = [
        {
          [ENROLLMENT_MODULE]: { enrollment_id: enrollment.id },
          [Modules.CUSTOMER]: { customer_id: input.customer_id },
        },
        {
          [ENROLLMENT_MODULE]: { enrollment_id: enrollment.id },
          [COURSE_MODULE]: { course_id: input.course_id },
        },
      ]
      if (input.order_id) {
        defs.push({
          [ENROLLMENT_MODULE]: { enrollment_id: enrollment.id },
          [Modules.ORDER]: { order_id: input.order_id },
        })
      }
      return defs
    })
    createRemoteLinkStep(links)

    return new WorkflowResponse(enrollment)
  }
)
