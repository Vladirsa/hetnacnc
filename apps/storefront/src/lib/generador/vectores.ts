// Lectura y escritura de dibujos 2D (DXF y SVG) en el navegador.
// Todo se convierte a trazos en milímetros con Y hacia arriba (como en CAD).
// Las curvas (arcos, círculos, splines, Bézier) se convierten en tramos rectos
// con un error máximo de TOL mm, que es lo que usan láser, plasma y router.

export type P = [number, number]
export type Trazo = { pts: P[]; cerrado: boolean; capa: string }
export type Dibujo = { trazos: Trazo[]; avisos: string[]; unidades: string }

const TOL = 0.02 // mm de error máximo al convertir curvas en tramos
const PI2 = Math.PI * 2

// número de tramos para un arco de radio r y ángulo a
const pasos = (r: number, a: number) => {
  if (!(r > 0)) return 1
  const t = Math.min(PI2, Math.abs(a))
  const d = 2 * Math.acos(Math.max(-1, Math.min(1, 1 - TOL / r)))
  return Math.max(2, Math.min(720, Math.ceil(t / (d || 0.1))))
}

function arco(cx: number, cy: number, r: number, a0: number, barrido: number): P[] {
  const n = pasos(r, barrido)
  const out: P[] = []
  for (let i = 0; i <= n; i++) {
    const a = a0 + (barrido * i) / n
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
  }
  return out
}

// tramo con "bulge" de DXF (arco entre dos vértices)
function bulge(a: P, b: P, g: number): P[] {
  if (!g) return [b]
  const th = 4 * Math.atan(g)
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const d = Math.hypot(dx, dy)
  if (d < 1e-12) return [b]
  const r = d / (2 * Math.sin(th / 2))
  const mx = (a[0] + b[0]) / 2
  const my = (a[1] + b[1]) / 2
  const h = r * Math.cos(th / 2) // distancia con signo del centro a la cuerda
  const cx = mx - (h * dy) / d
  const cy = my + (h * dx) / d
  const a0 = Math.atan2(a[1] - cy, a[0] - cx)
  return arco(cx, cy, Math.abs(r), a0, th).slice(1)
}

// ======================================================================
// DXF
// ======================================================================
type Ent = { tipo: string; c: [number, string][] }

const UNIDADES_DXF: Record<number, [number, string]> = {
  0: [1, "sin unidades (se toma mm)"],
  1: [25.4, "pulgadas"],
  2: [304.8, "pies"],
  4: [1, "mm"],
  5: [10, "cm"],
  6: [1000, "m"],
}

