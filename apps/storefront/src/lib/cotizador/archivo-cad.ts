// Lectura de archivos CAD en el navegador para el cotizador en línea de los
// talleres (hetnacnc.com/t/<slug>). Saca lo que necesita el precio estimado:
//   2D (DXF, SVG): largo × ancho, largo total de corte, contornos y perforaciones
//   3D (STL, OBJ): largo × ancho × alto y volumen real
// y un dibujo simplificado para la vista previa. Es el mismo criterio que
// lib/services/archivo_cad_service.dart de la app (perforaciones = contornos
// cerrados circulares, sin contar el exterior).
// Todo en milímetros.

export type Trazo = [number, number][]
export type GeoCad = {
  tipo: "2d" | "3d"
  largo: number
  ancho: number
  alto: number
  corte_mm: number
  contornos: number
  perforaciones: number
  volumen_cm3: number
  trazos: Trazo[] // 2D: contornos; 3D: silueta vista de arriba (aristas del contorno)
  avisos: string[]
}

const MAX_TRAZOS_DIBUJO = 4000

// ── utilidades ──────────────────────────────────────────────────────────
const dist = (a: [number, number], b: [number, number]) => Math.hypot(b[0] - a[0], b[1] - a[1])
const largoTrazo = (t: Trazo) => t.reduce((s, p, i) => (i ? s + dist(t[i - 1], p) : 0), 0)
const cerrado = (t: Trazo) => t.length > 2 && dist(t[0], t[t.length - 1]) < 0.05
function areaPoligono(t: Trazo) {
  let a = 0
  for (let i = 0; i < t.length; i++) {
    const [x1, y1] = t[i]
    const [x2, y2] = t[(i + 1) % t.length]
    a += x1 * y2 - x2 * y1
  }
  return Math.abs(a) / 2
}
function esCirculo(t: Trazo) {
  if (!cerrado(t) || t.length < 8) return false
  const pts = t.slice(0, -1) // el último repite al primero; contarlo dos veces mueve el centro
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length
  const radios = pts.map((p) => Math.hypot(p[0] - cx, p[1] - cy))
  const r = radios.reduce((s, x) => s + x, 0) / radios.length
  return r > 0 && radios.every((x) => Math.abs(x - r) / r < 0.04)
}

/** Une segmentos sueltos (LINE de DXF) que comparten extremos en trazos. */
function unirSegmentos(segs: Trazo[]): Trazo[] {
  const tol = 0.01
  const llave = (p: [number, number]) => `${Math.round(p[0] / tol)}|${Math.round(p[1] / tol)}`
  const pendientes = segs.slice()
  const resultado: Trazo[] = []
  const porPunto = new Map<string, number[]>()
  pendientes.forEach((s, i) => {
    for (const p of [s[0], s[s.length - 1]]) {
      const k = llave(p)
      porPunto.set(k, [...(porPunto.get(k) || []), i])
    }
  })
  const usado = new Set<number>()
  for (let i = 0; i < pendientes.length; i++) {
    if (usado.has(i)) continue
    usado.add(i)
    let t = pendientes[i].slice()
    let crecio = true
    while (crecio && t.length < 20000) {
      crecio = false
      const fin = t[t.length - 1]
      const cands = porPunto.get(llave(fin)) || []
      for (const j of cands) {
        if (usado.has(j)) continue
        const s = pendientes[j]
        if (dist(s[0], fin) < tol * 2) t = t.concat(s.slice(1))
        else if (dist(s[s.length - 1], fin) < tol * 2) t = t.concat(s.slice(0, -1).reverse())
        else continue
        usado.add(j)
        crecio = true
        break
      }
    }
    resultado.push(t)
  }
  return resultado
}

