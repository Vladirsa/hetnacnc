// Lógica de administración de anuncios (solo servidor). Quien la llama debe haber verificado
// antes que es administrador (ver sesion.ts).

import { revalidateTag } from "next/cache"

import { db } from "@/lib/foro/db"

import { todasLasPiezas } from "./consultas"
import { esEspacio, type DatosPieza, type Pieza } from "./tipos"

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

export async function guardar(d: DatosPieza): Promise<Res<{ id: string }>> {
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
