// Vectorizador de imágenes para CNC: convierte una foto o un logotipo en contornos cerrados.
// Todo corre en el navegador: la imagen nunca sale del equipo del cliente.
//
// Pasos: imagen -> gris o colores -> máscara por capa -> bordes entre píxeles -> contornos
// cerrados -> simplificar escalones -> curvas suaves (con esquinas) -> SVG y DXF en mm.

export type Pt = [number, number]
export type Imagen = { data: Uint8ClampedArray; width: number; height: number }
export type Tramo = { c1: Pt; c2: Pt; p: Pt } | { p: Pt } // curva cúbica o recta hasta p
export type Curva = { inicio: Pt; tramos: Tramo[]; hueco: boolean }
export type Capa = { color: string; nombre: string; curvas: Curva[] }
export type Vector = { capas: Capa[]; ancho: number; alto: number; avisos: string[] } // ancho y alto en píxeles

export type OpcionesVector = {
  modo: "silueta" | "colores"
  umbral: number // 0–255, solo silueta
  invertir: boolean // solo silueta
  colores: number // 2–6, solo colores
  quitarFondo: boolean // solo colores
  tolerancia: number // px de error al simplificar
  manchas: number // área mínima en px² de cada contorno
  suave: boolean // curvas o solo rectas
  ruido: boolean // foto con grano: suaviza antes del umbral (redondea 1 px las esquinas)
}

// ---------------------------------------------------------------------
// Imagen a gris y a colores
// ---------------------------------------------------------------------

// Luminancia 0–255 con la transparencia puesta sobre blanco
export function gris(im: Imagen): Uint8Array {
  const n = im.width * im.height
  const g = new Uint8Array(n)
  const d = im.data
  for (let i = 0; i < n; i++) {
    const a = d[i * 4 + 3] / 255
    const r = d[i * 4] * a + 255 * (1 - a)
    const v = d[i * 4 + 1] * a + 255 * (1 - a)
    const b = d[i * 4 + 2] * a + 255 * (1 - a)
    g[i] = Math.round(0.299 * r + 0.587 * v + 0.114 * b)
  }
  return g
}

// Desenfoque de caja de radio 1 para quitar ruido de foto antes del umbral
export function desenfocar(g: Uint8Array, w: number, h: number): Uint8Array {
  const s = new Uint8Array(g.length)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let suma = 0
      let n = 0
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= h) continue
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx
          if (xx < 0 || xx >= w) continue
          suma += g[yy * w + xx]
          n++
        }
      }
      s[y * w + x] = Math.round(suma / n)
    }
  }
  return s
}

// Umbral automático de Otsu
export function umbralAutomatico(g: Uint8Array): number {
  const hist = new Array(256).fill(0)
  for (let i = 0; i < g.length; i++) hist[g[i]]++
  const total = g.length
  let sumaTotal = 0
  for (let i = 0; i < 256; i++) sumaTotal += i * hist[i]
  let sumaB = 0
  let pesoB = 0
  let mejor = 0
  let umbral = 128
  for (let t = 0; t < 256; t++) {
    pesoB += hist[t]
    if (!pesoB) continue
    const pesoF = total - pesoB
    if (!pesoF) break
    sumaB += t * hist[t]
    const mB = sumaB / pesoB
    const mF = (sumaTotal - sumaB) / pesoF
    const v = pesoB * pesoF * (mB - mF) * (mB - mF)
    if (v > mejor) {
      mejor = v
      umbral = t
    }
  }
  return umbral + 1 // tinta = gris < umbral
}

// Fracción de la orilla de la imagen que queda como tinta (para sugerir invertir)
export function orillaOscura(g: Uint8Array, w: number, h: number, umbral: number): number {
  let n = 0
  let t = 0
  const ver = (i: number) => { n++; if (g[i] < umbral) t++ }
  for (let x = 0; x < w; x++) { ver(x); ver((h - 1) * w + x) }
  for (let y = 1; y < h - 1; y++) { ver(y * w); ver(y * w + w - 1) }
  return n ? t / n : 0
}

const hex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")

