// Letreros y nombres para CNC: texto con una tipografía -> contornos en mm listos para cortar
// (letras unidas, con barra opcional) o para grabar dentro de una placa.
//
// Las letras se unen dibujándolas en una rejilla fina (20 px por mm como máximo) y
// sacando su contorno con el mismo trazador del vectorizador: así las letras cursivas que
// se enciman quedan como una sola pieza, sin líneas cruzadas que arruinen el corte.

import { type Curva, type Pt, type Vector, caja, contornos, curvasDeMascara } from "./trazado"

// Lo mínimo que se usa de opentype.js (se carga desde la CDN en la página)
export type Cmd = { type: string; x?: number; y?: number; x1?: number; y1?: number; x2?: number; y2?: number }
export type Glifo = { advanceWidth?: number; getPath(x: number, y: number, size: number): { commands: Cmd[] } }
export type Fuente = {
  unitsPerEm: number
  charToGlyph(c: string): Glifo
  stringToGlyphs(s: string): Glifo[]
  getKerningValue(a: Glifo, b: Glifo): number
}

export type OpcionesLetrero = {
  texto: string
  alto: number // mm, alto de la letra mayúscula
  espaciado: number // mm extra entre letras (puede ser negativo)
  interlineado: number // distancia entre renglones, en veces el alto de la mayúscula
  alineacion: "izquierda" | "centro" | "derecha"
  barra: number // mm de grosor de una barra bajo el último renglón que une las letras (0 = sin barra)
  placa: null | { margen: number; radio: number; barreno: number } // mm; barreno 0 = sin barrenos
  fresa: number // mm de diámetro de la fresa (0 = láser o plasma, sin revisión)
}

export type Letrero = {
  vector: Vector // capas en mm (CORTE, o PLACA y GRABADO)
  problema: Curva[] // zonas que la fresa no alcanza, en mm
  areaProblema: number // mm²
  ancho: number
  alto: number
  piezas: number
  avisos: string[]
}

// ---------------------------------------------------------------------
// Texto a curvas (mm, y hacia abajo)
// ---------------------------------------------------------------------

const f23 = 2 / 3

function curvasDeComandos(cmds: Cmd[]): Curva[] {
  const out: Curva[] = []
  let act: Curva | null = null
  let a: Pt = [0, 0]
  const cerrar = () => {
    if (act && act.tramos.length) {
      const u = act.tramos[act.tramos.length - 1].p
      if (Math.abs(u[0] - act.inicio[0]) > 1e-9 || Math.abs(u[1] - act.inicio[1]) > 1e-9) act.tramos.push({ p: act.inicio })
      out.push(act)
    }
    act = null
  }
  for (const c of cmds) {
    const p: Pt = [c.x ?? 0, c.y ?? 0]
    if (c.type === "M") {
      cerrar()
      act = { inicio: p, tramos: [], hueco: false }
    } else if (c.type === "L" && act) act.tramos.push({ p })
    else if (c.type === "C" && act) act.tramos.push({ c1: [c.x1 ?? 0, c.y1 ?? 0], c2: [c.x2 ?? 0, c.y2 ?? 0], p })
    else if (c.type === "Q" && act) {
      const q: Pt = [c.x1 ?? 0, c.y1 ?? 0]
      act.tramos.push({ c1: [a[0] + f23 * (q[0] - a[0]), a[1] + f23 * (q[1] - a[1])], c2: [p[0] + f23 * (q[0] - p[0]), p[1] + f23 * (q[1] - p[1])], p })
    } else if (c.type === "Z") {
      cerrar()
      continue
    }
    a = p
  }
  cerrar()
  return out
}