function resumen2d(trazos: Trazo[], avisos: string[]): GeoCad {
  trazos = trazos.filter((t) => t.length >= 2)
  if (!trazos.length) throw new Error("No encontramos dibujo en el archivo.")
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const t of trazos)
    for (const [x, y] of t) {
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  let corte = 0, cerrados = 0, circ = 0, areaMax = 0
  for (const t of trazos) {
    corte += largoTrazo(t)
    if (cerrado(t)) {
      cerrados++
      if (esCirculo(t)) circ++
      areaMax = Math.max(areaMax, areaPoligono(t))
    }
  }
  let perforaciones = circ
  if (cerrados > 1 && circ === cerrados) perforaciones = cerrados - 1
  else if (cerrados > 1 && circ > 0 && trazos.some((t) => cerrado(t) && esCirculo(t) && areaPoligono(t) === areaMax)) perforaciones = circ - 1
  const largo = maxX - minX
  const ancho = maxY - minY
  if (!(largo > 0 && ancho > 0)) throw new Error("El dibujo no tiene medidas.")
  return {
    tipo: "2d",
    largo,
    ancho,
    alto: 0,
    corte_mm: corte,
    contornos: cerrados,
    perforaciones: Math.max(0, perforaciones),
    volumen_cm3: 0,
    trazos: decimar(trazos.map((t) => t.map(([x, y]) => [x - minX, y - minY] as [number, number]))),
    avisos,
  }
}

function decimar(trazos: Trazo[]): Trazo[] {
  const total = trazos.reduce((s, t) => s + t.length, 0)
  if (total <= MAX_TRAZOS_DIBUJO) return trazos
  const paso = Math.ceil(total / MAX_TRAZOS_DIBUJO)
  return trazos.map((t) => (t.length <= 4 ? t : t.filter((_, i) => i % paso === 0 || i === t.length - 1)))
}

// ── DXF ─────────────────────────────────────────────────────────────────
const UNIDADES_DXF: Record<number, number> = { 1: 25.4, 2: 304.8, 4: 1, 5: 10, 6: 1000 }

function arco(cx: number, cy: number, r: number, a0: number, a1: number): Trazo {
  // Ángulos en grados, sentido antihorario
  let fin = a1
  while (fin <= a0) fin += 360
  const pasos = Math.max(8, Math.min(180, Math.ceil(((fin - a0) / 360) * 72)))
  const t: Trazo = []
  for (let i = 0; i <= pasos; i++) {
    const a = ((a0 + ((fin - a0) * i) / pasos) * Math.PI) / 180
    t.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
  }
  return t
}

/** Polilínea con "bulge" (arcos entre vértices). */
function polilinea(v: { x: number; y: number; b: number }[], cerrar: boolean): Trazo {
  const pts: Trazo = []
  const n = v.length
  const tramos = cerrar ? n : n - 1
  for (let i = 0; i < tramos; i++) {
    const a = v[i]
    const b = v[(i + 1) % n]
    if (!pts.length) pts.push([a.x, a.y])
    if (Math.abs(a.b) > 1e-9) {
      const ang = 4 * Math.atan(a.b)
      const d = Math.hypot(b.x - a.x, b.y - a.y)
      const r = d / (2 * Math.sin(Math.abs(ang) / 2))
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
      const h = Math.sqrt(Math.max(0, r * r - (d / 2) ** 2)) * Math.sign(a.b) * (Math.abs(ang) > Math.PI ? -1 : 1)
      const ux = (b.x - a.x) / d, uy = (b.y - a.y) / d
      const cx = mx - uy * h, cy = my + ux * h
      const t0 = Math.atan2(a.y - cy, a.x - cx)
      const pasos = Math.max(4, Math.ceil((Math.abs(ang) / (2 * Math.PI)) * 48))
      for (let k = 1; k <= pasos; k++) {
        const t = t0 + (ang * k) / pasos
        pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)])
      }
    } else {
      pts.push([b.x, b.y])
    }
  }
  return pts
}

