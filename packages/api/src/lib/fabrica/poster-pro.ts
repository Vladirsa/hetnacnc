// @ts-nocheck
// Imagen "pro" para redes (estilo de los ejemplos del dueño): foto realista
// hecha con IA de una persona en un taller mexicano con el producto o la
// herramienta, logo de HETNA arriba, título grande en dos líneas (blanco y
// naranja), subtítulo, triángulos naranjas en las esquinas y barra de abajo con
// la web y el WhatsApp. Formatos 9:16 (historias, reels) y 4:5 (feed).
//
// - La IA escribe el texto corto y describe la foto (no inventa precios: sólo
//   usa los que vengan en el texto de la publicación).
// - Foto: FLUX 1.1 Pro en fal.ai (~0.05 USD). Si no hay FAL_KEY o falla,
//   regresa null y se usa el póster de siempre.
import Anthropic from "@anthropic-ai/sdk"
import fs from "fs"
import os from "os"
import path from "path"
import { spawn } from "child_process"
import sharp from "sharp"

import { modeloIA } from "../ia-modelo"
import { EMPRESA_WHATSAPP_TEXTO } from "./poster-pro-datos"
import { fal } from "./fal"
import { chromeBin } from "./poster"
import { carpetaFuentes } from "./render"

const ASSETS = () => path.resolve(carpetaFuentes(), "..")
// Tope diario de imágenes pro (cada una cuesta ~0.06 USD)
const TOPE_DIA = () => Number(process.env.POSTER_PRO_DIA || 8)
const hechas = { dia: "", n: 0 }
export const posterProListo = () => !!(process.env.FAL_KEY || "").trim() && !!chromeBin() && process.env.POSTER_PRO !== "0"
const MODELO_FOTO = () => process.env.POSTER_PRO_MODELO || "fal-ai/flux-pro/v1.1"

export type IdeaPro = { linea1: string; linea2: string; sub: string; foto: string }

const ESQUEMA = {
  type: "object", additionalProperties: false, required: ["linea1", "linea2", "sub", "foto"],
  properties: {
    linea1: { type: "string", description: "primera línea del título, 1 a 3 palabras, en MAYÚSCULAS (ej. MAQUINADO CNC)" },
    linea2: { type: "string", description: "segunda línea que remata, 1 a 3 palabras, en MAYÚSCULAS (ej. DE PRECISIÓN); un precio sólo si viene en el texto" },
    sub: { type: "string", description: "subtítulo de 4 a 8 palabras con el beneficio" },
    foto: { type: "string", description: "descripción EN INGLÉS de la foto: una persona mexicana (variar edad y género) en un taller CNC real, mirando a cámara y sonriendo, con gafas de seguridad y mandil oscuro liso, sosteniendo algo relacionado con el tema (pieza, engrane, tablet con un diseño, laptop, letrero), máquina CNC al fondo. Sin texto ni logos." },
  },
}

let ia: Anthropic | null = null
export async function ideaPro(texto: string, titulo = ""): Promise<IdeaPro> {
  ia ??= new Anthropic()
  const r = await ia.beta.messages.create({
    ...modeloIA(),
    max_tokens: 1200,
    output_config: { effort: "low", format: { type: "json_schema", schema: ESQUEMA } },
    system:
      "Eres director de arte de HETNA CNC (marketplace mexicano de fabricación CNC). A partir de una publicación, escribe el texto corto de una imagen publicitaria y describe la foto. " +
      "Texto potente y concreto, como anuncio profesional; no inventes precios, descuentos ni datos que no estén en la publicación. Español de México.",
    messages: [{ role: "user", content: `Título: ${titulo}\nPublicación:\n${String(texto).slice(0, 1500)}` }],
  } as any)
  return JSON.parse(r.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join(""))
}

