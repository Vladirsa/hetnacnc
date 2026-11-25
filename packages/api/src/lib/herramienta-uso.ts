// Uso de las herramientas del Estudio, por día (lo cuenta el navegador con
// components/hetna/estudio/ContarUsoHerramienta.tsx): cuánta gente abre cada
// herramienta, descarga, la manda a cotizar o a fabricar, al CAM o por correo.
// Cada evento cuenta una vez por herramienta y sesión del navegador. No se
// guarda nada personal: sólo el contador del día.
//
// El tablero de la semana (lib/tablero-ventas.ts) lo cruza con los correos de
// "Mándamelo por correo" y con las solicitudes de fabricación que hicieron esas
// personas, para ver qué herramienta termina en trabajo.
import { HERRAMIENTAS } from "./herramienta-correo"
import { T_SOLICITUD } from "./licitacion"

export const T_USO = "hetna_herramienta_uso"
export const EVENTOS_USO = ["vista", "descarga", "cotizar", "fabricar", "correo", "cam"] as const
export type EventoUso = (typeof EVENTOS_USO)[number]

let listo = false
export async function asegurarTablaUso(knex: any) {
  if (listo) return
  await knex.raw(`CREATE TABLE IF NOT EXISTS ${T_USO} (
    dia date NOT NULL,
    herramienta text NOT NULL,
    evento text NOT NULL,
    n integer NOT NULL DEFAULT 0,
    PRIMARY KEY (dia, herramienta, evento)
  )`)
  listo = true
}

export const usoValido = (herramienta: unknown, evento: unknown): evento is EventoUso =>
  typeof herramienta === "string" && !!HERRAMIENTAS[herramienta] && typeof evento === "string" && (EVENTOS_USO as readonly string[]).includes(evento)

/** Suma 1 al contador del día (fecha de Ciudad de México). */
export async function contarUso(knex: any, herramienta: string, evento: EventoUso) {
  await asegurarTablaUso(knex)
  await knex.raw(
    `INSERT INTO ${T_USO} (dia, herramienta, evento, n) VALUES ((now() AT TIME ZONE 'America/Mexico_City')::date, ?, ?, 1)
     ON CONFLICT (dia, herramienta, evento) DO UPDATE SET n = ${T_USO}.n + 1`,
    [herramienta, evento]
  )
}

export type FilaUso = { herramienta: string; vista: number; descarga: number; cotizar: number; fabricar: number; correo: number; cam: number; solicitudes: number }

/**
 * Uso por herramienta desde `desde`, con las solicitudes de fabricación que
 * mandaron quienes se mandaron su diseño por correo (después de mandárselo).
 */
export async function resumenUso(knex: any, desde: Date): Promise<FilaUso[]> {
  await asegurarTablaUso(knex)
  const filas = new Map<string, FilaUso>()
  const fila = (h: string) => {
    if (!filas.has(h)) filas.set(h, { herramienta: h, vista: 0, descarga: 0, cotizar: 0, fabricar: 0, correo: 0, cam: 0, solicitudes: 0 })
    return filas.get(h)!
  }
  const { rows } = await knex.raw(`SELECT herramienta, evento, sum(n)::int AS n FROM ${T_USO} WHERE dia >= ?::date GROUP BY 1, 2`, [desde.toISOString().slice(0, 10)])
  for (const r of rows) if ((EVENTOS_USO as readonly string[]).includes(r.evento)) (fila(r.herramienta) as any)[r.evento] = Number(r.n) || 0
  try {
    if (await knex.schema.hasTable(T_SOLICITUD)) {
      const s = await knex.raw(
        `SELECT e.herramienta, count(DISTINCT s.id)::int AS n
           FROM hetna_estimado e
           JOIN ${T_SOLICITUD} s ON lower(s.contacto->>'email') = e.email AND s.created_at >= e.created_at
          WHERE e.herramienta IS NOT NULL AND e.created_at >= ?
          GROUP BY 1`,
        [desde]
      )
      for (const r of s.rows) fila(r.herramienta).solicitudes = Number(r.n) || 0
    }
  } catch {
    // sin estimados o solicitudes todavía: el uso sale igual
  }
  return [...filas.values()].sort((a, b) => b.vista - a.vista || b.descarga - a.descarga)
}
