// Conservación y borrado de los archivos de las solicitudes de fabricación.
// Auditoría del 12 nov 2026, problema 4; plazo decidido el mismo día.
//
//   - Solicitud cerrada o cancelada: sus archivos se borran DIAS_CONSERVACION
//     días después (todas las versiones en Backblaze, sin vuelta atrás). Con
//     una disputa abierta no se borran.
//   - El cliente puede borrarlos antes desde su liga, en cuanto la solicitud
//     se cierra o se cancela.
//   - Subidas que nunca se usaron en una solicitud: se borran a los
//     DIAS_HUERFANOS días.
//
// Se conserva el nombre y el tamaño (para el historial), no el contenido. Si
// el taller elegido tenía el archivo en su HetNa Cloud (lib/cloud lo importa
// por referencia), esa entrada también se quita.
import { borrarArchivoDefinitivo } from "./backblaze"
import { T_SUBIDA, asegurarSubidas } from "./archivo-seguro"
import { T_ARCHIVO } from "./cloud"
import { T_SOLICITUD } from "./licitacion"
import { anotar } from "./seguimiento"

export const DIAS_CONSERVACION = 180
export const DIAS_HUERFANOS = 7

export const etapaTerminada = (s: any) => ["cerrada", "cancelada"].includes(s?.etapa) || (!s?.etapa && s?.estado === "cerrada")

/** Borra todos los archivos de una solicitud. Si alguno falla, no marca nada
 *  (se reintenta en la siguiente vuelta) y devuelve el error. */
export async function borrarArchivosSolicitud(
  knex: any,
  s: any,
  quien: "cliente" | "sistema",
  logger?: any
): Promise<{ ok: true; borrados: number } | { ok: false; motivo: string }> {
  const archivos = (s.trabajo?.archivos || []) as { clave: string; nombre: string; tamano: number }[]
  if (!archivos.length) return { ok: true, borrados: 0 }
  for (const a of archivos) {
    // Si otra solicitud usa la misma clave (no debería: cada subida sirve una
    // sola vez, pero las anteriores a esa regla no lo garantizaban), no se
    // toca el archivo en Backblaze; sólo se quita de esta solicitud.
    const otra = await knex(T_SOLICITUD)
      .whereNot({ id: s.id })
      .whereRaw(`trabajo->'archivos' @> ?::jsonb`, [JSON.stringify([{ clave: a.clave }])])
      .first("id")
    if (otra) {
      logger?.warn?.(`[conservacion] ${a.clave} también está en ${otra.id}: no se borra de B2`)
      continue
    }
    const r = await borrarArchivoDefinitivo(a.clave)
    if (!r.ok) {
      logger?.error?.(`[conservacion] ${s.id}: no se pudo borrar ${a.clave}: ${r.reason}`)
      return { ok: false, motivo: r.reason }
    }
  }
  const claves = archivos.map((a) => a.clave)
  const ahora = new Date()
  const trabajo = {
    ...s.trabajo,
    archivos: [],
    archivos_borrados: archivos.map((a) => ({ nombre: a.nombre, tamano: a.tamano })),
    archivos_borrados_en: ahora.toISOString(),
  }
  await knex(T_SOLICITUD).where({ id: s.id }).update({ trabajo })
  await asegurarSubidas(knex)
  await knex(T_SUBIDA).whereIn("clave", claves).update({ borrado_en: ahora }).catch(() => null)
  await knex(T_ARCHIVO).whereIn("clave", claves).where({ notas: "Archivo del cliente" }).delete().catch(() => null)
  await anotar(
    knex,
    s.id,
    quien,
    quien === "cliente"
      ? `Borraste tus archivos (${archivos.length}). Ya no se pueden descargar.`
      : `Se borraron los archivos (${archivos.length}) por la política de conservación: ${DIAS_CONSERVACION} días después del cierre.`
  ).catch(() => null)
  return { ok: true, borrados: archivos.length }
}

/** Lo que toca borrar hoy (también sirve para el reporte). */
export async function pendientesDeBorrar(knex: any, limite = 50) {
  await asegurarSubidas(knex)
  const corte = new Date(Date.now() - DIAS_CONSERVACION * 864e5)
  const solicitudes = (await knex(T_SOLICITUD)
    .where((w: any) => w.whereIn("etapa", ["cerrada", "cancelada"]).orWhere((x: any) => x.whereNull("etapa").where({ estado: "cerrada" })))
    .whereRaw("coalesce(etapa_desde, updated_at) < ?", [corte])
    .whereRaw("jsonb_array_length(coalesce(trabajo->'archivos', '[]'::jsonb)) > 0")
    .whereNull("disputa")
    .limit(limite)
    .select("*")) as any[]
  const huerfanos = (await knex(T_SUBIDA)
    .where({ carpeta: "solicitudes" })
    .whereNull("usado_en")
    .whereNull("borrado_en")
    .where("created_at", "<", new Date(Date.now() - DIAS_HUERFANOS * 864e5))
    .limit(limite * 4)
    .select("clave")) as { clave: string }[]
  return { solicitudes, huerfanos }
}

export async function borrarHuerfano(knex: any, clave: string): Promise<boolean> {
  const r = await borrarArchivoDefinitivo(clave)
  if (!r.ok) return false
  await knex(T_SUBIDA).where({ clave }).update({ borrado_en: new Date() })
  return true
}
