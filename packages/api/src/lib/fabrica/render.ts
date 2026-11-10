// @ts-nocheck
// Fábrica de contenido — generador de imágenes con la línea gráfica de HETNA.
// (Aprobada en "Ejemplos de contenido HETNA": fondo del tema + velo azul +
//  naranja + letra Archivo + liga/QR medidos.)
//
// Todo corre en el servidor con sharp (sin GPU):
//   fondo  -> foto de la biblioteca del tema (subida por HETNA o hecha con IA)
//             o, si no hay, una escena dibujada del tema
//   velo   -> degradado azul HETNA para que el texto se lea
//   texto  -> motor de texto de sharp (Pango) con la fuente Archivo incluida
//   QR     -> liga medida del Social Hub
import path from "path"
import sharp from "sharp"
import QRCode from "qrcode"

export const AZUL = "#142033"
export const NARANJA = "#C2560A"
export const NARANJA2 = "#F2A25F"
export const ORO = "#E8A33D"
export const VERDE = "#2E9E57"

export const FORMATOS = {
  "4:5": [1080, 1350],
  "1:1": [1080, 1080],
  "9:16": [1080, 1920],
  "16:9": [1920, 1080],
} as const
export type Formato = keyof typeof FORMATOS

const FUENTES = {
  500: path.resolve(__dirname, "../../../assets/fonts/Archivo-500.ttf"),
  800: path.resolve(__dirname, "../../../assets/fonts/Archivo-800.ttf"),
  900: path.resolve(__dirname, "../../../assets/fonts/Archivo-900.ttf"),
}
// En el build de Medusa los .ts quedan en .medusa/server; las fuentes viven en el paquete
// Busca assets/fonts subiendo desde este archivo y desde el directorio de trabajo
// (en desarrollo vive en packages/api; ya compilado, en .medusa/server).
const cacheFuente: Record<number, string> = {}
const fuente = (peso: 500 | 800 | 900) => {
  if (cacheFuente[peso]) return cacheFuente[peso]
  const fs = require("fs")
  const nombre = `assets/fonts/Archivo-${peso}.ttf`
  const bases = [__dirname, process.cwd()]
  for (const b of bases) {
    let d = b
    for (let i = 0; i < 7; i++) {
      const f = path.join(d, nombre)
      if (fs.existsSync(f)) return (cacheFuente[peso] = f)
      d = path.dirname(d)
    }
  }
  return (cacheFuente[peso] = FUENTES[peso])
}
const FAMILIA = { 500: "Archivo Medium", 800: "Archivo ExtraBold", 900: "Archivo Black" }

const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

/** Bloque de texto (con saltos de línea automáticos) como imagen transparente. */
export async function texto(t: string, o: { tam: number; peso?: 500 | 800 | 900; color?: string; ancho: number; alinear?: "left" | "centre"; interlineado?: number }) {
  const peso = o.peso || 800
  const markup = `<span foreground="${o.color || "#ffffff"}">${esc(t)}</span>`
  const img = sharp({
    text: { text: markup, font: `${FAMILIA[peso]} ${o.tam}`, fontfile: fuente(peso), width: Math.round(o.ancho), dpi: 72, rgba: true, wrap: "word", align: o.alinear === "centre" ? "centre" : "left", spacing: o.interlineado ?? Math.round(o.tam * -0.12) },
  })
  const { data, info } = await img.png().toBuffer({ resolveWithObject: true })
  return { buf: data, w: info.width, h: info.height }
}

export async function qr(url: string, lado: number) {
  return QRCode.toBuffer(url, { width: lado, margin: 1, color: { dark: AZUL, light: "#ffffff" }, errorCorrectionLevel: "M" })
}

