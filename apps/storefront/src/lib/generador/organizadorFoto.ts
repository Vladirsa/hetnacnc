// Organizador de herramientas desde una foto (2D Studio · Imagen): pones las
// herramientas sobre una hoja blanca (carta o A4) encima de una mesa oscura y
// tomas la foto desde arriba. Aquí:
//  1. se encuentra la hoja (la mancha clara más grande) y sus 4 esquinas;
//  2. se endereza la perspectiva a tamaño real (la hoja da la escala);
//  3. lo oscuro sobre la hoja son las herramientas: sus contornos con holgura;
//  4. sale el inserto: DXF/SVG (espuma o MDF calado, o bolsillo para router) y
//     STL (placa con los huecos a la profundidad que pongas).
// Todo es puro (recibe píxeles) para probarlo sin navegador.
import { LIMPIEZA_MM, areaPts as areaSigno, extruirEn } from "@/lib/generador/contornos"
import { desplazar } from "@/lib/generador/cortadores"
import { aplanar } from "@/lib/generador/llaveros"
import { contornos, curvasDeMascara, umbralAutomatico } from "@/lib/generador/trazado"
import { type Dibujo, type Malla, type P, type Trazo, conPartes } from "@/lib/generador/vectores"

export const HOJAS = { carta: { nombre: "Carta", ancho: 215.9, alto: 279.4 }, a4: { nombre: "A4", ancho: 210, alto: 297 } }
export type TipoHoja = keyof typeof HOJAS
const MM = LIMPIEZA_MM

// ── 1. la hoja ─────────────────────────────────────────────────────────────
/** Esquinas de la hoja (sup-izq, sup-der, inf-der, inf-izq) en píxeles, o null. */
export function encontrarHoja(gris: Uint8Array, w: number, h: number): [P, P, P, P] | null {
  const u = umbralAutomatico(gris)
  const m = new Uint8Array(w * h)
  for (let i = 0; i < m.length; i++) m[i] = gris[i] > u ? 1 : 0
  // la mancha clara más grande
  const lazos = contornos(m, w, h, (w * h) / 50)
  let mejor: P[] | null = null, area = 0
  for (const l of lazos) {
    if (l.area < 0) continue
    if (l.area > area) (area = l.area), (mejor = l.pts as P[])
  }
  if (!mejor || area < (w * h) / 12) return null
  // esquinas por extremos: x+y mínimo/máximo y x−y mínimo/máximo
  let si = mejor[0], sd = mejor[0], id = mejor[0], ii = mejor[0]
  for (const p of mejor) {
    if (p[0] + p[1] < si[0] + si[1]) si = p
    if (p[0] + p[1] > id[0] + id[1]) id = p
    if (p[0] - p[1] > sd[0] - sd[1]) sd = p
    if (p[0] - p[1] < ii[0] - ii[1]) ii = p
  }
  return [si, sd, id, ii]
}

// ── 2. perspectiva ─────────────────────────────────────────────────────────
/** Homografía que lleva los 4 puntos `de` a los 4 puntos `a` (8 incógnitas). */
export function homografia(de: P[], a: P[]): number[] {
  const A: number[][] = []
  for (let i = 0; i < 4; i++) {
    const [x, y] = de[i], [u, v] = a[i]
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u])
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v])
  }
  // eliminación de Gauss con pivote
  for (let c = 0; c < 8; c++) {
    let p = c
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r
    ;[A[c], A[p]] = [A[p], A[c]]
    for (let r = 0; r < 8; r++) {
      if (r === c) continue
      const f = A[r][c] / A[c][c]
      for (let k = c; k < 9; k++) A[r][k] -= f * A[c][k]
    }
  }
  return [...A.map((r, i) => r[8] / r[i]), 1]
}
const aplicar = (H: number[], [x, y]: P): P => {
  const z = H[6] * x + H[7] * y + H[8]
  return [(H[0] * x + H[1] * y + H[2]) / z, (H[3] * x + H[4] * y + H[5]) / z]
}

/** La hoja enderezada a `pxmm` píxeles por mm (gris). La hoja va parada (alto > ancho). */
export function enderezar(gris: Uint8Array, w: number, h: number, esquinas: [P, P, P, P], hoja: TipoHoja, pxmm: number) {
  // si la hoja salió acostada en la foto, se gira para que quede parada
  const [si, sd, id, ii] = esquinas
  const anchoFoto = Math.hypot(sd[0] - si[0], sd[1] - si[1]), altoFoto = Math.hypot(ii[0] - si[0], ii[1] - si[1])
  const orden: P[] = anchoFoto > altoFoto ? [ii, si, sd, id] : [si, sd, id, ii]
  const { ancho, alto } = HOJAS[hoja]
  const W = Math.round(ancho * pxmm), Hh = Math.round(alto * pxmm)
  // de destino a foto (para muestrear cada píxel de salida)
  const H = homografia([[0, 0], [W, 0], [W, Hh], [0, Hh]], orden)
  const salida = new Uint8Array(W * Hh)
  for (let y = 0; y < Hh; y++)
    for (let x = 0; x < W; x++) {
      const [u, v] = aplicar(H, [x + 0.5, y + 0.5])
      const xi = Math.min(w - 1, Math.max(0, Math.round(u))), yi = Math.min(h - 1, Math.max(0, Math.round(v)))
      salida[y * W + x] = gris[yi * w + xi]
    }
  return { gris: salida, w: W, h: Hh }
}