export function leerDXF(texto: string): Dibujo {
  const ls = texto.split(/\r?\n/)
  const pares: [number, string][] = []
  for (let i = 0; i + 1 < ls.length; i += 2) pares.push([parseInt(ls[i].trim(), 10), ls[i + 1].trim()])
  const avisos: string[] = []

  // unidades
  let ins = -1
  for (let i = 0; i < pares.length - 1; i++) {
    if (pares[i][0] === 9 && pares[i][1] === "$INSUNITS") { ins = parseInt(pares[i + 1][1], 10); break }
    if (pares[i][0] === 2 && pares[i][1] === "ENTITIES") break
  }
  const [esc, unidades] = UNIDADES_DXF[ins] || [1, "no indicadas (se toma mm)"]

  // secciones BLOCKS y ENTITIES
  const bloques = new Map<string, Ent[]>()
  const entidades: Ent[] = []
  let seccion = ""
  let bloqueAct: string | null = null
  let lista: Ent[] | null = null
  let act: Ent | null = null
  for (let i = 0; i < pares.length; i++) {
    const [c, v] = pares[i]
    if (c === 0 && v === "SECTION") { seccion = pares[i + 1]?.[1] || ""; i++; continue }
    if (c === 0 && v === "ENDSEC") { if (act) (seccion === "ENTITIES" ? entidades : lista)?.push(act); act = null; seccion = ""; continue }
    if (seccion === "BLOCKS") {
      if (c === 0 && v === "BLOCK") {
        act = null
        let j = i + 1
        let nombre = ""
        while (j < pares.length && pares[j][0] !== 0) { if (pares[j][0] === 2) nombre = pares[j][1]; j++ }
        bloqueAct = nombre
        lista = []
        i = j - 1
        continue
      }
      if (c === 0 && v === "ENDBLK") {
        if (act && lista) lista.push(act)
        if (bloqueAct !== null && lista) bloques.set(bloqueAct, lista)
        act = null; lista = null; bloqueAct = null
        continue
      }
    }
    if (seccion === "ENTITIES" || (seccion === "BLOCKS" && lista)) {
      const destino = seccion === "ENTITIES" ? entidades : lista!
      if (c === 0) {
        if (act) destino.push(act)
        act = { tipo: v, c: [] }
      } else if (act) act.c.push([c, v])
    }
  }

  const trazos: Trazo[] = []
  const ignorados: Record<string, number> = {}

  type M = [number, number, number, number, number, number] // a b c d e f: x' = a x + c y + e
  const aplicar = (m: M, p: P): P => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]]
  const componer = (m: M, n: M): M => [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
  ]
  const ID: M = [esc, 0, 0, esc, 0, 0]

  const procesar = (ents: Ent[], m: M, profundidad: number) => {
    for (let i = 0; i < ents.length; i++) {
      const e = ents[i]
      const val = (code: number, def = 0) => { const p = e.c.find((q) => q[0] === code); return p ? parseFloat(p[1]) : def }
      const capa = e.c.find((q) => q[0] === 8)?.[1] || "0"
      // sistema de coordenadas del objeto (espejo cuando la extrusión apunta a -Z)
      const espejo = val(230, 1) < 0
      const ocs = (p: P): P => (espejo ? [-p[0], p[1]] : p)
      const push = (pts: P[], cerrado: boolean) => {
        if (pts.length < 2) return
        trazos.push({ pts: pts.map((p) => aplicar(m, ocs(p))), cerrado, capa })
      }
      if (e.tipo === "LINE") {
        push([[val(10), val(20)], [val(11), val(21)]], false)
      } else if (e.tipo === "CIRCLE") {
        const pts = arco(val(10), val(20), val(40), 0, PI2)
        pts.pop()
        push(pts, true)
      } else if (e.tipo === "ARC") {
        const a0 = (val(50) * Math.PI) / 180
        let sw = (val(51) * Math.PI) / 180 - a0
        while (sw <= 0) sw += PI2
        push(arco(val(10), val(20), val(40), a0, sw), false)
      } else if (e.tipo === "LWPOLYLINE") {
        const vs: [number, number, number][] = []
        for (const [c, v] of e.c) {
          if (c === 10) vs.push([parseFloat(v), 0, 0])
          else if (c === 20 && vs.length) vs[vs.length - 1][1] = parseFloat(v)
          else if (c === 42 && vs.length) vs[vs.length - 1][2] = parseFloat(v)
        }
        push(...polilinea(vs, (val(70) & 1) === 1))
      } else if (e.tipo === "POLYLINE") {
        const flags = val(70)
        const vs: [number, number, number][] = []
        let j = i + 1
        while (j < ents.length && ents[j].tipo === "VERTEX") {
          const w = ents[j]
          const g = (code: number) => parseFloat(w.c.find((q) => q[0] === code)?.[1] || "0")
          if (!(g(70) & 16)) vs.push([g(10), g(20), g(42)]) // se omiten puntos de control de splines
          j++
        }
        i = ents[j]?.tipo === "SEQEND" ? j : j - 1 // salta los VERTEX y el SEQEND
        if (flags & (16 | 64)) { ignorados["MALLA 3D"] = (ignorados["MALLA 3D"] || 0) + 1; continue }
        push(...polilinea(vs, (flags & 1) === 1))
      } else if (e.tipo === "ELLIPSE") {
        const cx = val(10), cy = val(20)
        const mx = val(11), my = val(21)
        const a = Math.hypot(mx, my)
        const b = a * val(40, 1)
        const rot = Math.atan2(my, mx)
        const t0 = val(41, 0)
        let t1 = val(42, PI2)
        while (t1 <= t0) t1 += PI2
        const n = pasos(a, t1 - t0)
        const pts: P[] = []
        for (let k = 0; k <= n; k++) {
          const t = t0 + ((t1 - t0) * k) / n
          const x = a * Math.cos(t)
          const y = b * Math.sin(t)
          pts.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)])
        }
        const completa = Math.abs(t1 - t0 - PI2) < 1e-6
        if (completa) pts.pop()
        push(pts, completa)
      } else if (e.tipo === "SPLINE") {
        push(...spline(e))
      } else if (e.tipo === "INSERT") {
        const nombre = e.c.find((q) => q[0] === 2)?.[1] || ""
        const b = bloques.get(nombre)
        if (!b || profundidad > 8) { ignorados.INSERT = (ignorados.INSERT || 0) + 1; continue }
        const sx = val(41, 1), sy = val(42, 1)
        const r = (val(50) * Math.PI) / 180
        const cols = Math.max(1, val(70, 1)), filas = Math.max(1, val(71, 1))
        const dc = val(44), df = val(45)
        for (let fi = 0; fi < filas; fi++) {
          for (let co = 0; co < cols; co++) {
            const ox = val(10) + co * dc * Math.cos(r) - fi * df * Math.sin(r)
            const oy = val(20) + co * dc * Math.sin(r) + fi * df * Math.cos(r)
            const n: M = [Math.cos(r) * sx, Math.sin(r) * sx, -Math.sin(r) * sy, Math.cos(r) * sy, ox, oy]
            procesar(b, componer(m, n), profundidad + 1)
          }
        }
      } else if (!["VERTEX", "SEQEND", "ATTRIB", "ATTDEF", "POINT", "VIEWPORT"].includes(e.tipo)) {
        ignorados[e.tipo] = (ignorados[e.tipo] || 0) + 1
      }
    }
  }
  procesar(entidades, ID, 0)

  const ign = Object.entries(ignorados)
  if (ign.length) avisos.push(`Se omitieron objetos que no son líneas de corte: ${ign.map(([k, v]) => `${k} (${v})`).join(", ")}. Si son textos, conviértelos a curvas en tu programa de dibujo.`)
  if (!trazos.length) avisos.push("No encontré líneas en el archivo. Si es un DXF binario, vuelve a exportarlo como DXF de texto (ASCII).")
  if (ins < 1) avisos.push("El DXF no indica sus unidades: se tomó en milímetros. Revisa que el tamaño sea el correcto.")
  return { trazos, avisos, unidades }

  function polilinea(vs: [number, number, number][], cerrada: boolean): [P[], boolean] {
    if (!vs.length) return [[], cerrada]
    const pts: P[] = [[vs[0][0], vs[0][1]]]
    const n = vs.length
    for (let k = 0; k < (cerrada ? n : n - 1); k++) {
      const a: P = [vs[k][0], vs[k][1]]
      const b: P = [vs[(k + 1) % n][0], vs[(k + 1) % n][1]]
      pts.push(...bulge(a, b, vs[k][2]))
    }
    if (cerrada) pts.pop() // el último punto repite el primero
    return [pts, cerrada]
  }

  function spline(e: Ent): [P[], boolean] {
    const g = (code: number) => e.c.filter((q) => q[0] === code).map((q) => parseFloat(q[1]))
    const grado = g(71)[0] || 3
    const nudos = g(40)
    const cx = g(10), cy = g(20)
    const pesos = g(41)
    const cerrada = ((g(70)[0] || 0) & 1) === 1
    const ctrl: P[] = cx.map((x, k) => [x, cy[k] || 0])
    if (ctrl.length >= grado + 1 && nudos.length === ctrl.length + grado + 1) {
      const w = pesos.length === ctrl.length ? pesos : ctrl.map(() => 1)
      const t0 = nudos[grado]
      const t1 = nudos[ctrl.length]
      let largo = 0
      for (let k = 1; k < ctrl.length; k++) largo += Math.hypot(ctrl[k][0] - ctrl[k - 1][0], ctrl[k][1] - ctrl[k - 1][1])
      const n = Math.max(16, Math.min(2000, Math.ceil(largo / 0.5)))
      const pts: P[] = []
      for (let k = 0; k <= n; k++) pts.push(deBoor(t0 + ((t1 - t0) * k) / n, grado, nudos, ctrl, w))
      return [pts, cerrada]
    }
    const fx = g(11), fy = g(21)
    if (fx.length >= 2) return [fx.map((x, k) => [x, fy[k] || 0] as P), cerrada]
    return [ctrl, cerrada]
  }
}