// k-medias con semilla fija para que el resultado no cambie entre corridas
export function agruparColores(im: Imagen, k: number): { centros: [number, number, number][]; etiqueta: Uint8Array } {
  const n = im.width * im.height
  const d = im.data
  const rgb = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const a = d[i * 4 + 3] / 255
    rgb[i * 3] = d[i * 4] * a + 255 * (1 - a)
    rgb[i * 3 + 1] = d[i * 4 + 1] * a + 255 * (1 - a)
    rgb[i * 3 + 2] = d[i * 4 + 2] * a + 255 * (1 - a)
  }
  // muestra de hasta 30 000 píxeles
  const paso = Math.max(1, Math.floor(n / 30000))
  const muestra: number[] = []
  for (let i = 0; i < n; i += paso) muestra.push(i)
  // arranque k-medias++ con semilla fija: el resultado es igual cada vez
  let semilla = 12345
  const azar = () => ((semilla = (semilla * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  const dist2 = (i: number, c: [number, number, number]) => {
    const dr = rgb[i * 3] - c[0], dg = rgb[i * 3 + 1] - c[1], db = rgb[i * 3 + 2] - c[2]
    return dr * dr + dg * dg + db * db
  }
  const tomar = (i: number): [number, number, number] => [rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]]
  let centros: [number, number, number][] = [tomar(muestra[Math.floor(azar() * muestra.length)])]
  const dmin = muestra.map((i) => dist2(i, centros[0]))
  while (centros.length < k) {
    const total = dmin.reduce((s, x) => s + x, 0)
    if (!total) break
    let r = azar() * total
    let elegido = muestra.length - 1
    for (let t = 0; t < muestra.length; t++) { r -= dmin[t]; if (r <= 0) { elegido = t; break } }
    const c = tomar(muestra[elegido])
    centros.push(c)
    for (let t = 0; t < muestra.length; t++) dmin[t] = Math.min(dmin[t], dist2(muestra[t], c))
  }
  const cercano = (i: number) => {
    let mejor = 0
    let dm = Infinity
    for (let j = 0; j < centros.length; j++) {
      const c = centros[j]
      const dr = rgb[i * 3] - c[0], dg = rgb[i * 3 + 1] - c[1], db = rgb[i * 3 + 2] - c[2]
      const dd = dr * dr + dg * dg + db * db
      if (dd < dm) { dm = dd; mejor = j }
    }
    return mejor
  }
  for (let it = 0; it < 15; it++) {
    const suma = centros.map(() => [0, 0, 0, 0])
    for (const i of muestra) {
      const j = cercano(i)
      suma[j][0] += rgb[i * 3]; suma[j][1] += rgb[i * 3 + 1]; suma[j][2] += rgb[i * 3 + 2]; suma[j][3]++
    }
    let movio = 0
    centros = centros.map((c, j) => {
      if (!suma[j][3]) return c
      const nc: [number, number, number] = [suma[j][0] / suma[j][3], suma[j][1] / suma[j][3], suma[j][2] / suma[j][3]]
      movio = Math.max(movio, Math.abs(nc[0] - c[0]) + Math.abs(nc[1] - c[1]) + Math.abs(nc[2] - c[2]))
      return nc
    })
    if (movio < 0.5) break
  }
  let etiqueta = new Uint8Array(n)
  for (let i = 0; i < n; i++) etiqueta[i] = cercano(i)
  // filtro de mayoría 3×3: quita los píxeles sueltos de las orillas suavizadas
  const w = im.width
  const h = im.height
  for (let vuelta = 0; vuelta < 2; vuelta++) {
    const sal = new Uint8Array(etiqueta)
    const cuenta = new Uint8Array(centros.length)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        cuenta.fill(0)
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy
          if (yy < 0 || yy >= h) continue
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx
            if (xx >= 0 && xx < w) cuenta[etiqueta[yy * w + xx]]++
          }
        }
        let mejor = etiqueta[y * w + x]
        for (let j = 0; j < centros.length; j++) if (cuenta[j] > cuenta[mejor]) mejor = j
        if (cuenta[mejor] >= 5) sal[y * w + x] = mejor
      }
    }
    etiqueta = sal
  }
  return { centros, etiqueta }
}

// ---------------------------------------------------------------------
// Contornos: sigue los bordes entre píxeles de tinta y de fondo
// ---------------------------------------------------------------------

type Lazo = { pts: Pt[]; area: number }