function puntosDe(c: Curva, paso: number): Pt[] {
  const pts: Pt[] = [c.inicio]
  let a = c.inicio
  for (const t of c.tramos) {
    if ("c1" in t) {
      const L = Math.hypot(t.c1[0] - a[0], t.c1[1] - a[1]) + Math.hypot(t.c2[0] - t.c1[0], t.c2[1] - t.c1[1]) + Math.hypot(t.p[0] - t.c2[0], t.p[1] - t.c2[1])
      const n = Math.max(2, Math.min(64, Math.ceil(L / paso)))
      for (let i = 1; i <= n; i++) {
        const s = i / n
        const u = 1 - s
        pts.push([
          u * u * u * a[0] + 3 * u * u * s * t.c1[0] + 3 * u * s * s * t.c2[0] + s * s * s * t.p[0],
          u * u * u * a[1] + 3 * u * u * s * t.c1[1] + 3 * u * s * s * t.c2[1] + s * s * s * t.p[1],
        ])
      }
    } else pts.push(t.p)
    a = t.p
  }
  return pts
}

function limites(curvas: Curva[]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const c of curvas) {
    for (const p of [c.inicio, ...c.tramos.flatMap((t) => ("c1" in t ? [t.c1, t.c2, t.p] : [t.p]))]) {
      if (p[0] < x0) x0 = p[0]
      if (p[0] > x1) x1 = p[0]
      if (p[1] < y0) y0 = p[1]
      if (p[1] > y1) y1 = p[1]
    }
  }
  return Number.isFinite(x0) ? { x0, y0, x1, y1 } : null
}

// Alto de la "H" en unidades de la fuente (para dar el tamaño por alto de mayúscula)
function altoMayuscula(fuente: Fuente): number {
  const b = limites(curvasDeComandos(fuente.charToGlyph("H").getPath(0, 0, fuente.unitsPerEm).commands))
  return b && b.y1 - b.y0 > 0 ? b.y1 - b.y0 : fuente.unitsPerEm * 0.7
}

// Acomoda el texto en renglones; devuelve curvas en mm y dónde queda la base del último renglón
export function textoACurvas(fuente: Fuente, o: Pick<OpcionesLetrero, "texto" | "alto" | "espaciado" | "interlineado" | "alineacion">) {
  const tam = (o.alto * fuente.unitsPerEm) / altoMayuscula(fuente)
  const k = tam / fuente.unitsPerEm
  const renglones = o.texto.replace(/\r/g, "").split("\n")
  const lineas: { curvas: Curva[]; ancho: number }[] = []
  renglones.forEach((r, j) => {
    const base = j * o.interlineado * o.alto
    const glifos = fuente.stringToGlyphs(r)
    let x = 0
    const curvas: Curva[] = []
    glifos.forEach((g, i) => {
      curvas.push(...curvasDeComandos(g.getPath(x, base, tam).commands))
      x += (g.advanceWidth ?? 0) * k + o.espaciado
      if (i < glifos.length - 1) x += fuente.getKerningValue(g, glifos[i + 1]) * k
    })
    lineas.push({ curvas, ancho: Math.max(0, x - o.espaciado) })
  })
  const maximo = Math.max(0, ...lineas.map((l) => l.ancho))
  const todas: Curva[] = []
  for (const l of lineas) {
    const dx = o.alineacion === "centro" ? (maximo - l.ancho) / 2 : o.alineacion === "derecha" ? maximo - l.ancho : 0
    const mover = (p: Pt): Pt => [p[0] + dx, p[1]]
    for (const c of l.curvas) {
      todas.push({ ...c, inicio: mover(c.inicio), tramos: c.tramos.map((t) => ("c1" in t ? { c1: mover(t.c1), c2: mover(t.c2), p: mover(t.p) } : { p: mover(t.p) })) })
    }
  }
  return { curvas: todas, baseFinal: (renglones.length - 1) * o.interlineado * o.alto, renglones: renglones.length }
}

// ---------------------------------------------------------------------
// Figuras
// ---------------------------------------------------------------------

const K = 0.5522847498 // manija de un cuarto de círculo

