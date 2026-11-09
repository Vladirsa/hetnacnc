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

export type Escena = { png: Buffer; segundos: number }

/**
 * Corto vertical: cada escena es un cuadro 1080x1920 que se acerca despacio;
 * entre escenas, transición de 0.4 s. `musica` y `voz` son rutas o URLs.
 */
export async function corto(escenas: Escena[], o: { musica?: string | null; voz?: string | null; fps?: number } = {}) {
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