// Recorre cada borde con la tinta a la derecha. Afuera queda en sentido horario (en pantalla)
// y los huecos al revés. En las esquinas en diagonal une la tinta (vuelta a la izquierda).
export function contornos(m: Uint8Array, w: number, h: number, areaMin = 0): Lazo[] {
  const W1 = w + 1
  const sale = new Uint8Array(W1 * (h + 1)) // bits de dirección: 0 derecha, 1 abajo, 2 izquierda, 3 arriba
  const usado = new Uint8Array(W1 * (h + 1))
  const tinta = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && m[y * w + x] === 1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (m[y * w + x] !== 1) continue
      if (!tinta(x, y - 1)) sale[y * W1 + x] |= 1
      if (!tinta(x + 1, y)) sale[y * W1 + x + 1] |= 2
      if (!tinta(x, y + 1)) sale[(y + 1) * W1 + x + 1] |= 4
      if (!tinta(x - 1, y)) sale[(y + 1) * W1 + x] |= 8
    }
  }
  const DX = [1, 0, -1, 0]
  const DY = [0, 1, 0, -1]
  const lazos: Lazo[] = []
  for (let v0 = 0; v0 < sale.length; v0++) {
    while (sale[v0] & ~usado[v0]) {
      const libres = sale[v0] & ~usado[v0]
      const d0 = libres & 1 ? 0 : libres & 2 ? 1 : libres & 4 ? 2 : 3
      usado[v0] |= 1 << d0
      const pts: Pt[] = [[v0 % W1, Math.floor(v0 / W1)]]
      let x = pts[0][0]
      let y = pts[0][1]
      let d = d0
      for (let guardia = 0; guardia < sale.length * 4; guardia++) {
        x += DX[d]
        y += DY[d]
        const v = y * W1 + x
        let libres2 = sale[v] & ~usado[v]
        if (v === v0) libres2 |= 1 << d0
        const izq = (d + 3) & 3
        const der = (d + 1) & 3
        let nd: number
        if (libres2 & (1 << izq)) nd = izq
        else if (libres2 & (1 << d)) nd = d
        else if (libres2 & (1 << der)) nd = der
        else break // no debería pasar
        if (v === v0 && nd === d0) {
          if (d === d0) pts.shift() // el arranque no era esquina
          break
        }
        usado[v] |= 1 << nd
        if (nd !== d) pts.push([x, y])
        d = nd
      }
      let a = 0
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i]
        const q = pts[(i + 1) % pts.length]
        a += p[0] * q[1] - q[0] * p[1]
      }
      a /= 2
      if (pts.length >= 3 && Math.abs(a) >= Math.max(areaMin, 0.5)) lazos.push({ pts, area: a })
    }
  }
  return lazos
}

// Quita la escalera de los píxeles: cada tramo se cambia por su punto medio (que sí cae sobre
// la orilla real) y solo se conservan las esquinas entre dos tramos largos (cuadrados, letras)
function sinEscalones(c: Pt[]): Pt[] {
  const n = c.length
  const largo = (i: number) => {
    const a = c[i]
    const b = c[(i + 1) % n]
    return Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1])
  }
  const s: Pt[] = []
  for (let i = 0; i < n; i++) {
    const a = c[i]
    const b = c[(i + 1) % n]
    if (largo((i - 1 + n) % n) >= 3 && largo(i) >= 3) s.push(a)
    s.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2])
  }
  return s
}

function distSeg(p: Pt, a: Pt, b: Pt) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const L = dx * dx + dy * dy
  if (!L) return Math.hypot(p[0] - a[0], p[1] - a[1])
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)
}

// Douglas–Peucker sin recursión; devuelve los índices que se quedan
function rdp(pts: Pt[], i0: number, i1: number, tol: number, guardar: Uint8Array) {
  const n = pts.length
  const at = (t: number) => pts[t % n]
  guardar[i0 % n] = guardar[i1 % n] = 1
  const pila: [number, number][] = [[i0, i1]]
  while (pila.length) {
    const [i, j] = pila.pop()!
    let dm = -1
    let k = -1
    for (let t = i + 1; t < j; t++) {
      const dd = distSeg(at(t), at(i), at(j))
      if (dd > dm) { dm = dd; k = t }
    }
    if (k > 0 && dm > tol) {
      guardar[k % n] = 1
      pila.push([i, k], [k, j])
    }
  }
}

