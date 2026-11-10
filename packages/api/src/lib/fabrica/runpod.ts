// @ts-nocheck
// Cliente del trabajador de RunPod de la Fábrica (infra/fabrica-ia).
// Variables: RUNPOD_API_KEY (ya existe) y RUNPOD_FABRICA_ENDPOINT_ID.
// Los resultados pesados llegan como claves del bucket privado de B2; aquí se
// descargan con ligas firmadas y se copian al almacenamiento público cuando
// hace falta publicarlos en redes.
import { getSignedDownloadUrls } from "../backblaze"

export const runpodListo = () => !!process.env.RUNPOD_API_KEY && !!process.env.RUNPOD_FABRICA_ENDPOINT_ID
const base = () => `https://api.runpod.ai/v2/${process.env.RUNPOD_FABRICA_ENDPOINT_ID}`
const cabeceras = () => ({ Authorization: `Bearer ${process.env.RUNPOD_API_KEY}`, "Content-Type": "application/json" })
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))

export const VOZ = (idioma: string, genero = "hombre") => {
  const mujer = genero === "mujer"
  if (idioma === "en") return mujer ? process.env.FABRICA_VOZ_EN_MUJER || "af_heart" : process.env.FABRICA_VOZ_EN || "am_adam"
  if (idioma === "pt") return mujer ? process.env.FABRICA_VOZ_PT_MUJER || "pf_dora" : process.env.FABRICA_VOZ_PT || "pm_alex"
  return mujer ? process.env.FABRICA_VOZ_ES_MUJER || "ef_dora" : process.env.FABRICA_VOZ_ES || "em_alex"
}
export const idiomaDe = (mercado: string) => (mercado === "us" ? "en" : mercado === "br" ? "pt" : "es")

/** Manda un trabajo y espera el resultado (la GPU arranca en frío la primera vez). */
export async function correr(input: Record<string, unknown>, o: { topeMin?: number; logger?: any } = {}) {
  if (!runpodListo()) throw new Error("Falta configurar RunPod (RUNPOD_FABRICA_ENDPOINT_ID en el .env del backend).")
  const r = await fetch(`${base()}/run`, { method: "POST", headers: cabeceras(), body: JSON.stringify({ input }), signal: AbortSignal.timeout(30_000) })
  if (!r.ok) throw new Error(`RunPod respondió ${r.status}: ${(await r.text()).slice(0, 200)}`)
  const { id } = await r.json()
  const fin = Date.now() + (o.topeMin || 30) * 60_000
  let espera = 3000
  while (Date.now() < fin) {
    await esperar(espera)
    espera = Math.min(15_000, espera + 2000)
    const s = await fetch(`${base()}/status/${id}`, { headers: cabeceras(), signal: AbortSignal.timeout(30_000) }).then((x) => x.json()).catch(() => null)
    if (!s) continue
    if (s.status === "COMPLETED") {
      if (s.output?.error) throw new Error(`Trabajador: ${s.output.error}`)
      return s.output
    }
    if (["FAILED", "CANCELLED", "TIMED_OUT"].includes(s.status)) throw new Error(`RunPod: ${s.status} ${String(s.error || s.output?.error || "").slice(0, 300)}`)
  }
  await fetch(`${base()}/cancel/${id}`, { method: "POST", headers: cabeceras() }).catch(() => {})
  throw new Error("RunPod tardó demasiado; se canceló el trabajo.")
}

/** Ligas firmadas (1 hora) para leer lo que dejó el trabajador en B2. */
export async function ligasB2(claves: string[], segundos = 3600) {
  const m = await getSignedDownloadUrls(claves, segundos)
  return claves.map((c) => m.get(c) as string)
}

export async function bajarB2(clave: string) {
  const [url] = await ligasB2([clave], 900)
  if (!url) throw new Error("No se pudo firmar la descarga de B2.")
  const r = await fetch(url, { signal: AbortSignal.timeout(300_000) })
  if (!r.ok) throw new Error(`B2 respondió ${r.status}`)
  return Buffer.from(await r.arrayBuffer())
}

/** Estado del endpoint (para el panel). */
export async function salud() {
  if (!runpodListo()) return { configurado: false }
  try {
    const r = await fetch(`${base()}/health`, { headers: cabeceras(), signal: AbortSignal.timeout(10_000) })
    const d = await r.json().catch(() => ({}))
    return { configurado: true, ok: r.ok, workers: d.workers || null, jobs: d.jobs || null }
  } catch (e) {
    return { configurado: true, ok: false, error: (e as Error).message }
  }
}

// Instrucciones (en inglés, como mejor responde FLUX) para la biblioteca de fondos
export const PROMPTS_TEMA: Record<string, string[]> = {
  laser: [
    "close-up photograph of a CNC fiber laser cutting a thick steel plate, bright orange sparks flying, dark industrial workshop, cinematic lighting, shallow depth of field, no text, no logos",
    "CNC laser cutter head cutting intricate geometric pattern in stainless steel sheet, glowing kerf line, sparks, moody blue and orange light, photorealistic, no text",
    "freshly laser-cut steel parts on the slat bed of a CNC laser machine, warm workshop light, realistic photo, no people, no text",
  ],
  plasma: [
    "CNC plasma cutter torch cutting thick steel plate, intense blue-white arc and molten sparks, industrial shop, dramatic lighting, photorealistic, no text",
    "plasma cutting table with steel parts being cut, smoke and sparks, wide shot, realistic industrial photography, no text",
  ],
  router: [
    "CNC router spindle carving a decorative pattern into MDF board, wood chips flying, warm workshop light, close-up, photorealistic, no text",
    "CNC router machine milling a wooden sign, dust and chips, shallow depth of field, realistic photo, no text, no logos",
  ],
  torno: [
    "CNC lathe turning a shiny steel shaft, metal chips curling, coolant spray, close-up, industrial lighting, photorealistic, no text",
    "CNC milling machine cutting an aluminum block, coolant splash, macro photograph, dramatic lighting, no text",
  ],
  taller: [
    "interior of a modern small CNC machine shop in Mexico, laser cutter and CNC router, warm evening light through windows, realistic photo, no people, no text",
    "organized metal fabrication workshop with CNC machines and steel sheets, golden hour light, wide angle, photorealistic, no text",
  ],
  lamina: [
    "stacked steel and aluminum sheets in an industrial warehouse, reflections, shallow depth of field, realistic photo, no text",
    "close-up of brushed stainless steel sheet texture with laser-cut holes, soft industrial light, no text",
  ],
  impresion3d: [
    "3D printer printing an orange mechanical part layer by layer, close-up, soft studio light, photorealistic, no text",
  ],
  general: [
    "engineer holding a precision machined metal part in a CNC workshop, hands only, shallow depth of field, realistic photo, no text, no logos",
  ],
}
