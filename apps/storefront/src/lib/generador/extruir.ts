// SVG o DXF → STL: extruye los contornos cerrados de un dibujo 2D a un sólido
// (letras, logotipos, siluetas) para imprimir en 3D o tallar en relieve.
// Todo en el navegador, en milímetros.
//
// Los contornos anidados se interpretan como agujeros (la "o" de un texto, el
// hueco de un llavero): un contorno con número par de contornos alrededor es
// pieza; con número impar, agujero de la pieza que lo rodea.

import { ShapeUtils, Vector2 } from "three"

import type { Dibujo, Malla, P, Trazo } from "@/lib/generador/vectores"

// Qué se hace con cada trazo (por color o capa del archivo):
//  corte: contornos cerrados que forman piezas y huecos (lo de siempre)
//  grabado: áreas cerradas hundidas en la cara de arriba (lo que queda dentro
//    de un área grabada vuelve a subir, como una isla)
//  marcar: la línea se vuelve un canal del ancho indicado, hundido igual que el grabado
//  ignorar: no se usa
export type Operacion = "corte" | "grabado" | "marcar" | "ignorar"

export type OpcionesExtruir = {
  alto: number // altura de la extrusión (mm)
  base: number // grosor de la placa base (0 = sin placa)
  margenBase: number // cuánto sobresale la placa del dibujo por cada lado
  redondearBase: number // radio de las esquinas de la placa
  espejo: boolean // voltear (para que al imprimir boca abajo quede legible)
  operacion?: (t: Trazo) => Operacion // sin esto, todo es corte
  profundidad?: number // mm que se hunden el grabado y las líneas marcadas
  anchoLinea?: number // mm de ancho del canal de una línea marcada
}

export type ResultadoExtruir = { malla: Malla; piezas: number; agujeros: number; errores: string[]; rebajes?: number }

const area2 = (pts: P[]) => {
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i]
    const [x1, y1] = pts[(i + 1) % pts.length]
    a += x0 * y1 - x1 * y0
  }
  return a / 2
}

function dentro(p: P, poly: P[]) {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}

// quita puntos repetidos y cierra bien el contorno
const limpiar = (pts: P[]) => {
  const out: P[] = []
  for (const p of pts) {
    const q = out[out.length - 1]
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-4) out.push(p)
  }
  if (out.length > 1) {
    const a = out[0]
    const b = out[out.length - 1]
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-4) out.pop()
  }
  // Quita los puntos alineados con sus vecinos. El triangulador de three
  // (earcut) los descarta en las tapas; si las paredes los conservan, las
  // aristas no coinciden y el STL queda con huecos (no es "watertight").
  let cambio = true
  while (cambio && out.length > 3) {
    cambio = false
    for (let i = 0; i < out.length && out.length > 3; i++) {
      const p = out[(i + out.length - 1) % out.length]
      const q = out[i]
      const r = out[(i + 1) % out.length]
      if (Math.abs((q[0] - p[0]) * (r[1] - q[1]) - (q[1] - p[1]) * (r[0] - q[0])) < 1e-9) {
        out.splice(i, 1)
        cambio = true
        i--
      }
    }
  }
  return out
}

