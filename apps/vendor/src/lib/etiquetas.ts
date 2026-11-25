// Etiquetas de producto para impresoras térmicas (panel del taller › Etiquetas).
//
// Una etiqueta se dibuja en SVG con medidas reales en milímetros: así se ve
// igual en la pantalla, al imprimir desde el navegador (cualquier impresora de
// etiquetas con su controlador: Zebra, TSC, Xprinter, Brother, Dymo…) y en el
// PDF. Para impresoras Zebra también sale en ZPL (el idioma de la impresora),
// que se manda directo sin controlador.
//
// Código de barras: Code 128 (juego B), el que leen todos los lectores.
import { codigoQR } from "./qr"

// ── Code 128 ─────────────────────────────────────────────────────────────
// Patrones de barras y espacios (anchos 1–4) de los 107 símbolos.
const PATRONES = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213", "221312", "231212", "112232", "122132", "122231", "113222",
  "123122", "123221", "223211", "221132", "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211", "212123", "212321",
  "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313", "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121",
  "313121", "211331", "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111", "314111", "221411", "431111", "111224",
  "111422", "121124", "121421", "141122", "141221", "112214", "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141", "214121", "412121", "111143", "111341", "131141", "114113",
  "114311", "411113", "411311", "113141", "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
]
const INICIO_B = 104
const FIN = 106

/** Anchos de barras y espacios (empieza con barra) del texto en Code 128 B. Sólo ASCII 32–126. */
export function code128(texto: string): number[] {
  const limpio = texto.replace(/[^\x20-\x7E]/g, "")
  const valores = [INICIO_B, ...[...limpio].map((c) => c.charCodeAt(0) - 32)]
  let suma = INICIO_B
  for (let i = 1; i < valores.length; i++) suma += valores[i] * i
  valores.push(suma % 103, FIN)
  return valores.flatMap((v) => [...PATRONES[v]].map(Number))
}

// ── Diseño de la etiqueta ────────────────────────────────────────────────
export type Medida = { id: string; nombre: string; ancho: number; alto: number }
export const MEDIDAS: Medida[] = [
  { id: "50x25", nombre: "50 × 25 mm", ancho: 50, alto: 25 },
  { id: "50x30", nombre: "50 × 30 mm", ancho: 50, alto: 30 },
  { id: "40x30", nombre: "40 × 30 mm", ancho: 40, alto: 30 },
  { id: "60x40", nombre: "60 × 40 mm", ancho: 60, alto: 40 },
  { id: "100x50", nombre: "100 × 50 mm", ancho: 100, alto: 50 },
  { id: "100x150", nombre: '4 × 6" (100 × 150 mm)', ancho: 100, alto: 150 },
]

export type Campos = {
  nombre: boolean
  variante: boolean
  precio: boolean
  sku: boolean
  barras: boolean
  qr: boolean
  taller: boolean
  texto: string // texto libre ("Hecho en México", "Garantía 30 días"…)
}
export type Diseno = { medida: Medida; campos: Campos; acomodo: "clasica" | "qr-izquierda" | "precio-grande"; letra: number /* 0.8–1.4 */ }
export type DatosEtiqueta = { titulo: string; variante: string; precio: number | null; sku: string; liga: string; taller: string }

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
export const pesos = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: n < 100 ? 2 : 0 })

/** Corta un texto en renglones de hasta `max` letras (aprox. por ancho), máximo `lineas`. */
function renglones(t: string, max: number, lineas: number): string[] {
  const palabras = t.split(/\s+/).filter(Boolean)
  const out: string[] = []
  let r = ""
  for (const p of palabras) {
    if ((r + " " + p).trim().length > max && r) {
      out.push(r)
      r = p
    } else r = (r + " " + p).trim()
  }
  if (r) out.push(r)
  if (out.length > lineas) {
    const corte = out.slice(0, lineas)
    corte[lineas - 1] = corte[lineas - 1].slice(0, Math.max(1, max - 1)) + "…"
    return corte
  }
  return out
}

// Ancho promedio de una letra = 0.55 × su alto (letra sin patines, en negritas un poco más)
const ANCHO_LETRA = 0.56

type Pieza =
  | { tipo: "texto"; x: number; y: number; alto: number; texto: string; negrita?: boolean; centro?: boolean }
  | { tipo: "barras"; x: number; y: number; ancho: number; alto: number; anchos: number[]; leyenda?: string }
  | { tipo: "qr"; x: number; y: number; lado: number; modulos: boolean[][] }