function deBoor(t: number, p: number, U: number[], C: P[], W: number[]): P {
  const n = C.length - 1
  let k = p
  while (k < n && t >= U[k + 1]) k++
  const d = [] as [number, number, number][]
  for (let j = 0; j <= p; j++) {
    const i = k - p + j
    d.push([C[i][0] * W[i], C[i][1] * W[i], W[i]])
  }
  for (let r = 1; r <= p; r++) {
    for (let j = p; j >= r; j--) {
      const i = k - p + j
      const den = U[i + p - r + 1] - U[i]
      const a = den ? (t - U[i]) / den : 0
      d[j] = [(1 - a) * d[j - 1][0] + a * d[j][0], (1 - a) * d[j - 1][1] + a * d[j][1], (1 - a) * d[j - 1][2] + a * d[j][2]]
    }
  }
  return [d[p][0] / d[p][2], d[p][1] / d[p][2]]
}

// ======================================================================
// SVG
// ======================================================================
type Mat = [number, number, number, number, number, number] // a b c d e f
const MI: Mat = [1, 0, 0, 1, 0, 0]
const mult = (m: Mat, n: Mat): Mat => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
]
const ap = (m: Mat, p: P): P => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]]

function transformar(t: string | null): Mat {
  let m = MI
  if (!t) return m
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g
  let x: RegExpExecArray | null
  while ((x = re.exec(t))) {
    const v = (x[2].match(/[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/gi) || []).map(Number)
    let n: Mat = MI
    if (x[1] === "matrix" && v.length >= 6) n = [v[0], v[1], v[2], v[3], v[4], v[5]]
    else if (x[1] === "translate") n = [1, 0, 0, 1, v[0] || 0, v[1] || 0]
    else if (x[1] === "scale") n = [v[0] ?? 1, 0, 0, v[1] ?? v[0] ?? 1, 0, 0]
    else if (x[1] === "rotate") {
      const a = ((v[0] || 0) * Math.PI) / 180
      const c = Math.cos(a), s = Math.sin(a)
      const r: Mat = [c, s, -s, c, 0, 0]
      n = v.length >= 3 ? mult(mult([1, 0, 0, 1, v[1], v[2]], r), [1, 0, 0, 1, -v[1], -v[2]]) : r
    } else if (x[1] === "skewX") n = [1, 0, Math.tan(((v[0] || 0) * Math.PI) / 180), 1, 0, 0]
    else if (x[1] === "skewY") n = [1, Math.tan(((v[0] || 0) * Math.PI) / 180), 0, 1, 0, 0]
    m = mult(m, n)
  }
  return m
}

// convierte "210mm", "8.5in", "300" (px) a mm
function aMm(s: string | null): number | null {
  if (!s) return null
  const m = s.trim().match(/^([-+]?[\d.]+(?:e[-+]?\d+)?)\s*(mm|cm|in|pt|pc|px)?$/i)
  if (!m) return null
  const v = parseFloat(m[1])
  const u = (m[2] || "px").toLowerCase()
  return v * ({ mm: 1, cm: 10, in: 25.4, pt: 25.4 / 72, pc: 25.4 / 6, px: 25.4 / 96 } as Record<string, number>)[u]
}

// divide el atributo "d" de un <path> en subtrazos (en unidades del SVG)
export function trazosDePath(d: string): { pts: P[]; cerrado: boolean }[] {
  const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) || []
  const out: { pts: P[]; cerrado: boolean }[] = []
  let i = 0
  let cmd = ""
  let cur: P = [0, 0]
  let ini: P = [0, 0]
  let ctrl: P | null = null // último punto de control (para S y T)
  let ctrlTipo = ""
  let pts: P[] = []
  const num = () => parseFloat(tokens[i++])
  const hayNum = () => i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i])
  const cerrar = (c: boolean) => {
    if (pts.length > 1) out.push({ pts, cerrado: c })
    pts = []
  }
  const cubica = (p0: P, p1: P, p2: P, p3: P) => {
    const largo = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) + Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) + Math.hypot(p3[0] - p2[0], p3[1] - p2[1])
    const n = Math.max(4, Math.min(200, Math.ceil(Math.sqrt(largo / TOL) / 2)))
    for (let k = 1; k <= n; k++) {
      const t = k / n, u = 1 - t
      pts.push([
        u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
        u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
      ])
    }
  }
  while (i < tokens.length) {
    if (/^[a-zA-Z]$/.test(tokens[i])) cmd = tokens[i++]
    else if (!cmd) { i++; continue }
    const rel = cmd === cmd.toLowerCase()
    const C = cmd.toUpperCase()
    const base = (p: P): P => (rel ? [cur[0] + p[0], cur[1] + p[1]] : p)
    if (C === "Z") {
      cerrar(true)
      cur = ini
      ctrl = null
      continue
    }
    if (!hayNum()) { if (C !== "Z") cmd = ""; continue }
    if (C === "M") {
      cerrar(false)
      cur = base([num(), num()])
      ini = cur
      pts = [cur]
      cmd = rel ? "l" : "L" // pares siguientes son líneas
      ctrl = null
      continue
    }
    if (!pts.length) pts = [cur]
    if (C === "L") { cur = base([num(), num()]); pts.push(cur); ctrl = null }
    else if (C === "H") { const x = num(); cur = [rel ? cur[0] + x : x, cur[1]]; pts.push(cur); ctrl = null }
    else if (C === "V") { const y = num(); cur = [cur[0], rel ? cur[1] + y : y]; pts.push(cur); ctrl = null }
    else if (C === "C" || C === "S") {
      let p1: P
      if (C === "C") p1 = base([num(), num()])
      else p1 = ctrl && ctrlTipo === "C" ? [2 * cur[0] - ctrl[0], 2 * cur[1] - ctrl[1]] : cur
      const p2 = base([num(), num()])
      const p3 = base([num(), num()])
      cubica(cur, p1, p2, p3)
      ctrl = p2; ctrlTipo = "C"; cur = p3
    } else if (C === "Q" || C === "T") {
      let q: P
      if (C === "Q") q = base([num(), num()])
      else q = ctrl && ctrlTipo === "Q" ? [2 * cur[0] - ctrl[0], 2 * cur[1] - ctrl[1]] : cur
      const p3 = base([num(), num()])
      cubica(cur, [cur[0] + (2 / 3) * (q[0] - cur[0]), cur[1] + (2 / 3) * (q[1] - cur[1])], [p3[0] + (2 / 3) * (q[0] - p3[0]), p3[1] + (2 / 3) * (q[1] - p3[1])], p3)
      ctrl = q; ctrlTipo = "Q"; cur = p3
    } else if (C === "A") {
      const rx = Math.abs(num()), ry = Math.abs(num()), rotG = num()
      const grande = num() !== 0, barre = num() !== 0
      const fin = base([num(), num()])
      pts.push(...arcoSVG(cur, fin, rx, ry, rotG, grande, barre))
      cur = fin
      ctrl = null
    } else i++
  }
  cerrar(false)
  return out
}