// ---------------------------------------------------------------------
// Escenas dibujadas por tema (si no hay foto en la biblioteca)
// ---------------------------------------------------------------------
function azar(semilla: number) {
  let s = semilla >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

export const TEMAS = ["laser", "plasma", "router", "torno", "taller", "lamina", "impresion3d", "general"] as const
export type Tema = (typeof TEMAS)[number]

export function escenaSvg(tema: string, W: number, H: number, semilla = 7) {
  const az = azar(semilla)
  const lineas = (n: number, f: () => string) => Array.from({ length: n }, f).join("")
  const defs = `<defs>
    <radialGradient id="brillo"><stop offset="0" stop-color="#fff5d2"/><stop offset=".25" stop-color="#ff9628" stop-opacity=".85"/><stop offset="1" stop-color="#ff6e00" stop-opacity="0"/></radialGradient>
    <radialGradient id="arco"><stop offset="0" stop-color="#e6f0ff"/><stop offset=".2" stop-color="#96beff" stop-opacity=".85"/><stop offset=".5" stop-color="#ff8c28" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    <linearGradient id="acero" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a5058"/><stop offset="1" stop-color="#1a1d22"/></linearGradient>
    <linearGradient id="calido" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2a25f"/><stop offset=".35" stop-color="#7a4a2a"/><stop offset="1" stop-color="#141b26"/></linearGradient>
    <linearGradient id="metal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6c747e"/><stop offset=".35" stop-color="#eef2f6"/><stop offset=".6" stop-color="#9aa3ad"/><stop offset="1" stop-color="#3b4148"/></linearGradient>
  </defs>`
  let c = ""
  if (tema === "laser" || tema === "general") {
    const cx = W * 0.62, cy = H * 0.6
    c = `<rect width="${W}" height="${H}" fill="url(#acero)"/>` +
      lineas(Math.ceil((W + H) / 12), () => { const x = az() * (W + H) - H; return `<line x1="${x}" y1="0" x2="${x + H * 0.6}" y2="${H}" stroke="#fff" stroke-opacity=".05" stroke-width="2"/>` }) +
      [0, 1, 2].map((k) => `<rect x="${W * (0.1 + k * 0.3)}" y="${H * 0.18}" width="${W * 0.2}" height="${W * 0.2}" fill="none" stroke="#0a0a0a" stroke-opacity=".75" stroke-width="6"/><circle cx="${W * (0.2 + k * 0.3)}" cy="${H * 0.18 + W * 0.1}" r="${W * 0.045}" fill="none" stroke="#0a0a0a" stroke-opacity=".75" stroke-width="6"/>`).join("") +
      `<line x1="${W * 0.18}" y1="${cy}" x2="${cx}" y2="${cy}" stroke="#0a0a0a" stroke-width="7"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${W * 0.24}" fill="url(#brillo)"/>` +
      `<rect x="${cx - W * 0.035}" y="${cy - H * 0.2}" width="${W * 0.07}" height="${H * 0.17}" fill="#c9d0d8"/>` +
      lineas(160, () => { const a = Math.PI * (0.05 + az() * 0.9), l = W * (0.08 + az() * 0.38), s = az() > 0.5 ? 1 : -1; return `<line x1="${cx}" y1="${cy}" x2="${cx + Math.cos(a) * l * s}" y2="${cy - Math.sin(a) * l * 0.35 + az() * H * 0.25}" stroke="rgb(255,${150 + Math.round(az() * 90)},60)" stroke-opacity="${0.35 + az() * 0.6}" stroke-width="${1.5 + az() * 2.5}"/>` })
  } else if (tema === "plasma") {
    const cx = W * 0.5, cy = H * 0.6
    c = `<rect width="${W}" height="${H}" fill="#1b2230"/><rect y="${H * 0.58}" width="${W}" height="${H * 0.42}" fill="#555c66"/>` +
      lineas(14, () => `<rect x="${az() * W}" y="${H * 0.58}" width="4" height="${H * 0.42}" fill="#000" fill-opacity=".35"/>`) +
      `<circle cx="${cx}" cy="${cy}" r="${W * 0.5}" fill="url(#arco)"/><rect x="${cx - W * 0.05}" y="${cy - H * 0.28}" width="${W * 0.1}" height="${H * 0.25}" fill="#b8c0ca"/>` +
      lineas(240, () => `<rect x="${cx + (az() - 0.5) * W * 0.9}" y="${cy + az() * H * 0.4}" width="${3 + az() * 4}" height="${3 + az() * 4}" fill="rgb(255,${120 + Math.round(az() * 120)},40)" fill-opacity="${az()}"/>`)
  } else if (tema === "router") {
    c = `<rect width="${W}" height="${H}" fill="#b98a57"/>` +
      lineas(70, () => { const y = az() * H; return `<path d="M0 ${y} C ${W * 0.3} ${y + (az() - 0.5) * 50} ${W * 0.7} ${y + (az() - 0.5) * 50} ${W} ${y + (az() - 0.5) * 40}" stroke="rgb(110,70,35)" stroke-opacity="${0.08 + az() * 0.15}" stroke-width="${1 + az() * 4}" fill="none"/>` }) +
      `<path d="M${W * 0.15} ${H * 0.7} C ${W * 0.3} ${H * 0.45} ${W * 0.45} ${H * 0.9} ${W * 0.6} ${H * 0.62}" stroke="#462a12" stroke-opacity=".9" stroke-width="${W * 0.035}" stroke-linecap="round" fill="none"/>` +
      `<rect x="${W * 0.58}" y="${H * 0.2}" width="${W * 0.08}" height="${H * 0.38}" fill="#d9dee5"/><rect x="${W * 0.605}" y="${H * 0.56}" width="${W * 0.03}" height="${H * 0.07}" fill="#8f98a3"/>` +
      lineas(260, () => `<ellipse cx="${W * 0.6 + (az() - 0.5) * W * 0.5}" cy="${H * 0.62 + (az() - 0.5) * H * 0.3}" rx="${2 + az() * 5}" ry="${1 + az() * 2.5}" fill="rgb(232,200,150)" fill-opacity="${0.4 + az() * 0.6}"/>`)
  } else if (tema === "torno") {
    const y = H * 0.45, h = H * 0.18
    c = `<rect width="${W}" height="${H}" fill="#161b21"/><rect x="${W * 0.05}" y="${y}" width="${W * 0.9}" height="${h}" fill="url(#metal)"/>` +
      lineas(40, () => `<rect x="${W * (0.3 + az() * 0.25)}" y="${y}" width="3" height="${h}" fill="#000" fill-opacity=".25"/>`) +
      `<polygon points="${W * 0.55},${y + h + H * 0.12} ${W * 0.58},${y + h} ${W * 0.66},${y + h + H * 0.12}" fill="${NARANJA}"/>` +
      lineas(6, () => { const k = az() * 20; let d = ""; for (let t = 0; t < 30; t++) { const a = t * 0.5, rr = 4 + t * 1.8; d += `${t ? "L" : "M"}${W * 0.58 + Math.cos(a) * rr + t * 3 + k} ${y + h + Math.sin(a) * rr * 0.5 + t * 2.4} ` } return `<path d="${d}" stroke="rgb(220,170,90)" stroke-opacity=".85" stroke-width="2.5" fill="none"/>` })
  } else if (tema === "taller") {
    c = `<rect width="${W}" height="${H}" fill="url(#calido)"/>` +
      [0, 1, 2, 3].map((i) => `<polygon points="${W * (0.1 + i * 0.25)},0 ${W * (0.2 + i * 0.25)},0 ${W * (0.45 + i * 0.2)},${H} ${W * (0.25 + i * 0.2)},${H}" fill="#ffdcaa" fill-opacity=".10"/>`).join("") +
      `<g fill="#0e141d"><rect x="${W * 0.05}" y="${H * 0.55}" width="${W * 0.38}" height="${H * 0.25}"/><rect x="${W * 0.07}" y="${H * 0.4}" width="${W * 0.04}" height="${H * 0.15}"/><rect x="${W * 0.37}" y="${H * 0.4}" width="${W * 0.04}" height="${H * 0.15}"/><rect x="${W * 0.07}" y="${H * 0.38}" width="${W * 0.34}" height="${H * 0.03}"/><rect x="${W * 0.2}" y="${H * 0.41}" width="${W * 0.06}" height="${H * 0.1}"/><rect x="${W * 0.55}" y="${H * 0.45}" width="${W * 0.3}" height="${H * 0.35}"/></g>` +
      `<rect x="${W * 0.6}" y="${H * 0.52}" width="${W * 0.12}" height="${H * 0.08}" fill="${NARANJA2}" fill-opacity=".5"/><rect y="${H * 0.8}" width="${W}" height="${H * 0.2}" fill="#0b1018"/>`
  } else if (tema === "impresion3d") {
    c = `<rect width="${W}" height="${H}" fill="#1d2430"/><rect x="${W * 0.2}" y="${H * 0.2}" width="${W * 0.6}" height="${H * 0.04}" fill="#8f98a3"/><rect x="${W * 0.2}" y="${H * 0.2}" width="${W * 0.03}" height="${H * 0.55}" fill="#8f98a3"/><rect x="${W * 0.77}" y="${H * 0.2}" width="${W * 0.03}" height="${H * 0.55}" fill="#8f98a3"/><rect x="${W * 0.46}" y="${H * 0.24}" width="${W * 0.08}" height="${H * 0.08}" fill="#d9dee5"/>` +
      lineas(22, () => "") + Array.from({ length: 22 }, (_, i) => `<rect x="${W * (0.38 + Math.sin(i / 3) * 0.02)}" y="${H * 0.72 - i * H * 0.012}" width="${W * 0.24}" height="${H * 0.01}" rx="3" fill="${NARANJA2}" fill-opacity="${0.6 + (i % 2) * 0.3}"/>`).join("") +
      `<rect x="${W * 0.15}" y="${H * 0.73}" width="${W * 0.7}" height="${H * 0.03}" fill="#3b4148"/>`
  } else {
    // lámina (y respaldo)
    c = Array.from({ length: 9 }, (_, i) => `<rect x="${-W * 0.05 + i * 8}" y="${H * (0.06 + i * 0.105)}" width="${W * 1.1}" height="${H * 0.09}" fill="${i % 2 ? "#5f6872" : "#6d7681"}"/><rect x="${-W * 0.05 + i * 8}" y="${H * (0.06 + i * 0.105)}" width="${W * 1.1}" height="3" fill="#fff" fill-opacity=".18"/>`).join("")
    c = `<rect width="${W}" height="${H}" fill="#2a2f36"/>` + c
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs}${c}</svg>`
}

const veloSvg = (W: number, H: number, tipo: "normal" | "lateral" | "fuerte" = "normal") => {
  const stops =
    tipo === "fuerte"
      ? `<stop offset="0" stop-color="${AZUL}" stop-opacity=".9"/><stop offset="1" stop-color="${AZUL}" stop-opacity=".96"/>`
      : `<stop offset="0" stop-color="${AZUL}" stop-opacity=".74"/><stop offset=".28" stop-color="${AZUL}" stop-opacity=".25"/><stop offset=".52" stop-color="${AZUL}" stop-opacity=".34"/><stop offset=".8" stop-color="${AZUL}" stop-opacity=".9"/><stop offset="1" stop-color="${AZUL}" stop-opacity=".97"/>`
  const paso = Math.round(W * 0.065)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><linearGradient id="v" x1="0" y1="0" x2="${tipo === "lateral" ? 1 : 0}" y2="${tipo === "lateral" ? 0 : 1}">${tipo === "lateral" ? `<stop offset="0" stop-color="${AZUL}" stop-opacity=".93"/><stop offset=".55" stop-color="${AZUL}" stop-opacity=".62"/><stop offset="1" stop-color="${AZUL}" stop-opacity=".2"/>` : stops}</linearGradient><pattern id="g" width="${paso}" height="${paso}" patternUnits="userSpaceOnUse"><path d="M ${paso} 0 L 0 0 0 ${paso}" fill="none" stroke="#fff" stroke-opacity=".055" stroke-width="2"/></pattern></defs><rect width="${W}" height="${H}" fill="url(#v)"/><rect width="${W}" height="${H}" fill="url(#g)"/></svg>`
}

async function bajarImagen(url: string) {
  const r = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!r.ok) throw new Error(`No se pudo bajar la imagen (${r.status})`)
  return Buffer.from(await r.arrayBuffer())
}