export function leerDxf(texto: string): GeoCad {
  const lineas = texto.split(/\r?\n/)
  const pares: [number, string][] = []
  for (let i = 0; i + 1 < lineas.length; i += 2) pares.push([parseInt(lineas[i].trim(), 10), lineas[i + 1].trim()])
  const avisos: string[] = []

  // Unidades del encabezado
  let escala = 1
  const iu = pares.findIndex(([c, v]) => c === 9 && v === "$INSUNITS")
  if (iu >= 0 && pares[iu + 1]?.[0] === 70) {
    const u = parseInt(pares[iu + 1][1], 10)
    if (UNIDADES_DXF[u]) escala = UNIDADES_DXF[u]
    else if (u === 0) avisos.push("El archivo no dice sus unidades; lo tomamos en milímetros.")
  }

  // Sólo la sección ENTITIES (los BLOCKS se ignoran para no contar dos veces)
  const ini = pares.findIndex(([c, v], i) => c === 2 && v === "ENTITIES" && pares[i - 1]?.[1] === "SECTION")
  const lista = ini >= 0 ? pares.slice(ini + 1) : pares
  const sueltos: Trazo[] = []
  const trazos: Trazo[] = []
  let i = 0
  const leerEntidad = () => {
    const tipo = lista[i][1]
    const datos: [number, string][] = []
    i++
    while (i < lista.length && lista[i][0] !== 0) datos.push(lista[i++])
    return { tipo, datos }
  }
  const num = (d: [number, string][], c: number, def = 0) => {
    const p = d.find((x) => x[0] === c)
    return p ? parseFloat(p[1]) : def
  }
  let poli: { x: number; y: number; b: number }[] | null = null
  let poliCerrada = false
  while (i < lista.length) {
    if (lista[i][0] !== 0) {
      i++
      continue
    }
    if (lista[i][1] === "ENDSEC") break
    const { tipo, datos } = leerEntidad()
    switch (tipo) {
      case "LINE":
        sueltos.push([
          [num(datos, 10), num(datos, 20)],
          [num(datos, 11), num(datos, 21)],
        ])
        break
      case "CIRCLE": {
        const t = arco(num(datos, 10), num(datos, 20), num(datos, 40), 0, 360)
        t[t.length - 1] = t[0]
        trazos.push(t)
        break
      }
      case "ARC":
        sueltos.push(arco(num(datos, 10), num(datos, 20), num(datos, 40), num(datos, 50), num(datos, 51)))
        break
      case "ELLIPSE": {
        const cx = num(datos, 10), cy = num(datos, 20), mx = num(datos, 11), my = num(datos, 21)
        const ratio = num(datos, 40, 1), t0 = num(datos, 41, 0), t1 = num(datos, 42, Math.PI * 2)
        const a = Math.hypot(mx, my), rot = Math.atan2(my, mx), b = a * ratio
        let fin = t1
        while (fin <= t0) fin += Math.PI * 2
        const pasos = 72
        const t: Trazo = []
        for (let k = 0; k <= pasos; k++) {
          const u = t0 + ((fin - t0) * k) / pasos
          const x = a * Math.cos(u), y = b * Math.sin(u)
          t.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)])
        }
        ;(Math.abs(fin - t0 - Math.PI * 2) < 1e-6 ? trazos : sueltos).push(t)
        break
      }
      case "LWPOLYLINE": {
        const v: { x: number; y: number; b: number }[] = []
        for (const [c, val] of datos) {
          if (c === 10) v.push({ x: parseFloat(val), y: 0, b: 0 })
          else if (c === 20 && v.length) v[v.length - 1].y = parseFloat(val)
          else if (c === 42 && v.length) v[v.length - 1].b = parseFloat(val)
        }
        const cerrar = (num(datos, 70) & 1) === 1
        if (v.length >= 2) (cerrar ? trazos : sueltos).push(polilinea(v, cerrar))
        break
      }
      case "POLYLINE":
        poli = []
        poliCerrada = (num(datos, 70) & 1) === 1
        break
      case "VERTEX":
        if (poli) poli.push({ x: num(datos, 10), y: num(datos, 20), b: num(datos, 42) })
        break
      case "SEQEND":
        if (poli && poli.length >= 2) (poliCerrada ? trazos : sueltos).push(polilinea(poli, poliCerrada))
        poli = null
        break
      case "SPLINE": {
        // Se aproxima con sus puntos de ajuste o de control
        const ajuste: Trazo = []
        const control: Trazo = []
        for (let k = 0; k < datos.length; k++) {
          const [c, val] = datos[k]
          if (c === 11) ajuste.push([parseFloat(val), num(datos.slice(k + 1, k + 2), 21)])
          if (c === 10) control.push([parseFloat(val), num(datos.slice(k + 1, k + 2), 20)])
        }
        const t = ajuste.length >= 2 ? ajuste : control
        if (t.length >= 2) (cerrado(t) ? trazos : sueltos).push(t)
        break
      }
      case "INSERT":
        if (!avisos.includes("El archivo usa bloques; puede que no contemos todo el dibujo.")) avisos.push("El archivo usa bloques; puede que no contemos todo el dibujo.")
        break
    }
  }
  const todos = trazos.concat(unirSegmentos(sueltos)).map((t) => t.map(([x, y]) => [x * escala, y * escala] as [number, number]))
  return resumen2d(todos, avisos)
}