const esc = (s: string) => String(s || "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c] as string)

/** HTML del póster (se exporta para probarlo). */
export function htmlPro(d: IdeaPro, o: { alto: number; web?: string; whatsapp?: string }) {
  const W = 1080, H = o.alto
  const vertical = H >= 1800
  const t1 = (d.linea1.length > 14 ? 128 : 150) * (vertical ? 1 : 0.84)
  const t2 = (d.linea2.length > 14 ? 112 : 132) * (vertical ? 1 : 0.84)
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: "Anton"; src: url("Anton-Regular.ttf"); }
@font-face { font-family: "Archivo XB"; src: url("Archivo-800.ttf"); }
@font-face { font-family: "Archivo M"; src: url("Archivo-500.ttf"); }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: #111; }
.foto { position: absolute; inset: 0; background: url("foto.jpg") center ${vertical ? "62%" : "55%"} / cover no-repeat; }
.sombra-arriba { position: absolute; left: 0; right: 0; top: 0; height: ${vertical ? 820 : 640}px; background: linear-gradient(180deg, rgba(12,12,14,.97) 0%, rgba(12,12,14,.9) 45%, rgba(12,12,14,0) 100%); }
.sombra-abajo { position: absolute; left: 0; right: 0; bottom: 0; height: 360px; background: linear-gradient(0deg, rgba(12,12,14,.96) 0%, rgba(12,12,14,.7) 45%, rgba(12,12,14,0) 100%); }
.tri { position: absolute; width: 0; height: 0; }
.esq { position: absolute; width: 330px; height: 330px; }
.esq i { position: absolute; display: block; }
.logo { position: absolute; top: ${vertical ? 70 : 52}px; left: 50%; transform: translateX(-50%); width: ${vertical ? 560 : 500}px; }
.titulo { position: absolute; top: ${vertical ? 230 : 175}px; left: 50px; right: 50px; text-align: center; }
.l1 { font-family: "Anton"; color: #fff; font-size: ${t1}px; line-height: 1.02; letter-spacing: 1px; text-shadow: 0 4px 18px rgba(0,0,0,.45); }
.l2 { font-family: "Anton"; color: #F2862B; font-size: ${t2}px; line-height: 1.06; letter-spacing: 1px; text-shadow: 0 4px 18px rgba(0,0,0,.45); }
.sub { margin-top: 18px; font-family: "Archivo XB"; color: #fff; font-size: ${vertical ? 46 : 40}px; text-shadow: 0 2px 10px rgba(0,0,0,.6); }
.barra { position: absolute; left: 0; right: 0; bottom: 0; height: ${vertical ? 210 : 170}px; background: #141416; border-top: 2px solid rgba(242,134,43,.35); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; }
.web { font-family: "Archivo XB"; color: #fff; font-size: ${vertical ? 56 : 48}px; letter-spacing: .5px; }
.wa { font-family: "Archivo XB"; color: #fff; font-size: ${vertical ? 44 : 38}px; opacity: .95; }
</style></head><body>
<div class="foto"></div>
<div class="sombra-arriba"></div>
<div class="sombra-abajo"></div>
${esquinas(W, H)}
<img class="logo" src="logo.png">
<div class="titulo"><div class="l1">${esc(d.linea1)}</div><div class="l2">${esc(d.linea2)}</div><div class="sub">${esc(d.sub)}</div></div>
<div class="barra"><div class="web">${esc(o.web || "www.hetnacnc.com")}</div>${o.whatsapp ? `<div class="wa">WhatsApp: ${esc(o.whatsapp)}</div>` : ""}</div>
</body></html>`
}

/** Triángulos naranjas en esquinas (estilo low-poly de los ejemplos), en SVG. */
function esquinas(W: number, H: number) {
  const n = (a: string) => `<polygon points="${a}" fill="url(#g)" />`
  const m = (a: string) => `<polygon points="${a}" fill="url(#h)" />`
  return `<svg width="${W}" height="${H}" style="position:absolute;inset:0" xmlns="http://www.w3.org/2000/svg">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF9A3D"/><stop offset="1" stop-color="#D9640F"/></linearGradient>
<linearGradient id="h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#B8530C"/><stop offset="1" stop-color="#7A3608"/></linearGradient></defs>
${n("0,0 230,0 0,170")}${m("0,170 230,0 120,250")}${n("0,170 120,250 0,330")}${m("230,0 330,0 120,250")}
${n(`${W},0 ${W - 200},0 ${W},150`)}${m(`${W},150 ${W - 200},0 ${W - 90},210`)}
${n(`${W},${H} ${W},${H - 330} ${W - 150},${H - 160}`)}${m(`${W - 150},${H - 160} ${W},${H - 330} ${W - 260},${H - 270}`)}${n(`${W},${H - 330} ${W - 260},${H - 270} ${W - 120},${H - 460}`)}
${n(`0,${H} 0,${H - 240} 180,${H - 110}`)}${m(`0,${H - 240} 180,${H - 110} 110,${H - 300}`)}
</svg>`
}

async function bajar(url: string, archivo: string) {
  const r = await fetch(url, { signal: AbortSignal.timeout(120_000) })
  if (!r.ok) throw new Error(`No se pudo bajar la foto (${r.status})`)
  fs.writeFileSync(archivo, Buffer.from(await r.arrayBuffer()))
}

function capturar(html: string, ancho: number, alto: number, salida: string) {
  return new Promise<boolean>((res) => {
    const args = ["--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1", `--window-size=${ancho},${alto}`, "--virtual-time-budget=5000", `--screenshot=${salida}`, `file://${html}`]
    const c = spawn(chromeBin()!, args, { stdio: "ignore", detached: true })
    const t = setTimeout(() => { try { process.kill(-c.pid!, "SIGKILL") } catch {} ; res(false) }, 60_000)
    c.on("close", () => { clearTimeout(t); try { process.kill(-c.pid!, "SIGKILL") } catch {} ; res(fs.existsSync(salida)) })
    c.on("error", () => { clearTimeout(t); res(false) })
  })
}

/**
 * Hace la imagen pro. `idea` opcional (si ya se tiene); si no, la IA la escribe
 * a partir del texto. Regresa { png, idea, costo } o null si no se pudo.
 */
export async function posterPro(d: { texto: string; titulo?: string; formato?: "9:16" | "4:5"; idea?: IdeaPro; foto?: string | null }, logger?: any) {
  if (!posterProListo()) return null
  const hoy = new Date().toISOString().slice(0, 10)
  if (hechas.dia !== hoy) { hechas.dia = hoy; hechas.n = 0 }
  if (hechas.n >= TOPE_DIA()) return null
  hechas.n++
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hetna-pro-"))
  try {
    const idea = d.idea || (await ideaPro(d.texto, d.titulo || ""))
    const alto = d.formato === "4:5" ? 1350 : 1920
    let costo = 0
    let fotoUrl = d.foto || null
    if (!fotoUrl) {
      const out = await fal(MODELO_FOTO(), {
        prompt: `${idea.foto}. Editorial advertising photograph, natural window and practical light, realistic skin, sharp focus on the person and the object, shallow depth of field, authentic Mexican machine shop. No text, no letters, no logos, no watermark.`,
        image_size: alto === 1920 ? { width: 896, height: 1600 } : { width: 1024, height: 1280 },
        num_images: 1, output_format: "jpeg", safety_tolerance: "2",
      }, 5)
      fotoUrl = out?.images?.[0]?.url
      costo += 0.06
      if (!fotoUrl) throw new Error("La IA no regresó la foto")
    }
    const crudo = path.join(dir, "foto-original")
    await bajar(fotoUrl, crudo)
    await sharp(crudo).rotate().resize(1080, alto, { fit: "cover", position: "attention" }).jpeg({ quality: 90 }).toFile(path.join(dir, "foto.jpg"))
    for (const f of ["Anton-Regular.ttf", "Archivo-800.ttf", "Archivo-500.ttf"]) fs.copyFileSync(path.join(carpetaFuentes(), f), path.join(dir, f))
    fs.copyFileSync(path.join(ASSETS(), "marca", "logo-hetna.png"), path.join(dir, "logo.png"))
    fs.writeFileSync(path.join(dir, "index.html"), htmlPro(idea, { alto, whatsapp: EMPRESA_WHATSAPP_TEXTO }))
    const salida = path.join(dir, "pro.png")
    if (!(await capturar(path.join(dir, "index.html"), 1080, alto, salida))) throw new Error("Chrome no tomó la imagen")
    const png = await sharp(salida).resize(1080, alto, { fit: "cover", position: "top" }).png().toBuffer()
    return { png, idea, costo, foto: fotoUrl }
  } catch (e) {
    logger?.warn?.(`[poster-pro] ${(e as Error).message}; se usa el póster de siempre`)
    return null
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}
