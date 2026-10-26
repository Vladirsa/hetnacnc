import { AuthenticatedMedusaRequest } from "@medusajs/framework/http"

// Mirrors packages/api/src/api/vendor/courses/vendor-request.ts — Mercur's
// ensureSellerMiddleware (internal, not exported) populates req.seller_context
// on every /vendor/* request, but its type augmentation isn't exported either.
export type VendorRequest<Body = unknown, Query = Record<string, unknown>> = AuthenticatedMedusaRequest<
  Body,
  Query
> & {
  seller_context?: {
    seller_id: string
    currency_code: string
  }
}