export function rectanguloRedondo(x0: number, y0: number, x1: number, y1: number, r: number): Curva {
  r = Math.max(0, Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2))
  if (r < 1e-6) return { inicio: [x0, y0], tramos: [{ p: [x1, y0] }, { p: [x1, y1] }, { p: [x0, y1] }, { p: [x0, y0] }], hueco: false }
  const m = r * K
  return {
    inicio: [x0 + r, y0],
    tramos: [
      { p: [x1 - r, y0] },
      { c1: [x1 - r + m, y0], c2: [x1, y0 + r - m], p: [x1, y0 + r] },
      { p: [x1, y1 - r] },
      { c1: [x1, y1 - r + m], c2: [x1 - r + m, y1], p: [x1 - r, y1] },
      { p: [x0 + r, y1] },
      { c1: [x0 + r - m, y1], c2: [x0, y1 - r + m], p: [x0, y1 - r] },
      { p: [x0, y0 + r] },
      { c1: [x0, y0 + r - m], c2: [x0 + r - m, y0], p: [x0 + r, y0] },
    ],
    hueco: false,
  }
}

export function circulo(cx: number, cy: number, r: number): Curva {
  const m = r * K
  return {
    inicio: [cx + r, cy],
    tramos: [
      { c1: [cx + r, cy + m], c2: [cx + m, cy + r], p: [cx, cy + r] },
      { c1: [cx - m, cy + r], c2: [cx - r, cy + m], p: [cx - r, cy] },
      { c1: [cx - r, cy - m], c2: [cx - m, cy - r], p: [cx, cy - r] },
      { c1: [cx + m, cy - r], c2: [cx + r, cy - m], p: [cx + r, cy] },
    ],
    hueco: true,
  }
}

// ---------------------------------------------------------------------
// Rejilla: rellenar curvas (regla distinto de cero) y operaciones con la fresa
// ---------------------------------------------------------------------

type Rejilla = { m: Uint8Array; w: number; h: number; x0: number; y0: number; pxmm: number }

function rellenar(curvas: Curva[], g: Rejilla) {
  const filas: number[][] = Array.from({ length: g.h }, () => [])
  const X = (x: number) => (x - g.x0) * g.pxmm
  const Y = (y: number) => (y - g.y0) * g.pxmm
  for (const c of curvas) {
    const pts = puntosDe(c, 1 / g.pxmm)
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]
      const b = pts[(i + 1) % pts.length]
      const ax = X(a[0]), ay = Y(a[1]), bx = X(b[0]), by = Y(b[1])
      if (ay === by) continue
      const dir = by > ay ? 1 : -1
      const ya = Math.min(ay, by)
      const yb = Math.max(ay, by)
      for (let j = Math.max(0, Math.ceil(ya - 0.5)); j < g.h && j + 0.5 < yb; j++) {
        const yc = j + 0.5
        if (yc < ya) continue
        const t = (yc - ay) / (by - ay)
        filas[j].push(ax + t * (bx - ax), dir)
      }
    }
  }
  for (let j = 0; j < g.h; j++) {
    const f = filas[j]
    if (!f.length) continue
    const orden: [number, number][] = []
    for (let i = 0; i < f.length; i += 2) orden.push([f[i], f[i + 1]])
    orden.sort((p, q) => p[0] - q[0])
    let giro = 0
    for (let i = 0; i < orden.length - 1; i++) {
      giro += orden[i][1]
      if (giro === 0) continue
      const desde = Math.max(0, Math.ceil(orden[i][0] - 0.5))
      const hasta = Math.min(g.w - 1, Math.floor(orden[i + 1][0] - 0.5))
      for (let x = desde; x <= hasta; x++) g.m[j * g.w + x] = 1
    }
  }
}

// Distancia (chaflán 3-4, en píxeles) a la celda más cercana con valor "a"
function distancia(m: Uint8Array, w: number, h: number, a: number): Float32Array {
  const INF = 1e9
  const d = new Float32Array(w * h)
  for (let i = 0; i < d.length; i++) d[i] = m[i] === a ? 0 : INF
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      let v = d[i]
      if (!v) continue
      if (x > 0) v = Math.min(v, d[i - 1] + 3)
      if (y > 0) {
        v = Math.min(v, d[i - w] + 3)
        if (x > 0) v = Math.min(v, d[i - w - 1] + 4)
        if (x < w - 1) v = Math.min(v, d[i - w + 1] + 4)
      }
      d[i] = v
    }
  }
  for (let y = h - 1; y >= 0; y--) {
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
  }
  for (let i = 0; i < d.length; i++) d[i] /= 3
  return d
}