// ── SVG (con el navegador) ──────────────────────────────────────────────
const MM_POR: Record<string, number> = { mm: 1, cm: 10, in: 25.4, pt: 25.4 / 72, pc: 25.4 / 6, px: 25.4 / 96, "": 25.4 / 96 }

export function leerSvg(texto: string): GeoCad {
  if (typeof document === "undefined") throw new Error("El SVG sólo se puede leer en el navegador.")
  const doc = new DOMParser().parseFromString(texto, "image/svg+xml")
  const svgOrig = doc.documentElement
  if (!svgOrig || svgOrig.nodeName.toLowerCase() !== "svg") throw new Error("El archivo SVG no es válido.")
  const avisos: string[] = []
  // Escala: unidades del width/height contra el viewBox
  const medida = (v: string | null) => {
    const m = String(v || "").trim().match(/^([\d.]+)\s*(mm|cm|in|pt|pc|px)?$/)
    return m ? { n: parseFloat(m[1]), u: m[2] || "" } : null
  }
  const w = medida(svgOrig.getAttribute("width"))
  const vb = (svgOrig.getAttribute("viewBox") || "").split(/[\s,]+/).map(Number)
  let mmPorUnidad = 25.4 / 96
  if (w && vb.length === 4 && vb[2] > 0) mmPorUnidad = (w.n * (MM_POR[w.u] ?? 25.4 / 96)) / vb[2]
  else if (w?.u && w.u !== "px") mmPorUnidad = MM_POR[w.u]
  else avisos.push("El SVG no trae medidas en mm; lo tomamos a 96 puntos por pulgada.")

  // Se monta oculto para poder medir con getTotalLength / getPointAtLength
  const cont = document.createElement("div")
  cont.style.cssText = "position:absolute;left:-99999px;top:0;width:1px;height:1px;overflow:hidden"
  const svg = document.importNode(svgOrig, true) as unknown as SVGSVGElement
  // Sin scripts ni ligas externas: sólo se mide
  svg.querySelectorAll("script,foreignObject,image,use").forEach((n) => n.remove())
  cont.appendChild(svg)
  document.body.appendChild(cont)
  try {
    const trazos: Trazo[] = []
    const formas = svg.querySelectorAll("path,rect,circle,ellipse,line,polyline,polygon")
    formas.forEach((el) => {
      const g = el as SVGGeometryElement
      if (typeof g.getTotalLength !== "function") return
      const L = g.getTotalLength()
      if (!(L > 0)) return
      // Transformaciones del elemento y sus grupos, hasta el sistema del viewBox
      const raiz = svg.getScreenCTM()
      const propia = g.getScreenCTM()
      const ctm = raiz && propia ? raiz.inverse().multiply(propia) : g.getCTM()
      const pasos = Math.max(8, Math.min(400, Math.ceil(L / 2)))
      const t: Trazo = []
      for (let k = 0; k <= pasos; k++) {
        let p = g.getPointAtLength((L * k) / pasos)
        if (ctm) p = p.matrixTransform(ctm)
        t.push([p.x * mmPorUnidad, -p.y * mmPorUnidad])
      }
      const tag = el.tagName.toLowerCase()
      if (["rect", "circle", "ellipse", "polygon"].includes(tag) || /z\s*$/i.test(el.getAttribute("d") || "")) t[t.length - 1] = t[0]
      trazos.push(t)
    })
    return resumen2d(trazos, avisos)
  } finally {
    cont.remove()
  }
}

// ── STL / OBJ ───────────────────────────────────────────────────────────────────

