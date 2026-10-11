import { PaginatedResponse } from "@medusajs/framework/types"

export type CourseDTO = {
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
}

export interface AdminCourseResponse {
  course: CourseDTO
}

export type AdminCourseListResponse = PaginatedResponse<{
  courses: CourseDTO[]
}>
