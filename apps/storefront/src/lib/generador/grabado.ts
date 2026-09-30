// Foto para grabado láser: ajusta la foto y la convierte en puntos (tramado) al tamaño y
// resolución exactos de la máquina. Todo corre en el navegador.

export type Estilo = "tramado" | "semitono" | "grises" | "boceto" | "umbral"
export type Difusion = "jarvis" | "floyd" | "stucki" | "atkinson"

export type OpcionesGrabado = {
  estilo: Estilo
  difusion: Difusion // solo tramado
  brillo: number // -100 a 100
  contraste: number // -100 a 100
  gamma: number // 0.3 a 3 (más de 1 aclara los medios tonos)
  nitidez: number // 0 a 100
  invertir: boolean // pizarra, acrílico negro o anodizado
  espejo: boolean // grabar por detrás del acrílico o hacer sellos
  semitono: number // tamaño de la celda del semitono en píxeles
  umbral: number // 0 a 255, solo umbral
}

// Luminancia 0–255 (transparencia sobre blanco)
export function aGris(data: Uint8ClampedArray, w: number, h: number): Float32Array {
  const g = new Float32Array(w * h)
  for (let i = 0; i < g.length; i++) {
    const a = data[i * 4 + 3] / 255
    g[i] = (0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]) * a + 255 * (1 - a)
  }
  return g
}

// Desenfoque de caja separable (radio en píxeles)
function desenfocar(g: Float32Array, w: number, h: number, r: number): Float32Array {
  r = Math.max(1, Math.round(r))
  const t = new Float32Array(g.length)
  const s = new Float32Array(g.length)
  for (let y = 0; y < h; y++) {
    let suma = 0
    const f = y * w
    for (let x = -r; x <= r; x++) suma += g[f + Math.min(w - 1, Math.max(0, x))]
    for (let x = 0; x < w; x++) {
      t[f + x] = suma / (2 * r + 1)
      suma += g[f + Math.min(w - 1, x + r + 1)] - g[f + Math.max(0, x - r)]
    }
  }
  for (let x = 0; x < w; x++) {
    let suma = 0
    for (let y = -r; y <= r; y++) suma += t[Math.min(h - 1, Math.max(0, y)) * w + x]
    for (let y = 0; y < h; y++) {
      s[y * w + x] = suma / (2 * r + 1)
      suma += t[Math.min(h - 1, y + r + 1) * w + x] - t[Math.max(0, y - r) * w + x]
    }
  }
  return s
}

// Brillo, contraste, gamma, nitidez, inversión y espejo
export function ajustar(g0: Float32Array, w: number, h: number, o: OpcionesGrabado): Float32Array {
  let g = g0
  if (o.nitidez > 0) {
    const b = desenfocar(g, w, h, 1)
    const k = (o.nitidez / 100) * 1.5
    const n = new Float32Array(g.length)
    for (let i = 0; i < g.length; i++) n[i] = g[i] + k * (g[i] - b[i])
    g = n
  }
  // brillo, contraste, gamma e inversión en una tabla de 256 valores (mucho más rápido)
  const c = Math.max(-99, Math.min(100, o.contraste))
  const fc = (259 * (c * 2.55 + 255)) / (255 * (259 - c * 2.55))
  const brillo = o.brillo * 2.55
  const inv = 1 / Math.max(0.1, o.gamma)
  const tabla = new Float32Array(256)
  for (let i = 0; i < 256; i++) {
    let v = fc * (i - 128) + 128 + brillo
    v = Math.max(0, Math.min(255, v))
    v = 255 * Math.pow(v / 255, inv)
    tabla[i] = o.invertir ? 255 - v : v
  }
  const out = new Float32Array(g.length)
  for (let y = 0; y < h; y++) {
    const f = y * w
    for (let x = 0; x < w; x++) {
      const v = g[f + (o.espejo ? w - 1 - x : x)]
      out[f + x] = tabla[v <= 0 ? 0 : v >= 255 ? 255 : Math.round(v)]
    }
  }
  return out
}

const DIFUSION: Record<Difusion, { d: number; m: [number, number, number][] }> = {
  floyd: { d: 16, m: [[1, 0, 7], [-1, 1, 3], [0, 1, 5], [1, 1, 1]] },
  jarvis: { d: 48, m: [[1, 0, 7], [2, 0, 5], [-2, 1, 3], [-1, 1, 5], [0, 1, 7], [1, 1, 5], [2, 1, 3], [-2, 2, 1], [-1, 2, 3], [0, 2, 5], [1, 2, 3], [2, 2, 1]] },
  stucki: { d: 42, m: [[1, 0, 8], [2, 0, 4], [-2, 1, 2], [-1, 1, 4], [0, 1, 8], [1, 1, 4], [2, 1, 2], [-2, 2, 1], [-1, 2, 2], [0, 2, 4], [1, 2, 2], [2, 2, 1]] },
  atkinson: { d: 8, m: [[1, 0, 1], [2, 0, 1], [-1, 1, 1], [0, 1, 1], [1, 1, 1], [0, 2, 1]] },
}

