// Importador de productos, versión taller (panel del taller › Publicar con Excel).
// Lo usa api/vendor/hetna-publicar/excel. Aquí van las piezas que lo distinguen
// del importador del dashboard: fotos sólo de la tienda, identificadores con el
// handle del taller y las reglas de Publicar producto.
import { LEYENDA, fondoBlancoModo, revisarFoto } from "../../api/vendor/fondo-blanco/middlewares"
import { esArchivoPropio } from "../url-publica"
import type { Plan } from "./importar"
import { nombreFoto, slug, TITULO_FOTOS_TALLER, type Lectura } from "./plantilla"

export const MAX_RENGLONES_TALLER = 100

const archivoPropio = (url: string) => {
  try {
    return esArchivoPropio(new URL(url)) && !/%2e/i.test(url)
  } catch {
    return false
  }
}

/** El mapa nombre → liga que manda la página, sólo con ligas de la tienda. */
export function mapaFotos(crudo: unknown): Map<string, string> {
  const m = new Map<string, string>()
  let o: unknown = crudo
  if (typeof crudo === "string") {
    try { o = JSON.parse(crudo) } catch { o = {} }
  }
  if (!o || typeof o !== "object" || Array.isArray(o)) return m
  for (const [nombre, url] of Object.entries(o as Record<string, unknown>).slice(0, 300)) {
    if (typeof url !== "string" || /\s/.test(url) || !archivoPropio(url)) continue
    m.set(nombreFoto(nombre), url)
  }
  return m
}

/**
 * El identificador de cada producto lleva el handle del taller adelante. Dos
 * talleres aún podrían coincidir ("a" + "b-x" y "a-b" + "x"); eso lo frena el
 * control de dueño de revisar(), que lo reporta como agrupador ya usado.
 */
export function prefijarHandles(lectura: Lectura, handleTaller: string): Lectura {
  const pre = slug(handleTaller).slice(0, 40) || "taller"
  return {
    ...lectura,
    productos: lectura.productos.map((p) => (p.handle.startsWith(`${pre}-`) ? p : { ...p, handle: `${pre}-${p.handle}`.slice(0, 120) })),
  }
}

/** Qué foto de la lista no tiene fondo blanco (-1 = todas bien o no se pudo saber). */
async function fotoSinFondo(urls: string[]): Promise<number> {
  for (let i = 0; i < urls.length; i++) if ((await revisarFoto(urls[i])) === false) return i
  return -1
}

/**
 * Reglas de Publicar producto que el importador del dashboard no pide.
 * Fondo blanco: en modo "bloquear" es error (todas las fotos); en "avisar" sólo
 * se revisa la portada y sale como aviso, y sólo al revisar (avisar = true).
 */
export async function reglasTaller(plan: Plan, marca: string, opc: { avisar?: boolean } = {}): Promise<Plan> {
  const errores = [...plan.errores]
  const avisos = [...plan.avisos]
  const modo = fondoBlancoModo()
  const revisar = modo === "bloquear" || (modo === "avisar" && opc.avisar === true)
  const candidatos = plan.pasos.filter((paso) => {
    if (paso.accion === "crear" && !paso.producto.imagenes.length) {
      errores.push({ fila: paso.producto.filas[0], columna: TITULO_FOTOS_TALLER, mensaje: "Un producto nuevo necesita al menos una foto." })
      return false
    }
    return true
  })
  // Las fotos se revisan de 4 productos a la vez para no tardar de más
  const fuera: number[] = new Array(candidatos.length).fill(-1)
  if (revisar) {
    for (let i = 0; i < candidatos.length; i += 4) {
      const lote = candidatos.slice(i, i + 4)
      const r = await Promise.all(lote.map((paso) => fotoSinFondo(modo === "bloquear" ? paso.producto.imagenes : paso.producto.imagenes.slice(0, 1))))
      r.forEach((x, j) => { fuera[i + j] = x })
    }
  }
  const pasos: Plan["pasos"] = []
  candidatos.forEach((paso, i) => {
    const p = paso.producto
    if (fuera[i] >= 0) {
      const problema = { fila: p.filas[0], columna: TITULO_FOTOS_TALLER, mensaje: `La foto ${fuera[i] + 1} no tiene fondo blanco. ${LEYENDA}` }
      if (modo === "bloquear") return void errores.push(problema)
      avisos.push({ ...problema, mensaje: `La foto ${fuera[i] + 1} no tiene fondo blanco: se puede publicar, pero con fondo blanco se vende más.` })
    }
    pasos.push({ ...paso, producto: p.marca ? p : { ...p, marca } })
  })
  const orden = (a: { fila: number | null }, b: { fila: number | null }) => (a.fila ?? 0) - (b.fila ?? 0)
  return { ...plan, pasos, errores: errores.sort(orden), avisos: avisos.sort(orden) }
}