/** Fondo del tema: foto (si hay) o escena dibujada, con el velo encima. */
export async function fondo(W: number, H: number, o: { tema?: string; foto_url?: string | null; velo?: "normal" | "lateral" | "fuerte"; semilla?: number }) {
  let base: Buffer
  try {
    base = o.foto_url ? await sharp(await bajarImagen(o.foto_url)).resize(W, H, { fit: "cover", position: "attention" }).png().toBuffer() : null
  } catch {
    base = null
  }
  if (!base) base = await sharp(Buffer.from(escenaSvg(o.tema || "general", W, H, o.semilla || 7))).png().toBuffer()
  return sharp(base).composite([{ input: Buffer.from(veloSvg(W, H, o.velo || "normal")) }]).png().toBuffer()
}

// ---------------------------------------------------------------------
// Piezas
// ---------------------------------------------------------------------

type Capa = { input: Buffer; left: number; top: number }

async function marca(tam: number) {
  const a = await texto("HETNA", { tam, peso: 900, color: NARANJA, ancho: tam * 6 })
  const b = await texto("CNC", { tam, peso: 500, color: "#ffffff", ancho: tam * 4 })
  return { a, b, w: Math.round(a.w + tam * 0.3 + b.w), h: Math.max(a.h, b.h) }
}

