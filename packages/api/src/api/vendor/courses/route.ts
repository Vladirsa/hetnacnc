import { MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { createVendorCourseWorkflow } from "../../../workflows/create-vendor-course"
import { VendorCreateCourseType, VendorGetCoursesParamsType } from "./validators"
import { VendorCourseListResponse, VendorCourseResponse, VendorCourseDTO } from "./types"
import { VendorRequest } from "./vendor-request"
import { prepararVentaCurso } from "../../../lib/cursos"

export const GET = async (
  req: VendorRequest<unknown, VendorGetCoursesParamsType>,
  res: MedusaResponse<VendorCourseListResponse>
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: courses, metadata } = await query.graph({
    entity: "course",
    fields: req.queryConfig.fields,
    filters: { seller_id: req.seller_context!.seller_id },
    pagination: req.queryConfig.pagination,
  })

  res.json({
    courses: courses as unknown as VendorCourseDTO[],
    count: metadata!.count,
    offset: metadata!.skip,
    limit: metadata!.take,
  })
}

export const POST = async (
  req: VendorRequest<VendorCreateCourseType>,
  res: MedusaResponse<VendorCourseResponse>
) => {
  const { result } = await createVendorCourseWorkflow(req.scope).run({
    input: {
      ...req.validatedBody,
      seller_id: req.seller_context!.seller_id,
    },
  })

  // Curso de pago: oferta del taller + "digital" + categoría Cursos.
  // Gratis: el producto queda en borrador y se inscribe con un clic.
  const ctx = (req as any).seller_context as { seller_member?: { member_id?: string } } | undefined
  await prepararVentaCurso(req.scope, {
    productId: result.product.id,
    sellerId: req.seller_context!.seller_id,
    precio: Number(req.validatedBody.price_amount) || 0,
    memberId: ctx?.seller_member?.member_id || req.auth_context?.actor_id,
    thumbnail: req.validatedBody.thumbnail_url,
    slug: (result.course as any)?.slug,
        publicado: (result.course as any)?.status === "published",
    description: req.validatedBody.description,
  })

  res.json({ course: result.course as unknown as VendorCourseDTO })
}