// arco elíptico de SVG (de punto final a centro, W3C SVG 1.1 anexo F.6)
function arcoSVG(p0: P, p1: P, rx: number, ry: number, rotG: number, grande: boolean, barre: boolean): P[] {
  if (!rx || !ry) return [p1]
  const phi = (rotG * Math.PI) / 180
  const cf = Math.cos(phi), sf = Math.sin(phi)
  const dx = (p0[0] - p1[0]) / 2, dy = (p0[1] - p1[1]) / 2
  const x1 = cf * dx + sf * dy, y1 = -sf * dx + cf * dy
  const lam = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry)
  if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam) }
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1
  const den = rx * rx * y1 * y1 + ry * ry * x1 * x1
  let co = Math.sqrt(Math.max(0, num / den))
  if (grande === barre) co = -co
  const cxp = (co * rx * y1) / ry, cyp = (-co * ry * x1) / rx
  const cx = cf * cxp - sf * cyp + (p0[0] + p1[0]) / 2
  const cy = sf * cxp + cf * cyp + (p0[1] + p1[1]) / 2
  const ang = (ux: number, uy: number, vx: number, vy: number) => {
    const a = Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy)))))
    return ux * vy - uy * vx < 0 ? -a : a
  }
  const t1 = ang(1, 0, (x1 - cxp) / rx, (y1 - cyp) / ry)
  let dt = ang((x1 - cxp) / rx, (y1 - cyp) / ry, (-x1 - cxp) / rx, (-y1 - cyp) / ry)
  if (!barre && dt > 0) dt -= PI2
  if (barre && dt < 0) dt += PI2
  const n = pasos(Math.max(rx, ry), dt)
  const out: P[] = []
  for (let k = 1; k <= n; k++) {
    const t = t1 + (dt * k) / n
    const x = rx * Math.cos(t), y = ry * Math.sin(t)
    out.push([cf * x - sf * y + cx, sf * x + cf * y + cy])
  }
  out[out.length - 1] = p1
  return out
}