/** Acomoda los datos en la etiqueta (en mm). Lo usan el SVG y el ZPL. */
export function piezas(d: DatosEtiqueta, dis: Diseno): Pieza[] {
  const { ancho: W, alto: H } = dis.medida
  const c = dis.campos
  const m = Math.max(1.5, Math.min(W, H) * 0.06) // margen
  const out: Pieza[] = []
  let x0 = m, ancho = W - 2 * m

  // QR a la izquierda (o arriba a la derecha en la clásica)
  const conQr = c.qr && d.liga
  let ladoQr = 0
  if (conQr) {
    ladoQr = dis.acomodo === "qr-izquierda" ? Math.min(H - 2 * m, W * 0.4) : Math.min(H * 0.42, W * 0.3)
    const qx = dis.acomodo === "qr-izquierda" ? m : W - m - ladoQr
    const qy = dis.acomodo === "qr-izquierda" ? (H - ladoQr) / 2 : m
    out.push({ tipo: "qr", x: qx, y: qy, lado: ladoQr, modulos: codigoQR(d.liga) })
    if (dis.acomodo === "qr-izquierda") {
      x0 = m + ladoQr + m
      ancho = W - x0 - m
    }
  }
  const anchoTexto = dis.acomodo === "qr-izquierda" || !conQr ? ancho : ancho - ladoQr - m
  // letra base según el alto de la etiqueta y el ancho que queda para el texto
  const base = Math.max(1.6, Math.min(H / 8, anchoTexto / 13, 6)) * dis.letra
  const letras = (alto: number, w = anchoTexto) => Math.max(4, Math.floor(w / (alto * ANCHO_LETRA)))

  // 1) abajo: código de barras (con el SKU debajo) o el SKU en texto
  let abajo = H - m
  if (c.barras && d.sku) {
    const altoLeyenda = c.sku ? Math.min(3, base * 0.75) : 0
    const altoBarras = Math.max(5, Math.min(H * 0.26, 15))
    const anchoBarras = Math.min(ancho, Math.max(22, code128(d.sku).reduce((a, b) => a + b, 0) * 0.33))
    out.push({ tipo: "barras", x: x0 + (ancho - anchoBarras) / 2, y: abajo - altoLeyenda - altoBarras, ancho: anchoBarras, alto: altoBarras, anchos: code128(d.sku), leyenda: c.sku ? d.sku : undefined })
    abajo -= altoLeyenda + altoBarras + m * 0.6
  } else if (c.sku && d.sku) {
    out.push({ tipo: "texto", x: x0, y: abajo, alto: base * 0.8, texto: `SKU ${d.sku}` })
    abajo -= base * 0.8 + m * 0.4
  }

  // 2) encima: el precio (se aparta su lugar antes que el nombre)
  if (c.precio && d.precio != null) {
    let alto = base * (dis.acomodo === "precio-grande" ? 2.1 : 1.45)
    const texto = pesos(d.precio)
    alto = Math.min(alto, anchoTexto / (texto.length * ANCHO_LETRA * 1.05))
    if (abajo - alto >= m) {
      out.push({ tipo: "texto", x: x0, y: abajo, alto, texto, negrita: true })
      abajo -= alto + m * 0.5
    }
  }

  // 3) de arriba hacia abajo, en lo que quede: taller, nombre, presentación, texto libre
  let arriba = m
  const poner = (t: string, alto: number, lineas: number, negrita = false) => {
    for (const r of renglones(t, letras(alto), lineas)) {
      if (arriba + alto > abajo + 0.01) return
      arriba += alto
      out.push({ tipo: "texto", x: x0, y: arriba, alto, texto: r, negrita })
      arriba += alto * 0.25
    }
  }
  const quedan = (alto: number) => Math.max(1, Math.floor((abajo - arriba) / (alto * 1.25)))
  if (c.taller && d.taller) poner(d.taller.toUpperCase(), base * 0.7, 1, true)
  const altoNombre = base * (dis.acomodo === "precio-grande" ? 0.9 : 1)
  // el nombre deja lugar a la presentación y al texto libre
  const reservar = (c.variante && d.variante ? 1 : 0) + (c.texto.trim() ? 1 : 0)
  if (c.nombre) poner(d.titulo, altoNombre, Math.min(3, Math.max(1, quedan(altoNombre) - reservar)), true)
  if (c.variante && d.variante) poner(d.variante, base * 0.8, 1)
  if (c.texto.trim()) poner(c.texto.trim(), base * 0.72, 1)
  return out
}

