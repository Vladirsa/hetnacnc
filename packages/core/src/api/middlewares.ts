import { MiddlewareRoute, defineMiddlewares } from "@medusajs/medusa"
import { authMiddlewares } from "./auth/middlewares"

export default defineMiddlewares({
  routes: [
    ...authMiddlewares,
  ],
})
