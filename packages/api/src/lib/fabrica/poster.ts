// @ts-nocheck
// Imágenes de promoción con el estilo nuevo (el mismo de los videos animados):
// fondos de tema, letra Archivo, dibujos de línea, la foto del producto o la
// captura completa en su tarjeta, botón y QR de la liga medida.
//
// Se dibujan como HTML y se toman con Chrome sin pantalla (el que deja
// scripts/desplegar.sh en /opt/hyperframes): unos 2 segundos por imagen.
// Si no hay Chrome o algo falla, devuelve null y se usa la tarjeta de siempre.
import { spawn, spawnSync } from "child_process"
import fs from "fs"
import os from "os"
import path from "path"
import QRCode from "qrcode"
import sharp from "sharp"

import { carpetaFuentes, lamina, miniatura } from "./render"
import { ICONOS, TEMAS, acomodarTitulo, iconoPara } from "./hyperframes"

const DIR = () => process.env.HYPERFRAMES_DIR || "/opt/hyperframes"
const INK = "#142033"
const ACC = "#C2560A"

let rutaChrome: string | null | undefined
/** Chrome para tomar la imagen: el de chrome-path (plan B), HYPERFRAMES_BROWSER_PATH o el de HyperFrames. */
export function chromeBin(): string | null {
  if (rutaChrome !== undefined) return rutaChrome
  const candidatos = [process.env.HYPERFRAMES_BROWSER_PATH]
  try {
    candidatos.push(fs.readFileSync(path.join(DIR(), "chrome-path"), "utf8").trim())
  } catch {}
  const bin = process.env.HYPERFRAMES_BIN || path.join(DIR(), "node_modules", ".bin", "hyperframes")
  if (fs.existsSync(bin)) {
    const r = spawnSync(bin, ["browser", "path"], { encoding: "utf8", timeout: 20_000, env: { ...process.env, HF_CLI_TELEMETRY_DISABLED: "1", DO_NOT_TRACK: "1" } })
    candidatos.push(String(r.stdout || "").trim().split("\n").pop())
  }
  rutaChrome = candidatos.find((c) => c && fs.existsSync(c)) || null
  return rutaChrome
}
export const posterListo = () => process.env.POSTER_DESACTIVAR !== "1" && !!chromeBin()

// Palabras que nunca se resaltan
const RELLENO = new Set("para como cómo pero porque desde hasta sobre entre este esta estos estas tiene tienen with that this your from what".split(" "))

const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

export type Poster = {
  formato?: "4:5" | "9:16"
  tema?: string
  cinta?: string // etiqueta arriba ("Día de las Madres", "HETNA Cotizador")
  titulo: string
  foto?: string | null // foto del producto o captura (URL o ruta)
  fondo?: string | null // foto de fondo (sólo tema "foto")
  icono?: string // dibujo si no hay foto
  cta?: string
  liga?: string // QR + texto
  liga_texto?: string // en lugar de la URL (p. ej. "liga en el perfil")
  /** tarjeta (una imagen) | lámina de carrusel: portada, punto o cierre | miniatura de YouTube 16:9 */
  modo?: "tarjeta" | "portada" | "punto" | "cierre" | "miniatura"
  sub?: string // texto de apoyo de una lámina (debajo del punto)
  num?: number
  total?: number
}

/** Tamaño en px según el modo y el formato. */
export const medidas = (p: Poster): [number, number] => (p.modo === "miniatura" ? [1280, 720] : [1080, p.formato === "9:16" ? 1920 : 1350])