// Tramado por difusión de error, recorriendo en zigzag para no dejar vetas
function tramar(g: Float32Array, w: number, h: number, tipo: Difusion): Uint8Array {
  const e = new Float32Array(g)
  const out = new Uint8Array(g.length)
  const { d, m } = DIFUSION[tipo]
  const n = m.length
  const dx = Int32Array.from(m.map((q) => q[0]))
  const dy = Int32Array.from(m.map((q) => q[1]))
  const p = Float32Array.from(m.map((q) => q[2] / d))
  for (let y = 0; y < h; y++) {
    const der = y % 2 === 0
    const s = der ? 1 : -1
    for (let k = 0; k < w; k++) {
      const x = der ? k : w - 1 - k
      const i = y * w + x
      const v = e[i]
      const b = v < 128 ? 0 : 255
      out[i] = b
      const err = v - b
      if (err === 0) continue
      for (let j = 0; j < n; j++) {
        const xx = x + s * dx[j]
        const yy = y + dy[j]
        if (xx < 0 || xx >= w || yy >= h) continue
        e[yy * w + xx] += err * p[j]
      }
    }
  }
  return out
}

// Semitono de puntos redondos a 45°, como en imprenta
function semitono(g: Float32Array, w: number, h: number, celda: number): Uint8Array {
  const out = new Uint8Array(g.length)
  const c = Math.max(2, celda)
  const cos = Math.SQRT1_2
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = ((x * cos + y * cos) / c) * Math.PI
      const v = ((-x * cos + y * cos) / c) * Math.PI
      const umbral = ((Math.cos(u) + Math.cos(v)) / 4 + 0.5) * 255
      out[y * w + x] = g[y * w + x] < umbral ? 0 : 255
    }
  }
  return out
}

// Boceto a lápiz: sobreexposición de la imagen contra su negativo desenfocado
function boceto(g: Float32Array, w: number, h: number): Float32Array {
  const neg = new Float32Array(g.length)
  for (let i = 0; i < g.length; i++) neg[i] = 255 - g[i]
  const r = Math.max(2, Math.round(Math.min(w, h) / 120))
  const b = desenfocar(neg, w, h, r)
  const out = new Float32Array(g.length)
  for (let i = 0; i < g.length; i++) out[i] = Math.min(255, (g[i] * 255) / Math.max(1, 255 - b[i]))
  return out
}

// Resultado en gris 0–255 (0 = quemar a fondo)
export function grabar(gris: Float32Array, w: number, h: number, o: OpcionesGrabado): Uint8Array {
  const base = o.estilo === "boceto" ? boceto(gris, w, h) : gris
  const g = ajustar(base, w, h, o)
  if (o.estilo === "tramado") return tramar(g, w, h, o.difusion)
  if (o.estilo === "semitono") return semitono(g, w, h, o.semitono)
  const out = new Uint8Array(g.length)
  if (o.estilo === "umbral") for (let i = 0; i < g.length; i++) out[i] = g[i] < o.umbral ? 0 : 255
  else for (let i = 0; i < g.length; i++) out[i] = Math.round(g[i])
  return out
}

// Porcentaje de la superficie que se quema (para estimar el tiempo)
export function cobertura(r: Uint8Array): number {
  let s = 0
  for (let i = 0; i < r.length; i++) s += 255 - r[i]
  return r.length ? s / (255 * r.length) : 0
}

// ---------------------------------------------------------------------
// PNG con la resolución (DPI) guardada, para que LightBurn lo abra al tamaño correcto
// ---------------------------------------------------------------------

const TABLA_CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(b: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < b.length; i++) c = TABLA_CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

export function pngConDPI(png: Uint8Array, dpi: number): Uint8Array {
  const ppm = Math.round(dpi / 0.0254)
  const datos = new Uint8Array(13)
  const vista = new DataView(datos.buffer)
  datos.set([0x70, 0x48, 0x59, 0x73]) // "pHYs"
  vista.setUint32(4, ppm)
  vista.setUint32(8, ppm)
  datos[12] = 1 // metros
  const trozo = new Uint8Array(4 + 13 + 4)
  const v2 = new DataView(trozo.buffer)
  v2.setUint32(0, 9)
  trozo.set(datos, 4)
  v2.setUint32(17, crc32(datos))
  // quita un pHYs que ya viniera y lo pone justo después del encabezado (IHDR)
  const partes: Uint8Array[] = [png.subarray(0, 33), trozo]
  let i = 33
  while (i + 8 <= png.length) {
    const largo = new DataView(png.buffer, png.byteOffset + i, 4).getUint32(0)
    const tipo = String.fromCharCode(...png.subarray(i + 4, i + 8))
    const fin = i + 12 + largo
    if (tipo !== "pHYs") partes.push(png.subarray(i, fin))
    i = fin
  }
  const total = partes.reduce((s, p) => s + p.length, 0)
  const out = new Uint8Array(total)
  let o = 0
  for (const p of partes) {
    out.set(p, o)
    o += p.length
  }
  return out
}
