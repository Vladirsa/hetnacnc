const fields = [
  "id",
  "slug",
  "title",
  "excerpt",
  "content_html",
  "cover_image_url",
  "video_url",
  "external_links",
  "seo_title",
  "seo_description",
  "published_at",
]

export const storeLearningArticleQueryConfig = {
  list: {
    defaults: fields,
    isList: true,
  },
  retrieve: {
    defaults: fields,
  },
}