function resumen3d(tris: Float64Array, n: number, avisos: string[]): GeoCad {
  if (!n) throw new Error("No encontramos la pieza en el archivo 3D.")
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
  let vol = 0
  for (let k = 0; k < n; k++) {
    const o = k * 9
    for (let j = 0; j < 9; j += 3) {
      const x = tris[o + j], y = tris[o + j + 1], z = tris[o + j + 2]
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (z < minZ) minZ = z
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
      if (z > maxZ) maxZ = z
    }
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = [tris[o], tris[o + 1], tris[o + 2], tris[o + 3], tris[o + 4], tris[o + 5], tris[o + 6], tris[o + 7], tris[o + 8]]
    vol += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6
  }
  const largo = maxX - minX, ancho = maxY - minY, alto = maxZ - minZ
  if (!(largo > 0 && ancho > 0)) throw new Error("La pieza 3D no tiene medidas.")
  // Silueta vista de arriba: mapa de alturas en una malla gruesa
  const celdas = 120
  const paso = Math.max(largo, ancho) / celdas
  const cols = Math.max(1, Math.ceil(largo / paso)), filas = Math.max(1, Math.ceil(ancho / paso))
  const lleno = new Uint8Array(cols * filas)
  const muestra = Math.max(1, Math.floor(n / 200000))
  for (let k = 0; k < n; k += muestra) {
    const o = k * 9
    for (let j = 0; j < 9; j += 3) {
      const c = Math.min(cols - 1, Math.floor((tris[o + j] - minX) / paso))
      const f = Math.min(filas - 1, Math.floor((tris[o + j + 1] - minY) / paso))
      lleno[f * cols + c] = 1
    }
  }
  const trazos: Trazo[] = []
  for (let f = 0; f < filas; f++)
    for (let c = 0; c < cols; c++) {
      if (!lleno[f * cols + c]) continue
      const x = c * paso, y = f * paso
      if (c === 0 || !lleno[f * cols + c - 1]) trazos.push([[x, y], [x, y + paso]])
      if (c === cols - 1 || !lleno[f * cols + c + 1]) trazos.push([[x + paso, y], [x + paso, y + paso]])
      if (f === 0 || !lleno[(f - 1) * cols + c]) trazos.push([[x, y], [x + paso, y]])
      if (f === filas - 1 || !lleno[(f + 1) * cols + c]) trazos.push([[x, y + paso], [x + paso, y + paso]])
    }
  const volumen = Math.abs(vol) / 1000
  if (!(volumen > 0)) avisos.push("No pudimos calcular el volumen (la malla no está cerrada); usamos las medidas de la caja.")
  return { tipo: "3d", largo, ancho, alto, corte_mm: 0, contornos: 0, perforaciones: 0, volumen_cm3: volumen, trazos: decimar(trazos), avisos }
}

export function leerStl(buffer: ArrayBuffer): GeoCad {
  const dv = new DataView(buffer)
  const avisos: string[] = []
  const binario = buffer.byteLength >= 84 && 84 + dv.getUint32(80, true) * 50 === buffer.byteLength
  if (binario) {
    const n = dv.getUint32(80, true)
    const tris = new Float64Array(n * 9)
    for (let k = 0; k < n; k++) {
      const o = 84 + k * 50 + 12
      for (let j = 0; j < 9; j++) tris[k * 9 + j] = dv.getFloat32(o + j * 4, true)
    }
    return resumen3d(tris, n, avisos)
  }
  const texto = new TextDecoder().decode(buffer)
  const v = [...texto.matchAll(/vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g)].map((m) => [+m[1], +m[2], +m[3]])
  const n = Math.floor(v.length / 3)
  const tris = new Float64Array(n * 9)
  for (let k = 0; k < n * 3; k++) tris.set(v[k], k * 3)
  return resumen3d(tris, n, avisos)
}

export function leerObj(texto: string): GeoCad {
  const verts: number[][] = []
  const caras: number[][] = []
  for (const l of texto.split(/\r?\n/)) {
    if (l.startsWith("v ")) {
      const p = l.trim().split(/\s+/)
      verts.push([+p[1], +p[2], +p[3]])
    } else if (l.startsWith("f ")) {
      const idx = l.trim().split(/\s+/).slice(1).map((s) => {
        const i = parseInt(s.split("/")[0], 10)
        return i < 0 ? verts.length + i : i - 1
      })
      for (let k = 1; k + 1 < idx.length; k++) caras.push([idx[0], idx[k], idx[k + 1]])
    }
  }
  const tris = new Float64Array(caras.length * 9)
  caras.forEach((c, k) => c.forEach((vi, j) => verts[vi] && tris.set(verts[vi], k * 9 + j * 3)))
  return resumen3d(tris, caras.length, [])
}

/** Lee el archivo según su extensión. Devuelve null si no se puede medir (PDF, STEP, imágenes...). */
export async function leerArchivoCad(archivo: File): Promise<GeoCad | null> {
  const ext = archivo.name.split(".").pop()?.toLowerCase() || ""
  if (ext === "dxf") return leerDxf(await archivo.text())
  if (ext === "svg") return leerSvg(await archivo.text())
  if (ext === "stl") return leerStl(await archivo.arrayBuffer())
  if (ext === "obj") return leerObj(await archivo.text())
  return null
}
