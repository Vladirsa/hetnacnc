// Datos técnicos que el vendedor captura en su panel (Ficha del producto,
// packages/api/src/lib/ficha-extendida.ts):
//   vista_previa     modelo de MUESTRA, público, para el visor 3D (STL, OBJ, DXF o SVG)
//   fotos_fabricada  fotos reales de la pieza ya fabricada
// Sólo se aceptan archivos del almacenamiento del propio sitio.
import { DOMINIOS_IMAGENES } from "@/lib/imagenes/dominios"

export const EXT_VISTA = /\.(stl|obj|dxf|svg)$/i
const EXT_FOTO = /\.(jpe?g|png|webp)$/i

export type FormatoVista = "stl" | "obj" | "dxf" | "svg"

/** ¿La URL es https y de un dominio propio? */
export function urlPropia(u: unknown): u is string {
  if (typeof u !== "string" || !u) return false
  try {
    const x = new URL(u)
    return x.protocol === "https:" && DOMINIOS_IMAGENES.includes(x.hostname.toLowerCase())
  } catch {
    return false
  }
}

const sinQuery = (u: string) => u.split(/[?#]/)[0]

export function vistaPreviaDe(metadata?: Record<string, unknown> | null): { url: string; formato: FormatoVista } | null {
  const u = metadata?.vista_previa
  if (!urlPropia(u)) return null
  const m = sinQuery(u).match(EXT_VISTA)
  return m ? { url: u, formato: m[1].toLowerCase() as FormatoVista } : null
}

export function fotosFabricadaDe(metadata?: Record<string, unknown> | null): string[] {
  const v = metadata?.fotos_fabricada
  const lista = Array.isArray(v) ? v : typeof v === "string" ? v.split(/[\s,;]+/) : []
  return lista.filter((u): u is string => urlPropia(u) && EXT_FOTO.test(sinQuery(u))).slice(0, 8)
}
