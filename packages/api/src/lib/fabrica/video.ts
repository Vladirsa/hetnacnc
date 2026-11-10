// @ts-nocheck
// Fábrica de contenido — armado de video con FFmpeg (en el servidor, sin GPU).
// Cortos verticales 9:16 a partir de cuadros (gancho, frases, cierre):
// zoom lento en cada cuadro, transición suave, música de fondo con salida
// gradual y, si hay, voz encima (la música baja cuando habla la voz).
import { spawn, spawnSync } from "child_process"
import fs from "fs"
import os from "os"
import path from "path"

export const ffmpegBin = () => process.env.FFMPEG_PATH || "ffmpeg"
export function ffmpegDisponible() {
  try {
    return spawnSync(ffmpegBin(), ["-version"], { timeout: 5000 }).status === 0
  } catch {
    return false
  }
}

function correr(args: string[], tope = 10 * 60_000) {
  return new Promise<void>((ok, mal) => {
    const p = spawn(ffmpegBin(), ["-hide_banner", "-loglevel", "error", "-y", ...args])
    let err = ""
    p.stderr.on("data", (d) => (err += d.toString()))
    const t = setTimeout(() => p.kill("SIGKILL"), tope)
    p.on("close", (c) => {
      clearTimeout(t)
      c === 0 ? ok() : mal(new Error(`ffmpeg: ${err.slice(-400) || c}`))
    })
    p.on("error", (e) => {
      clearTimeout(t)
      mal(e)
    })
  })
}

// subtitulo: texto que se dice en la escena; sale palabra por palabra (karaoke)
export type Escena = { png: Buffer; segundos: number; subtitulo?: string }

