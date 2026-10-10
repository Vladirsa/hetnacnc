import { PaginatedResponse } from "@medusajs/framework/types"

export type StoreLessonDTO = {
  id: string
  title: string
  description: string | null
  position: number
  duration_seconds: number | null
  is_preview: boolean
}

export type StoreCourseSectionDTO = {
  id: string
  title: string
  position: number
  lessons: StoreLessonDTO[]
}

export type StoreCourseDTO = {
  id: string
  title: string
  slug: string
  description: string | null
  thumbnail_url: string | null
  level: "principiante" | "intermedio" | "avanzado"
  language: string
  published_at: string | null
  product: { id: string; handle: string | null; title: string } | null
  sections?: StoreCourseSectionDTO[]
}

export interface StoreCourseResponse {
  course: StoreCourseDTO
}

export type StoreCourseListResponse = PaginatedResponse<{
  courses: StoreCourseDTO[]
}>