/** La etiqueta en SVG con medidas en mm (viewBox en mm). */
export function etiquetaSVG(d: DatosEtiqueta, dis: Diseno, borde = false): string {
  const { ancho: W, alto: H } = dis.medida
  const partes = piezas(d, dis).map((p) => {
    if (p.tipo === "texto")
      return `<text x="${p.x.toFixed(2)}" y="${p.y.toFixed(2)}" font-size="${p.alto.toFixed(2)}" font-family="Arial, Helvetica, sans-serif" font-weight="${p.negrita ? 700 : 400}" fill="#000">${esc(p.texto)}</text>`
    if (p.tipo === "barras") {
      const total = p.anchos.reduce((a, b) => a + b, 0)
      const u = p.ancho / total
      let x = p.x
      const barras: string[] = []
      p.anchos.forEach((w, i) => {
        if (i % 2 === 0) barras.push(`<rect x="${x.toFixed(3)}" y="${p.y.toFixed(2)}" width="${(w * u).toFixed(3)}" height="${p.alto.toFixed(2)}"/>`)
        x += w * u
      })
      const leyenda = p.leyenda ? `<text x="${(p.x + p.ancho / 2).toFixed(2)}" y="${(p.y + p.alto + Math.min(3, p.alto * 0.35)).toFixed(2)}" font-size="${Math.min(3, p.alto * 0.32).toFixed(2)}" font-family="Arial, Helvetica, sans-serif" text-anchor="middle">${esc(p.leyenda)}</text>` : ""
      return `<g fill="#000">${barras.join("")}</g>${leyenda}`
    }
    const n = p.modulos.length
    const u = p.lado / (n + 2)
    const cuadros: string[] = []
    p.modulos.forEach((fila, y) => fila.forEach((on, x) => on && cuadros.push(`<rect x="${(p.x + (x + 1) * u).toFixed(3)}" y="${(p.y + (y + 1) * u).toFixed(3)}" width="${u.toFixed(3)}" height="${u.toFixed(3)}"/>`)))
    return `<g fill="#000">${cuadros.join("")}</g>`
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"${borde ? ' stroke="#bbb" stroke-width="0.3"' : ""}/>${partes.join("")}</svg>`
}

/** ZPL para impresoras Zebra (203 dpi = 8 puntos por mm). Una etiqueta por renglón, con su cantidad. */
export function etiquetaZPL(d: DatosEtiqueta, dis: Diseno, cantidad: number, dpmm = 8): string {
  const { ancho: W, alto: H } = dis.medida
  const p2 = (mm: number) => Math.round(mm * dpmm)
  // ZPL no acepta ^ ni ~ dentro del texto
  const t = (s: string) => s.replace(/[\^~]/g, "")
  const lineas: string[] = ["^XA", "^CI28", `^PW${p2(W)}`, `^LL${p2(H)}`, "^LH0,0"]
  for (const p of piezas(d, dis)) {
    if (p.tipo === "texto") lineas.push(`^FO${p2(p.x)},${p2(p.y - p.alto)}^A0N,${p2(p.alto * 1.1)},${p2(p.alto * (p.negrita ? 1 : 0.9))}^FD${t(p.texto)}^FS`)
    else if (p.tipo === "barras") {
      const total = p.anchos.reduce((a, b) => a + b, 0)
      const modulo = Math.max(1, Math.floor(p2(p.ancho) / total))
      lineas.push(`^BY${modulo},2,${p2(p.alto)}`, `^FO${p2(p.x)},${p2(p.y)}^BCN,${p2(p.alto)},${p.leyenda ? "Y" : "N"},N,N^FD${t(d.sku)}^FS`)
    } else {
      const mag = Math.max(1, Math.min(10, Math.floor(p2(p.lado) / (p.modulos.length + 8))))
      lineas.push(`^FO${p2(p.x)},${p2(p.y)}^BQN,2,${mag}^FDMA,${t(d.liga)}^FS`)
    }
  }
  lineas.push(`^PQ${Math.max(1, Math.min(999, Math.round(cantidad)))}`, "^XZ")
  return lineas.join("\n")
}