// engrosa (r > 0) o adelgaza (r < 0) la figura r píxeles
function mover(m: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const out = new Uint8Array(m.length)
  if (r > 0) {
    const d = distancia(m, w, h, 1)
    for (let i = 0; i < m.length; i++) out[i] = d[i] <= r ? 1 : 0
  } else {
    const d = distancia(m, w, h, 0)
    for (let i = 0; i < m.length; i++) out[i] = d[i] > -r ? 1 : 0
  }
  return out
}

// ---------------------------------------------------------------------
// Letrero completo
// ---------------------------------------------------------------------

export function hacerLetrero(fuente: Fuente, o: OpcionesLetrero): Letrero {
  const avisos: string[] = []
  const vacio: Letrero = { vector: { capas: [], ancho: 0, alto: 0, avisos }, problema: [], areaProblema: 0, ancho: 0, alto: 0, piezas: 0, avisos }
  if (!o.texto.trim()) {
    avisos.push("Escribe el texto del letrero.")
    return vacio
  }
  if (!(o.alto > 0)) {
    avisos.push("Escribe el alto de las letras.")
    return vacio
  }
  const t = textoACurvas(fuente, o)
  const b = limites(t.curvas)
  if (!b) {
    avisos.push("La tipografía no tiene esas letras.")
    return vacio
  }
  const figuras = [...t.curvas]
  if (o.barra > 0) {
    const y = t.baseFinal - o.barra / 2
    figuras.push(rectanguloRedondo(b.x0, y, b.x1, y + o.barra, 0))
  }
  const bb = limites(figuras)!
  // rejilla con orilla para la fresa
  const orilla = 2 + o.fresa * 2
  const anchoMM = bb.x1 - bb.x0 + 2 * orilla
  const altoMM = bb.y1 - bb.y0 + 2 * orilla
  const pxmm = Math.max(1, Math.min(20, 4000 / Math.max(anchoMM, altoMM), Math.sqrt(8e6 / (anchoMM * altoMM))))
  const g: Rejilla = {
    w: Math.ceil(anchoMM * pxmm),
    h: Math.ceil(altoMM * pxmm),
    x0: bb.x0 - orilla,
    y0: bb.y0 - orilla,
    pxmm,
    m: new Uint8Array(0),
  }
  g.m = new Uint8Array(g.w * g.h)
  rellenar(figuras, g)
  const aMM = (curvas: Curva[]): Curva[] => {
    const P = (p: Pt): Pt => [g.x0 + p[0] / pxmm, g.y0 + p[1] / pxmm]
    return curvas.map((c) => ({ ...c, inicio: P(c.inicio), tramos: c.tramos.map((q) => ("c1" in q ? { c1: P(q.c1), c2: P(q.c2), p: P(q.p) } : { p: P(q.p) })) }))
  }
  const texto = aMM(curvasDeMascara(g.m, g.w, g.h, { tolerancia: 0.6, manchas: 1, suave: true }))
  const piezas = contornos(g.m, g.w, g.h, 1).filter((l) => l.area > 0).length

  // revisión de la fresa
  let problema: Curva[] = []
  let areaProblema = 0
  if (o.fresa > 0) {
    const r = (o.fresa / 2) * pxmm
    let p: Uint8Array
    if (o.placa) {
      // grabado dentro de la placa: la fresa va por dentro de las letras
      const abierta = mover(mover(g.m, g.w, g.h, -r), g.w, g.h, r)
      p = new Uint8Array(g.m.length)
      for (let i = 0; i < p.length; i++) p[i] = g.m[i] && !abierta[i] ? 1 : 0
    } else {
      // letras recortadas: la fresa va por fuera y no entra en huecos angostos
      const cerrada = mover(mover(g.m, g.w, g.h, r), g.w, g.h, -r)
      p = new Uint8Array(g.m.length)
      for (let i = 0; i < p.length; i++) p[i] = cerrada[i] && !g.m[i] ? 1 : 0
    }
    let n = 0
    for (let i = 0; i < p.length; i++) n += p[i]
    areaProblema = n / (pxmm * pxmm)
    // las esquinas interiores siempre quedan con el radio de la fresa; solo se marca lo que pesa
    const minimo = Math.max((0.15 * pxmm) ** 2 + 2, 1.5 * r * r)
    problema = aMM(curvasDeMascara(p, g.w, g.h, { tolerancia: 0.8, manchas: minimo, suave: true }))
    if (problema.length) {
      avisos.push(
        o.placa
          ? `Con fresa de ${o.fresa} mm hay partes de las letras más angostas que la fresa (en rojo): no se van a grabar. Sube el alto de las letras o usa una fresa más delgada.`
          : `Con fresa de ${o.fresa} mm hay huecos y esquinas donde la fresa no entra (en rojo): ahí quedará material. Sube el alto de las letras o usa una fresa más delgada.`,
      )
    }
  }

  const capas: Vector["capas"] = []
  if (o.placa) {
    const tb = limites(texto)!
    const { margen, radio, barreno } = o.placa
    const x0 = tb.x0 - margen, y0 = tb.y0 - margen, x1 = tb.x1 + margen, y1 = tb.y1 + margen
    const placa: Curva[] = [rectanguloRedondo(x0, y0, x1, y1, radio)]
    if (barreno > 0) {
      if (margen < barreno + 4) avisos.push(`Para barrenos de ${barreno} mm deja un margen de al menos ${barreno + 4} mm.`)
      const cy = (y0 + y1) / 2
      placa.push(circulo(x0 + margen / 2, cy, barreno / 2), circulo(x1 - margen / 2, cy, barreno / 2))
    }
    capas.push({ color: "#1B1B18", nombre: "PLACA", curvas: placa })
    capas.push({ color: "#1F5FBF", nombre: "GRABADO", curvas: texto })
  } else {
    capas.push({ color: "#1B1B18", nombre: "CORTE", curvas: texto })
    if (piezas > 1 && t.renglones === 1 && !o.barra) avisos.push(`Salen ${piezas} piezas sueltas. Si lo quieres de una sola pieza, junta las letras (espaciado negativo) o activa la barra inferior.`)
  }
  const vector: Vector = { capas, ancho: 0, alto: 0, avisos }
  const c = caja(vector)
  vector.ancho = c.ancho
  vector.alto = c.alto
  return { vector, problema, areaProblema, ancho: c.ancho, alto: c.alto, piezas, avisos }
}

