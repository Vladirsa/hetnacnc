// Rebanado en capas: de un modelo 3D (STL u OBJ) a las capas 2D que se cortan
// en hojas del espesor del material y se pegan una sobre otra (esculturas,
// maquetas, topografía). Cada capa lleva su número grabado y barrenos para
// alinear con taquetes, y todas se acomodan en hojas.
import { type P, type Trazo, acomodarEnHojas, area, caja, circulo, dentro, dibujo, trazo } from "@/lib/generador/geo2d"

export type Eje = "z" | "y" | "x"

export type OpcionesRebanado = {
  eje: Eje // el eje que queda vertical (las capas se apilan en él)
  altura: number // mm del modelo armado
  espesor: number // mm de cada hoja
  hoja: { ancho: number; alto: number }
  barrenos: boolean
  diametroBarreno: number
  numerar: boolean
}

const MAX_CAPAS = 300

// Dígitos de 7 segmentos (para grabar el número de capa con una línea)
const SEG: Record<string, number[]> = {
  "0": [0, 1, 2, 3, 4, 5], "1": [1, 2], "2": [0, 1, 6, 4, 3], "3": [0, 1, 6, 2, 3], "4": [5, 6, 1, 2],
  "5": [0, 5, 6, 2, 3], "6": [0, 5, 4, 3, 2, 6], "7": [0, 1, 2], "8": [0, 1, 2, 3, 4, 5, 6], "9": [0, 1, 2, 3, 5, 6],
}
function numeroGrabado(n: number, x: number, y: number, alto: number): Trazo[] {
  const w = alto * 0.55
  const tramos: [P, P][] = [
    [[0, alto], [w, alto]], [[w, alto], [w, alto / 2]], [[w, alto / 2], [w, 0]], [[w, 0], [0, 0]],
    [[0, 0], [0, alto / 2]], [[0, alto / 2], [0, alto]], [[0, alto / 2], [w, alto / 2]],
  ]
  const txt = String(n)
  const total = txt.length * w * 1.5 - w * 0.5
  const out: Trazo[] = []
  ;[...txt].forEach((d, i) => {
    const ox = x - total / 2 + i * w * 1.5
    for (const s of SEG[d] || []) out.push(trazo(tramos[s].map(([a, b]) => [ox + a, y - alto / 2 + b] as P), false, "grabado"))
  })
  return out
}

/** Cortes de la malla con el plano z = h, unidos en lazos cerrados. */
function cortar(v: Float64Array, h: number): P[][] {
  const segs: [P, P][] = []
  for (let i = 0; i < v.length; i += 9) {
    const z = [v[i + 2] - h, v[i + 5] - h, v[i + 8] - h]
    const pts: P[] = []
    for (let a = 0; a < 3; a++) {
      const b = (a + 1) % 3
      if ((z[a] > 0) !== (z[b] > 0)) {
        const t = z[a] / (z[a] - z[b])
        pts.push([v[i + a * 3] + t * (v[i + b * 3] - v[i + a * 3]), v[i + a * 3 + 1] + t * (v[i + b * 3 + 1] - v[i + a * 3 + 1])])
      }
    }
    if (pts.length === 2) segs.push([pts[0], pts[1]])
  }
  // Une los tramos por sus puntas
  const clave = (p: P) => `${Math.round(p[0] * 1000)},${Math.round(p[1] * 1000)}`
  const porPunta = new Map<string, number[]>()
  segs.forEach(([a, b], i) => {
    for (const p of [a, b]) {
      const k = clave(p)
      const l = porPunta.get(k)
      if (l) l.push(i)
      else porPunta.set(k, [i])
    }
  })
  const usado = new Uint8Array(segs.length)
  const lazos: P[][] = []
  for (let i = 0; i < segs.length; i++) {
    if (usado[i]) continue
    usado[i] = 1
    const lazo: P[] = [segs[i][0], segs[i][1]]
    let punta = segs[i][1]
    for (let guard = 0; guard < segs.length; guard++) {
      const cand = (porPunta.get(clave(punta)) || []).find((j) => !usado[j])
      if (cand === undefined) break
      usado[cand] = 1
      const [a, b] = segs[cand]
      punta = clave(a) === clave(punta) ? b : a
      lazo.push(punta)
    }
    if (lazo.length > 3 && clave(lazo[0]) === clave(lazo[lazo.length - 1])) lazo.pop()
    if (lazo.length >= 3) lazos.push(lazo)
  }
  return lazos
}

