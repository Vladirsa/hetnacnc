export const vendorCourseListFields = [
  "id",
  "title",
  "slug",
  "thumbnail_url",
  "level",
  "language",
  "status",
  "published_at",
  "created_at",
  "updated_at",
  "product.id",
  "product.handle",
  "product.title",
  "product.metadata",
]

export const vendorCourseRetrieveFields = [
  ...vendorCourseListFields,
  "description",
  "sections.id",
  "sections.title",
  "sections.position",
  "sections.lessons.id",
  "sections.lessons.title",
  "sections.lessons.description",
  "sections.lessons.position",
  "sections.lessons.duration_seconds",
  "sections.lessons.is_preview",
  "sections.lessons.video_provider",
  "sections.lessons.video_asset_id",
]

export const vendorCourseQueryConfig = {
  list: {
    defaults: vendorCourseListFields,
    isList: true,
  },
  retrieve: {
    defaults: vendorCourseRetrieveFields,
    isList: false,
  },
}