async function cinta(t: string, color: string, tam: number, colorTexto = "#ffffff", ancho = 900) {
  const tx = await texto(t.toUpperCase(), { tam, peso: 800, color: colorTexto, ancho })
  const pad = Math.round(tam * 0.55)
  const w = tx.w + pad * 2, h = tx.h + pad * 1.1
  const fondoC = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${Math.round(h)}"><rect width="${w}" height="${Math.round(h)}" rx="${Math.round(tam * 0.3)}" fill="${color}"/></svg>`)
  const img = await sharp(fondoC).composite([{ input: tx.buf, left: pad, top: Math.round(pad * 0.55) }]).png().toBuffer()
  return { buf: img, w, h: Math.round(h) }
}

export type Tarjeta = {
  formato?: Formato
  tema?: string
  foto_url?: string | null // foto de fondo (biblioteca o del taller)
  producto_url?: string | null // foto del producto en un recuadro
  cinta?: { texto: string; tono?: "naranja" | "oro" | "verde" }
  titulo: string
  sub?: string
  cita?: string
  estrellas?: number
  datos?: [string, string][]
  barras?: { etiqueta: string; pct: number; valor: string }[]
  cta?: string
  liga?: string // se muestra como texto y como QR
  liga_texto?: string // si no se quiere mostrar la URL (ej. "liga en el perfil")
  semilla?: number
}

