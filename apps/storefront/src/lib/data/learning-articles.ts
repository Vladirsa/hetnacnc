'use server';

import { sdk } from '../client';

export type LearningArticle = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content_html: string;
  cover_image_url: string | null;
  video_url: string | null;
  external_links: { label: string; url: string }[] | null;
  seo_title: string | null;
  seo_description: string | null;
  published_at: string | null;
};

const FIELDS =
  'id,slug,title,excerpt,content_html,cover_image_url,video_url,external_links,seo_title,seo_description,published_at';

export const listLearningArticles = async ({
  limit = 12,
  offset = 0,
}: { limit?: number; offset?: number } = {}): Promise<{
  learning_articles: LearningArticle[];
  count: number;
}> => {
  return (
    sdk.store.learningArticles.query({
      limit,
      offset,
      fields: FIELDS,
      fetchOptions: { cache: 'force-cache', next: { revalidate: 300 } },
    } as never) as unknown as Promise<{
      learning_articles: LearningArticle[];
      count: number;
    }>
  ).catch(() => ({ learning_articles: [], count: 0 }));
};

export const getLearningArticleBySlug = async (
  slug: string
): Promise<LearningArticle | undefined> => {
  return (
    sdk.store.learningArticles.$slug.query({
      $slug: slug,
      fields: FIELDS,
      fetchOptions: { cache: 'force-cache', next: { revalidate: 300 } },
    } as never) as unknown as Promise<{ learning_article: LearningArticle }>
  )
    .then(({ learning_article }) => learning_article)
    .catch(() => undefined);
};