// El SVG se lee con el DOMParser del navegador (se puede pasar otro en pruebas)
export function leerSVG(texto: string, parser: { parseFromString(s: string, t: string): any } = new DOMParser()): Dibujo {
  const doc = parser.parseFromString(texto, "image/svg+xml")
  const svg = doc.getElementsByTagName("svg")[0]
  const avisos: string[] = []
  if (!svg) return { trazos: [], avisos: ["No es un archivo SVG válido."], unidades: "" }

  // escala: unidades del SVG -> mm
  const vb = (svg.getAttribute("viewBox") || "").trim().split(/[\s,]+/).map(Number)
  const wmm = aMm(svg.getAttribute("width"))
  const hmm = aMm(svg.getAttribute("height"))
  let sx = 25.4 / 96
  let sy = 25.4 / 96
  let ox = 0, oy = 0
  let unidades = "px a 96 ppp"
  if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) {
    ox = vb[0]; oy = vb[1]
    if (wmm && hmm) { sx = wmm / vb[2]; sy = hmm / vb[3]; unidades = `${svg.getAttribute("width")} × ${svg.getAttribute("height")}` }
    else if (wmm) { sx = sy = wmm / vb[2]; unidades = `ancho ${svg.getAttribute("width")}` }
  } else if (!svg.getAttribute("width")) avisos.push("El SVG no indica su tamaño real: se tomó a 96 ppp (como Inkscape). Revisa las medidas.")
  const raiz: Mat = [sx, 0, 0, sy, -ox * sx, -oy * sy]

  const trazos: Trazo[] = []
  const ignorados: Record<string, number> = {}
  const atr = (el: any, n: string, def = 0) => { const v = parseFloat(el.getAttribute(n) || ""); return Number.isFinite(v) ? v : def }

  const visitar = (el: any, m: Mat, capa: string) => {
    const tag = (el.localName || el.nodeName || "").replace(/^svg:/, "")
    if (["defs", "clipPath", "mask", "metadata", "title", "desc", "style", "symbol", "marker", "pattern", "linearGradient", "radialGradient"].includes(tag)) return
    if ((el.getAttribute?.("display") || "") === "none") return
    const mm = mult(m, transformar(el.getAttribute?.("transform")))
    const capaAct = el.getAttribute?.("inkscape:label") || el.getAttribute?.("id") || capa
    const agregar = (lista: { pts: P[]; cerrado: boolean }[]) => {
      for (const t of lista) if (t.pts.length > 1) trazos.push({ pts: t.pts.map((p) => ap(mm, p)), cerrado: t.cerrado, capa: tag === "g" ? capaAct : capa })
    }
    if (tag === "g" || tag === "svg" || tag === "a") {
      for (const h of Array.from(el.childNodes || []) as any[]) if (h.nodeType === 1) visitar(h, mm, tag === "g" ? capaAct : capa)
      return
    }
    if (tag === "path") agregar(trazosDePath(el.getAttribute("d") || ""))
    else if (tag === "rect") {
      const x = atr(el, "x"), y = atr(el, "y"), w = atr(el, "width"), h = atr(el, "height")
      let rx = atr(el, "rx", NaN), ry = atr(el, "ry", NaN)
      if (!Number.isFinite(rx)) rx = Number.isFinite(ry) ? ry : 0
      if (!Number.isFinite(ry)) ry = rx
      rx = Math.min(rx, w / 2); ry = Math.min(ry, h / 2)
      if (w > 0 && h > 0) {
        const d = rx > 0 && ry > 0
          ? `M${x + rx} ${y}H${x + w - rx}A${rx} ${ry} 0 0 1 ${x + w} ${y + ry}V${y + h - ry}A${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}H${x + rx}A${rx} ${ry} 0 0 1 ${x} ${y + h - ry}V${y + ry}A${rx} ${ry} 0 0 1 ${x + rx} ${y}Z`
          : `M${x} ${y}H${x + w}V${y + h}H${x}Z`
        agregar(trazosDePath(d))
      }
    } else if (tag === "circle" || tag === "ellipse") {
      const cx = atr(el, "cx"), cy = atr(el, "cy")
      const rx = tag === "circle" ? atr(el, "r") : atr(el, "rx")
      const ry = tag === "circle" ? rx : atr(el, "ry")
      if (rx > 0 && ry > 0) agregar(trazosDePath(`M${cx + rx} ${cy}A${rx} ${ry} 0 1 1 ${cx - rx} ${cy}A${rx} ${ry} 0 1 1 ${cx + rx} ${cy}Z`))
    } else if (tag === "line") {
      agregar([{ pts: [[atr(el, "x1"), atr(el, "y1")], [atr(el, "x2"), atr(el, "y2")]], cerrado: false }])
    } else if (tag === "polyline" || tag === "polygon") {
      const v = (el.getAttribute("points") || "").match(/[-+]?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/gi)?.map(Number) || []
      const pts: P[] = []
      for (let k = 0; k + 1 < v.length; k += 2) pts.push([v[k], v[k + 1]])
      agregar([{ pts, cerrado: tag === "polygon" }])
    } else if (tag) ignorados[tag] = (ignorados[tag] || 0) + 1
  }
  visitar(svg, raiz, "0")

  // quitar el punto final repetido de los cerrados
  for (const t of trazos) {
    const a = t.pts[0], b = t.pts[t.pts.length - 1]
    if (t.cerrado && t.pts.length > 2 && Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-9) t.pts.pop()
  }
  // SVG tiene Y hacia abajo; en CAD es hacia arriba
  for (const t of trazos) for (const p of t.pts) p[1] = -p[1]

  const ign = Object.entries(ignorados).filter(([k]) => k !== "#text")
  if (ign.length) avisos.push(`Se omitieron elementos que no son líneas: ${ign.map(([k, v]) => `${k} (${v})`).join(", ")}. Si hay textos, conviértelos a trayectos (Objeto a trayecto) antes de subirlo.`)
  if (!trazos.length) avisos.push("No encontré líneas en el SVG.")
  return { trazos, avisos, unidades }
}

