import { MiddlewareRoute } from "@medusajs/framework/http"

export const vendorAnalyticsMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/vendor/analytics",
    middlewares: [],
  },
]