export function extruir(d: Dibujo, o: OpcionesExtruir): ResultadoExtruir {
  // Cada contorno se mueve una fracción de micra en Y: cuando varios huecos
  // tienen bordes sobre la misma recta exacta (letras que tocan un riel),
  // earcut une mal los huecos y el STL queda abierto. No cambia la pieza.
  const op = o.operacion || (() => "corte" as Operacion)
  const deCorte = d.trazos.filter((t) => op(t) === "corte")
  const cerrados = deCorte
    .filter((t) => t.cerrado)
    .map((t, k) => limpiar(t.pts).map(([x, y]) => [x, y + ((k % 997) + 1) * 1e-6] as P))
    .filter((p) => p.length >= 3 && Math.abs(area2(p)) > 0.01)
  if (!cerrados.length) return { malla: { tris: [], avisos: [] }, piezas: 0, agujeros: 0, errores: ["El dibujo no tiene contornos cerrados que extruir. Revisa que las líneas cierren o usa «Unir líneas sueltas» en el convertidor."] }

  // profundidad de anidado de cada contorno
  const prof = cerrados.map((c, i) => cerrados.filter((otro, j) => j !== i && dentro(c[0], otro)).length)
  const exteriores = cerrados.map((_, i) => i).filter((i) => prof[i] % 2 === 0)
  const agujerosDe: Record<number, number[]> = {}
  let agujeros = 0
  cerrados.forEach((c, i) => {
    if (prof[i] % 2 === 0) return
    // su pieza: el exterior más interno que lo contiene
    let mejor = -1
    for (const e of exteriores) if (prof[e] === prof[i] - 1 && dentro(c[0], cerrados[e])) mejor = e
    if (mejor >= 0) {
      ;(agujerosDe[mejor] ||= []).push(i)
      agujeros++
    }
  })

  const tris: number[] = []
  const h = o.alto
  const z0 = 0
  const sx = o.espejo ? -1 : 1
  const tri = (a: [number, number, number], b: [number, number, number], c: [number, number, number]) => tris.push(a[0] * sx, a[1], a[2], b[0] * sx, b[1], b[2], c[0] * sx, c[1], c[2])

  // paredes de un contorno (antihorario = exterior, horario = agujero)
  const paredes = (pts: P[], z0: number, z1: number) => {
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]
      const b = pts[(i + 1) % pts.length]
      tri([a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1])
      tri([a[0], a[1], z0], [b[0], b[1], z1], [a[0], a[1], z1])
    }
  }

  // cara plana a la altura z (normal hacia arriba o hacia abajo); exterior antihorario, huecos horarios
  const cara = (ext: P[], hoyos: P[][], z: number, arriba: boolean) => {
    let caras: number[][]
    try {
      caras = ShapeUtils.triangulateShape(ext.map(([x, y]) => new Vector2(x, y)), hoyos.map((hh) => hh.map(([x, y]) => new Vector2(x, y))))
    } catch {
      return false
    }
    const todos = [...ext, ...hoyos.flat()]
    for (const [i, j, k] of caras) {
      const a = todos[i]
      const [b, c] = area2([todos[i], todos[j], todos[k]]) >= 0 ? [todos[j], todos[k]] : [todos[k], todos[j]]
      if (arriba) tri([a[0], a[1], z], [b[0], b[1], z], [c[0], c[1], z])
      else tri([a[0], a[1], z], [c[0], c[1], z], [b[0], b[1], z])
    }
    return true
  }
  const ccw = (p: P[]) => (area2(p) > 0 ? p : [...p].reverse())
  const cw = (p: P[]) => (area2(p) < 0 ? p : [...p].reverse())

  // grabado y líneas marcadas: rebajes en la cara de arriba
  const prof0 = Math.max(0.05, Math.min(o.profundidad ?? 0.6, h * 0.9))
  const zr = z0 + h - prof0
  const rebajes = calcularRebajes(d.trazos.filter((t) => op(t) === "grabado" && t.cerrado), d.trazos.filter((t) => op(t) === "marcar"), cerrados, Math.max(0.1, o.anchoLinea ?? 0.8))
  // árbol de rebajes: nivel par = área hundida, nivel impar = isla que vuelve a subir
  const padreR = rebajes.map((r, i) => {
    let mejor = -1
    for (let j = 0; j < rebajes.length; j++)
      if (j !== i && Math.abs(area2(rebajes[j])) > Math.abs(area2(r)) && dentro(r[0], rebajes[j]) && (mejor < 0 || Math.abs(area2(rebajes[j])) < Math.abs(area2(rebajes[mejor])))) mejor = j
    return mejor
  })
  const nivelR = rebajes.map((_, i) => {
    let n = 0
    for (let p = padreR[i]; p >= 0; p = padreR[p]) n++
    return n
  })
  const hijosR = (i: number) => rebajes.map((_, j) => j).filter((j) => padreR[j] === i)

  for (const e of exteriores) {
    const ext = ccw(cerrados[e])
    const hoyos = (agujerosDe[e] || []).map((i) => cw(cerrados[i]))
    // rebajes de primer nivel que caen en esta pieza (ya vienen recortados dentro de ella)
    const mios = rebajes.map((_, i) => i).filter((i) => padreR[i] < 0 && dentro(rebajes[i][0], ext) && !hoyos.some((hh) => dentro(rebajes[i][0], hh)))
    // cada hueco de corte va en la cara más interna que lo rodea: la tapa de la
    // pieza o, si cae dentro de un área grabada, la tapa de la isla (el anillo
    // de margen) que lo rodea
    const caraDe = hoyos.map((hh) => {
      let mejor = -1
      for (let i = 0; i < rebajes.length; i++)
        if (dentro(hh[0], rebajes[i]) && (mejor < 0 || Math.abs(area2(rebajes[i])) < Math.abs(area2(rebajes[mejor])))) mejor = i
      return mejor
    })
    const huecosDe = (cual: number) => hoyos.filter((_, k) => caraDe[k] === cual)
    if (!cara(ext, [...huecosDe(-1), ...mios.map((i) => cw(rebajes[i]))], z0 + h, true)) continue // tapa
    cara(ext, hoyos, z0, false) // fondo
    paredes(ext, z0, z0 + h)
    for (const hh of hoyos) paredes(hh, z0, z0 + h)
    // cada área hundida: piso a zr con sus islas como huecos; paredes de zr a la tapa
    const pila = [...mios]
    while (pila.length) {
      const i = pila.pop()!
      const islas = hijosR(i)
      if (nivelR[i] % 2 === 0) {
        cara(ccw(rebajes[i]), [...islas.map((j) => cw(rebajes[j])), ...huecosDe(i)], zr, true)
        paredes(cw(rebajes[i]), zr, z0 + h)
      } else {
        // isla: su tapa a la altura de la pieza, con sus propias áreas hundidas como huecos
        cara(ccw(rebajes[i]), [...islas.map((j) => cw(rebajes[j])), ...huecosDe(i)], z0 + h, true)
        paredes(ccw(rebajes[i]), zr, z0 + h)
      }
      pila.push(...islas)
    }
  }

  // placa base (caja con esquinas redondeadas) debajo del dibujo
  if (o.base > 0) {
    const xs = cerrados.flat().map((p) => p[0])
    const ys = cerrados.flat().map((p) => p[1])
    const m = o.margenBase
    const x0 = Math.min(...xs) - m, x1 = Math.max(...xs) + m
    const y0 = Math.min(...ys) - m, y1 = Math.max(...ys) + m
    const r = Math.max(0, Math.min(o.redondearBase, (x1 - x0) / 2, (y1 - y0) / 2))
    const placa: P[] = []
    if (r > 0) {
      const esq: [number, number, number][] = [[x1 - r, y0 + r, -Math.PI / 2], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, Math.PI / 2], [x0 + r, y0 + r, Math.PI]]
      for (const [cx, cy, a0] of esq) for (let j = 0; j <= 8; j++) placa.push([cx + r * Math.cos(a0 + (Math.PI / 2) * (j / 8)), cy + r * Math.sin(a0 + (Math.PI / 2) * (j / 8))])
    } else placa.push([x0, y0], [x1, y0], [x1, y1], [x0, y1])
    const caras = ShapeUtils.triangulateShape(placa.map(([x, y]) => new Vector2(x, y)), [])
    for (const [i, j, k] of caras) {
      const a = placa[i]
      const [b, c] = area2([placa[i], placa[j], placa[k]]) >= 0 ? [placa[j], placa[k]] : [placa[k], placa[j]]
      tri([a[0], a[1], z0], [b[0], b[1], z0], [c[0], c[1], z0])
      tri([a[0], a[1], -o.base], [c[0], c[1], -o.base], [b[0], b[1], -o.base])
    }
    paredes(placa, -o.base, z0)
  }

  // con espejo las caras quedan al revés: se invierte el orden de cada triángulo
  if (o.espejo) {
    for (let i = 0; i < tris.length; i += 9) {
      const b = tris.slice(i + 3, i + 6)
      tris.splice(i + 3, 3, ...tris.slice(i + 6, i + 9))
      tris.splice(i + 6, 3, ...b)
    }
  }

  const avisos: string[] = []
  const abiertos = deCorte.filter((t) => !t.cerrado).length
  if (abiertos) avisos.push(`${abiertos} línea${abiertos === 1 ? "" : "s"} abierta${abiertos === 1 ? "" : "s"} de corte se ignoraron: solo se extruyen contornos cerrados. Si son líneas de doblez o marcado, ponles «Línea marcada».`)
  const grabAbiertos = d.trazos.filter((t) => op(t) === "grabado" && !t.cerrado).length
  if (grabAbiertos) avisos.push(`${grabAbiertos} línea${grabAbiertos === 1 ? "" : "s"} abierta${grabAbiertos === 1 ? "" : "s"} de grabado se ignoraron: el grabado necesita áreas cerradas. Para líneas usa «Línea marcada».`)
  const hayRebaje = d.trazos.some((t) => op(t) === "grabado" || op(t) === "marcar")
  if (hayRebaje && !rebajes.length) avisos.push("El grabado y las líneas marcadas no caen dentro de ninguna pieza de corte, así que no se hundió nada.")
  return { malla: { tris, avisos }, piezas: exteriores.length, agujeros, errores: [], rebajes: rebajes.filter((_, i) => nivelR[i] % 2 === 0).length }
}