// ======================================================================
// Utilidades
// ======================================================================
export function medidas(d: Dibujo) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  let largo = 0
  for (const t of d.trazos) {
    const n = t.pts.length
    for (let i = 0; i < n; i++) {
      const [x, y] = t.pts[i]
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
      if (i < n - 1 || t.cerrado) {
        const q = t.pts[(i + 1) % n]
        largo += Math.hypot(q[0] - x, q[1] - y)
      }
    }
  }
  const ok = Number.isFinite(x0)
  return {
    x0: ok ? x0 : 0, y0: ok ? y0 : 0,
    ancho: ok ? x1 - x0 : 0, alto: ok ? y1 - y0 : 0,
    largo,
    cerrados: d.trazos.filter((t) => t.cerrado).length,
    abiertos: d.trazos.filter((t) => !t.cerrado).length,
  }
}

// escala desde la esquina inferior izquierda y deja el dibujo en (0,0)
export function escalar(d: Dibujo, k: number): Dibujo {
  const m = medidas(d)
  return {
    ...d,
    trazos: d.trazos.map((t) => ({ ...t, pts: t.pts.map(([x, y]) => [(x - m.x0) * k, (y - m.y0) * k] as P) })),
  }
}

// une líneas y arcos sueltos que se tocan en sus puntas (tolerancia en mm)
export function unir(d: Dibujo, tol = 0.01): Dibujo {
  const cerrados = d.trazos.filter((t) => t.cerrado)
  let abiertos = d.trazos.filter((t) => !t.cerrado).map((t) => ({ ...t, pts: [...t.pts] }))
  const cerca = (a: P, b: P) => Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol
  const clave = (p: P) => `${Math.round(p[0] / (tol * 2))},${Math.round(p[1] / (tol * 2))}`
  const salida: Trazo[] = []
  const usados = new Set<number>()
  // índice de puntas por celda
  const indice = new Map<string, number[]>()
  const idx = (p: P, i: number) => {
    for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) {
      const [a, b] = clave(p).split(",").map(Number)
      const k = `${a + dx},${b + dy}`
      const l = indice.get(k) || []
      l.push(i)
      indice.set(k, l)
    }
  }
  abiertos.forEach((t, i) => { idx(t.pts[0], i); idx(t.pts[t.pts.length - 1], i) })
  const buscar = (p: P, excepto: number): [number, boolean] | null => {
    for (const j of indice.get(clave(p)) || []) {
      if (usados.has(j) || j === excepto) continue
      const t = abiertos[j]
      if (cerca(t.pts[0], p)) return [j, false]
      if (cerca(t.pts[t.pts.length - 1], p)) return [j, true]
    }
    return null
  }
  for (let i = 0; i < abiertos.length; i++) {
    if (usados.has(i)) continue
    usados.add(i)
    let pts = [...abiertos[i].pts]
    // extender hacia adelante y hacia atrás
    for (let lado = 0; lado < 2; lado++) {
      for (;;) {
        const r = buscar(pts[pts.length - 1], i)
        if (!r) break
        const [j, invertido] = r
        usados.add(j)
        const q = invertido ? [...abiertos[j].pts].reverse() : abiertos[j].pts
        pts = pts.concat(q.slice(1))
      }
      pts.reverse()
    }
    const cerrado = pts.length > 2 && cerca(pts[0], pts[pts.length - 1])
    if (cerrado) pts.pop()
    salida.push({ pts, cerrado, capa: abiertos[i].capa })
  }
  abiertos = []
  return { ...d, trazos: [...cerrados, ...salida] }
}