function simplificarCerrado(pts: Pt[], tol: number): Pt[] {
  const n = pts.length
  if (n <= 4) return pts
  // parte el lazo en el punto más lejano al primero
  let k = 0
  let dm = -1
  for (let i = 1; i < n; i++) {
    const dd = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1])
    if (dd > dm) { dm = dd; k = i }
  }
  const guardar = new Uint8Array(n)
  rdp(pts, 0, k, tol, guardar)
  rdp(pts, k, n, tol, guardar)
  let idx: number[] = []
  for (let i = 0; i < n; i++) if (guardar[i]) idx.push(i)
  // quita los puntos de corte forzados (el primero y el más lejano) si sobran
  let cambio = true
  while (cambio && idx.length > 3) {
    cambio = false
    for (let j = 0; j < idx.length && idx.length > 3; j++) {
      const a = idx[(j - 1 + idx.length) % idx.length]
      const b = idx[(j + 1) % idx.length]
      const fin = b > a ? b : b + n
      let ok = true
      for (let t = a + 1; t < fin && ok; t++) if (distSeg(pts[t % n], pts[a], pts[b]) > tol) ok = false
      if (ok) {
        idx.splice(j, 1)
        cambio = true
        j--
      }
    }
  }
  return idx.length >= 3 ? idx.map((i) => pts[i]) : pts
}

const ESQUINA = (50 * Math.PI) / 180 // vuelta mayor a 50° se queda como esquina

// Curvas suaves (Catmull–Rom a cúbicas) que respetan las esquinas marcadas
function curvaDe(p: Pt[], hueco: boolean, suave: boolean): Curva {
  const n = p.length
  if (!suave || n < 4) return { inicio: p[0], tramos: [...p.slice(1), p[0]].map((q) => ({ p: q })), hueco }
  const esquina = p.map((b, i) => {
    const a = p[(i - 1 + n) % n]
    const c = p[(i + 1) % n]
    const a1 = Math.atan2(b[1] - a[1], b[0] - a[0])
    const a2 = Math.atan2(c[1] - b[1], c[0] - b[0])
    let v = Math.abs(a2 - a1)
    if (v > Math.PI) v = 2 * Math.PI - v
    return v > ESQUINA
  })
  const tramos: Tramo[] = []
  for (let i = 0; i < n; i++) {
    const p0 = p[(i - 1 + n) % n]
    const p1 = p[i]
    const p2 = p[(i + 1) % n]
    const p3 = p[(i + 2) % n]
    if (esquina[i] && esquina[(i + 1) % n]) {
      tramos.push({ p: p2 })
      continue
    }
    // tangente de la parábola que pasa por tres puntos (aguanta tramos de distinto largo)
    // y manija de 1/3 del tramo, que se ajusta bien a arcos
    const L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1])
    const tangente = (a: Pt, b: Pt, c: Pt): Pt => {
      const d0 = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
      const d1 = Math.hypot(c[0] - b[0], c[1] - b[1]) || 1
      return [((b[0] - a[0]) * d1) / d0 + ((c[0] - b[0]) * d0) / d1, ((b[1] - a[1]) * d1) / d0 + ((c[1] - b[1]) * d0) / d1]
    }
    const manija = (v: Pt): Pt => {
      const m = Math.hypot(v[0], v[1]) || 1
      return [(v[0] / m) * (L / 3), (v[1] / m) * (L / 3)]
    }
    const recta: Pt = [p2[0] - p1[0], p2[1] - p1[1]]
    const t1 = manija(esquina[i] ? recta : tangente(p0, p1, p2))
    const t2 = manija(esquina[(i + 1) % n] ? recta : tangente(p1, p2, p3))
    tramos.push({ c1: [p1[0] + t1[0], p1[1] + t1[1]], c2: [p2[0] - t2[0], p2[1] - t2[1]], p: p2 })
  }
  return { inicio: p[0], tramos, hueco }
}

function curvasDeMascara(m: Uint8Array, w: number, h: number, o: OpcionesVector): Curva[] {
  return contornos(m, w, h, o.manchas).map((l) => curvaDe(simplificarCerrado(sinEscalones(l.pts), o.tolerancia), l.area < 0, o.suave))
}

// ---------------------------------------------------------------------
// Vectorizar
// ---------------------------------------------------------------------

