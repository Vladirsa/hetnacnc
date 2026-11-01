import { MedusaError, ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MedusaResponse } from "@medusajs/framework/http"

import { COURSE_MODULE } from "../../../../modules/course"
import CourseModuleService from "../../../../modules/course/service"
import { VendorUpdateCourseType } from "../validators"
import { VendorCourseResponse, VendorCourseDTO } from "../types"
import { VendorRequest } from "../vendor-request"
import { prepararVentaCurso, urlDeVideo } from "../../../../lib/cursos"

export const GET = async (req: VendorRequest, res: MedusaResponse<VendorCourseResponse>) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [course],
  } = await query.graph({
    entity: "course",
    fields: req.queryConfig.fields,
    filters: { id: req.params.id, seller_id: req.seller_context!.seller_id },
  })

  if (!course) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Course with id "${req.params.id}" not found`)
  }

  // El taller ve el enlace que pegó, no el id interno
  const c = course as any
  for (const s of c.sections || []) {
    for (const l of s.lessons || []) l.video_url = urlDeVideo(l.video_provider, l.video_asset_id)
  }
  const m = c.product?.metadata || {}
  c.price_amount = Number(m.curso_precio_mxn) || 0
  c.gratis = !(c.price_amount > 0)
  if (c.product) delete c.product.metadata

  res.json({ course: course as unknown as VendorCourseDTO })
}

export const POST = async (
  req: VendorRequest<VendorUpdateCourseType>,
  res: MedusaResponse<VendorCourseResponse>
) => {
  const courseModuleService = req.scope.resolve<CourseModuleService>(COURSE_MODULE)

  const [existing] = await courseModuleService.listCourses({
    id: req.params.id,
    seller_id: req.seller_context!.seller_id,
  })
  if (!existing) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Course with id "${req.params.id}" not found`)
  }

  const { price_amount, ...body } = req.validatedBody
  const updateData: Record<string, unknown> = { id: req.params.id, ...body }
  if (body.status === "published" && !existing.published_at) {
    updateData.published_at = new Date()
  }

  const course = await courseModuleService.updateCourses(updateData as any)

  if (price_amount !== undefined || body.status !== undefined) {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "course",
      fields: ["slug", "status", "thumbnail_url", "product.id", "product.metadata"],
      filters: { id: req.params.id },
    })
    const c = data[0] as any
    if (c?.product?.id) {
      const ctx = (req as any).seller_context as { seller_member?: { member_id?: string } } | undefined
      await prepararVentaCurso(req.scope, {
        productId: c.product.id,
        sellerId: req.seller_context!.seller_id,
        precio: price_amount ?? (Number(c.product.metadata?.curso_precio_mxn) || 0),
        thumbnail: c.thumbnail_url,
        slug: c.slug,
        publicado: c.status === "published",
        memberId: ctx?.seller_member?.member_id || req.auth_context?.actor_id,
      })
    }
  }

  res.json({ course: course as unknown as VendorCourseDTO })
}
