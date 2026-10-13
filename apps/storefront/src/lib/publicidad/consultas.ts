// Lectura de anuncios para el sitio (solo servidor).
// Los anuncios se guardan en memoria 60 segundos para que la página siga siendo rápida;
// al guardar un cambio en el panel se borra esa memoria al instante (revalidateTag).

import { unstable_cache } from "next/cache"

import { db } from "@/lib/foro/db"

import { ESPACIOS, esEspacio, type Pieza } from "./tipos"

const COLUMNAS = `id, espacio, titulo, subtitulo, boton, enlace, imagen_url, imagen_movil_url, video_url,
  anunciante, es_publicidad, orden, desde::text as desde, hasta::text as hasta, activo, vistas, clics,
  creado::text as creado`

const leerEspacio = unstable_cache(
  async (espacio: string): Promise<Pieza[]> => {
    if (!esEspacio(espacio)) return []
    try {
      const r = await db().query(
        `select ${COLUMNAS} from publicidad.piezas
         where espacio = $1 and activo and desde <= now() and (hasta is null or hasta > now())
         order by orden asc, creado desc
         limit $2`,
        [espacio, ESPACIOS[espacio].max]
      )
      return r.rows as Pieza[]
    } catch (e) {
      // Si todavía no se creó la tabla o falla la base, el sitio sigue normal (sin anuncios).
      console.error("[publicidad] lectura", e instanceof Error ? e.message : e)
      return []
    }
  },
  ["publicidad-espacio"],
  { revalidate: 60, tags: ["publicidad"] }
)

/** Anuncios vigentes de un espacio (rápido, con memoria de 60 s). */
export const piezasDe = (espacio: string) => leerEspacio(espacio)

/** Todos los anuncios para el panel de administración (sin memoria). */
export async function todasLasPiezas(): Promise<Pieza[]> {
  const r = await db().query(
    `select ${COLUMNAS} from publicidad.piezas order by espacio asc, orden asc, creado desc`
  )
  return r.rows as Pieza[]
}
