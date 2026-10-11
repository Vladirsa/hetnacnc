'use server';

import { sdk } from '../client';

export type Lesson = {
  id: string;
  title: string;
  description: string | null;
  position: number;
  duration_seconds: number | null;
  is_preview: boolean;
};

export type CourseSection = {
  id: string;
  title: string;
  position: number;
  lessons: Lesson[];
};

export type Course = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnail_url: string | null;
  level: 'principiante' | 'intermedio' | 'avanzado';
  language: string;
  published_at: string | null;
  product: { id: string; handle: string | null; title: string } | null;
  sections?: CourseSection[];
};

const LIST_FIELDS = 'id,title,slug,description,thumbnail_url,level,language,published_at,product.id,product.handle,product.title';
const DETAIL_FIELDS =
  LIST_FIELDS +
  ',sections.id,sections.title,sections.position,sections.lessons.id,sections.lessons.title,sections.lessons.description,sections.lessons.position,sections.lessons.duration_seconds,sections.lessons.is_preview';

export const listCourses = async ({
  limit = 12,
  offset = 0,
}: { limit?: number; offset?: number } = {}): Promise<{ courses: Course[]; count: number }> => {
  return (
    sdk.store.courses.query({
      limit,
      offset,
      fields: LIST_FIELDS,
      fetchOptions: { cache: 'force-cache', next: { revalidate: 300 } },
    } as never) as unknown as Promise<{ courses: Course[]; count: number }>
  ).catch(() => ({ courses: [], count: 0 }));
};

export const getCourseBySlug = async (slug: string): Promise<Course | undefined> => {
  return (
    sdk.store.courses.$slug.query({
      $slug: slug,
      fields: DETAIL_FIELDS,
      fetchOptions: { cache: 'force-cache', next: { revalidate: 300 } },
    } as never) as unknown as Promise<{ course: Course }>
  )
    .then(({ course }) => course)
    .catch(() => undefined);
};
