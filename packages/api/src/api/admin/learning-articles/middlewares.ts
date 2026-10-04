import {
  validateAndTransformBody,
  validateAndTransformQuery,
  MiddlewareRoute,
} from "@medusajs/framework/http"

import {
  AdminCreateLearningArticle,
  AdminGetLearningArticlesParams,
} from "./validators"
import { adminLearningArticleQueryConfig } from "./query-config"

export const adminLearningArticlesMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/admin/learning-articles",
    middlewares: [
      validateAndTransformQuery(
        AdminGetLearningArticlesParams,
        adminLearningArticleQueryConfig.list
      ),
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/learning-articles",
    middlewares: [validateAndTransformBody(AdminCreateLearningArticle)],
  },
]