// ---------- rebajes (grabado y líneas marcadas) ----------
// Se dibujan en una rejilla: así las áreas y canales que se enciman se unen
// solos y nunca quedan caras cruzadas. Se recortan 0.4 mm dentro de las piezas
// de corte para que ningún rebaje toque una pared (el sólido queda cerrado).
function calcularRebajes(grabados: Trazo[], lineas: Trazo[], cortes: P[][], ancho: number): P[][] {
  if ((!grabados.length && !lineas.length) || !cortes.length) return []
  const pts = cortes.flat()
  const x0 = Math.min(...pts.map((p) => p[0])) - 1
  const y0 = Math.min(...pts.map((p) => p[1])) - 1
  const x1 = Math.max(...pts.map((p) => p[0])) + 1
  const y1 = Math.max(...pts.map((p) => p[1])) + 1
  const px = Math.max(2, Math.min(20, Math.sqrt(8e6 / ((x1 - x0) * (y1 - y0)))))
  const w = Math.ceil((x1 - x0) * px) + 1
  const h = Math.ceil((y1 - y0) * px) + 1
  // relleno par-impar de un grupo de polígonos (en mm), sumado a la máscara
  const llenar = (m: Uint8Array, polis: P[][]) => {
    for (let j = 0; j < h; j++) {
      const y = y0 + (j + 0.5) / px
      const xs: number[] = []
      for (const pl of polis)
        for (let i = 0; i < pl.length; i++) {
          const a = pl[i]
          const b = pl[(i + 1) % pl.length]
          if (a[1] > y !== b[1] > y) xs.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]))
        }
      xs.sort((a, b) => a - b)
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const i0 = Math.max(0, Math.ceil((xs[k] - x0) * px - 0.5))
        const i1 = Math.min(w - 1, Math.floor((xs[k + 1] - x0) * px - 0.5))
        for (let i = i0; i <= i1; i++) m[j * w + i] = 1
      }
    }
  }
  const R = new Uint8Array(w * h)
  if (grabados.length) llenar(R, grabados.map((t) => t.pts))
  // cada tramo de línea es un rectángulo del ancho del canal, con un círculo en cada vértice
  for (const t of lineas) {
    const L = t.cerrado ? [...t.pts, t.pts[0]] : t.pts
    for (let i = 0; i + 1 < L.length; i++) {
      const [a, b] = [L[i], L[i + 1]]
      const dx = b[0] - a[0], dy = b[1] - a[1]
      const l = Math.hypot(dx, dy)
      if (l < 1e-9) continue
      const nx = (-dy / l) * (ancho / 2), ny = (dx / l) * (ancho / 2)
      llenar(R, [[[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]]])
    }
    for (const q of L) llenar(R, [Array.from({ length: 12 }, (_, k) => [q[0] + (ancho / 2) * Math.cos((k * Math.PI) / 6), q[1] + (ancho / 2) * Math.sin((k * Math.PI) / 6)] as P)])
  }
  // piezas de corte, adelgazadas 0.4 mm
  const piezas = new Uint8Array(w * h)
  llenar(piezas, cortes)
  const dist = distanciaCero(piezas, w, h)
  const margen = Math.max(0.4 * px, 3)
  for (let i = 0; i < R.length; i++) if (!(dist[i] > margen)) R[i] = 0
  // dos áreas que se tocan sólo en diagonal compartirían un vértice (sólido
  // abierto): se rellena la esquina para unirlas
  for (let cambio = true; cambio; ) {
    cambio = false
    for (let j = 0; j + 1 < h; j++)
      for (let i = 0; i + 1 < w; i++) {
        const a = R[j * w + i], b = R[j * w + i + 1], c = R[(j + 1) * w + i], e = R[(j + 1) * w + i + 1]
        if (a && e && !b && !c) { R[j * w + i + 1] = 1; cambio = true }
        else if (b && c && !a && !e) { R[j * w + i] = 1; cambio = true }
      }
  }
  // contorno de los rebajes: tramos rectos siguiendo los bordes de la rejilla, simplificados
  const lazos = contornosMascara(R, w, h)
  const minimo = Math.max(2, (0.3 * px) ** 2)
  return lazos
    .filter((l) => Math.abs(area2(l)) >= minimo)
    .map((l) => simplificar(l, 0.45).map(([i, j]) => [x0 + i / px, y0 + j / px] as P))
    .map((l, k) => limpiar(l).map(([x, y]) => [x, y + ((k % 991) + 1) * 1.3e-6] as P))
    .filter((l) => l.length >= 3 && Math.abs(area2(l)) > 1e-4)
}

