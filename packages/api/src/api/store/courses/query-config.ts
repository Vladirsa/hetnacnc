const listFields = [
  "id",
  "title",
  "slug",
  "description",
  "thumbnail_url",
  "level",
  "language",
  "published_at",
  "product.id",
  "product.handle",
  "product.title",
]

const retrieveFields = [
  ...listFields,
  "sections.id",
  "sections.title",
  "sections.position",
  "sections.lessons.id",
  "sections.lessons.title",
  "sections.lessons.description",
  "sections.lessons.position",
  "sections.lessons.duration_seconds",
  "sections.lessons.is_preview",
]

export const storeCourseQueryConfig = {
  list: {
    defaults: listFields,
    isList: true,
  },
  retrieve: {
    defaults: retrieveFields,
  },
}
