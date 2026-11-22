// Importador de productos, versión taller (panel del taller › Publicar con Excel).
// Lo usa api/vendor/hetna-publicar/excel. Aquí van las piezas que lo distinguen
// del importador del dashboard: fotos sólo de la tienda, identificadores con el
// handle del taller y las reglas de Publicar producto.
import { LEYENDA, fondoBlancoModo, revisarFoto } from "../../api/vendor/fondo-blanco/middlewares"
import type { Plan } from "./importar"
import { nombreFoto, slug, TITULO_FOTOS_TALLER, type Lectura } from "./plantilla"

/** Ligas de archivos de la tienda (las que devuelve /vendor/uploads). */
export function baseArchivos() {
  return (process.env.FILE_BACKEND_URL || "http://localhost:9000/static").replace(/\/+$/, "") + "/"
}

/** El mapa nombre → liga que manda la página, sólo con ligas de la tienda. */
export function mapaFotos(crudo: unknown): Map<string, string> {
  const m = new Map<string, string>()
  let o: unknown = crudo
  if (typeof crudo === "string") {
    try { o = JSON.parse(crudo) } catch { o = {} }
  }
  if (!o || typeof o !== "object" || Array.isArray(o)) return m
  const base = baseArchivos()
  for (const [nombre, url] of Object.entries(o as Record<string, unknown>).slice(0, 300)) {
    if (typeof url !== "string" || !url.startsWith(base) || /\s/.test(url)) continue
    m.set(nombreFoto(nombre), url)
  }
  return m
}

/** El identificador de cada producto lleva el handle del taller adelante. */
export function prefijarHandles(lectura: Lectura, handleTaller: string): Lectura {
  const pre = slug(handleTaller).slice(0, 40) || "taller"
  return {
    ...lectura,
    productos: lectura.productos.map((p) => (p.handle.startsWith(`${pre}-`) ? p : { ...p, handle: `${pre}-${p.handle}`.slice(0, 120) })),
  }
}

/** Reglas de Publicar producto que el importador del dashboard no pide. */
export async function reglasTaller(plan: Plan, marca: string): Promise<Plan> {
  const errores = [...plan.errores]
  const pasos: Plan["pasos"] = []
  const bloquear = fondoBlancoModo() === "bloquear"
  for (const paso of plan.pasos) {
    const p = paso.producto
    const fila = p.filas[0]
    if (paso.accion === "crear" && !p.imagenes.length) {
      errores.push({ fila, columna: TITULO_FOTOS_TALLER, mensaje: "Un producto nuevo necesita al menos una foto." })
      continue
    }
    if (bloquear && p.imagenes.length) {
      let fuera = -1
      for (let i = 0; i < p.imagenes.length && fuera < 0; i++) if ((await revisarFoto(p.imagenes[i])) === false) fuera = i
      if (fuera >= 0) {
        errores.push({ fila, columna: TITULO_FOTOS_TALLER, mensaje: `La foto ${fuera + 1} no tiene fondo blanco. ${LEYENDA}` })
        continue
      }
    }
    pasos.push({ ...paso, producto: p.marca ? p : { ...p, marca } })
  }
  errores.sort((a, b) => (a.fila ?? 0) - (b.fila ?? 0))
  return { ...plan, pasos, errores }
}