// distancia (chaflán 3-4, en píxeles) de cada celda a la celda vacía más cercana
function distanciaCero(m: Uint8Array, w: number, h: number): Float32Array {
  const d = new Float32Array(w * h)
  for (let i = 0; i < d.length; i++) d[i] = m[i] ? 1e9 : 0
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      let v = d[i]
      if (!v) continue
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) v = 3
      if (x > 0) v = Math.min(v, d[i - 1] + 3)
      if (y > 0) {
        v = Math.min(v, d[i - w] + 3)
        if (x > 0) v = Math.min(v, d[i - w - 1] + 4)
        if (x < w - 1) v = Math.min(v, d[i - w + 1] + 4)
      }
      d[i] = v
    }
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x
      let v = d[i]
      if (!v) continue
      if (x < w - 1) v = Math.min(v, d[i + 1] + 3)
      if (y < h - 1) {
        v = Math.min(v, d[i + w] + 3)
        if (x < w - 1) v = Math.min(v, d[i + w + 1] + 4)
        if (x > 0) v = Math.min(v, d[i + w - 1] + 4)
      }
      d[i] = v
    }
  for (let i = 0; i < d.length; i++) d[i] /= 3
  return d
}

// Contornos de una máscara siguiendo los bordes entre celdas llenas y vacías.
// Lo lleno queda a la izquierda del recorrido; las esquinas que se tocan en
// diagonal se separan (cada lazo es simple).
function contornosMascara(m: Uint8Array, w: number, h: number): P[][] {
  const lleno = (i: number, j: number) => i >= 0 && j >= 0 && i < w && j < h && m[j * w + i] === 1
  // aristas dirigidas: de (x, y) a (x2, y2), en coordenadas de esquina
  const sig = new Map<number, number[]>()
  const clave = (x: number, y: number) => y * (w + 1) + x
  const agregar = (x: number, y: number, x2: number, y2: number) => {
    const k = clave(x, y)
    const l = sig.get(k)
    if (l) l.push(clave(x2, y2))
    else sig.set(k, [clave(x2, y2)])
  }
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      if (!lleno(i, j)) continue
      // Y hacia abajo en la rejilla: con lo lleno a la izquierda se recorre en sentido horario de pantalla
      if (!lleno(i, j - 1)) agregar(i + 1, j, i, j) // arriba, hacia la izquierda
      if (!lleno(i - 1, j)) agregar(i, j, i, j + 1) // izquierda, hacia abajo
      if (!lleno(i, j + 1)) agregar(i, j + 1, i + 1, j + 1) // abajo, hacia la derecha
      if (!lleno(i + 1, j)) agregar(i + 1, j + 1, i + 1, j) // derecha, hacia arriba
    }
  const lazos: P[][] = []
  const xy = (k: number): P => [k % (w + 1), Math.floor(k / (w + 1))]
  for (const [inicio] of sig) {
    while ((sig.get(inicio) || []).length) {
      const lazo: P[] = []
      let k = inicio
      let prev: P | null = null
      for (let guard = 0; guard < 4 * (w + 1) * (h + 1); guard++) {
        const l = sig.get(k)
        if (!l || !l.length) break
        // en un cruce diagonal se gira a la derecha para mantener lazos simples
        let elegido = 0
        if (l.length > 1 && prev) {
          const [cx, cy] = xy(k)
          const din = [cx - prev[0], cy - prev[1]]
          let mejor = Infinity
          l.forEach((n, idx) => {
            const [nx, ny] = xy(n)
            const dout = [nx - cx, ny - cy]
            const giro = din[0] * dout[1] - din[1] * dout[0] // >0 a la derecha (Y abajo)
            const pref = giro > 0 ? 0 : giro === 0 ? 1 : 2
            if (pref < mejor) { mejor = pref; elegido = idx }
          })
        }
        const n = l.splice(elegido, 1)[0]
        lazo.push(xy(k))
        prev = xy(k)
        k = n
        if (k === inicio) break
      }
      if (lazo.length >= 4) lazos.push(lazo)
    }
  }
  return lazos
}

// Douglas-Peucker cerrado (tolerancia en píxeles)
function simplificar(pts: P[], tol: number): P[] {
  if (pts.length < 8) return pts
  // punto más lejano del primero, para partir el lazo en dos cadenas
  let lejos = 0
  for (let i = 1; i < pts.length; i++) if (Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]) > Math.hypot(pts[lejos][0] - pts[0][0], pts[lejos][1] - pts[0][1])) lejos = i
  const dp = (c: P[]): P[] => {
    if (c.length < 3) return c
    const [a, b] = [c[0], c[c.length - 1]]
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    let max = -1, idx = 0
    for (let i = 1; i < c.length - 1; i++) {
      const d = Math.abs((b[0] - a[0]) * (a[1] - c[i][1]) - (a[0] - c[i][0]) * (b[1] - a[1])) / L
      if (d > max) { max = d; idx = i }
    }
    if (max <= tol) return [a, b]
    const izq = dp(c.slice(0, idx + 1))
    return [...izq.slice(0, -1), ...dp(c.slice(idx))]
  }
  const uno = dp(pts.slice(0, lejos + 1))
  const dos = dp([...pts.slice(lejos), pts[0]])
  return [...uno.slice(0, -1), ...dos.slice(0, -1)]
}