const f = (x: number) => String(Math.round(x * 1000) / 1000)

export function dibujoSVG(d: Dibujo, modo: "corte" | "vista" = "corte") {
  const m = medidas(d)
  const mar = 2
  const W = m.ancho + 2 * mar
  const H = m.alto + 2 * mar
  const X = (x: number) => f(x - m.x0 + mar)
  const Y = (y: number) => f(H - mar - (y - m.y0))
  const estilo = modo === "vista"
    ? `fill="none" stroke="#C2560A" stroke-width="1.3" vector-effect="non-scaling-stroke"`
    : `fill="none" stroke="#FF0000" stroke-width="0.1"`
  const abierto = modo === "vista" ? `fill="none" stroke="#1F5FBF" stroke-width="1.3" vector-effect="non-scaling-stroke"` : estilo
  const cuerpo = d.trazos
    .map((t) => `<path d="${t.pts.map(([x, y], i) => `${i ? "L" : "M"}${X(x)} ${Y(y)}`).join(" ")}${t.cerrado ? " Z" : ""}" ${t.cerrado ? estilo : abierto}/>`)
    .join("\n")
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${f(W)}mm" height="${f(H)}mm" viewBox="0 0 ${f(W)} ${f(H)}">\n${cuerpo}\n</svg>\n`
}

