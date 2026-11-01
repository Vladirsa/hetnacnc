'use server';

import { sdk } from '../client';
import { getAuthHeaders } from './cookies';

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
  // agregados por el backend (lib/cursos.ts: enriquecerCursos)
  precio?: { gratis: boolean; mxn: number; usd: number | null };
  taller?: { id: string; nombre: string; handle: string | null; foto: string | null } | null;
  lecciones?: number;
  vistas_previas?: number;
  duracion_segundos?: number;
  alumnos?: number;
};

export type AccesoCurso = {
  course_id: string;
  inscrito: boolean;
  lecciones: { id: string; abierta: boolean; embed_url: string | null }[];
};

const API = process.env.MEDUSA_BACKEND_URL || 'http://localhost:9000';
const PK = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string;
const SLUG = /^[a-z0-9][a-z0-9-]{0,120}$/i;

/** Qué lecciones puede ver quien está en la página (con o sin sesión). */
export const getAccesoCurso = async (slug: string): Promise<AccesoCurso | null> => {
  if (!SLUG.test(slug)) return null;
  const auth = (await getAuthHeaders().catch(() => ({}))) as Record<string, string>;
  try {
    const r = await fetch(`${API}/store/courses/${slug}/acceso`, {
      headers: { 'x-publishable-api-key': PK, ...auth },
      cache: 'no-store',
    });
    return r.ok ? ((await r.json()) as AccesoCurso) : null;
  } catch {
    return null;
  }
};

/** Inscribirse a un curso gratis. */
export const inscribirmeGratis = async (
  slug: string
): Promise<{ ok: boolean; mensaje: string; sesion?: boolean }> => {
  if (!SLUG.test(slug)) return { ok: false, mensaje: 'Curso inválido.' };
  const auth = (await getAuthHeaders().catch(() => ({}))) as { authorization?: string };
  if (!auth.authorization) return { ok: false, sesion: false, mensaje: 'Inicia sesión o crea tu cuenta gratis para inscribirte.' };
  try {
    const r = await fetch(`${API}/store/courses/${slug}/inscribir`, {
      method: 'POST',
      headers: { 'x-publishable-api-key': PK, ...auth },
      cache: 'no-store',
    });
    const j = (await r.json().catch(() => ({}))) as { message?: string };
    if (r.status === 401) return { ok: false, sesion: false, mensaje: 'Inicia sesión de nuevo para inscribirte.' };
    return r.ok ? { ok: true, mensaje: '¡Listo! Ya estás inscrito.' } : { ok: false, mensaje: j.message || 'No se pudo inscribir.' };
  } catch {
    return { ok: false, mensaje: 'No se pudo conectar. Intenta de nuevo.' };
  }
};

const LIST_FIELDS = 'id,title,slug,description,thumbnail_url,level,language,published_at,product.id,product.handle,product.title';
const DETAIL_FIELDS =
  LIST_FIELDS +
  ',sections.id,sections.title,sections.position,sections.lessons.id,sections.lessons.title,sections.lessons.description,sections.lessons.position,sections.lessons.duration_seconds,sections.lessons.is_preview';

export const listCourses = async ({
  limit = 60,
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
