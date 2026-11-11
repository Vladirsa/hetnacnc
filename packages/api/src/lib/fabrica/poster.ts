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

import { carpetaFuentes } from "./render"
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
  const ac = palabras.filter((w) => w.replace(/[¿?¡!.,:]/g, "").length > 3).pop() || ""
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
        await sharp(crudo).rotate().resize(1080, p.formato === "9:16" ? 1920 : 1350, { fit: "cover" }).blur(7).modulate({ saturation: 0.85 }).jpeg({ quality: 80 }).toFile(path.join(dir, "fondo.jpg"))
        fondo = true
      } catch {}
    }
    const qr = p.liga ? await QRCode.toString(p.liga, { type: "svg", margin: 0, color: { dark: INK, light: "#ffffff" }, errorCorrectionLevel: "M" }) : ""
    fs.writeFileSync(path.join(dir, "index.html"), htmlPoster(p, { foto, fondo, qr }))
    const alto = p.formato === "9:16" ? 1920 : 1350
    const salida = path.join(dir, "poster.png")
    const ok = await new Promise<boolean>((res) => {
      const args = ["--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1", `--window-size=1080,${alto}`, "--virtual-time-budget=4000", `--screenshot=${salida}`, `file://${path.join(dir, "index.html")}`]
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
    return await sharp(salida).resize(1080, alto, { fit: "cover", position: "top" }).png().toBuffer()
  } catch (e) {
    logger?.warn?.(`[poster] ${(e as Error).message}; se usa la tarjeta de siempre`)
    return null
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}