const CSS_BASE = (T: any, ancho: number, alto: number) => `
@font-face { font-family: "Archivo Black"; src: url("Archivo-900.ttf"); }
@font-face { font-family: "Archivo XB"; src: url("Archivo-800.ttf"); }
* { margin:0; padding:0; box-sizing:border-box; }
html, body { width:${ancho}px; height:${alto}px; overflow:hidden; background:${T.fondo}; }
body { position:relative; font-family:"Archivo Black", sans-serif; color:${T.texto}; }
.fondo { position:absolute; inset:0; background-color:${T.fondo}; ${T.patron} }
.foto-fondo { position:absolute; inset:0; background:url("fondo.jpg") center/cover; }
.velo { position:absolute; inset:0; background:linear-gradient(180deg, rgba(20,32,51,.9) 0%, rgba(20,32,51,.6) 45%, rgba(20,32,51,.92) 100%); }
.acento { color:${T.acento}; }
.dibujo svg { overflow:visible; }
.dibujo svg [stroke="${INK}"] { stroke:${T.trazo}; } .dibujo svg [fill="${INK}"] { fill:${T.trazo}; } .dibujo svg [fill="#fff"][stroke] { fill:${T.relleno}; }
.dibujo svg [fill="${ACC}"] { fill:${T.acento}; } .dibujo svg [stroke="${ACC}"] { stroke:${T.acento}; }
.tarjeta { background:#fff; border:6px solid ${T.trazo}; border-radius:36px; box-shadow:0 18px 0 ${T.sombra}; overflow:hidden; display:flex; align-items:center; justify-content:center; }
.tarjeta img { width:100%; height:100%; object-fit:contain; }
`

/** Reparte un texto en renglones parejos (máx. n) y da el tamaño de letra para que quepa en `ancho`. */
function renglones(t: string, ancho: number, max: number, min: number, n = 3) {
  const palabras = String(t || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean)
  const lineas: string[] = []
  let act = ""
  const maxCar = Math.max(10, Math.ceil(String(t || "").length / n))
  for (const w of palabras) {
    if (act && (act + " " + w).length > maxCar && lineas.length < n - 1) lineas.push(act), (act = w)
    else act = act ? `${act} ${w}` : w
  }
  if (act) lineas.push(act)
  const tam = Math.max(min, Math.min(max, Math.floor(ancho / (Math.max(1, ...lineas.map((l) => l.length)) * 0.6))))
  const ac = palabras.filter((w) => w.replace(/[¿?¡!.,:]/g, "").length > 3 && !RELLENO.has(w.toLowerCase().replace(/[¿?¡!.,:]/g, ""))).pop() || ""
  const html = lineas.map((l) => l.split(" ").map((w) => (w === ac ? `<span class="acento">${esc(w)}</span>` : esc(w))).join(" ")).join("<br>")
  return { html, tam, n: lineas.length }
}

