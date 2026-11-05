// Código QR para grabar: los módulos negros del QR unidos en contornos (menos
// trazos para la máquina), sobre una placa con margen, texto abajo y barreno
// opcional para colgar. El QR se genera aquí mismo (lib/generador/qr.ts).
import { type P, type Trazo, cajaDibujo, circulo, curvasATrazos, dibujo, mover, rect, trazo } from "@/lib/generador/geo2d"
import { codigoQR } from "@/lib/generador/qr"
import { contornos, type Curva } from "@/lib/generador/trazado"

export type OpcionesQR = {
  texto: string
  lado: number // mm del QR sin la zona blanca
  zona: number // módulos de zona blanca alrededor
  placa: boolean
  radio: number
  barreno: boolean
  etiqueta: Curva[] | null // texto ya convertido a curvas (mm, y hacia abajo)
  altoEtiqueta: number
}

export function hacerQR(o: OpcionesQR) {
  const avisos: string[] = []
  if (!o.texto.trim()) return { dibujo: null, avisos: ["Escribe la liga o el texto del QR."], modulo: 0, version: 0 }
  let m: boolean[][]
  try {
    m = codigoQR(o.texto.trim())
  } catch {
    return { dibujo: null, avisos: ["El texto es demasiado largo para un QR. Usa una liga corta."], modulo: 0, version: 0 }
  }
  const n = m.length
  const mod = o.lado / n
  const zona = Math.max(0, o.zona) * mod
  // Máscara de los módulos negros y sus contornos (en módulos, Y hacia abajo)
  const mascara = new Uint8Array(n * n)
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) mascara[y * n + x] = m[y][x] ? 1 : 0
  const lazos = contornos(mascara, n, n)
  const altoTexto = o.etiqueta?.length ? o.altoEtiqueta + mod * 2 : 0
  const W = o.lado + 2 * zona
  const H = o.lado + 2 * zona + altoTexto + (o.barreno ? 10 : 0)
  const trazos: Trazo[] = []
  const baseQR = altoTexto // el QR va arriba del texto
  for (const l of lazos) {
    const pts: P[] = l.pts.map(([x, y]) => [zona + x * mod, baseQR + zona + (n - y) * mod])
    trazos.push(trazo(pts, true, "grabado"))
  }
  if (o.etiqueta?.length) {
    const t = curvasATrazos(o.etiqueta, "grabado").map((tr) => ({ ...tr, pts: tr.pts.map(([x, y]) => [x, -y] as P) }))
    const b = cajaDibujo(t)
    const dx = W / 2 - (b.x0 + b.x1) / 2
    const dy = zona * 0.5 + mod - b.y0
    for (const tr of t) trazos.push({ ...tr, pts: mover(tr.pts, dx, dy) })
  }
  if (o.placa) trazos.unshift(rect(0, 0, W, H, o.radio))
  if (o.barreno && o.placa) trazos.push(circulo(W / 2, H - 5, 2.5))
  if (mod < 0.6) avisos.push(`Cada cuadrito mide ${mod.toFixed(2)} mm: muy chico para grabar bien. Haz el QR más grande o la liga más corta.`)
  else if (mod < 1) avisos.push(`Cada cuadrito mide ${mod.toFixed(2)} mm: sólo láser. Para router con fresa V, de 1.5 mm en adelante.`)
  if (o.zona < 2) avisos.push("Deja al menos 2 cuadritos de margen claro alrededor para que el celular lo lea.")
  avisos.push("Prueba el QR con tu celular antes de grabar (puedes escanear la vista previa).")
  return { dibujo: dibujo(trazos, avisos), avisos, modulo: mod, version: (n - 17) / 4 }
}
