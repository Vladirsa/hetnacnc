// Lógica de administración de anuncios (solo servidor). Quien la llama debe haber verificado
// antes que es administrador (ver sesion.ts).

import { revalidateTag } from "next/cache"

import { db } from "@/lib/foro/db"

import { todasLasPiezas } from "./consultas"
import { ESPACIOS, esEspacio, type DatosPieza, type Pieza } from "./tipos"

export type Res<T = object> = ({ ok: true } & T) | { ok: false; error: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Solo se aceptan enlaces internos (/ruta) o https://. Bloquea javascript: y similares.
const enlaceSeguro = (v: string, vacioOk = false): string | null => {
  const t = (v || "").trim()
  if (!t) return vacioOk ? "" : null
  if (/^\/(?!\/)/.test(t) || /^https:\/\/[^\s]+$/i.test(t)) return t.slice(0, 1000)
  return null
}

const fechaONull = (v: string): string | null => {
  const t = (v || "").trim()
  if (!t) return null
  return Number.isNaN(Date.parse(t)) ? null : t
}

export async function listar(): Promise<Res<{ piezas: Pieza[] }>> {
  try {
    return { ok: true, piezas: await todasLasPiezas() }
  } catch (e) {
    const pg = e as { code?: string }
    if (pg.code === "42P01" || pg.code === "3F000")
      return { ok: false, error: "Falta crear la tabla. Corre el archivo esquema.sql en Supabase (SQL Editor)." }
    console.error("[publicidad] listar", e instanceof Error ? e.message : e)
    return { ok: false, error: "No se pudo leer la base de datos." }
  }
}

// ¿Cuántos otros anuncios activos del mismo espacio coinciden en fechas con este?
// El sitio sólo muestra los primeros `max` por orden: los que sobran no salen.
async function activosQueCoinciden(espacio: string, id: string, desde: string | null, hasta: string | null): Promise<number> {
  const r = await db().query(
    `with esta as (
       -- Desde hoy en adelante: lo que ya venció no ocupa lugar aunque siga marcado activo
       select greatest(coalesce($3::timestamptz, (select desde from publicidad.piezas where id::text = $2), now()), now()) as desde, $4::timestamptz as hasta
     )
     select count(*)::int as n from publicidad.piezas p, esta
     where p.espacio = $1 and p.activo and p.id::text <> $2
       and (p.hasta is null or p.hasta > esta.desde)
       and (esta.hasta is null or p.desde < esta.hasta)`,
    [espacio, id, desde, hasta]
  )
  return r.rows[0]?.n ?? 0
}

export async function guardar(d: DatosPieza & { forzar?: boolean }): Promise<Res<{ id: string }> | { ok: false; error: string; lleno: true }> {
  if (!d || !esEspacio(String(d.espacio))) return { ok: false, error: "Elige un espacio válido." }
  const enlace = enlaceSeguro(String(d.enlace ?? ""))
  if (enlace === null) return { ok: false, error: "El enlace debe empezar con / (dentro del sitio) o con https://" }
  const imagen = enlaceSeguro(String(d.imagen_url ?? ""), true)
  const movil = enlaceSeguro(String(d.imagen_movil_url ?? ""), true)
  const video = enlaceSeguro(String(d.video_url ?? ""), true)
  if (imagen === null || movil === null || video === null)
    return { ok: false, error: "La imagen o el video no tienen una dirección válida." }
  const titulo = String(d.titulo ?? "").trim().slice(0, 140)
  if (!imagen && !titulo) return { ok: false, error: "Agrega una imagen o al menos un título." }

  const desde = fechaONull(String(d.desde ?? ""))
  const hasta = fechaONull(String(d.hasta ?? ""))
  if (hasta && desde && Date.parse(hasta) <= Date.parse(desde))
    return { ok: false, error: "La fecha de fin debe ser después de la de inicio." }

  // Cupo del espacio: si ya están llenos los lugares en esas fechas, se avisa antes de guardar
  // (el panel pregunta y, si confirmas, vuelve a mandar con forzar)
  if (Boolean(d.activo) && !d.forzar && !(hasta && Date.parse(hasta) <= Date.now())) {
    if (d.id && !UUID.test(d.id)) return { ok: false, error: "Anuncio no válido." }
    try {
      const max = ESPACIOS[d.espacio as keyof typeof ESPACIOS].max
      const otros = await activosQueCoinciden(String(d.espacio), d.id || "", desde, hasta)
      if (otros >= max)
        return {
          ok: false,
          lleno: true,
          error: `En "${ESPACIOS[d.espacio as keyof typeof ESPACIOS].nombre}" caben ${max} a la vez y ya hay ${otros} activo(s) en esas fechas. El sitio sólo muestra los primeros ${max} por orden; los demás no saldrán.`,
        }
    } catch (e) {
      console.error("[publicidad] cupo", e instanceof Error ? e.message : e)
    }
  }

  const orden = Number(d.orden)
  const valores = [
    d.espacio,
    titulo,
    String(d.subtitulo ?? "").trim().slice(0, 300) || null,
    String(d.boton ?? "").trim().slice(0, 40) || null,
    enlace,
    imagen || null,
    movil || null,
    video || null,
    String(d.anunciante ?? "").trim().slice(0, 120) || null,
    Boolean(d.es_publicidad),
    Number.isFinite(orden) ? Math.trunc(orden) : 0,
    desde,
    hasta,
    Boolean(d.activo),
  ]

  try {
    let id = d.id || ""
    if (id) {
      if (!UUID.test(id)) return { ok: false, error: "Anuncio no válido." }
      await db().query(
        `update publicidad.piezas set espacio=$1, titulo=$2, subtitulo=$3, boton=$4, enlace=$5, imagen_url=$6,
           imagen_movil_url=$7, video_url=$8, anunciante=$9, es_publicidad=$10, orden=$11,
           desde=coalesce($12::timestamptz, desde), hasta=$13::timestamptz, activo=$14
         where id=$15`,
        [...valores, id]
      )
    } else {
      const r = await db().query(
        `insert into publicidad.piezas (espacio, titulo, subtitulo, boton, enlace, imagen_url, imagen_movil_url,
           video_url, anunciante, es_publicidad, orden, desde, hasta, activo)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, coalesce($12::timestamptz, now()), $13::timestamptz, $14)
         returning id`,
        valores
      )
      id = r.rows[0].id
    }
    revalidateTag("publicidad")
    return { ok: true, id }
  } catch (e) {
    console.error("[publicidad] guardar", e instanceof Error ? e.message : e)
    return { ok: false, error: "No se pudo guardar. Revisa los datos e intenta de nuevo." }
  }
}

export async function borrar(id: string): Promise<Res> {
  if (!UUID.test(id || "")) return { ok: false, error: "Anuncio no válido." }
  try {
    await db().query("delete from publicidad.piezas where id = $1", [id])
    revalidateTag("publicidad")
    return { ok: true }
  } catch {
    return { ok: false, error: "No se pudo borrar." }
  }
}

export async function alternar(id: string, activo: boolean): Promise<Res> {
  if (!UUID.test(id || "")) return { ok: false, error: "Anuncio no válido." }
  try {
    await db().query("update publicidad.piezas set activo = $2 where id = $1", [id, Boolean(activo)])
    revalidateTag("publicidad")
    return { ok: true }
  } catch {
    return { ok: false, error: "No se pudo cambiar el estado." }
  }
}