const assTiempo = (t: number) => {
  const cs = Math.max(0, Math.round(t * 100))
  const h = Math.floor(cs / 360000), m = Math.floor((cs % 360000) / 6000), s = Math.floor((cs % 6000) / 100), c = cs % 100
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(c).padStart(2, "0")}`
}
const assEsc = (t: string) => String(t || "").replace(/[{}\\]/g, "").replace(/\n/g, " ")

/**
 * Subtítulos ASS con resaltado palabra por palabra: cada palabra se ilumina en
 * naranja cuando "se dice". El tiempo de cada palabra es proporcional a su
 * largo dentro de la duración de la escena (o de la voz, si la hay).
 */
export function assKaraoke(items: { texto: string; inicio: number; fin: number }[]) {
  const cab = [
    "[Script Info]", "ScriptType: v4.00+", "PlayResX: 1080", "PlayResY: 1920", "WrapStyle: 0", "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    // Primario = palabra ya dicha (naranja HETNA), secundario = por decir (blanco)
    "Style: Sub,Archivo ExtraBold,96,&H005FA2F2,&H00FFFFFF,&H00000000,&H96000000,-1,0,0,0,100,100,0,0,1,7,3,2,80,80,600,1",
    "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ]
  const lineas = items.filter((x) => x.texto?.trim() && x.fin > x.inicio).map((x) => {
    const palabras = assEsc(x.texto).trim().split(/\s+/)
    const dur = Math.max(0.3, (x.fin - x.inicio) * 0.92) // termina un poco antes del cambio de escena
    const peso = palabras.reduce((a, w) => a + w.length + 2, 0)
    const k = palabras.map((w) => `{\\kf${Math.max(8, Math.round(((w.length + 2) / peso) * dur * 100))}}${w}`).join(" ")
    return `Dialogue: 0,${assTiempo(x.inicio)},${assTiempo(x.fin)},Sub,,0,0,0,,{\\fad(80,80)}${k}`
  })
  return [...cab, ...lineas].join("\n") + "\n"
}

/**
 * Corto vertical: cada escena es un cuadro 1080x1920 que se acerca despacio;
 * entre escenas, transición de 0.4 s. `musica` y `voz` son rutas o URLs.
 */
export async function corto(escenas: Escena[], o: { musica?: string | null; voz?: string | null; fps?: number; fuentes?: string | null } = {}) {
  if (!escenas.length) throw new Error("Sin escenas")
  const fps = o.fps || 30
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hetna-video-"))
  try {
    const T = 0.4 // transición
    const entradas: string[] = []
    const filtros: string[] = []
    escenas.forEach((e, i) => {
      const f = path.join(dir, `e${i}.png`)
      fs.writeFileSync(f, e.png)
      entradas.push("-loop", "1", "-t", String(e.segundos + T), "-i", f)
      const n = Math.round((e.segundos + T) * fps)
      // Zoom lento hacia el centro (efecto Ken Burns), sin bordes negros
      filtros.push(`[${i}:v]scale=1188:2112,zoompan=z='min(zoom+0.0007,1.08)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${n}:s=1080x1920:fps=${fps},setsar=1,format=yuv420p[v${i}]`)
    })
    let prev = "v0"
    let t = escenas[0].segundos
    for (let i = 1; i < escenas.length; i++) {
      const sal = i === escenas.length - 1 ? "vout" : `x${i}`
      filtros.push(`[${prev}][v${i}]xfade=transition=fade:duration=${T}:offset=${t.toFixed(2)}[${sal}]`)
      prev = sal
      t += escenas[i].segundos
    }
    if (escenas.length === 1) filtros.push(`[v0]null[vout]`)
    const total = t + T
    // Subtítulos animados (palabra por palabra) sobre el video ya armado
    let inicio = 0
    const subs: { texto: string; inicio: number; fin: number }[] = []
    escenas.forEach((e) => {
      if (e.subtitulo) subs.push({ texto: e.subtitulo, inicio: inicio + 0.15, fin: inicio + e.segundos })
      inicio += e.segundos
    })
    if (subs.length) {
      const ass = path.join(dir, "subs.ass")
      fs.writeFileSync(ass, assKaraoke(subs))
      const esc = (x: string) => x.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'")
      const ult = filtros.pop() as string
      const nuevo = ult.replace(/\[vout\]$/, "[vbase]")
      filtros.push(nuevo, `[vbase]ass='${esc(ass)}'${o.fuentes ? `:fontsdir='${esc(o.fuentes)}'` : ""}[vout]`)
    }
    let idx = escenas.length
    const audio: string[] = []
    if (o.musica) {
      entradas.push("-stream_loop", "-1", "-i", o.musica)
      audio.push(`[${idx}:a]atrim=0:${total.toFixed(2)},asetpts=PTS-STARTPTS,volume=${o.voz ? 0.18 : 0.6},afade=t=in:d=0.5,afade=t=out:st=${Math.max(0, total - 1.5).toFixed(2)}:d=1.5[mus]`)
      idx++
    }
    if (o.voz) {
      entradas.push("-i", o.voz)
      audio.push(`[${idx}:a]apad,atrim=0:${total.toFixed(2)},volume=1.0[voz]`)
      idx++
    }
    let mapaAudio: string[] = []
    if (o.musica && o.voz) {
      // La música baja sola cuando habla la voz (sidechain)
      audio.push(`[mus][voz]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[musb]`, `[musb][voz]amix=inputs=2:duration=first:dropout_transition=0[aout]`)
      mapaAudio = ["-map", "[aout]"]
    } else if (o.musica) mapaAudio = ["-map", "[mus]"]
    else if (o.voz) mapaAudio = ["-map", "[voz]"]
    const salida = path.join(dir, "corto.mp4")
    await correr([
      ...entradas,
      "-filter_complex", [...filtros, ...audio].join(";"),
      "-map", "[vout]", ...mapaAudio,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-r", String(fps),
      ...(mapaAudio.length ? ["-c:a", "aac", "-b:a", "128k"] : []),
      "-movflags", "+faststart", "-t", total.toFixed(2),
      salida,
    ])
    return { buf: fs.readFileSync(salida), segundos: total }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

/** Duración aproximada de una frase en pantalla (lectura cómoda). */
export const segundosPara = (texto: string, min = 2.2, max = 5) => Math.max(min, Math.min(max, String(texto || "").split(/\s+/).length * 0.42))
