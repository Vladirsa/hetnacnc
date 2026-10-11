import { validateAndTransformBody, validateAndTransformQuery, MiddlewareRoute } from "@medusajs/framework/http"

import {
  VendorCreateCourse,
  VendorUpdateCourse,
  VendorGetCoursesParams,
  VendorCreateSection,
  VendorUpdateSection,
  VendorCreateLesson,
  VendorUpdateLesson,
} from "./validators"
import { vendorCourseQueryConfig } from "./query-config"

export const vendorCoursesMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/vendor/courses",
    middlewares: [validateAndTransformQuery(VendorGetCoursesParams, vendorCourseQueryConfig.list)],
  },
  {
    method: ["POST"],
    matcher: "/vendor/courses",
    middlewares: [validateAndTransformBody(VendorCreateCourse)],
  },
  {
    method: ["GET"],
    matcher: "/vendor/courses/:id",
    middlewares: [validateAndTransformQuery(VendorGetCoursesParams, vendorCourseQueryConfig.retrieve)],
  },
  {
    method: ["POST"],
    matcher: "/vendor/courses/:id",
    middlewares: [validateAndTransformBody(VendorUpdateCourse)],
  },
  {
    method: ["POST"],
    matcher: "/vendor/courses/:id/sections",
    middlewares: [validateAndTransformBody(VendorCreateSection)],
  },
  {
    method: ["POST"],
    matcher: "/vendor/courses/:id/sections/:sectionId",
    middlewares: [validateAndTransformBody(VendorUpdateSection)],
  },
  {
    method: ["DELETE"],
    matcher: "/vendor/courses/:id/sections/:sectionId",
    middlewares: [],
  },
  {
    method: ["POST"],
    matcher: "/vendor/courses/:id/sections/:sectionId/lessons",
    middlewares: [validateAndTransformBody(VendorCreateLesson)],
  },
  {
    method: ["POST"],
    matcher: "/vendor/courses/:id/sections/:sectionId/lessons/:lessonId",
    middlewares: [validateAndTransformBody(VendorUpdateLesson)],
  },
  {
    method: ["DELETE"],
    matcher: "/vendor/courses/:id/sections/:sectionId/lessons/:lessonId",
    middlewares: [],
  },
]
