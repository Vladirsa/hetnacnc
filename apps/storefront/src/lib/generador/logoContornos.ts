// Logo del cliente → contornos para el llavero (o cualquier placa). Se dibuja
// la imagen (PNG, JPG, WebP o SVG) en un lienzo sobre blanco, se pasa a blanco
// y negro con el umbral automático y se sacan sus contornos con el mismo
// trazador del vectorizador (lib/generador/trazado.ts). Si la orilla de la
// imagen sale casi toda oscura (logo claro sobre fondo oscuro), se invierte.
// Los contornos salen con Y hacia arriba en "píxeles"; hacerLlavero los ajusta al alto pedido.
import { aplanar } from "@/lib/generador/llaveros"
import { curvasDeMascara, gris, orillaOscura, umbralAutomatico } from "@/lib/generador/trazado"
import type { P } from "@/lib/generador/vectores"

const LADO = 400 // px del lado mayor: suficiente para un llavero y rápido en celular
export const TIPOS_LOGO = "image/png,image/jpeg,image/webp,image/svg+xml"
const MAX_BYTES = 5 * 1024 * 1024

/** Contornos del logo a partir de la máscara (1 = tinta). Puro, para probarlo sin navegador. */
export function contornosDeMascara(m: Uint8Array, w: number, h: number): P[][] {
  return curvasDeMascara(m, w, h, { tolerancia: 0.8, manchas: Math.max(12, (w * h) / 4000), suave: true })
    .map((c) => aplanar(c, 1))
    .filter((p) => p.length >= 3)
}

/** Imagen → máscara de tinta (umbral automático, invierte si el fondo es oscuro). */
export function mascaraDeImagen(data: Uint8ClampedArray, w: number, h: number): Uint8Array {
  const g = gris({ data, width: w, height: h })
  const umbral = umbralAutomatico(g)
  const invertir = orillaOscura(g, w, h, umbral) > 0.5
  const m = new Uint8Array(w * h)
  for (let i = 0; i < m.length; i++) m[i] = (g[i] < umbral) !== invertir ? 1 : 0
  return m
}

/** Lee el archivo del logo en el navegador y regresa sus contornos. */
export async function logoDeArchivo(archivo: File): Promise<P[][]> {
  if (archivo.size > MAX_BYTES) throw new Error("El logo pesa más de 5 MB: usa una imagen más chica.")
  if (!TIPOS_LOGO.split(",").includes(archivo.type)) throw new Error("Sube el logo en PNG, JPG, WebP o SVG.")
  const url = URL.createObjectURL(archivo)
  try {
    const img = await new Promise<HTMLImageElement>((ok, mal) => {
      const i = new Image()
      i.onload = () => ok(i)
      i.onerror = () => mal(new Error("No se pudo abrir la imagen del logo."))
      i.src = url
    })
    const w0 = img.naturalWidth || 300, h0 = img.naturalHeight || 300
    const k = LADO / Math.max(w0, h0)
    const w = Math.max(8, Math.round(w0 * k)), h = Math.max(8, Math.round(h0 * k))
    // 4 px de orilla blanca para que los contornos cierren aunque el logo toque el borde
    const lienzo = document.createElement("canvas")
    lienzo.width = w + 8
    lienzo.height = h + 8
    const ctx = lienzo.getContext("2d", { willReadFrequently: true })
    if (!ctx) throw new Error("Tu navegador no deja leer la imagen.")
    ctx.fillStyle = "#fff"
    ctx.fillRect(0, 0, lienzo.width, lienzo.height)
    ctx.drawImage(img, 4, 4, w, h)
    const { data } = ctx.getImageData(0, 0, lienzo.width, lienzo.height)
    const c = contornosDeMascara(mascaraDeImagen(data, lienzo.width, lienzo.height), lienzo.width, lienzo.height)
    if (!c.length) throw new Error("No encontramos el dibujo del logo: prueba con una imagen de más contraste (logo oscuro sobre fondo claro).")
    return c
  } finally {
    URL.revokeObjectURL(url)
  }
}
