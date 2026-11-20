// @ts-nocheck
// Imagen "limpia" para redes (el estilo que más le gusta al dueño, nov. 2026):
// fondo blanco, título grande en azul marino o negro alineado a la izquierda,
// subtítulo gris, una imagen clara y la invitación abajo. Tres variantes:
//
//   telefono  logo de HETNA arriba, un celular con la pantalla de la herramienta
//             (dibujada aquí con texto real, no con IA) y "Gratis en
//             www.hetnacnc.com" abajo. No gasta en fotos.
//   persona   foto con IA de una persona del taller sobre fondo blanco, y una
//             barra verde abajo con la invitación y un botón.
//   producto  foto con IA de la pieza o el mueble sobre una mesa de madera y
//             fondo blanco; título arriba y una línea chica abajo.
//
// La IA escribe el texto (sin inventar precios ni datos: sólo los que traiga la
// publicación) y, si hace falta, la foto (FLUX en fal.ai, ~0.06 USD).
import Anthropic from "@anthropic-ai/sdk"
import fs from "fs"
import os from "os"
import path from "path"
import { spawn } from "child_process"
import sharp from "sharp"

import { modeloIA } from "../ia-modelo"
import { fal } from "./fal"
import { chromeBin } from "./poster"
import { carpetaFuentes } from "./render"

export type VarianteLimpia = "telefono" | "persona" | "producto"
export const VARIANTES_LIMPIAS: VarianteLimpia[] = ["telefono", "persona", "producto"]

export type IdeaLimpia = {
  titulo: string
  sub: string
  invitacion: string
  boton: string
  pie: string
  pantalla: { encabezado: string; filas: { k: string; v: string }[]; resaltado: { k: string; v: string } | null }
  foto_persona: string
  foto_producto: string
}

const ASSETS = () => path.resolve(carpetaFuentes(), "..")
const MODELO_FOTO = () => process.env.POSTER_PRO_MODELO || "fal-ai/flux-pro/v1.1"

const ESQUEMA = {
  type: "object",
  additionalProperties: false,
  required: ["titulo", "sub", "invitacion", "boton", "pie", "pantalla", "foto_persona", "foto_producto"],
  properties: {
    titulo: { type: "string", description: "título de 3 a 6 palabras, en minúsculas con mayúscula inicial (ej. «Calcula tu precio en minutos»), sin punto final" },
    sub: { type: "string", description: "subtítulo de 5 a 10 palabras con el beneficio concreto (ej. «Costos, material y margen, sin perder dinero»)" },
    invitacion: { type: "string", description: "invitación corta para la barra verde (ej. «Empieza gratis, sin instalar nada»), 3 a 7 palabras" },
    boton: { type: "string", description: "texto del botón en MAYÚSCULAS, 1 a 3 palabras (ej. PROBAR GRATIS)" },
    pie: { type: "string", description: "línea chica de abajo con un dato real de la publicación (ej. «Diseños desde $30 · CAM desde $600»); vacío si no hay dato" },
    pantalla: {
      type: "object",
      additionalProperties: false,
      required: ["encabezado", "filas", "resaltado"],
      properties: {
        encabezado: { type: "string", description: "nombre de la herramienta para la barra de la app (ej. «Cocina integral»)" },
        filas: {
          type: "array",
          minItems: 3,
          maxItems: 5,
          description: "filas de la pantalla de la app: dato y valor cortos, verosímiles y tomados de lo que hace la herramienta (ej. Material: Melamina 18 mm; Piezas: 26; Archivos: DXF y planos). Sin precios inventados.",
          items: { type: "object", additionalProperties: false, required: ["k", "v"], properties: { k: { type: "string" }, v: { type: "string" } } },
        },
        resaltado: {
          anyOf: [
            { type: "null" },
            { type: "object", additionalProperties: false, required: ["k", "v"], properties: { k: { type: "string" }, v: { type: "string" } } },
          ],
          description: "fila destacada en naranja (ej. «Listo para: Router CNC»); un precio sólo si viene en la publicación",
        },
      },
    },
    foto_persona: { type: "string", description: "descripción EN INGLÉS de una foto: una persona mexicana (variar edad y género) del taller, sonriendo a cámara, con mandil oscuro y gafas de seguridad en la frente, sosteniendo algo del tema (pieza, tablero, celular con la pantalla apagada), de la cintura para arriba, aislada sobre fondo blanco puro de estudio. Sin texto." },
    foto_producto: { type: "string", description: "descripción EN INGLÉS de una foto de producto: la pieza o el mueble del tema sobre una mesa de madera clara, con alguna herramienta al lado (vernier, fresa), fondo blanco puro, luz suave de estudio. Sin texto." },
  },
}

