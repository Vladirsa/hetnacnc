import { PaginatedResponse } from "@medusajs/framework/types"

export type VendorLessonDTO = {
  id: string
  title: string
  description: string | null
  position: number
  duration_seconds: number | null
  is_preview: boolean
}

export type VendorCourseSectionDTO = {
  id: string
  title: string
  position: number
  lessons: VendorLessonDTO[]
}

export type VendorCourseDTO = {
  id: string
  title: string
  slug: string
  description: string | null
  thumbnail_url: string | null
  level: "principiante" | "intermedio" | "avanzado"
  language: string
  status: "draft" | "published"
  published_at: string | null
  created_at: string
  updated_at: string
  product: { id: string; handle: string | null; title: string } | null
  sections?: VendorCourseSectionDTO[]
}

export interface VendorCourseResponse {
  course: VendorCourseDTO
}

export type VendorCourseListResponse = PaginatedResponse<{
  courses: VendorCourseDTO[]
}>

export interface VendorCourseSectionResponse {
  section: VendorCourseSectionDTO
}

export interface VendorLessonResponse {
  lesson: VendorLessonDTO
}
