"use server"

// CAM Studio, fase C: las máquinas y fresas del cliente, guardadas en su
// cuenta (metadata del cliente, llave "cam_estudio") para no capturarlas cada
// vez. Sin sesión, la pantalla las guarda en el navegador.
import { revalidateTag } from "next/cache"

import { sdk } from "../client"
import { getAuthHeaders, getCacheTag } from "./cookies"

export type MaquinaCam = {
  id: string
  nombre: string
  tipo: "router" | "laser"
  post: "mach3" | "grbl" | "linuxcnc" | "laser_grbl"
  tarifa: number // MXN por hora de máquina
  smax: number // S máximo del láser (GRBL: 1000)
}

export type FresaCam = {
  id: string
  nombre: string
  tipo: "recta" | "v" | "compresion" | "bola"
  diametro: number
  angulo: number // sólo fresa en V
  // Parámetros de corte propios de la fresa; 0 o ausente = los del material
  pasada?: number // profundidad por pasada (mm)
  traslape?: number // % del diámetro que se encima en el cajeado
  rpm?: number
  avance?: number // mm/min
  penetracion?: number // mm/min
}

export type DatosCam = { maquinas: MaquinaCam[]; fresas: FresaCam[] }

const LLAVE = "cam_estudio"
const POSTS = ["mach3", "grbl", "linuxcnc", "laser_grbl"]
const TIPOS_FRESA = ["recta", "v", "compresion", "bola"]

const texto = (v: unknown, max = 40) => String(v ?? "").replace(/[<>]/g, "").trim().slice(0, max)
const num = (v: unknown, min: number, max: number, def: number) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : def
}

function limpiar(d: unknown): DatosCam {
  const o = (d && typeof d === "object" ? d : {}) as Record<string, unknown>
  const maquinas = (Array.isArray(o.maquinas) ? o.maquinas : []).slice(0, 10).map((m: any, i: number) => ({
    id: texto(m?.id, 24) || `m${i}`,
    nombre: texto(m?.nombre) || `Máquina ${i + 1}`,
    tipo: m?.tipo === "laser" ? ("laser" as const) : ("router" as const),
    post: (POSTS.includes(m?.post) ? m.post : "mach3") as MaquinaCam["post"],
    tarifa: num(m?.tarifa, 0, 100000, 0),
    smax: num(m?.smax, 1, 100000, 1000),
  }))
  const fresas = (Array.isArray(o.fresas) ? o.fresas : []).slice(0, 30).map((f: any, i: number) => ({
    id: texto(f?.id, 24) || `f${i}`,
    nombre: texto(f?.nombre) || `Fresa ${i + 1}`,
    tipo: (TIPOS_FRESA.includes(f?.tipo) ? f.tipo : "recta") as FresaCam["tipo"],
    diametro: num(f?.diametro, 0.1, 30, 6),
    angulo: num(f?.angulo, 10, 150, 90),
    pasada: num(f?.pasada, 0, 50, 0),
    traslape: num(f?.traslape, 0, 95, 0),
    rpm: num(f?.rpm, 0, 60000, 0),
    avance: num(f?.avance, 0, 30000, 0),
    penetracion: num(f?.penetracion, 0, 10000, 0),
  }))
  return { maquinas, fresas }
}

async function leerMetadata(): Promise<Record<string, unknown> | null> {
  const headers = await getAuthHeaders()
  if (!headers || !Object.keys(headers).length) return null
  return ((sdk.store as any).customers.me.query({ fields: "id,metadata", fetchOptions: { headers, cache: "no-store" } } as never) as unknown as Promise<{
    customer: { metadata?: Record<string, unknown> | null }
  }>)
    .then(({ customer }) => customer?.metadata ?? {})
    .catch(() => null)
}

/** Máquinas y fresas guardadas; sesion=false si no hay cuenta abierta. */
export async function leerMaquinasCam(): Promise<{ sesion: boolean; datos: DatosCam }> {
  const metadata = await leerMetadata()
  if (!metadata) return { sesion: false, datos: { maquinas: [], fresas: [] } }
  return { sesion: true, datos: limpiar(metadata[LLAVE]) }
}

export async function guardarMaquinasCam(datos: DatosCam): Promise<{ ok: boolean; error?: string }> {
  const metadata = await leerMetadata()
  if (!metadata) return { ok: false, error: "Inicia sesión para guardar en tu cuenta." }
  const headers = await getAuthHeaders()
  try {
    await (sdk.store as any).customers.me.mutate({ metadata: { ...metadata, [LLAVE]: limpiar(datos) }, fetchOptions: { headers } } as never)
    revalidateTag(await getCacheTag("customers"))
    return { ok: true }
  } catch {
    return { ok: false, error: "No se pudo guardar. Intenta otra vez." }
  }
}
