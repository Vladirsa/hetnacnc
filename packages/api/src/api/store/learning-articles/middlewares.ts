import { validateAndTransformQuery, MiddlewareRoute } from "@medusajs/framework/http"

import {
  StoreGetLearningArticlesParams,
  StoreGetLearningArticleParams,
} from "./validators"
import { storeLearningArticleQueryConfig } from "./query-config"

export const storeLearningArticlesMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/store/learning-articles",
    middlewares: [
      validateAndTransformQuery(
        StoreGetLearningArticlesParams,
        storeLearningArticleQueryConfig.list
      ),
    ],
  },
  {
    method: ["GET"],
    matcher: "/store/learning-articles/:slug",
    middlewares: [
      validateAndTransformQuery(
        StoreGetLearningArticleParams,
        storeLearningArticleQueryConfig.retrieve
      ),
    ],
  },
]
