import { authenticate, validateAndTransformQuery, MiddlewareRoute } from "@medusajs/framework/http"

import { StoreGetCoursesParams, StoreGetCourseParams } from "./validators"
import { storeCourseQueryConfig } from "./query-config"

export const storeCoursesMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/store/courses",
    middlewares: [validateAndTransformQuery(StoreGetCoursesParams, storeCourseQueryConfig.list)],
  },
  {
    method: ["GET"],
    matcher: "/store/courses/:slug",
    middlewares: [validateAndTransformQuery(StoreGetCourseParams, storeCourseQueryConfig.retrieve)],
  },
  {
    method: ["POST"],
    matcher: "/store/courses/:slug/inscribir",
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
  {
    method: ["GET"],
    matcher: "/store/courses/:slug/acceso",
    middlewares: [authenticate("customer", ["session", "bearer"], { allowUnauthenticated: true })],
  },
]