// DXF R12 con una capa por cada capa original
export function dibujoDXF(d: Dibujo) {
  const m = medidas(d)
  const l: string[] = []
  const par = (c: number | string, v: number | string) => l.push(String(c), String(v))
  const limpiarCapa = (s: string) => (s || "0").replace(/[<>/\\":;?*|=`,]/g, "_").slice(0, 60) || "0"
  const capas = [...new Set(d.trazos.map((t) => limpiarCapa(t.capa)))]
  par(0, "SECTION"); par(2, "HEADER"); par(9, "$ACADVER"); par(1, "AC1009"); par(9, "$INSUNITS"); par(70, 4); par(0, "ENDSEC")
  par(0, "SECTION"); par(2, "TABLES"); par(0, "TABLE"); par(2, "LAYER"); par(70, capas.length)
  for (const c of capas) { par(0, "LAYER"); par(2, c); par(70, 0); par(62, 7); par(6, "CONTINUOUS") }
  par(0, "ENDTAB"); par(0, "ENDSEC")
  par(0, "SECTION"); par(2, "ENTITIES")
  for (const t of d.trazos) {
    const capa = limpiarCapa(t.capa)
    par(0, "POLYLINE"); par(8, capa); par(66, 1); par(10, 0); par(20, 0); par(30, 0); par(70, t.cerrado ? 1 : 0)
    for (const [x, y] of t.pts) { par(0, "VERTEX"); par(8, capa); par(10, f(x - m.x0)); par(20, f(y - m.y0)); par(30, 0) }
    par(0, "SEQEND"); par(8, capa)
  }
  par(0, "ENDSEC"); par(0, "EOF")
  return l.join("\n") + "\n"
}

// ======================================================================
// STL <-> OBJ (sin vista previa, solo conversión)
// ======================================================================
export type Malla = { tris: number[]; avisos: string[] } // 9 números por triángulo

export function leerSTL(buf: ArrayBuffer): Malla {
  const dv = new DataView(buf)
  const n = buf.byteLength >= 84 ? dv.getUint32(80, true) : 0
  const tris: number[] = []
  if (buf.byteLength === 84 + n * 50) {
    for (let i = 0; i < n; i++) {
      const o = 84 + i * 50 + 12
      for (let k = 0; k < 9; k++) tris.push(dv.getFloat32(o + k * 4, true))
    }
  } else {
    const t = new TextDecoder().decode(buf)
    const re = /vertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(t))) tris.push(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]))
    tris.length -= tris.length % 9
  }
  return { tris, avisos: tris.length ? [] : ["No encontré triángulos en el STL."] }
}

export function leerOBJ(texto: string): Malla {
  const v: number[][] = []
  const tris: number[] = []
  for (const linea of texto.split(/\r?\n/)) {
    const p = linea.trim().split(/\s+/)
    if (p[0] === "v") v.push([+p[1], +p[2], +p[3]])
    else if (p[0] === "f") {
      const ids = p.slice(1).map((s) => { const k = parseInt(s.split("/")[0], 10); return k < 0 ? v.length + k : k - 1 })
      for (let k = 1; k + 1 < ids.length; k++) for (const j of [ids[0], ids[k], ids[k + 1]]) tris.push(...(v[j] || [0, 0, 0]))
    }
  }
  return { tris, avisos: tris.length ? [] : ["No encontré caras en el OBJ."] }
}

export function mallaSTL(m: Malla): ArrayBuffer {
  const n = m.tris.length / 9
  const buf = new ArrayBuffer(84 + n * 50)
  const dv = new DataView(buf)
  const cab = "HETNA CNC - hetnacnc.com"
  for (let i = 0; i < cab.length; i++) dv.setUint8(i, cab.charCodeAt(i))
  dv.setUint32(80, n, true)
  for (let i = 0; i < n; i++) {
    const t = m.tris.slice(i * 9, i * 9 + 9)
    const ux = t[3] - t[0], uy = t[4] - t[1], uz = t[5] - t[2]
    const vx = t[6] - t[0], vy = t[7] - t[1], vz = t[8] - t[2]
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
    const L = Math.hypot(nx, ny, nz) || 1
    nx /= L; ny /= L; nz /= L
    const o = 84 + i * 50
    ;[nx, ny, nz, ...t].forEach((x, k) => dv.setFloat32(o + k * 4, x, true))
  }
  return buf
}

export function mallaOBJ(m: Malla): string {
  // une vértices repetidos para que el OBJ sea más ligero
  const mapa = new Map<string, number>()
  const vs: string[] = []
  const caras: string[] = []
  for (let i = 0; i < m.tris.length; i += 9) {
    const ids: number[] = []
    for (let k = 0; k < 3; k++) {
      const x = m.tris[i + k * 3], y = m.tris[i + k * 3 + 1], z = m.tris[i + k * 3 + 2]
      const key = `${f(x)} ${f(y)} ${f(z)}`
      let id = mapa.get(key)
      if (!id) { vs.push(`v ${key}`); id = vs.length; mapa.set(key, id) }
      ids.push(id)
    }
    caras.push(`f ${ids.join(" ")}`)
  }
  return `# HETNA CNC - hetnacnc.com\n${vs.join("\n")}\n${caras.join("\n")}\n`
}

export function medidasMalla(m: Malla) {
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity
  for (let i = 0; i < m.tris.length; i += 3) {
    const [x, y, z] = [m.tris[i], m.tris[i + 1], m.tris[i + 2]]
    x0 = Math.min(x0, x); x1 = Math.max(x1, x)
    y0 = Math.min(y0, y); y1 = Math.max(y1, y)
    z0 = Math.min(z0, z); z1 = Math.max(z1, z)
  }
  const ok = Number.isFinite(x0)
  return { x: ok ? x1 - x0 : 0, y: ok ? y1 - y0 : 0, z: ok ? z1 - z0 : 0, triangulos: m.tris.length / 9 }
}

export function escalarMalla(m: Malla, k: number): Malla {
  return { ...m, tris: m.tris.map((x) => x * k) }
}