/** Lámina de carrusel (4:5): portada con foto o dibujo, puntos numerados y cierre con botón y QR. */
export function htmlLamina(p: Poster, o: { foto?: boolean; fondo?: boolean; qr?: string } = {}) {
  const [W, H] = medidas(p)
  const T = TEMAS[p.tema === "foto" && !o.fondo ? "plano" : p.tema || "plano"] || TEMAS.plano
  const sobre = T.oscuro ? INK : "#ffffff"
  const ic = ICONOS[p.icono && p.icono !== "maquina" ? p.icono : iconoPara(p.titulo)] || ICONOS.engrane
  const pagina = p.total ? `<div class="pag">${p.num || 1}/${p.total}</div>` : ""
  let cuerpo = ""
  if (p.modo === "punto") {
    const r = renglones(p.titulo, 900, p.sub ? 76 : 92, 46, 4)
    const sub = p.sub ? `<div class="sub">${esc(String(p.sub).slice(0, 260))}</div>` : ""
    cuerpo = `<div class="num">${Math.max(1, (p.num || 2) - 1)}</div><div class="col"><div class="texto-p" style="font-size:${r.tam}px">${r.html}</div>${sub}</div><div class="dibujo chico"><svg viewBox="-10 -20 220 230" width="${p.sub ? 200 : 260}" height="${p.sub ? 200 : 260}">${ic}</svg></div>`
  } else if (p.modo === "cierre") {
    const r = renglones(p.titulo || p.cta || "", 900, 96, 56, 3)
    const liga = (p.liga_texto || p.liga || "hetnacnc.com").replace(/^https?:\/\//, "")
    cuerpo = `<div class="texto cierre-t" style="font-size:${r.tam}px">${r.html}</div><div class="cta">${esc(p.cta || "")}</div><div class="liga">${esc(liga)}</div>${o.qr ? `<div class="qr">${o.qr}</div>` : ""}`
  } else {
    const r = renglones(p.titulo, 920, 104, 56, 3)
    cuerpo = `<div class="texto portada-t" style="font-size:${r.tam}px">${r.html}</div><div class="medio" style="top:${300 + r.n * r.tam}px">${o.foto ? `<div class="tarjeta" style="width:100%;height:100%"><img src="foto.jpg" alt=""></div>` : `<div class="dibujo"><svg viewBox="-10 -20 220 230" width="440" height="440">${ic}</svg></div>`}</div><div class="desliza">Desliza →</div>`
  }
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS_BASE(T, W, H)}
.marca { position:absolute; left:80px; top:70px; font-size:44px; white-space:nowrap; }
.pag { position:absolute; right:80px; top:70px; font-family:"Archivo XB"; font-size:34px; color:${sobre}; background:${T.acento}; border-radius:999px; padding:8px 24px; }
.cinta { position:absolute; left:80px; top:150px; font-family:"Archivo XB"; font-size:30px; color:${T.acento}; }
.texto { position:absolute; left:80px; width:920px; line-height:1; letter-spacing:-.02em; }
.portada-t { top:220px; }
.medio { position:absolute; left:80px; width:920px; bottom:170px; display:flex; align-items:center; justify-content:center; }
.desliza { position:absolute; right:80px; bottom:80px; font-family:"Archivo XB"; font-size:36px; color:${T.acento}; }
.num { position:absolute; left:80px; top:240px; width:170px; height:170px; border-radius:40px; background:${T.acento}; color:${sobre}; font-size:110px; display:flex; align-items:center; justify-content:center; }
.texto:not(.portada-t):not(.cierre-t) { top:470px; }
.chico { position:absolute; right:80px; bottom:90px; }
.col { position:absolute; left:80px; width:920px; top:460px; display:flex; flex-direction:column; gap:28px; }
.texto-p { line-height:1; letter-spacing:-.02em; }
.sub { font-family:"Archivo XB"; font-size:38px; line-height:1.25; opacity:.85; max-width:780px; }
.cierre-t { top:230px; }
.cta { position:absolute; left:80px; top:760px; font-size:56px; color:${sobre}; background:${T.acento}; border-radius:28px; padding:26px 44px; white-space:nowrap; max-width:920px; overflow:hidden; text-overflow:ellipsis; }
.liga { position:absolute; left:80px; top:930px; font-family:"Archivo XB"; font-size:40px; }
.qr { position:absolute; right:80px; bottom:80px; width:240px; height:240px; background:#fff; border-radius:24px; padding:14px; }
.qr svg { width:100%; height:100%; display:block; }
</style></head><body><div class="fondo"></div>${o.fondo ? `<div class="foto-fondo"></div><div class="velo"></div>` : ""}
<div class="marca"><span class="acento">HETNA</span> CNC</div>${pagina}${p.cinta ? `<div class="cinta">${esc(p.cinta)}</div>` : ""}
${cuerpo}</body></html>`
}

/** Miniatura de YouTube (1280x720): título enorme a la izquierda, foto o dibujo a la derecha. */
export function htmlMiniatura(p: Poster, o: { foto?: boolean; fondo?: boolean } = {}) {
  const T = TEMAS[p.tema === "foto" && !o.fondo ? "plano" : p.tema || "plano"] || TEMAS.plano
  const ic = ICONOS[p.icono && p.icono !== "maquina" ? p.icono : iconoPara(p.titulo)] || ICONOS.engrane
  const r = renglones(p.titulo, 700, 110, 54, 3)
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS_BASE(T, 1280, 720)}
.marca { position:absolute; left:60px; top:44px; font-size:38px; white-space:nowrap; }
.texto { position:absolute; left:60px; width:720px; top:${360 - (r.n * r.tam) / 2 + 20}px; font-size:${r.tam}px; line-height:.98; letter-spacing:-.02em; }
.der { position:absolute; right:50px; top:110px; width:430px; height:500px; display:flex; align-items:center; justify-content:center; }
.barra { position:absolute; left:0; right:0; bottom:0; height:16px; background:${T.acento}; }
</style></head><body><div class="fondo"></div>${o.fondo ? `<div class="foto-fondo"></div><div class="velo"></div>` : ""}
<div class="marca"><span class="acento">HETNA</span> CNC</div>
<div class="texto">${r.html}</div>
<div class="der">${o.foto ? `<div class="tarjeta" style="width:100%;height:100%"><img src="foto.jpg" alt=""></div>` : `<div class="dibujo"><svg viewBox="-10 -20 220 230" width="430" height="430">${ic}</svg></div>`}</div>
<div class="barra"></div></body></html>`
}

async function traer(src: string, destino: string) {
  if (/^https?:\/\//.test(src)) {
    const r = await fetch(src, { signal: AbortSignal.timeout(30_000) })
    if (!r.ok) throw new Error(`descarga ${r.status}`)
    fs.writeFileSync(destino, Buffer.from(await r.arrayBuffer()))
  } else fs.copyFileSync(src, destino)
}

/** HTML del póster (se puede probar sin Chrome). */
export function htmlPoster(p: Poster, o: { foto?: boolean; fondo?: boolean; qr?: string } = {}) {
  if (p.modo === "miniatura") return htmlMiniatura(p, o)
  if (p.modo === "portada" || p.modo === "punto" || p.modo === "cierre") return htmlLamina(p, o)
  const alto = p.formato === "9:16" ? 1920 : 1350
  const largo = p.formato === "9:16"
  const T = TEMAS[p.tema === "foto" && !o.fondo ? "plano" : p.tema || "plano"] || TEMAS.plano
  const sobreAcento = T.oscuro ? INK : "#ffffff"
  // Título: hasta 3 renglones, tamaño según el más largo
  const palabras = String(p.titulo || "").replace(/\s+/g, " ").trim().split(" ")
  const lineas: string[] = []
  let act = ""
  const maxCar = Math.max(12, Math.ceil(String(p.titulo).length / 3))
  for (const w of palabras) {
    if (act && (act + " " + w).length > maxCar && lineas.length < 2) lineas.push(act), (act = w)
    else act = act ? `${act} ${w}` : w
  }
  if (act) lineas.push(act)
  const tam = Math.max(56, Math.min(largo ? 112 : 100, Math.floor(920 / (Math.max(...lineas.map((l) => l.length)) * 0.6))))
  const ac = palabras.filter((w) => w.replace(/[¿?¡!.,:]/g, "").length > 3 && !RELLENO.has(w.toLowerCase().replace(/[¿?¡!.,:]/g, ""))).pop() || ""
  const titulo = lineas.map((l) => l.split(" ").map((w) => (w === ac ? `<span class="acento">${esc(w)}</span>` : esc(w))).join(" ")).join("<br>")
  const ic = ICONOS[p.icono && p.icono !== "maquina" ? p.icono : iconoPara(p.titulo)] || ICONOS.engrane
  const yTit = largo ? 300 : 210
  const yMedio = yTit + lineas.length * tam * 0.98 + (largo ? 90 : 50)
  const hMedio = (largo ? 1380 : 1030) - yMedio // termina antes del botón y el QR
  const liga = (p.liga_texto || p.liga || "hetnacnc.com").replace(/^https?:\/\//, "")
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: "Archivo Black"; src: url("Archivo-900.ttf"); }
@font-face { font-family: "Archivo XB"; src: url("Archivo-800.ttf"); }
* { margin:0; padding:0; box-sizing:border-box; }
html, body { width:1080px; height:${alto}px; overflow:hidden; background:${T.fondo}; }
body { position:relative; font-family:"Archivo Black", sans-serif; color:${T.texto}; }
.fondo { position:absolute; inset:0; background-color:${T.fondo}; ${T.patron} }
.foto-fondo { position:absolute; inset:0; background:url("fondo.jpg") center/cover; }
.velo { position:absolute; inset:0; background:linear-gradient(180deg, rgba(20,32,51,.9) 0%, rgba(20,32,51,.6) 45%, rgba(20,32,51,.92) 100%); }
.marca { position:absolute; left:80px; top:${largo ? 150 : 70}px; font-size:44px; white-space:nowrap; }
.cinta { position:absolute; right:80px; top:${largo ? 150 : 70}px; max-width:560px; font-family:"Archivo XB"; font-size:30px; color:${sobreAcento}; background:${T.acento}; border-radius:999px; padding:12px 28px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.acento { color:${T.acento}; }
.titulo { position:absolute; left:80px; width:920px; top:${yTit}px; font-size:${tam}px; line-height:.98; letter-spacing:-.02em; }
.medio { position:absolute; left:80px; width:920px; top:${yMedio}px; height:${hMedio}px; display:flex; align-items:center; justify-content:center; }
.tarjeta { width:100%; height:100%; background:#fff; border:6px solid ${T.trazo}; border-radius:36px; box-shadow:0 18px 0 ${T.sombra}; overflow:hidden; display:flex; align-items:center; justify-content:center; }
.tarjeta img { width:100%; height:100%; object-fit:contain; }
.dibujo svg { width:${Math.min(520, hMedio)}px; height:${Math.min(520, hMedio)}px; overflow:visible; }
.dibujo svg [stroke="${INK}"] { stroke:${T.trazo}; } .dibujo svg [fill="${INK}"] { fill:${T.trazo}; } .dibujo svg [fill="#fff"][stroke] { fill:${T.relleno}; }
.dibujo svg [fill="${ACC}"] { fill:${T.acento}; } .dibujo svg [stroke="${ACC}"] { stroke:${T.acento}; }
.pie { position:absolute; left:80px; right:80px; bottom:${largo ? 260 : 70}px; height:200px; display:flex; align-items:center; gap:36px; }
.pie .izq { flex:1; min-width:0; }
.cta { display:inline-block; max-width:100%; font-size:${String(p.cta || "").length > 22 ? 40 : 50}px; color:${sobreAcento}; background:${T.acento}; border-radius:24px; padding:22px 36px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.liga { margin-top:18px; font-family:"Archivo XB"; font-size:34px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.qr { width:200px; height:200px; background:#fff; border-radius:20px; padding:12px; flex:none; }
.qr svg { width:100%; height:100%; display:block; }
</style></head><body>
<div class="fondo"></div>${o.fondo ? `<div class="foto-fondo"></div><div class="velo"></div>` : ""}
<div class="marca"><span class="acento">HETNA</span> CNC</div>
${p.cinta ? `<div class="cinta">${esc(p.cinta)}</div>` : ""}
<div class="titulo">${titulo}</div>
<div class="medio">${o.foto ? `<div class="tarjeta"><img src="foto.jpg" alt=""></div>` : `<div class="dibujo"><svg viewBox="-10 -20 220 230">${ic}</svg></div>`}</div>
<div class="pie"><div class="izq">${p.cta ? `<div class="cta">${esc(p.cta)}</div>` : ""}<div class="liga">${esc(liga)}</div></div>${o.qr ? `<div class="qr">${o.qr}</div>` : ""}</div>
</body></html>`
}

let cola: Promise<any> = Promise.resolve()

/** PNG del póster, o null (sin Chrome o si falla: se usa la tarjeta de siempre). */
export async function poster(p: Poster, logger?: any): Promise<Buffer | null> {
  if (!posterListo()) return null
  const turno = cola.then(() => hacerPoster(p, logger))
  cola = turno.catch(() => null)
  return turno
}

async function hacerPoster(p: Poster, logger?: any) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hetna-poster-"))
  try {
    for (const n of [800, 900]) fs.copyFileSync(path.join(carpetaFuentes(), `Archivo-${n}.ttf`), path.join(dir, `Archivo-${n}.ttf`))
    let foto = false
    if (p.foto) {
      try {
        const crudo = path.join(dir, "foto-original")
        await traer(p.foto, crudo)
        const m = await sharp(crudo).metadata()
        if (Math.min(m.width || 0, m.height || 0) >= 300) {
          const alta = (m.height || 0) / Math.max(1, m.width || 1) > 1.4 // captura de celular: la parte de arriba
          await sharp(crudo).rotate().resize(1000, 900, alta ? { fit: "cover", position: "top" } : { fit: "contain", background: "#ffffff" }).flatten({ background: "#ffffff" }).jpeg({ quality: 88 }).toFile(path.join(dir, "foto.jpg"))
          foto = true
        }
      } catch (e) {
        logger?.warn?.(`[poster] foto: ${(e as Error).message}`)
      }
    }
    let fondo = false
    if (p.tema === "foto" && p.fondo) {
      try {
        const crudo = path.join(dir, "fondo-original")
        await traer(p.fondo, crudo)
        await sharp(crudo).rotate().resize(medidas(p)[0], medidas(p)[1], { fit: "cover" }).blur(7).modulate({ saturation: 0.85 }).jpeg({ quality: 80 }).toFile(path.join(dir, "fondo.jpg"))
        fondo = true
      } catch {}
    }
    const qr = p.liga ? await QRCode.toString(p.liga, { type: "svg", margin: 0, color: { dark: INK, light: "#ffffff" }, errorCorrectionLevel: "M" }) : ""
    fs.writeFileSync(path.join(dir, "index.html"), htmlPoster(p, { foto, fondo, qr }))
    const [ancho, alto] = medidas(p)
    const salida = path.join(dir, "poster.png")
    const ok = await new Promise<boolean>((res) => {
      const args = ["--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1", `--window-size=${ancho},${alto}`, "--virtual-time-budget=4000", `--screenshot=${salida}`, `file://${path.join(dir, "index.html")}`]
      const usaNice = process.platform === "linux" && fs.existsSync("/usr/bin/nice")
      const c = spawn(usaNice ? "/usr/bin/nice" : chromeBin()!, usaNice ? ["-n", "10", chromeBin()!, ...args] : args, { stdio: "ignore", detached: true })
      const t = setTimeout(() => {
        try {
          process.kill(-c.pid!, "SIGKILL")
        } catch {}
        res(false)
      }, 60_000)
      c.on("close", () => {
        clearTimeout(t)
        try {
          process.kill(-c.pid!, "SIGKILL")
        } catch {}
        res(fs.existsSync(salida))
      })
      c.on("error", () => (clearTimeout(t), res(false)))
    })
    if (!ok) throw new Error("Chrome no tomó la imagen")
    // Chrome a veces deja la ventana unos px distinta: se fija al tamaño exacto
    return await sharp(salida).resize(ancho, alto, { fit: "cover", position: "top" }).png().toBuffer()
  } catch (e) {
    logger?.warn?.(`[poster] ${(e as Error).message}; se usa la tarjeta de siempre`)
    return null
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

/** Opciones del estilo nuevo para carruseles y miniaturas (un tema por carrusel). */
export type Estilo = { activo: boolean; tema: string; icono?: string; cinta?: string; liga?: string; logger?: any }

/** Lámina de carrusel con el estilo nuevo; si está apagado o falla, la de siempre. */
export async function laminaEstilo(l: { num: number; total: number; titulo: string; texto?: string; portada?: boolean; cierre?: { cta: string; liga_texto: string }; tema?: string; foto_url?: string | null }, e?: Estilo) {
  if (e?.activo) {
    const b = await poster(
      {
        modo: l.portada ? "portada" : l.cierre ? "cierre" : "punto",
        num: l.num, total: l.total, titulo: l.titulo, sub: l.portada || l.cierre ? undefined : l.texto, tema: e.tema, icono: e.icono, cinta: l.portada ? e.cinta : undefined,
        cta: l.cierre?.cta, liga_texto: l.cierre?.liga_texto, liga: l.cierre ? e.liga : undefined,
      },
      e.logger,
    )
    if (b) return b
  }
  return lamina(l)
}

/** Miniatura de YouTube con el estilo nuevo; si está apagado o falla, la de siempre. */
export async function miniaturaEstilo(m: { titulo: string; tema?: string; foto_url?: string | null }, e?: Estilo) {
  if (e?.activo) {
    const b = await poster({ modo: "miniatura", titulo: m.titulo, tema: e.tema, icono: e.icono }, e.logger)
    if (b) return b
  }
  return miniatura(m)
}
