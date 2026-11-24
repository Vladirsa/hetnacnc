// Calificación de los ejercicios del Simulador CNC.
//
// Se corre el programa del alumno con el material y la herramienta del
// ejercicio (nunca los que mande el navegador) y se compara la PIEZA que queda
// con la de la solución de referencia:
//   - Banda de tolerancia: cada celda del alumno debe quedar entre el mínimo y
//     el máximo de la referencia en sus celdas vecinas (así una orilla corrida
//     una fracción de milímetro no cuenta como error), más una tolerancia de
//     profundidad.
//   - "Sobrecorte" = cortó de más (pieza echada a perder). "Falta" = quedó
//     material que había que quitar.
//   - Cualquier alarma de error (choque, husillo apagado, sin avance…) reprueba.
// Los porcentajes se cuentan sobre las celdas que la referencia sí corta: un
// programa vacío no puede aprobar un grabado aunque toque poco material.
import { interpretar, type Alarma, type Material } from "./gcode"
import { Bloque, type Fresa } from "./material"
import { cortarMovimiento, interpretarTorno, Perfil } from "./torno"
import type { Ejercicio } from "./ejercicios"

export const MAX_CARACTERES = 100_000
export const MAX_LINEAS = 5_000
const CELDAS_FRESA = 160 // cuadrícula para calificar (más gruesa que la de la vista)
const TOL_Z = 0.15 // mm de profundidad (fresadora)
const TOL_R = 0.04 // mm en radio (torno: 0.08 mm en diámetro)
const VECINOS_FRESA = 1 // celdas
const VECINOS_TORNO = 2 // celdas de 0.1 mm en Z
const MARGEN = 0.01 // se aprueba con hasta 1 % de celdas fuera (redondeos)

export type Defecto = { cantidad: number; peor: number; donde: string } // peor en mm
export type Calificacion = {
  aprobado: boolean
  calificacion: number // 0–100
  errores: Alarma[]
  sobrecorte: Defecto
  falta: Defecto
  mensaje: string
}

const f1 = (n: number) => (Math.round(n * 10) / 10).toString()

// ---- Geometría de referencia (se calcula una vez por ejercicio) ------------
const cache = new Map<string, Float32Array>()

function piezaFresa(codigo: string, material: Material, fresa: Fresa) {
  const r = interpretar(codigo, material)
  const b = new Bloque(material, CELDAS_FRESA)
  for (const m of r.movimientos) if (m.tipo === "corte") for (let i = 1; i < m.puntos.length; i++) b.cortar(m.puntos[i - 1], m.puntos[i], fresa)
  return { r, b }
}

function piezaTorno(e: Extract<Ejercicio, { maquina: "torno" }>, codigo: string) {
  const r = interpretarTorno(codigo, e.barra, e.inserto)
  const p = new Perfil(e.barra, 0.1)
  for (const m of r.movimientos) if (m.tipo === "corte") for (let i = 1; i < m.puntos.length; i++) cortarMovimiento(p, m, m.puntos[i - 1], m.puntos[i], e.inserto)
  return { r, p }
}

/** Pieza objetivo: alturas (fresadora) o radios (torno) de la solución. */
export function objetivo(e: Ejercicio): { datos: Float32Array; nx: number; ny: number; celda: number } {
  const clave = `${e.id}:${e.version}`
  if (e.maquina === "fresadora") {
    const b = new Bloque(e.material, CELDAS_FRESA)
    if (!cache.has(clave)) cache.set(clave, piezaFresa(e.solucion, e.material, e.fresa).b.h)
    return { datos: cache.get(clave)!, nx: b.nx, ny: b.ny, celda: b.celda }
  }
  const p = new Perfil(e.barra, 0.1)
  if (!cache.has(clave)) cache.set(clave, piezaTorno(e, e.solucion).p.r)
  return { datos: cache.get(clave)!, nx: p.n, ny: 1, celda: p.paso }
}

/** Mínimo y máximo de la referencia entre las celdas vecinas. */
function banda(ref: Float32Array, nx: number, ny: number, v: number) {
  const min = new Float32Array(ref.length)
  const max = new Float32Array(ref.length)
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      let lo = Infinity, hi = -Infinity
      for (let dj = -v; dj <= v; dj++) {
        const jj = j + dj
        if (jj < 0 || jj >= ny) continue
        for (let di = -v; di <= v; di++) {
          const ii = i + di
          if (ii < 0 || ii >= nx) continue
          const x = ref[jj * nx + ii]
          if (x < lo) lo = x
          if (x > hi) hi = x
        }
      }
      min[j * nx + i] = lo
      max[j * nx + i] = hi
    }
  return { min, max }
}

