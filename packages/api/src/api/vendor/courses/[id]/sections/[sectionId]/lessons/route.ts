import { MedusaError } from "@medusajs/framework/utils"
import { MedusaResponse } from "@medusajs/framework/http"
import { videoDeUrl } from "../../../../../../../lib/cursos"

import { COURSE_MODULE } from "../../../../../../../modules/course"
import CourseModuleService from "../../../../../../../modules/course/service"
import { VendorCreateLessonType } from "../../../../validators"
import { VendorLessonResponse, VendorLessonDTO } from "../../../../types"
import { VendorRequest } from "../../../../vendor-request"

export const POST = async (
  req: VendorRequest<VendorCreateLessonType>,
  res: MedusaResponse<VendorLessonResponse>
) => {
  const courseModuleService = req.scope.resolve<CourseModuleService>(COURSE_MODULE)

  const [course] = await courseModuleService.listCourses({
    id: req.params.id,
    seller_id: req.seller_context!.seller_id,
  })
  if (!course) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Course with id "${req.params.id}" not found`)
  }
  const [section] = await courseModuleService.listCourseSections({
    id: req.params.sectionId,
    course_id: req.params.id,
  })
  if (!section) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Section with id "${req.params.sectionId}" not found`)
  }

  const { video_url, ...datos } = req.validatedBody
  const video = videoDeUrl(video_url)
  if (video_url && !video) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Pega un enlace de YouTube o Vimeo")
  }
  const lesson = await courseModuleService.createLessons({
    ...datos,
    ...(video ? { video_provider: video.provider, video_asset_id: video.asset_id } : {}),
    section_id: req.params.sectionId,
  } as any)

  res.json({ lesson: lesson as unknown as VendorLessonDTO })
}