export function hacerRebanado(tris: number[], o: OpcionesRebanado) {
  const avisos: string[] = []
  if (!tris.length) return { dibujo: null, avisos: ["Sube un modelo STL u OBJ."], capas: 0, hojas: 0, escala: 1 }
  // Reacomoda los ejes para que el eje elegido quede como Z
  const v = new Float64Array(tris.length)
  for (let i = 0; i < tris.length; i += 3) {
    const [x, y, z] = [tris[i], tris[i + 1], tris[i + 2]]
    const [a, b, c] = o.eje === "z" ? [x, y, z] : o.eje === "y" ? [x, -z, y] : [y, z, x]
    v[i] = a
    v[i + 1] = b
    v[i + 2] = c
  }
  let zmin = Infinity, zmax = -Infinity
  for (let i = 2; i < v.length; i += 3) {
    if (v[i] < zmin) zmin = v[i]
    if (v[i] > zmax) zmax = v[i]
  }
  const alto0 = zmax - zmin
  if (!(alto0 > 0)) return { dibujo: null, avisos: ["El modelo no tiene altura en ese eje."], capas: 0, hojas: 0, escala: 1 }
  const k = Math.max(1, o.altura) / alto0
  for (let i = 0; i < v.length; i++) v[i] = i % 3 === 2 ? (v[i] - zmin) * k : v[i] * k
  const t = Math.max(0.5, o.espesor)
  let n = Math.max(1, Math.round(o.altura / t))
  if (n > MAX_CAPAS) {
    avisos.push(`Salen ${n} capas: se cortan sólo ${MAX_CAPAS}. Usa material más grueso o baja la altura.`)
    n = MAX_CAPAS
  }
  const paso = o.altura / n

  // Barrenos de alineación: dos puntos fijos cerca del centro del modelo
  let cx = 0, cy = 0
  for (let i = 0; i < v.length; i += 3) {
    cx += v[i]
    cy += v[i + 1]
  }
  cx /= v.length / 3
  cy /= v.length / 3

  const grupos: Trazo[][] = []
  let vacias = 0
  for (let i = 0; i < n; i++) {
    const lazos = cortar(v, (i + 0.5) * paso).filter((l) => Math.abs(area(l)) > 1)
    if (!lazos.length) {
      vacias++
      continue
    }
    const g: Trazo[] = lazos.map((l) => trazo(l, true, "corte"))
    const exteriores = lazos.filter((l) => !lazos.some((m) => m !== l && Math.abs(area(m)) > Math.abs(area(l)) && dentro(l[0], m)))
    const solido = (p: P) => {
      const adentro = lazos.filter((l) => dentro(p, l)).length
      return adentro % 2 === 1
    }
    const libre = (p: P, r: number) => solido(p) && [0, 1, 2, 3, 4, 5, 6, 7].every((q) => solido([p[0] + r * Math.cos((q * Math.PI) / 4), p[1] + r * Math.sin((q * Math.PI) / 4)]))
    if (o.barrenos) {
      const r = o.diametroBarreno / 2
      const b = caja(exteriores.flat())
      const d = Math.min(30, (b.x1 - b.x0) / 4)
      for (const p of [[cx - d, cy], [cx + d, cy]] as P[]) if (libre(p, r + 2)) g.push(circulo(p[0], p[1], r))
    }
    if (o.numerar) {
      // El número va en el punto sólido más cercano al centro de la capa
      const b = caja(exteriores.flat())
      const alto = Math.min(5, (b.y1 - b.y0) / 4)
      let mejor: P | null = null
      let dist = Infinity
      const pasoBusca = Math.max(1, Math.min(b.x1 - b.x0, b.y1 - b.y0) / 20)
      const mx = (b.x0 + b.x1) / 2
      const my = (b.y0 + b.y1) / 2
      for (let x = b.x0; x <= b.x1; x += pasoBusca)
        for (let y = b.y0; y <= b.y1; y += pasoBusca) {
          if (!libre([x, y], alto * 1.2)) continue
          const dd = Math.hypot(x - mx, y - my)
          if (dd < dist) {
            dist = dd
            mejor = [x, y]
          }
        }
      if (mejor && alto >= 2) g.push(...numeroGrabado(i + 1, mejor[0], mejor[1], alto))
    }
    grupos.push(g)
  }
  if (vacias) avisos.push(`${vacias} capas quedaron vacías (el modelo tiene huecos o no es sólido en esa altura).`)
  const r = acomodarEnHojas(grupos, o.hoja)
  if (r.noCaben) avisos.push(`${r.noCaben} capas no caben en la hoja: haz el modelo más chico o la hoja más grande.`)
  avisos.push("Pega las capas en orden con el número hacia arriba y usa taquetes en los barrenos para alinearlas.")
  return { dibujo: dibujo(r.trazos, avisos), avisos, capas: grupos.length, hojas: r.hojas, escala: k }
}
