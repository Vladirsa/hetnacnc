// Lectura de anuncios para el sitio (solo servidor).
// Los anuncios se guardan en memoria 60 segundos para que la página siga siendo rápida;
// al guardar un cambio en el panel se borra esa memoria al instante (revalidateTag).

import { unstable_cache } from "next/cache"

import { db } from "@/lib/foro/db"

import { asegurarEsquema } from "./esquema"
import { ESPACIOS, esEspacio, type Pieza } from "./tipos"

const COLUMNAS = `id, espacio, titulo, subtitulo, boton, enlace, imagen_url, imagen_movil_url, video_url,
  anunciante, es_publicidad, orden, desde::text as desde, hasta::text as hasta, activo, vistas, clics,
  creado::text as creado, vistas_objetivo, tipo_anunciante, pedido_id`

const leerEspacio = unstable_cache(
  async (espacio: string): Promise<Pieza[]> => {
    if (!esEspacio(espacio)) return []
    try {
      await asegurarEsquema()
      // Un paquete de vistas sale hasta llegar a su cifra (vistas_objetivo)
      const r = await db().query(
        `select ${COLUMNAS} from publicidad.piezas
         where espacio = $1 and activo and desde <= now() and (hasta is null or hasta > now())
           and (vistas_objetivo is null or vistas < vistas_objetivo)
         order by orden asc, creado desc
         limit 50`,
        [espacio]
      )
      return turnar(r.rows as Pieza[], ESPACIOS[espacio].max)
    } catch (e) {
      // Si todavía no se creó la tabla o falla la base, el sitio sigue normal (sin anuncios).
      console.error("[publicidad] lectura", e instanceof Error ? e.message : e)
      return []
    }
  },
  ["publicidad-espacio"],
  { revalidate: 60, tags: ["publicidad"] }
)

/**
 * Si hay más anuncios que lugares, se turnan: cada minuto (lo que dura la
 * memoria) salen otros, al azar, y se acomodan por su orden. Antes los de
 * abajo nunca salían.
 */
function turnar(todas: Pieza[], max: number): Pieza[] {
  if (todas.length <= max) return todas
  const barajadas = [...todas]
  for (let i = barajadas.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[barajadas[i], barajadas[j]] = [barajadas[j], barajadas[i]]
  }
  return barajadas.slice(0, max).sort((a, b) => a.orden - b.orden || b.creado.localeCompare(a.creado))
}

/** Anuncios vigentes de un espacio (rápido, con memoria de 60 s). */
export const piezasDe = (espacio: string) => leerEspacio(espacio)

/** Todos los anuncios para el panel de administración (sin memoria). */
export async function todasLasPiezas(): Promise<Pieza[]> {
  await asegurarEsquema()
  const r = await db().query(
    `select ${COLUMNAS} from publicidad.piezas order by espacio asc, orden asc, creado desc`
  )
  return r.rows as Pieza[]
}

/**
 * Números reales de cada espacio, para el kit de medios de /anunciate y para
 * estimar cuánto tarda un paquete de vistas:
 *   vistasMes  vistas al mes que recibe UN anuncio (vistas ÷ días publicados × 30)
 *   ctr        % de vistas que terminan en clic
 * Promedio de todos los anuncios que ha tenido el espacio. Si es nuevo: null.
 */
export type Metricas = { vistasMes: number | null; ctr: number | null }
export const metricasEspacios = unstable_cache(
  async (): Promise<Record<string, Metricas>> => {
    const salida: Record<string, Metricas> = Object.fromEntries(Object.keys(ESPACIOS).map((k) => [k, { vistasMes: null, ctr: null }]))
    try {
      const r = await db().query(
        `select espacio,
                sum(vistas)::float / nullif(sum(greatest(1, extract(epoch from (least(now(), coalesce(hasta, now())) - greatest(desde, creado))) / 86400)), 0) * 30 as mes,
                100.0 * sum(clics) / nullif(sum(vistas), 0) as ctr
         from publicidad.piezas
         where vistas > 0
         group by espacio`
      )
      for (const f of r.rows as { espacio: string; mes: number | null; ctr: number | null }[])
        if (f.espacio in salida)
          salida[f.espacio] = {
            vistasMes: f.mes ? Math.round(f.mes) : null,
            // Con menos de 100 vistas el porcentaje no dice nada todavía
            ctr: f.ctr != null && (f.mes || 0) >= 100 ? Math.round(Number(f.ctr) * 10) / 10 : null,
          }
    } catch (e) {
      console.error("[publicidad] métricas", e instanceof Error ? e.message : e)
    }
    return salida
  },
  ["publicidad-metricas"],
  { revalidate: 3600, tags: ["publicidad"] }
)