const TONO = { naranja: [NARANJA, "#ffffff"], oro: [ORO, AZUL], verde: [VERDE, "#ffffff"] }

/** Tarjeta de publicación (4:5, 1:1 o 9:16). */
export async function tarjeta(t: Tarjeta) {
  const [W, H] = FORMATOS[t.formato || "4:5"]
  const M = Math.round(W * 0.07)
  const ancho = W - M * 2
  const u = W / 100 // unidad: 1% del ancho
  const capas: Capa[] = []
  let y = Math.round(t.formato === "9:16" ? H * 0.09 : M)
  const mk = await marca(Math.round(u * 6))
  capas.push({ input: mk.a.buf, left: M, top: y }, { input: mk.b.buf, left: Math.round(M + mk.a.w + u * 1.6), top: y })
  y += mk.h + Math.round(u * 3)
  if (t.cinta) {
    const [c1, c2] = TONO[t.cinta.tono || "naranja"]
    const ci = await cinta(t.cinta.texto, c1, Math.round(u * 3.6), c2, ancho)
    capas.push({ input: ci.buf, left: M, top: y })
    y += ci.h + Math.round(u * 3)
  }
  if (t.producto_url) {
    try {
      const alto = Math.round(H * 0.3)
      const ph = await sharp(await bajarImagen(t.producto_url)).resize(ancho, alto, { fit: "cover" }).png().toBuffer()
      const mascara = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}"><rect width="${ancho}" height="${alto}" rx="${Math.round(u * 2)}" fill="#fff"/></svg>`)
      const red = await sharp(ph).composite([{ input: mascara, blend: "dest-in" }]).png().toBuffer()
      capas.push({ input: red, left: M, top: y })
      y += alto + Math.round(u * 3)
    } catch {}
  }
  const tTam = Math.round(u * (t.titulo.length > 60 ? 7.4 : t.titulo.length > 36 ? 8.8 : 10.4))
  const ti = await texto(t.titulo, { tam: tTam, peso: 900, ancho, interlineado: -Math.round(tTam * 0.18) })
  capas.push({ input: ti.buf, left: M, top: y })
  y += ti.h + Math.round(u * 2.4)
  if (t.estrellas) {
    const es = await texto("★".repeat(Math.round(t.estrellas)), { tam: Math.round(u * 7), peso: 900, color: ORO, ancho })
    capas.push({ input: es.buf, left: M, top: y })
    y += es.h + Math.round(u * 1.6)
  }
  if (t.cita) {
    const ci = await texto(`“${t.cita}”`, { tam: Math.round(u * 5.8), peso: 800, ancho })
    capas.push({ input: ci.buf, left: M, top: y })
    y += ci.h + Math.round(u * 2)
  }
  if (t.sub) {
    const su = await texto(t.sub, { tam: Math.round(u * 4.2), peso: 500, color: "#dfe5ee", ancho })
    capas.push({ input: su.buf, left: M, top: y })
    y += su.h + Math.round(u * 2.4)
  }
  for (const [k, v] of t.datos || []) {
    const kk = await texto(k, { tam: Math.round(u * 4), peso: 800, color: NARANJA2, ancho: Math.round(ancho * 0.3) })
    const vv = await texto(v, { tam: Math.round(u * 4), peso: 500, ancho: Math.round(ancho * 0.68) })
    capas.push({ input: kk.buf, left: M, top: y }, { input: vv.buf, left: Math.round(M + ancho * 0.32), top: y })
    y += Math.max(kk.h, vv.h) + Math.round(u * 1.2)
  }
  if (t.barras?.length) {
    for (const b of t.barras) {
      const et = await texto(b.etiqueta, { tam: Math.round(u * 3.4), peso: 500, ancho: Math.round(ancho * 0.3) })
      const va = await texto(b.valor, { tam: Math.round(u * 3.6), peso: 800, ancho: Math.round(ancho * 0.2), alinear: "centre" })
      const bw = Math.round(ancho * 0.48), bh = Math.round(u * 2.8)
      const barra = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${bw}" height="${bh}"><rect width="${bw}" height="${bh}" rx="${bh / 2}" fill="#fff" fill-opacity=".14"/><rect width="${Math.max(bh, Math.round((bw * Math.min(100, b.pct)) / 100))}" height="${bh}" rx="${bh / 2}" fill="${NARANJA}"/></svg>`)
      capas.push({ input: et.buf, left: M, top: y }, { input: barra, left: Math.round(M + ancho * 0.32), top: y + Math.round(u * 0.6) }, { input: va.buf, left: Math.round(M + ancho * 0.82), top: y })
      y += Math.max(et.h, bh) + Math.round(u * 1.8)
    }
  }
  // Pie: llamada a la acción + QR
  const lado = Math.round(u * 20)
  const pieY = H - M - lado
  if (t.liga) {
    const q = await qr(t.liga, lado - Math.round(u * 3))
    const marco = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}"><rect width="${lado}" height="${lado}" rx="${Math.round(u * 1.6)}" fill="#fff"/></svg>`)
    const qrm = await sharp(marco).composite([{ input: q, left: Math.round(u * 1.5), top: Math.round(u * 1.5) }]).png().toBuffer()
    capas.push({ input: qrm, left: W - M - lado, top: pieY })
  }
  if (t.cta) {
    const anchoCta = ancho - (t.liga ? lado + Math.round(u * 3) : 0)
    const ct = await texto(t.cta, { tam: Math.round(u * 5.2), peso: 800, ancho: anchoCta })
    const lt = await texto(t.liga_texto || (t.liga || "").replace(/^https?:\/\//, ""), { tam: Math.round(u * 3.4), peso: 500, color: NARANJA2, ancho: anchoCta })
    const bloque = ct.h + Math.round(u * 1) + lt.h
    capas.push({ input: ct.buf, left: M, top: H - M - bloque }, { input: lt.buf, left: M, top: H - M - lt.h })
  }
  const base = await fondo(W, H, { tema: t.tema, foto_url: t.foto_url, velo: t.barras?.length ? "lateral" : "normal", semilla: t.semilla })
  return sharp(base).composite(capas).png({ compressionLevel: 8 }).toBuffer()
}

/** Lámina de carrusel (4:5). */
export async function lamina(l: { num: number; total: number; titulo: string; texto?: string; portada?: boolean; cierre?: { cta: string; liga_texto: string }; tema?: string; foto_url?: string | null }) {
  const [W, H] = FORMATOS["4:5"]
  const M = Math.round(W * 0.07), u = W / 100, ancho = W - M * 2
  const capas: Capa[] = []
  let y = M
  if (l.portada || l.cierre) {
    const mk = await marca(Math.round(u * 6))
    capas.push({ input: mk.a.buf, left: M, top: y }, { input: mk.b.buf, left: Math.round(M + mk.a.w + u * 1.6), top: y })
    y += mk.h + Math.round(u * 6)
  } else {
    const n = await texto(`${l.num} / ${l.total}`, { tam: Math.round(u * 3.6), peso: 500, color: NARANJA2, ancho })
    capas.push({ input: n.buf, left: M, top: y })
    y += n.h + Math.round(u * 6)
  }
  const tTam = Math.round(u * (l.portada ? 11 : 8.6))
  const ti = await texto(l.titulo, { tam: tTam, peso: 900, ancho, interlineado: -Math.round(tTam * 0.18) })
  capas.push({ input: ti.buf, left: M, top: y })
  y += ti.h + Math.round(u * 3)
  if (l.texto) {
    const tx = await texto(l.texto, { tam: Math.round(u * 4.6), peso: 500, color: "#e4e9f0", ancho })
    capas.push({ input: tx.buf, left: M, top: y })
  }
  const pie = await texto(l.cierre ? l.cierre.cta : l.portada ? "Desliza →" : `${l.num} / ${l.total}`, { tam: Math.round(u * (l.cierre ? 5 : 4)), peso: 800, ancho })
  capas.push({ input: pie.buf, left: M, top: H - M - pie.h - (l.cierre ? Math.round(u * 6) : 0) })
  if (l.cierre) {
    const lt = await texto(l.cierre.liga_texto, { tam: Math.round(u * 3.6), peso: 500, color: NARANJA2, ancho })
    capas.push({ input: lt.buf, left: M, top: H - M - lt.h })
  }
  const base = await fondo(W, H, { tema: l.tema || (l.portada || l.cierre ? "laser" : "lamina"), foto_url: l.foto_url, velo: l.portada || l.cierre ? "normal" : "fuerte", semilla: l.num * 11 })
  return sharp(base).composite(capas).png({ compressionLevel: 8 }).toBuffer()
}

/** Cuadro de video vertical 9:16: gancho, frase con subtítulo o cierre con QR. */
export async function cuadroVideo(c: { tipo: "gancho" | "frase" | "cierre"; texto: string; tema?: string; foto_url?: string | null; liga?: string; credito?: string; semilla?: number }) {
  const [W, H] = FORMATOS["9:16"]
  const M = Math.round(W * 0.08), u = W / 100, ancho = Math.round(W * 0.78)
  const capas: Capa[] = []
  if (c.tipo === "cierre") {
    const mk = await marca(Math.round(u * 10))
    const x = Math.round((W - mk.w) / 2)
    capas.push({ input: mk.a.buf, left: x, top: Math.round(H * 0.26) }, { input: mk.b.buf, left: Math.round(x + mk.a.w + u * 2.6), top: Math.round(H * 0.26) })
    const t = await texto(c.texto, { tam: Math.round(u * 7.2), peso: 900, ancho: W - M * 2, alinear: "centre" })
    capas.push({ input: t.buf, left: Math.round((W - t.w) / 2), top: Math.round(H * 0.36) })
    if (c.liga) {
      const lado = Math.round(u * 38)
      const q = await qr(c.liga, lado - Math.round(u * 4))
      const marco = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}"><rect width="${lado}" height="${lado}" rx="${Math.round(u * 2)}" fill="#fff"/></svg>`)
      capas.push({ input: await sharp(marco).composite([{ input: q, left: Math.round(u * 2), top: Math.round(u * 2) }]).png().toBuffer(), left: Math.round((W - lado) / 2), top: Math.round(H * 0.36 + t.h + u * 6) })
    }
    const pie = await texto("liga en el perfil · comenta COTIZA", { tam: Math.round(u * 4.4), peso: 500, color: NARANJA2, ancho: W - M * 2, alinear: "centre" })
    capas.push({ input: pie.buf, left: Math.round((W - pie.w) / 2), top: Math.round(H * 0.74) })
    const base = await fondo(W, H, { tema: c.tema || "laser", foto_url: c.foto_url, velo: "fuerte", semilla: c.semilla })
    return sharp(base).composite(capas).png().toBuffer()
  }
  if (c.tipo === "gancho") {
    const t = await texto(c.texto, { tam: Math.round(u * 9.4), peso: 900, ancho, interlineado: -Math.round(u * 1.6) })
    capas.push({ input: t.buf, left: M, top: Math.round(H * 0.16) })
  } else {
    // Subtítulo: cuadro oscuro detrás del texto, arriba de la zona de botones de la app
    const t = await texto(c.texto, { tam: Math.round(u * 6), peso: 800, ancho: Math.round(W * 0.7), alinear: "centre" })
    const pad = Math.round(u * 2.4)
    const caja = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${t.w + pad * 2}" height="${t.h + pad * 2}"><rect width="${t.w + pad * 2}" height="${t.h + pad * 2}" rx="${Math.round(u * 2)}" fill="#000" fill-opacity=".72"/></svg>`)
    const top = Math.round(H * 0.7 - t.h)
    capas.push({ input: caja, left: Math.round((W * 0.88 - t.w) / 2) - pad, top: top - pad }, { input: t.buf, left: Math.round((W * 0.88 - t.w) / 2), top })
  }
  if (c.credito) {
    const cr = await texto(`Hecho por ${c.credito}`, { tam: Math.round(u * 4.2), peso: 800, ancho })
    capas.push({ input: cr.buf, left: M, top: Math.round(H * 0.1) })
  }
  const base = await fondo(W, H, { tema: c.tema || "laser", foto_url: c.foto_url, velo: "normal", semilla: c.semilla })
  return sharp(base).composite(capas).png().toBuffer()
}