export function calificar(e: Ejercicio, codigo: string): Calificacion {
  const texto = String(codigo || "")
  if (texto.length > MAX_CARACTERES || texto.split("\n").length > MAX_LINEAS) {
    return {
      aprobado: false,
      calificacion: 0,
      errores: [{ linea: 1, nivel: "error", mensaje: `El programa es demasiado grande para calificarlo (máximo ${MAX_LINEAS} líneas).` }],
      sobrecorte: { cantidad: 0, peor: 0, donde: "" },
      falta: { cantidad: 0, peor: 0, donde: "" },
      mensaje: "Programa demasiado grande.",
    }
  }
  const ref = objetivo(e)
  let alumno: Float32Array
  let errores: Alarma[]
  if (e.maquina === "fresadora") {
    const { r, b } = piezaFresa(texto, e.material, e.fresa)
    alumno = b.h
    errores = r.alarmas.filter((a) => a.nivel === "error")
  } else {
    const { r, p } = piezaTorno(e, texto)
    alumno = p.r
    errores = r.alarmas.filter((a) => a.nivel === "error")
  }

  const fresa = e.maquina === "fresadora"
  const { min, max } = banda(ref.datos, ref.nx, ref.ny, e.vecinos ?? (fresa ? VECINOS_FRESA : VECINOS_TORNO))
  const tol = fresa ? TOL_Z : TOL_R
  const inicial = fresa ? 0 : (e as Extract<Ejercicio, { maquina: "torno" }>).barra.diametro / 2
  // En la fresadora "cortar de más" es quedar más abajo (h menor); en el torno es radio menor: igual en los dos
  let refCortadas = 0
  const sob = { cantidad: 0, peor: 0, k: -1 }
  const fal = { cantidad: 0, peor: 0, k: -1 }
  for (let k = 0; k < ref.datos.length; k++) {
    if (ref.datos[k] < inicial - tol) refCortadas++
    const a = alumno[k]
    if (a < min[k] - tol) {
      sob.cantidad++
      const d = min[k] - a
      if (d > sob.peor) { sob.peor = d; sob.k = k }
    } else if (a > max[k] + tol) {
      fal.cantidad++
      const d = a - max[k]
      if (d > fal.peor) { fal.peor = d; fal.k = k }
    }
  }
  const base = Math.max(refCortadas, 1)
  const donde = (k: number) => {
    if (k < 0) return ""
    if (fresa) {
      const em = (e as Extract<Ejercicio, { maquina: "fresadora" }>).material
      const x0 = em.cero === "centro" ? -em.ancho / 2 : 0
      const y0 = em.cero === "centro" ? -em.largo / 2 : 0
      return `cerca de X${f1(x0 + (k % ref.nx) * ref.celda)} Y${f1(y0 + Math.floor(k / ref.nx) * ref.celda)}`
    }
    return `cerca de Z${f1(-k * ref.celda)}`
  }
  const enMm = (d: number) => (fresa ? d : d * 2) // en torno se reporta en diámetro
  const sobrecorte = { cantidad: sob.cantidad, peor: Math.round(enMm(sob.peor) * 100) / 100, donde: donde(sob.k) }
  const falta = { cantidad: fal.cantidad, peor: Math.round(enMm(fal.peor) * 100) / 100, donde: donde(fal.k) }

  const fuera = (sob.cantidad + fal.cantidad) / base
  let calificacion = Math.max(0, Math.min(100, Math.round(100 * (1 - fuera))))
  if (errores.length) calificacion = Math.min(calificacion, 59)
  const aprobado = !errores.length && sob.cantidad <= base * MARGEN && fal.cantidad <= base * MARGEN

  let mensaje: string
  if (aprobado) mensaje = "¡Aprobado! Tu pieza coincide con el plano."
  else if (errores.length) mensaje = `Tu programa tiene ${errores.length === 1 ? "un error" : `${errores.length} errores`}: corrígelo${errores.length === 1 ? "" : "s"} primero (en una máquina real se detendría o chocaría).`
  else if (sob.cantidad > base * MARGEN && sob.peor >= fal.peor) mensaje = `Cortaste de más ${sobrecorte.donde}: hasta ${sobrecorte.peor} mm${fresa ? "" : " en diámetro"}. En una pieza real se echaría a perder.`
  else mensaje = `Falta quitar material ${falta.donde}: hasta ${falta.peor} mm${fresa ? "" : " en diámetro"}. Revisa medidas y profundidades.`

  return { aprobado, calificacion, errores: errores.slice(0, 10), sobrecorte, falta, mensaje }
}

/** Pieza objetivo reducida para dibujar el plano en el navegador (sin la solución). */
export function planoPublico(e: Ejercicio) {
  const o = objetivo(e)
  if (e.maquina === "torno") {
    // un radio cada 0.5 mm
    const cada = Math.max(1, Math.round(0.5 / o.celda))
    const radios: number[] = []
    for (let i = 0; i < o.nx; i += cada) radios.push(Math.round(o.datos[i] * 100) / 100)
    return { tipo: "perfil" as const, paso: cada * o.celda, radios }
  }
  // alturas en una cuadrícula de hasta 100 celdas por lado, en centésimas de mm
  const cada = Math.max(1, Math.ceil(Math.max(o.nx, o.ny) / 100))
  const nx = Math.ceil(o.nx / cada), ny = Math.ceil(o.ny / cada)
  const alturas: number[] = []
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      let lo = 0
      for (let dj = 0; dj < cada; dj++)
        for (let di = 0; di < cada; di++) {
          const ii = i * cada + di, jj = j * cada + dj
          if (ii < o.nx && jj < o.ny) lo = Math.min(lo, o.datos[jj * o.nx + ii])
        }
      alturas.push(Math.round(lo * 100))
    }
  return { tipo: "alturas" as const, nx, ny, celda: o.celda * cada, alturas }
}

/** Lo que el navegador puede ver de un ejercicio: todo menos la solución. */
export function ejercicioPublico(e: Ejercicio) {
  const { solucion: _s, ...resto } = e
  return { ...resto, plano: planoPublico(e) }
}