export function vectorizar(im: Imagen, o: OpcionesVector): Vector {
  const w = im.width
  const h = im.height
  const avisos: string[] = []
  const capas: Capa[] = []
  if (o.modo === "silueta") {
    const g = o.ruido ? desenfocar(gris(im), w, h) : gris(im)
    const m = new Uint8Array(w * h)
    for (let i = 0; i < m.length; i++) m[i] = (g[i] < o.umbral) !== o.invertir ? 1 : 0
    capas.push({ color: "#1B1B18", nombre: "CORTE", curvas: curvasDeMascara(m, w, h, o) })
  } else {
    const k = Math.max(2, Math.min(8, Math.round(o.colores)))
    const { centros, etiqueta } = agruparColores(im, k)
    // el fondo es el color que más aparece en la orilla
    const cuenta = new Array(k).fill(0)
    const ver = (i: number) => cuenta[etiqueta[i]]++
    for (let x = 0; x < w; x++) { ver(x); ver((h - 1) * w + x) }
    for (let y = 1; y < h - 1; y++) { ver(y * w); ver(y * w + w - 1) }
    const fondo = cuenta.indexOf(Math.max(...cuenta))
    // de más oscuro a más claro
    const orden = centros.map((c, j) => ({ j, l: 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2] })).sort((a, b) => a.l - b.l)
    let num = 0
    for (const { j } of orden) {
      if (o.quitarFondo && j === fondo) continue
      const m = new Uint8Array(w * h)
      for (let i = 0; i < m.length; i++) m[i] = etiqueta[i] === j ? 1 : 0
      const c = centros[j]
      num++
      const curvas = curvasDeMascara(m, w, h, o)
      if (curvas.length) capas.push({ color: hex(c[0], c[1], c[2]), nombre: `COLOR_${num}`, curvas })
    }
  }
  const total = capas.reduce((s, c) => s + c.curvas.length, 0)
  if (!total) avisos.push("No salió ningún contorno. Mueve el umbral o cambia a modo de colores.")
  if (total > 4000) avisos.push("La imagen tiene mucho detalle. Sube «Limpiar manchas» o baja el detalle para que corte más rápido.")
  return { capas, ancho: w, alto: h, avisos }
}

// Rectángulo que ocupa el dibujo, en píxeles (el tamaño final en mm se toma de aquí)
export function caja(v: Vector) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  const ver = (p: Pt) => {
    if (p[0] < x0) x0 = p[0]
    if (p[0] > x1) x1 = p[0]
    if (p[1] < y0) y0 = p[1]
    if (p[1] > y1) y1 = p[1]
  }
  for (const c of v.capas) for (const k of c.curvas) { ver(k.inicio); for (const t of k.tramos) ver(t.p) }
  if (!Number.isFinite(x0)) return { x0: 0, y0: 0, ancho: 0, alto: 0 }
  return { x0, y0, ancho: x1 - x0, alto: y1 - y0 }
}

export function contar(v: Vector) {
  let contornos = 0
  let nodos = 0
  for (const c of v.capas) for (const k of c.curvas) { contornos++; nodos += k.tramos.length }
  return { contornos, nodos }
}

// ---------------------------------------------------------------------
// Salidas
// ---------------------------------------------------------------------

const f = (x: number) => String(Math.round(x * 1000) / 1000)

function pathDe(curvas: Curva[], k: number, x0 = 0, y0 = 0) {
  const P = (p: Pt) => `${f((p[0] - x0) * k)} ${f((p[1] - y0) * k)}`
  return curvas
    .map((c) => `M${P(c.inicio)}` + c.tramos.map((t) => ("c1" in t ? `C${P(t.c1)} ${P(t.c2)} ${P(t.p)}` : `L${P(t.p)}`)).join("") + "Z")
    .join("")
}

// Vista previa en píxeles (para mostrar en la página)
export function vistaSVG(v: Vector, fondo = "#FFFFFF") {
  const cuerpo = v.capas.map((c) => `<path fill="${c.color}" fill-rule="evenodd" d="${pathDe(c.curvas, 1)}"/>`).join("")
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${v.ancho} ${v.alto}"><rect width="100%" height="100%" fill="${fondo}"/>${cuerpo}</svg>`
}

// SVG en mm del tamaño pedido (el ancho es el del dibujo, no el de la foto), con relleno
// por color para grabado y contorno rojo fino para corte
export function vectorSVG(v: Vector, anchoMM: number) {
  const b = caja(v)
  const k = anchoMM / (b.ancho || 1)
  const W = b.ancho * k
  const H = b.alto * k
  const cuerpo = v.capas
    .map((c) => `<path id="${c.nombre}" fill="${c.color}" fill-rule="evenodd" stroke="#FF0000" stroke-width="0.1" d="${pathDe(c.curvas, k, b.x0, b.y0)}"/>`)
    .join("\n")
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${f(W)}mm" height="${f(H)}mm" viewBox="0 0 ${f(W)} ${f(H)}">\n${cuerpo}\n</svg>\n`
}