let ia: Anthropic | null = null
export async function ideaLimpia(texto: string, titulo = ""): Promise<IdeaLimpia> {
  ia ??= new Anthropic()
  const r = await ia.beta.messages.create({
    ...modeloIA(),
    max_tokens: 1500,
    output_config: { effort: "low", format: { type: "json_schema", schema: ESQUEMA } },
    system:
      "Eres director de arte de HETNA CNC (marketplace mexicano de fabricación CNC y herramientas de diseño para talleres). " +
      "Escribe el texto de una imagen publicitaria limpia (fondo blanco, título grande) a partir de una publicación. Frases cortas, claras y de beneficio, como anuncio profesional. " +
      "No inventes precios, descuentos, plazos ni datos que no estén en la publicación. Español de México.",
    messages: [{ role: "user", content: `Título: ${titulo}\nPublicación:\n${String(texto).slice(0, 1500)}` }],
  } as any)
  return JSON.parse(r.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join(""))
}

const esc = (s: string) => String(s || "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c] as string)

// el celular con la pantalla de la herramienta (HTML: el texto sale nítido y real)
function telefonoHTML(d: IdeaLimpia, ancho: number) {
  const filas = d.pantalla.filas.slice(0, 5).map((f) => `<div class="fila"><span>${esc(f.k)}:</span><b>${esc(f.v)}</b></div>`).join("")
  const r = d.pantalla.resaltado
  return `<div class="tel" style="width:${ancho}px">
  <div class="pant">
    <div class="app"><img src="logo-mini.png"><span>${esc(d.pantalla.encabezado)}</span></div>
    <div class="cuerpo">${filas}</div>
    ${r ? `<div class="total"><span>${esc(r.k)}</span><b>${esc(r.v)}</b></div>` : ""}
    <div class="btn">Abrir en hetnacnc.com</div>
  </div>
</div>`
}

/** HTML del póster limpio (se exporta para probarlo). */
export function htmlLimpio(d: IdeaLimpia, o: { alto: number; variante: VarianteLimpia; web?: string }) {
  const W = 1080, H = o.alto
  const vertical = H >= 1800
  const largo = d.titulo.length
  const tt = (largo > 34 ? 104 : largo > 24 ? 118 : 132) * (vertical ? 1.08 : 1)
  const web = o.web || "www.hetnacnc.com"
  const base = `
@font-face { font-family: "Archivo XB"; src: url("Archivo-800.ttf"); }
@font-face { font-family: "Archivo N"; src: url("Archivo-900.ttf"); }
@font-face { font-family: "Archivo M"; src: url("Archivo-500.ttf"); }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: #fff; font-family: "Archivo M"; }
.titulo { font-family: "Archivo N"; font-size: ${tt}px; line-height: 1.0; letter-spacing: -2px; }
.sub { font-size: ${vertical ? 50 : 44}px; line-height: 1.18; color: #3A3D44; margin-top: 26px; }`
  if (o.variante === "telefono") {
    return `<!doctype html><html><head><meta charset="utf-8"><style>${base}
.logo { position: absolute; top: 56px; right: 56px; width: 420px; }
.texto { position: absolute; left: 70px; top: ${vertical ? 300 : 230}px; width: ${vertical ? 940 : 540}px; }
.titulo { color: #0E2A5C; ${vertical ? "" : `font-size: ${Math.round(tt * 0.78)}px;`} }
.sub { ${vertical ? "" : "font-size: 38px;"} }
.tel { position: absolute; right: ${vertical ? 120 : 50}px; ${vertical ? "bottom: 300px;" : "top: 300px;"} transform: rotate(-6deg); border-radius: 64px; background: #13254A; padding: 22px; box-shadow: 0 40px 80px -30px rgba(14,42,92,.55); }
.pant { background: #F5F6F8; border-radius: 46px; overflow: hidden; }
.app { background: #F07A1E; color: #fff; display: flex; align-items: center; gap: 16px; padding: 34px 30px; font-family: "Archivo XB"; font-size: 40px; }
.app img { width: 54px; height: 54px; }
.cuerpo { margin: 26px 22px; background: #fff; border-radius: 22px; padding: 6px 24px; box-shadow: 0 2px 10px rgba(0,0,0,.06); }
.fila { display: flex; justify-content: space-between; gap: 20px; padding: 22px 0; border-bottom: 1px solid #E8EAEE; font-size: 32px; color: #2A2D33; }
.fila:last-child { border-bottom: 0; }
.fila b { font-family: "Archivo XB"; text-align: right; }
.total { margin: 0 22px; background: #F07A1E; color: #fff; border-radius: 22px; padding: 22px 26px; display: flex; flex-direction: column; }
.total span { font-size: 28px; font-family: "Archivo XB"; opacity: .95; }
.total b { font-family: "Archivo N"; font-size: 50px; }
.btn { margin: 22px 22px 30px; background: #0E2A5C; color: #fff; border-radius: 18px; padding: 24px; text-align: center; font-family: "Archivo XB"; font-size: 34px; }
.pie { position: absolute; left: 70px; bottom: ${vertical ? 110 : 70}px; font-family: "Archivo N"; font-size: ${vertical ? 64 : 44}px; line-height: 1.15; color: #0E2A5C; letter-spacing: -1px; }
.pie i { color: #F07A1E; font-style: normal; margin-right: 18px; }
</style></head><body>
<img class="logo" src="logo.png">
<div class="texto"><div class="titulo">${esc(d.titulo)}</div><div class="sub">${esc(d.sub)}</div></div>
${telefonoHTML(d, vertical ? 620 : 430)}
<div class="pie"><i>·</i>Gratis en<br>${esc(web)}</div>
</body></html>`
  }
  if (o.variante === "persona") {
    const barra = vertical ? 230 : 190
    return `<!doctype html><html><head><meta charset="utf-8"><style>${base}
.foto { position: absolute; right: 0; bottom: ${barra}px; width: ${vertical ? 1000 : 640}px; height: ${vertical ? 1100 : 720}px; background: url("foto.jpg") right bottom / contain no-repeat; }
.texto { position: absolute; left: 70px; top: ${vertical ? 140 : 90}px; width: 940px; }
.titulo { color: #1B1D22; ${vertical ? "" : `font-size: ${Math.round(tt * 0.8)}px;`} }
.barra { position: absolute; left: 0; right: 0; bottom: 0; height: ${barra}px; background: #6DB36A; display: flex; align-items: center; justify-content: space-between; padding: 0 56px; gap: 30px; }
.inv { font-family: "Archivo XB"; color: #fff; font-size: ${vertical ? 46 : 40}px; line-height: 1.15; }
.boton { background: #16A34A; color: #fff; font-family: "Archivo N"; font-size: ${vertical ? 46 : 40}px; padding: 26px 40px; border-radius: 22px; white-space: nowrap; box-shadow: 0 6px 18px rgba(0,0,0,.18); }
.web { position: absolute; left: 70px; bottom: ${barra + 40}px; font-family: "Archivo XB"; font-size: 34px; color: #0E2A5C; }
</style></head><body>
<div class="foto"></div>
<div class="texto"><div class="titulo">${esc(d.titulo)}</div><div class="sub">${esc(d.sub)}</div></div>
<div class="web">${esc(web)}</div>
<div class="barra"><div class="inv">${esc(d.invitacion)}</div><div class="boton">${esc(d.boton)}</div></div>
</body></html>`
  }
  // producto
  return `<!doctype html><html><head><meta charset="utf-8"><style>${base}
.foto { position: absolute; left: 0; right: 0; bottom: 0; height: ${vertical ? 1100 : 680}px; background: url("foto.jpg") center bottom / cover no-repeat; }
.velo { position: absolute; left: 0; right: 0; bottom: ${vertical ? 1000 : 600}px; height: 140px; background: linear-gradient(180deg, #fff 0%, rgba(255,255,255,0) 100%); }
.texto { position: absolute; left: 70px; top: ${vertical ? 220 : 150}px; width: 940px; }
.titulo { color: #1B1D22; ${vertical ? "" : `font-size: ${Math.round(tt * 0.8)}px;`} }
.pie { position: absolute; left: 0; right: 0; bottom: 48px; text-align: center; font-size: 36px; color: #2A2D33; }
.pie span { background: #fff; padding: 12px 26px; border-radius: 14px; box-shadow: 0 4px 14px rgba(0,0,0,.12); display: inline-block; }
.logo { position: absolute; top: 44px; right: 56px; width: 260px; }
</style></head><body>
<div class="foto"></div><div class="velo"></div>
<img class="logo" src="logo.png">
<div class="texto"><div class="titulo">${esc(d.titulo)}</div><div class="sub">${esc(d.sub)}</div></div>
<div class="pie"><span>${esc(d.pie ? `${d.pie} · ${web}` : web)}</span></div>
</body></html>`
}

async function bajar(url: string, archivo: string) {
  const r = await fetch(url, { signal: AbortSignal.timeout(120_000) })
  if (!r.ok) throw new Error(`No se pudo bajar la foto (${r.status})`)
  fs.writeFileSync(archivo, Buffer.from(await r.arrayBuffer()))
}

export function capturarHTML(html: string, ancho: number, alto: number, salida: string) {
  return new Promise<boolean>((res) => {
    const args = ["--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1", `--window-size=${ancho},${alto}`, "--virtual-time-budget=5000", `--screenshot=${salida}`, `file://${html}`]
    const c = spawn(chromeBin()!, args, { stdio: "ignore", detached: true })
    const t = setTimeout(() => { try { process.kill(-c.pid!, "SIGKILL") } catch {} ; res(false) }, 60_000)
    c.on("close", () => { clearTimeout(t); try { process.kill(-c.pid!, "SIGKILL") } catch {} ; res(fs.existsSync(salida)) })
    c.on("error", () => { clearTimeout(t); res(false) })
  })
}

// la variante que toca: rota entre las tres (la de teléfono no gasta en fotos)
let turno = 0
export const siguienteVariante = (): VarianteLimpia => VARIANTES_LIMPIAS[turno++ % VARIANTES_LIMPIAS.length]

/**
 * Hace la imagen limpia. Sin FAL_KEY, las variantes con foto se vuelven de
 * teléfono. Regresa { png, idea, costo, variante } o null si no se pudo.
 */
export async function posterLimpio(d: { texto: string; titulo?: string; formato?: "9:16" | "4:5"; variante?: VarianteLimpia; idea?: IdeaLimpia; foto?: string | null }, logger?: any) {
  if (!chromeBin()) return null
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hetna-limpio-"))
  try {
    const idea = d.idea || (await ideaLimpia(d.texto, d.titulo || ""))
    const alto = d.formato === "9:16" ? 1920 : 1350
    let variante = d.variante || siguienteVariante()
    const conFal = !!(process.env.FAL_KEY || "").trim()
    if (variante !== "telefono" && !conFal && !d.foto) variante = "telefono"
    let costo = 0
    if (variante !== "telefono") {
      let fotoUrl = d.foto || null
      if (!fotoUrl) {
        const prompt =
          variante === "persona"
            ? `${idea.foto_persona}. Commercial advertising photo, cut out on a pure seamless white studio background, soft even light, realistic skin, sharp focus. No text, no letters, no logos, no watermark.`
            : `${idea.foto_producto}. Commercial product photography, light wood tabletop, pure white seamless background above the table, soft studio light, sharp detail. No text, no letters, no logos, no watermark.`
        const out = await fal(MODELO_FOTO(), { prompt, image_size: variante === "persona" ? { width: 1024, height: 1280 } : { width: 1344, height: 1024 }, num_images: 1, output_format: "jpeg", safety_tolerance: "2" }, 5)
        fotoUrl = out?.images?.[0]?.url
        costo += 0.06
        if (!fotoUrl) throw new Error("La IA no regresó la foto")
      }
      const crudo = path.join(dir, "foto-original")
      await bajar(fotoUrl, crudo)
      await sharp(crudo).rotate().jpeg({ quality: 90 }).toFile(path.join(dir, "foto.jpg"))
    }
    for (const f of ["Archivo-800.ttf", "Archivo-900.ttf", "Archivo-500.ttf"]) fs.copyFileSync(path.join(carpetaFuentes(), f), path.join(dir, f))
    fs.copyFileSync(path.join(ASSETS(), "marca", "logo-hetna.png"), path.join(dir, "logo.png"))
    // ícono chico para la barra de la app: el mismo logo, recortado al hexágono de la izquierda
    const meta = await sharp(path.join(dir, "logo.png")).metadata()
    const lado = Math.min(meta.height || 200, meta.width || 200)
    await sharp(path.join(dir, "logo.png")).extract({ left: 0, top: 0, width: lado, height: lado }).toFile(path.join(dir, "logo-mini.png"))
    fs.writeFileSync(path.join(dir, "index.html"), htmlLimpio(idea, { alto, variante }))
    const salida = path.join(dir, "limpio.png")
    if (!(await capturarHTML(path.join(dir, "index.html"), 1080, alto, salida))) throw new Error("Chrome no tomó la imagen")
    const png = await sharp(salida).resize(1080, alto, { fit: "cover", position: "top" }).png().toBuffer()
    return { png, idea, costo, variante }
  } catch (e) {
    logger?.warn?.(`[poster-limpio] ${(e as Error).message}`)
    return null
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}
