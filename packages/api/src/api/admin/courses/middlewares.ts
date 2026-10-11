import {
  validateAndTransformBody,
  validateAndTransformQuery,
  MiddlewareRoute,
} from "@medusajs/framework/http"

import { AdminCreateCourse, AdminGetCoursesParams } from "./validators"
import { adminCourseQueryConfig } from "./query-config"

export const adminCoursesMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/admin/courses",
    middlewares: [validateAndTransformQuery(AdminGetCoursesParams, adminCourseQueryConfig.list)],
  },
  {
    method: ["POST"],
    matcher: "/admin/courses",
    middlewares: [validateAndTransformBody(AdminCreateCourse)],
  },
]
