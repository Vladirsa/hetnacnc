// La base de herramientas y máquinas del cliente, una sola para el CAM 2D, el
// de 3, 4 y 5 ejes y el torno. Con sesión vive en su cuenta; sin sesión, en el
// navegador.
import { type DatosCam, type FresaCam, guardarMaquinasCam, leerMaquinasCam } from "@/lib/data/cam-maquinas"

const ALMACEN = "hetna-cam-estudio"

export const FRESAS_BASE: FresaCam[] = [
  { id: "base-r3", nombre: "Recta Ø3", tipo: "recta", diametro: 3, angulo: 90, zanco: 3.175, largoCorte: 12, largoTotal: 38, voladizo: 20, filos: 2, materialFresa: "carburo" },
  { id: "base-r6", nombre: "Recta Ø6", tipo: "recta", diametro: 6, angulo: 90, zanco: 6, largoCorte: 22, largoTotal: 50, voladizo: 30, filos: 2, materialFresa: "carburo" },
  { id: "base-u6", nombre: "Espiral ascendente Ø6", tipo: "upcut", diametro: 6, angulo: 90, zanco: 6, largoCorte: 22, largoTotal: 50, voladizo: 30, filos: 2, materialFresa: "carburo" },
  { id: "base-c6", nombre: "Compresión Ø6", tipo: "compresion", diametro: 6, angulo: 90, zanco: 6, largoCorte: 22, largoTotal: 50, voladizo: 30, filos: 2, materialFresa: "carburo" },
  { id: "base-o6", nombre: "Un filo Ø6 (acrílico, aluminio)", tipo: "un_filo", diametro: 6, angulo: 90, zanco: 6, largoCorte: 22, largoTotal: 50, voladizo: 30, filos: 1, materialFresa: "carburo" },
  { id: "base-r8", nombre: "Recta Ø8", tipo: "recta", diametro: 8, angulo: 90, zanco: 8, largoCorte: 25, largoTotal: 60, voladizo: 35, filos: 2, materialFresa: "carburo" },
  { id: "base-b6", nombre: "Bola Ø6", tipo: "bola", diametro: 6, angulo: 90, zanco: 6, largoCorte: 22, largoTotal: 55, voladizo: 40, filos: 2, materialFresa: "carburo" },
  { id: "base-v90", nombre: "V 90°", tipo: "v", diametro: 12, angulo: 90, zanco: 6, largoCorte: 6, largoTotal: 45, voladizo: 25, filos: 2, materialFresa: "carburo" },
  { id: "base-v60", nombre: "V 60°", tipo: "v", diametro: 12, angulo: 60, zanco: 6, largoCorte: 10, largoTotal: 45, voladizo: 25, filos: 2, materialFresa: "carburo" },
]

const VACIA: DatosCam = { maquinas: [], fresas: [] }

export async function leerBase(): Promise<{ sesion: boolean; datos: DatosCam }> {
  const r = await leerMaquinasCam().catch(() => ({ sesion: false, datos: VACIA }))
  if (r.sesion) return r
  try {
    const local = JSON.parse(localStorage.getItem(ALMACEN) || "null")
    if (local && Array.isArray(local.maquinas) && Array.isArray(local.fresas)) return { sesion: false, datos: local as DatosCam }
  } catch {}
  return { sesion: false, datos: VACIA }
}

/** Guarda la base y devuelve el aviso para el usuario. */
export async function guardarBase(d: DatosCam, sesion: boolean): Promise<string> {
  if (sesion) {
    const r = await guardarMaquinasCam(d)
    return r.ok ? "Guardado en tu cuenta." : r.error || "No se pudo guardar."
  }
  try {
    localStorage.setItem(ALMACEN, JSON.stringify(d))
    return "Guardado en este navegador. Inicia sesión para tenerlo en tu cuenta."
  } catch {
    return "Este navegador no deja guardar."
  }
}

/** Fresas agrupadas por carpeta, en orden alfabético; las sin grupo al final. */
export function porGrupo(fresas: FresaCam[]): [string, FresaCam[]][] {
  const m = new Map<string, FresaCam[]>()
  for (const f of fresas) {
    const g = (f.grupo || "").trim()
    if (!m.has(g)) m.set(g, [])
    m.get(g)!.push(f)
  }
  return [...m.entries()].sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b, "es")))
}
