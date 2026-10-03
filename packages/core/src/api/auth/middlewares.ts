import { MiddlewareRoute } from "@medusajs/medusa"

// Auth middleware routes - this ensures auth routes are registered
export const authMiddlewares: MiddlewareRoute[] = [
  // Auth routes from @medusajs/medusa/auth are automatically registered
  // when this middleware is included in the main middleware chain
]