// Vista previa: madera para la placa, letras oscuras y en rojo lo que la fresa no alcanza
export function vistaLetrero(l: Letrero) {
  const c = caja(l.vector)
  if (!c.ancho) return ""
  const m = Math.max(c.ancho, c.alto) * 0.04
  const f = (x: number) => String(Math.round(x * 100) / 100)
  const d = (curvas: Curva[]) =>
    curvas
      .map((k) => `M${f(k.inicio[0])} ${f(k.inicio[1])}` + k.tramos.map((t) => ("c1" in t ? `C${f(t.c1[0])} ${f(t.c1[1])} ${f(t.c2[0])} ${f(t.c2[1])} ${f(t.p[0])} ${f(t.p[1])}` : `L${f(t.p[0])} ${f(t.p[1])}`)).join("") + "Z")
      .join("")
  const relleno: Record<string, string> = { PLACA: "#E9D6B8", GRABADO: "#142033", CORTE: "#142033" }
  const cuerpo = l.vector.capas
    .map((k) => `<path fill="${relleno[k.nombre] || k.color}" fill-rule="evenodd" ${k.nombre === "PLACA" ? `stroke="#8A6A45" stroke-width="${f(m * 0.08)}"` : ""} d="${d(k.curvas)}"/>`)
    .join("")
  const rojo = l.problema.length ? `<path fill="#E5484D" fill-opacity="0.85" fill-rule="evenodd" d="${d(l.problema)}"/>` : ""
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(c.x0 - m)} ${f(c.y0 - m)} ${f(c.ancho + 2 * m)} ${f(c.alto + 2 * m)}">${cuerpo}${rojo}</svg>`
}