// ── 3. herramientas ────────────────────────────────────────────────────────
/** Contornos de lo oscuro sobre la hoja enderezada, en mm (Y hacia arriba), sin la orilla de la hoja. */
export function contornosHerramientas(gris: Uint8Array, w: number, h: number, pxmm: number, orillaMm = 6): P[][] {
  const orilla = Math.round(orillaMm * pxmm)
  // umbral sólo con lo de adentro (la orilla trae sombra de la mesa)
  const dentro: number[] = []
  for (let y = orilla; y < h - orilla; y += 2) for (let x = orilla; x < w - orilla; x += 2) dentro.push(gris[y * w + x])
  const u = umbralAutomatico(Uint8Array.from(dentro))
  const m = new Uint8Array(w * h)
  for (let y = orilla; y < h - orilla; y++) for (let x = orilla; x < w - orilla; x++) m[y * w + x] = gris[y * w + x] < u ? 1 : 0
  return curvasDeMascara(m, w, h, { tolerancia: 0.8, manchas: Math.max(30, 25 * pxmm * pxmm), suave: true })
    .map((c) => aplanar(c, 0.5).map(([x, y]) => [x / pxmm, (h - y) / pxmm] as P))
    .filter((p) => p.length >= 3)
}

// ── 4. el inserto ──────────────────────────────────────────────────────────
export type OpcionesOrganizador = {
  holgura: number // mm alrededor de cada herramienta
  margen: number // mm del borde del inserto a las herramientas
  grosor: number // del inserto (STL) o de la espuma
  profundidad: number // de los huecos (STL); si es ≥ grosor, pasan
  dedos: boolean // hueco redondo a un lado de cada herramienta para sacarla
}
export const OPCIONES_ORGANIZADOR: OpcionesOrganizador = { holgura: 1.5, margen: 12, grosor: 20, profundidad: 15, dedos: true }

export type ResultadoOrganizador = { dibujo: Dibujo; malla: Malla; ancho: number; alto: number; piezas: number; avisos: string[]; errores: string[] }

export function hacerOrganizador(herramientas: P[][], o: OpcionesOrganizador): ResultadoOrganizador {
  const vacio = (e: string): ResultadoOrganizador => ({ dibujo: { trazos: [], avisos: [], unidades: "mm" }, malla: { tris: [], avisos: [] }, ancho: 0, alto: 0, piezas: 0, avisos: [], errores: [e] })
  if (!herramientas.length) return vacio("No encontramos herramientas sobre la hoja: que sean más oscuras que el papel y que la foto tenga buena luz.")
  const avisos: string[] = []
  let huecos = desplazar(herramientas, Math.max(0, o.holgura), MM)
  const exteriores = huecos.filter((p) => areaSigno(p) > 0)
  if (o.dedos) {
    // un círculo de 22 mm en el lado derecho de cada herramienta, a media altura
    const dedos: P[][] = exteriores.map((p) => {
      let x1 = -Infinity, y0 = Infinity, y1 = -Infinity
      for (const [x, y] of p) (x1 = Math.max(x1, x)), (y0 = Math.min(y0, y)), (y1 = Math.max(y1, y))
      const cx = x1, cy = (y0 + y1) / 2, r = 11
      return Array.from({ length: 32 }, (_, i) => [cx + r * Math.cos((i / 32) * 2 * Math.PI), cy + r * Math.sin((i / 32) * 2 * Math.PI)] as P)
    })
    huecos = desplazar([...huecos, ...dedos], 0, MM)
  }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const p of huecos) for (const [x, y] of p) (x0 = Math.min(x0, x)), (y0 = Math.min(y0, y)), (x1 = Math.max(x1, x)), (y1 = Math.max(y1, y))
  const M = Math.max(3, o.margen)
  const W = x1 - x0 + 2 * M, H = y1 - y0 + 2 * M
  const mover = (c: P[][]) => c.map((p) => p.map(([x, y]) => [x - x0 + M, y - y0 + M] as P))
  const huecosEn = mover(huecos)
  const placa: P[] = [[0, 0], [W, 0], [W, H], [0, H]]
  const trazos: Trazo[] = [{ pts: placa, cerrado: true, capa: "corte" }, ...huecosEn.map((pts) => ({ pts, cerrado: true, capa: "corte" }))]
  // STL: base llena + capa de arriba con los huecos
  const prof = Math.min(o.profundidad, o.grosor), base = o.grosor - prof
  const ext = extruirEn
  const malla = conPartes(["Base", ext([placa], base, 0)], ["Con huecos", ext([placa, ...huecosEn], prof, base > 0 ? base - 0.001 : 0)])
  if (prof >= o.grosor) avisos.push("Los huecos pasan de lado a lado (para espuma o MDF calado sobre una base).")
  if (W > 600 || H > 600) avisos.push("El inserto mide más de 60 cm: revisa que quepa en tu máquina o en tu caja.")
  return { dibujo: { trazos, avisos: [], unidades: "mm" }, malla, ancho: W, alto: H, piezas: exteriores.length, avisos, errores: [] }
}

