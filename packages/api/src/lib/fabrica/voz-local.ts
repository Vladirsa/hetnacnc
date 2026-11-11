// @ts-nocheck
// Voz de respaldo en el propio servidor (Piper, MIT, CPU). Se usa cuando RunPod
// no está configurado o falla, para que los videos nunca salgan mudos.
// La instala scripts/desplegar.sh en /opt/piper (voces es_MX y en_US).
import { spawn, spawnSync } from "child_process"
import fs from "fs"
import os from "os"
import path from "path"

import { ffmpegBin } from "./video"

const DIR = process.env.PIPER_DIR || "/opt/piper"
const BIN = () => process.env.PIPER_BIN || path.join(DIR, "piper", "piper")
const MODELOS: Record<string, string> = { es: "es_MX-claude-high.onnx", en: "en_US-lessac-medium.onnx" }
const modelo = (idioma: string) => path.join(DIR, "voces", MODELOS[idioma] || MODELOS.es)

export const vozLocalLista = (idioma = "es") => fs.existsSync(BIN()) && fs.existsSync(modelo(idioma))

function sintetizar(texto: string, idioma: string, salida: string) {
  return new Promise<void>((ok, mal) => {
    const p = spawn(BIN(), ["--model", modelo(idioma), "--output_file", salida, "--length_scale", "0.95", "--sentence_silence", "0.1"])
    let err = ""
    p.stderr.on("data", (d) => (err += d.toString()))
    const t = setTimeout(() => p.kill("SIGKILL"), 60_000)
    p.on("close", (c) => {
      clearTimeout(t)
      c === 0 && fs.existsSync(salida) ? ok() : mal(new Error(`piper: ${err.slice(-200) || c}`))
    })
    p.on("error", mal)
    p.stdin.end(String(texto).replace(/\s+/g, " ").trim())
  })
}

const duracion = (f: string) => {
  const r = spawnSync(ffmpegBin().replace(/ffmpeg$/, "ffprobe"), ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" })
  return Number(String(r.stdout).trim()) || 0
}

/**
 * Voz para una lista de frases (una por escena). Devuelve la ruta del WAV unido
 * y la duración de cada frase (con su pausa), igual que la tarea "voz" de RunPod.
 * null si Piper no está instalado o falla.
 */
export async function vozLocal(frases: string[], idioma = "es", logger?: any) {
  const lim = idioma === "en" ? "en" : "es"
  if (!vozLocalLista(lim)) return null
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hetna-voz-"))
  try {
    const PAUSA = 0.25
    const partes: string[] = []
    const duraciones: number[] = []
    for (const [i, f] of frases.entries()) {
      const salida = path.join(dir, `f${i}.wav`)
      await sintetizar(f || " ", lim, salida)
      partes.push(salida)
      duraciones.push(Math.round((duracion(salida) + (i < frases.length - 1 ? PAUSA : 0)) * 1000) / 1000)
    }
    const unido = path.join(dir, "voz.wav")
    const filtros =
      partes.map((_, i) => `[${i}:a]apad=pad_dur=${i < partes.length - 1 ? PAUSA : 0}[a${i}]`).join(";") +
      ";" +
      partes.map((_, i) => `[a${i}]`).join("") +
      `concat=n=${partes.length}:v=0:a=1[o]`
    const r = spawnSync(ffmpegBin(), ["-hide_banner", "-loglevel", "error", "-y", ...partes.flatMap((x) => ["-i", x]), "-filter_complex", filtros, "-map", "[o]", unido], { encoding: "utf8", timeout: 60_000 })
    if (r.status !== 0) throw new Error(`ffmpeg: ${String(r.stderr).slice(-200)}`)
    // Se borra sola después de armar el video
    const t = setTimeout(() => fs.rmSync(dir, { recursive: true, force: true }), 15 * 60_000)
    t.unref?.()
    return { url: unido, duraciones, local: true }
  } catch (e) {
    fs.rmSync(dir, { recursive: true, force: true })
    logger?.warn?.(`[fabrica] voz local: ${(e as Error).message}`)
    return null
  }
}
