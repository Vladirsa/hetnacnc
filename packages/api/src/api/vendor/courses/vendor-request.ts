import { AuthenticatedMedusaRequest } from "@medusajs/framework/http"

// Mercur's ensureSellerMiddleware (ships internally, not exported from the
// package's public types) populates req.seller_context on every /vendor/*
// request once x-seller-id resolves to a seller the member belongs to. A
// global `declare module "express"` augmentation conflicted with this
// monorepo's duplicated @medusajs/framework copies, so this local
// intersection type is used at each vendor route instead.
export type VendorRequest<Body = unknown, Query = Record<string, unknown>> = AuthenticatedMedusaRequest<
  Body,
  Query
> & {
  seller_context?: {
    seller_id: string
    currency_code: string
  }
}
