// @ts-nocheck
// Higgsfield AI como motor de video del Estudio (opcional): escenas con
// Seedance 2.5 (desde la imagen de arranque) y el "Virality Predictor" que
// califica el gancho y la retención del video terminado antes de publicarlo.
//
// Usa el programa oficial `higgsfield` (github.com/higgsfield-ai/cli), con la
// sesión iniciada en el servidor (`higgsfield auth login`, como el mismo
// usuario que corre el backend). Se prende con ESTUDIO_MOTOR=higgsfield.
import { spawn, spawnSync } from "child_process"

const BIN = () => process.env.HIGGSFIELD_BIN || "higgsfield"
export const motorHiggsfield = () => (process.env.ESTUDIO_MOTOR || "").toLowerCase() === "higgsfield"
export const MODELO_HF_VIDEO = () => process.env.HIGGSFIELD_MODELO_VIDEO || "seedance_2_5"

export function higgsfieldInstalado() {
  try {
    return spawnSync(BIN(), ["--version"], { timeout: 10_000 }).status === 0
  } catch {
    return false
  }
}

/** Corre el programa y regresa lo que imprime. */
export function correrHF(args: string[], topeMin = 20): Promise<string> {
  return new Promise((ok, mal) => {
    const p = spawn(BIN(), args, { env: process.env })
    let out = "", err = ""
    p.stdout.on("data", (d) => (out += d.toString()))
    p.stderr.on("data", (d) => (err += d.toString()))
    const t = setTimeout(() => p.kill("SIGKILL"), topeMin * 60_000)
    p.on("close", (c) => {
      clearTimeout(t)
      c === 0 ? ok(out) : mal(new Error(`Higgsfield: ${(err || out).trim().slice(-300) || c}`))
    })
    p.on("error", (e) => {
      clearTimeout(t)
      mal(new Error(`Higgsfield no está instalado en el servidor (${e.message})`))
    })
  })
}

/** Primera liga de un archivo de cierto tipo en la salida (JSON o texto). */
export function ligaDe(salida: string, ext = /\.(mp4|mov|webm)(\?|$)/i) {
  const ligas = String(salida || "").match(/https?:\/\/[^\s"'<>\\]+/g) || []
  return ligas.find((u) => ext.test(u)) || null
}

export async function estadoHiggsfield() {
  if (!higgsfieldInstalado()) return { instalado: false, sesion: false }
  try {
    const s = await correrHF(["account", "status"], 1)
    return { instalado: true, sesion: true, detalle: s.trim().split("\n").slice(0, 3).join(" · ").slice(0, 200) }
  } catch (e) {
    return { instalado: true, sesion: false, detalle: (e as Error).message.slice(0, 200) }
  }
}

/** Escena de video desde la imagen de arranque (archivo local). */
export async function escenaHiggsfield(prompt: string, imagen: string, segundos: number) {
  const out = await correrHF([
    "generate", "create", MODELO_HF_VIDEO(), "--prompt", prompt, "--mode", "omni_reference", "--start-image", imagen,
    "--duration", String(Math.max(4, Math.min(30, Math.round(segundos)))), "--resolution", "720p", "--wait", "--wait-timeout", "15m", "--json",
  ], 18)
  const url = ligaDe(out)
  if (!url) throw new Error("Higgsfield no regresó la liga del video")
  return url
}

/** Virality Predictor: calificación del gancho, atención y retención del video terminado. */
export async function calificarVideo(archivo: string) {
  const out = await correrHF(["generate", "create", "brain_activity", "--video", archivo, "--wait", "--wait-timeout", "15m"], 18)
  const texto = out.trim().slice(0, 1500)
  const informe = (texto.match(/https?:\/\/\S+/g) || []).find((u) => !/\.(glb|bin)(\?|$)/i.test(u)) || null
  return { texto, informe }
}
