// "Profundidad con IA" del generador de relieves: en vez de usar el brillo de la
// foto (claro = alto), una IA estima qué está cerca y qué lejos. Corre en el
// servidor de HETNA (/api/relieve-ia, packages/api/src/lib/relieve-ia): aquí la
// foto se reduce (lado corto ≈ 518 px, múltiplos de 14), se manda como píxeles
// RGB y regresa la profundidad (Uint16, cerca = 65535). La foto no se guarda.

export type Profundidad = { ancho: number; alto: number; datos: Uint16Array }

const LADO = 518
const LADO_MAX = 1036
const multiplo14 = (n: number) => Math.max(140, Math.min(LADO_MAX, Math.round(n / 14) * 14))

/** Medidas para el modelo: lado corto ≈ 518 y el largo como máximo 1036, ambos múltiplos de 14. */
export function medidasIA(w: number, h: number): { ancho: number; alto: number } {
  let esc = LADO / Math.min(w, h)
  if (Math.max(w, h) * esc > LADO_MAX) esc = LADO_MAX / Math.max(w, h)
  return { ancho: multiplo14(w * esc), alto: multiplo14(h * esc) }
}

/** RGB intercalado de la foto a las medidas del modelo. */
export function pixelesIA(img: HTMLImageElement): { ancho: number; alto: number; rgb: Uint8Array } | null {
  const { ancho, alto } = medidasIA(img.naturalWidth, img.naturalHeight)
  const c = document.createElement("canvas")
  c.width = ancho
  c.height = alto
  const ctx = c.getContext("2d", { willReadFrequently: true })
  if (!ctx) return null
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(img, 0, 0, ancho, alto)
  const rgba = ctx.getImageData(0, 0, ancho, alto).data
  const rgb = new Uint8Array(ancho * alto * 3)
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
    rgb[j] = rgba[i]
    rgb[j + 1] = rgba[i + 1]
    rgb[j + 2] = rgba[i + 2]
  }
  return { ancho, alto, rgb }
}

/** ¿Está prendida la IA en el servidor? */
export async function iaDisponible(): Promise<boolean> {
  try {
    const r = await fetch("/api/relieve-ia", { cache: "no-store" })
    return r.ok && Boolean(((await r.json()) as { disponible?: boolean }).disponible)
  } catch {
    return false
  }
}

export async function pedirProfundidad(img: HTMLImageElement, signal?: AbortSignal): Promise<Profundidad> {
  const p = pixelesIA(img)
  if (!p) throw new Error("No se pudo leer la foto.")
  const form = new FormData()
  form.append("ancho", String(p.ancho))
  form.append("alto", String(p.alto))
  form.append("rgb", new Blob([p.rgb.buffer as ArrayBuffer], { type: "application/octet-stream" }), "foto.rgb")
  const r = await fetch("/api/relieve-ia", { method: "POST", body: form, signal })
  if (!r.ok) {
    const d = (await r.json().catch(() => ({}))) as { error?: string }
    throw new Error(d.error || "No se pudo calcular la profundidad. Intenta de nuevo.")
  }
  const ancho = Number(r.headers.get("X-Ancho"))
  const alto = Number(r.headers.get("X-Alto"))
  const buf = await r.arrayBuffer()
  if (!ancho || !alto || buf.byteLength !== ancho * alto * 2) throw new Error("La respuesta de la IA llegó incompleta. Intenta de nuevo.")
  return { ancho, alto, datos: new Uint16Array(buf) }
}

/**
 * Profundidad a la malla del relieve (w × h puntos) en la misma escala que el gris (0–255):
 * cerca = 255. "textura" (0–1) suma el detalle fino de la foto (pelo, tela, letras) que la
 * profundidad sola suaviza.
 */
export function grisDeProfundidad(p: Profundidad, w: number, h: number, textura = 0, lum?: Float32Array | null): Float32Array {
  const out = new Float32Array(w * h)
  const sx = (p.ancho - 1) / Math.max(1, w - 1)
  const sy = (p.alto - 1) / Math.max(1, h - 1)
  for (let y = 0; y < h; y++) {
    const fy = y * sy
    const y0 = Math.floor(fy)
    const y1 = Math.min(p.alto - 1, y0 + 1)
    const ty = fy - y0
    for (let x = 0; x < w; x++) {
      const fx = x * sx
      const x0 = Math.floor(fx)
      const x1 = Math.min(p.ancho - 1, x0 + 1)
      const tx = fx - x0
      const a = p.datos[y0 * p.ancho + x0] * (1 - tx) + p.datos[y0 * p.ancho + x1] * tx
      const b = p.datos[y1 * p.ancho + x0] * (1 - tx) + p.datos[y1 * p.ancho + x1] * tx
      out[y * w + x] = ((a * (1 - ty) + b * ty) / 65535) * 255
    }
  }
  if (textura > 0 && lum && lum.length === w * h) {
    const borroso = desenfoque(lum, w, h, 2)
    for (let i = 0; i < out.length; i++) out[i] = Math.max(0, Math.min(255, out[i] + textura * (lum[i] - borroso[i])))
  }
  return out
}

function desenfoque(g: Float32Array, w: number, h: number, r: number): Float32Array {
  const t = new Float32Array(g.length)
  const s = new Float32Array(g.length)
  const n = 2 * r + 1
  for (let y = 0; y < h; y++) {
    let suma = 0
    for (let x = -r; x <= r; x++) suma += g[y * w + Math.min(w - 1, Math.max(0, x))]
    for (let x = 0; x < w; x++) {
      t[y * w + x] = suma / n
      suma += g[y * w + Math.min(w - 1, x + r + 1)] - g[y * w + Math.max(0, x - r)]
    }
  }
  for (let x = 0; x < w; x++) {
    let suma = 0
    for (let y = -r; y <= r; y++) suma += t[Math.min(h - 1, Math.max(0, y)) * w + x]
    for (let y = 0; y < h; y++) {
      s[y * w + x] = suma / n
      suma += t[Math.min(h - 1, y + r + 1) * w + x] - t[Math.max(0, y - r) * w + x]
    }
  }
  return s
}