/** Miniatura de YouTube (16:9). */
export async function miniatura(m: { titulo: string; tema?: string; foto_url?: string | null }) {
  const [W, H] = FORMATOS["16:9"]
  const M = Math.round(W * 0.05), u = W / 100
  const t = await texto(m.titulo, { tam: Math.round(u * 6.4), peso: 900, ancho: Math.round(W * 0.62), interlineado: -Math.round(u * 1.2) })
  const mk = await marca(Math.round(u * 3.4))
  const base = await fondo(W, H, { tema: m.tema || "laser", foto_url: m.foto_url, velo: "lateral" })
  return sharp(base)
    .composite([
      { input: mk.a.buf, left: M, top: M },
      { input: mk.b.buf, left: Math.round(M + mk.a.w + u), top: M },
      { input: t.buf, left: M, top: Math.round((H - t.h) / 2) },
    ])
    .png()
    .toBuffer()
}

/** Escena 16:9 del video largo: imagen del tema con velo suave, marca y, si toca, el título del capítulo. */
export async function escenaLarga(e: { foto_url?: string | null; tema?: string; capitulo?: string | null; semilla?: number }) {
  const [W, H] = FORMATOS["16:9"]
  const u = W / 100, M = Math.round(W * 0.04)
  const capas: Capa[] = []
  const mk = await marca(Math.round(u * 2.2))
  capas.push({ input: mk.a.buf, left: Math.round(W - M - mk.w), top: M }, { input: mk.b.buf, left: Math.round(W - M - mk.w + mk.a.w + u * 0.6), top: M })
  if (e.capitulo) {
    const ci = await cinta(e.capitulo, NARANJA, Math.round(u * 1.9), "#ffffff", Math.round(W * 0.6))
    capas.push({ input: ci.buf, left: M, top: M })
  }
  // Velo más ligero que en las tarjetas: aquí manda la imagen; abajo se oscurece para los subtítulos
  let base: Buffer
  try {
    base = e.foto_url ? await sharp(await bajarImagen(e.foto_url)).resize(W, H, { fit: "cover", position: "attention" }).png().toBuffer() : null
  } catch {
    base = null
  }
  if (!base) base = await sharp(Buffer.from(escenaSvg(e.tema || "taller", W, H, e.semilla || 5))).png().toBuffer()
  const velo = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><linearGradient id="v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${AZUL}" stop-opacity=".35"/><stop offset=".55" stop-color="${AZUL}" stop-opacity=".05"/><stop offset="1" stop-color="${AZUL}" stop-opacity=".7"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#v)"/></svg>`)
  return sharp(base).composite([{ input: velo }, ...capas]).png().toBuffer()
}