// Puntos de la curva para DXF: cada cúbica en tramos de ~0.3 mm
function muestrear(c: Curva, k: number, x0: number, y0: number): Pt[] {
  const pts: Pt[] = [[c.inicio[0] * k, c.inicio[1] * k]]
  let a = c.inicio
  for (const t of c.tramos) {
    if ("c1" in t) {
      const largo = (Math.hypot(t.c1[0] - a[0], t.c1[1] - a[1]) + Math.hypot(t.c2[0] - t.c1[0], t.c2[1] - t.c1[1]) + Math.hypot(t.p[0] - t.c2[0], t.p[1] - t.c2[1])) * k
      const n = Math.max(2, Math.min(24, Math.ceil(largo / 0.3)))
      for (let i = 1; i <= n; i++) {
        const s = i / n
        const u = 1 - s
        const x = u * u * u * a[0] + 3 * u * u * s * t.c1[0] + 3 * u * s * s * t.c2[0] + s * s * s * t.p[0]
        const y = u * u * u * a[1] + 3 * u * u * s * t.c1[1] + 3 * u * s * s * t.c2[1] + s * s * s * t.p[1]
        pts.push([x * k, y * k])
      }
    } else pts.push([t.p[0] * k, t.p[1] * k])
    a = t.p
  }
  const u = pts[pts.length - 1]
  if (Math.abs(u[0] - pts[0][0]) < 1e-9 && Math.abs(u[1] - pts[0][1]) < 1e-9) pts.pop()
  return pts.map(([x, y]) => [x - x0 * k, y - y0 * k] as Pt)
}

// Color AutoCAD más parecido (para que LightBurn y otros separen las capas)
const ACI: [number, number, number, number][] = [
  [1, 255, 0, 0], [2, 255, 255, 0], [3, 0, 255, 0], [4, 0, 255, 255], [5, 0, 0, 255], [6, 255, 0, 255],
  [7, 0, 0, 0], [8, 128, 128, 128], [9, 192, 192, 192], [30, 255, 127, 0], [34, 127, 63, 0], [40, 255, 191, 0],
]
// A cada capa le toca un color distinto (el más parecido que no se haya usado)
function colores(capas: Capa[]): number[] {
  if (capas.length === 1) return [7]
  const usados = new Set<number>()
  return capas.map((c) => {
    const r = parseInt(c.color.slice(1, 3), 16)
    const g = parseInt(c.color.slice(3, 5), 16)
    const b = parseInt(c.color.slice(5, 7), 16)
    const orden = [...ACI].sort((x, y) => (x[1] - r) ** 2 + (x[2] - g) ** 2 + (x[3] - b) ** 2 - ((y[1] - r) ** 2 + (y[2] - g) ** 2 + (y[3] - b) ** 2))
    const elegido = orden.find((x) => !usados.has(x[0]))?.[0] ?? 7
    usados.add(elegido)
    return elegido
  })
}

// DXF R12 en mm, una capa por color, eje Y hacia arriba
export function vectorDXF(v: Vector, anchoMM: number) {
  const b = caja(v)
  const k = anchoMM / (b.ancho || 1)
  const H = b.alto * k
  const l: string[] = []
  const par = (c: number | string, x: number | string) => l.push(String(c), String(x))
  par(0, "SECTION"); par(2, "HEADER"); par(9, "$ACADVER"); par(1, "AC1009"); par(9, "$INSUNITS"); par(70, 4); par(0, "ENDSEC")
  par(0, "SECTION"); par(2, "TABLES"); par(0, "TABLE"); par(2, "LAYER"); par(70, v.capas.length)
  const aci = colores(v.capas)
  v.capas.forEach((c, i) => { par(0, "LAYER"); par(2, c.nombre); par(70, 0); par(62, aci[i]); par(6, "CONTINUOUS") })
  par(0, "ENDTAB"); par(0, "ENDSEC")
  par(0, "SECTION"); par(2, "ENTITIES")
  for (const c of v.capas) {
    for (const cur of c.curvas) {
      const pts = muestrear(cur, k, b.x0, b.y0)
      if (pts.length < 3) continue
      par(0, "POLYLINE"); par(8, c.nombre); par(66, 1); par(10, 0); par(20, 0); par(30, 0); par(70, 1)
      for (const [x, y] of pts) { par(0, "VERTEX"); par(8, c.nombre); par(10, f(x)); par(20, f(H - y)); par(30, 0) }
      par(0, "SEQEND"); par(8, c.nombre)
    }
  }
  par(0, "ENDSEC"); par(0, "EOF")
  return l.join("\n") + "\n"
}
