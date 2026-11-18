// Clave de cada aviso urgente del Centro de control (jobs/centro-control-avisos.ts)
// para no mandarlo dos veces.
//
// Antes la clave era el título tal cual, y los títulos traen cifras que cambian
// solas ("Pedido #123 lleva 26 h sin enviarse", "te quedan $8.50"): cada
// revisión parecía un aviso nuevo y se volvía a mandar. Ahora:
//   - si el aviso trae su propia `clave` estable (p. ej. los servicios de
//     lib/vigilancia.ts: servicio + estado), se usa esa;
//   - si no, el título sin las cifras que cambian. Los números con # (pedido
//     #123) sí cuentan: son la identidad del aviso.
import { createHash } from "crypto"

export type AvisoConClave = { tipo: string; titulo: string; url?: string | null; clave?: string | null }

const sha1 = (s: string) => createHash("sha1").update(s).digest("hex")

/** Título sin cantidades, montos ni plazos (conserva los números con #). */
export function tituloEstable(titulo: string) {
  return String(titulo || "")
    .replace(/(#)?\d+(?:[.,]\d+)*/g, (m, gato) => (gato ? m : "N"))
    .replace(/\s+/g, " ")
    .trim()
}

/** Clave estable con la que se anota el aviso ya enviado. */
export function claveAviso(a: AvisoConClave) {
  return sha1(a.clave ? `${a.tipo}|clave|${a.clave}` : `${a.tipo}|${a.url || ""}|${tituloEstable(a.titulo)}`)
}

/** Clave del formato anterior (título exacto): lo ya anotado así cuenta como enviado. */
export function claveAvisoAnterior(a: AvisoConClave) {
  return sha1(`${a.tipo}|${a.url || ""}|${a.titulo}`)
}
