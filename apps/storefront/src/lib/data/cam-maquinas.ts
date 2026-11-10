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
  tipo: "recta" | "upcut" | "downcut" | "compresion" | "un_filo" | "bola" | "v" | "planeadora" | "desbaste" | "toroidal" | "conica_bola" | "broca"
  diametro: number // diámetro de corte
  angulo: number // sólo fresa en V
  // Ficha técnica; 0 o ausente = sin capturar
  zanco?: number // diámetro del zanco, el que entra al collet
  largoCorte?: number // largo de los filos
  largoTotal?: number
  voladizo?: number // cuánto sale del collet ya montada
  filos?: number
  materialFresa?: "carburo" | "carburo_rec" | "hss"
  numero?: number // posición T en la máquina
  notas?: string
  grupo?: string // carpeta de la base: "Madera", "Aluminio", "Grabado"…
  // Sólo las usa el CAM de 3, 4 y 5 ejes
  radio?: number // radio de esquina (toroidal)
  puntaD?: number // diámetro de la punta (cónica de bola)
  conicidad?: number // grados por lado (cónica de bola)
  portaD?: number // portaherramienta: diámetro y largo, para colisiones
  portaLargo?: number
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
const TIPOS_FRESA = ["recta", "upcut", "downcut", "compresion", "un_filo", "bola", "v", "planeadora", "desbaste", "toroidal", "conica_bola", "broca"]
const MATERIALES_FRESA = ["carburo", "carburo_rec", "hss"]

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
  const fresas = (Array.isArray(o.fresas) ? o.fresas : []).slice(0, 80).map((f: any, i: number) => ({
    id: texto(f?.id, 24) || `f${i}`,
    nombre: texto(f?.nombre) || `Fresa ${i + 1}`,
    tipo: (TIPOS_FRESA.includes(f?.tipo) ? f.tipo : "recta") as FresaCam["tipo"],
    diametro: num(f?.diametro, 0.1, 30, 6),
    angulo: num(f?.angulo, 10, 150, 90),
    zanco: num(f?.zanco, 0, 50, 0),
    largoCorte: num(f?.largoCorte, 0, 300, 0),
    largoTotal: num(f?.largoTotal, 0, 500, 0),
    voladizo: num(f?.voladizo, 0, 500, 0),
    filos: Math.round(num(f?.filos, 0, 12, 0)),
    materialFresa: (MATERIALES_FRESA.includes(f?.materialFresa) ? f.materialFresa : "carburo") as FresaCam["materialFresa"],
    numero: Math.round(num(f?.numero, 0, 999, 0)),
    notas: texto(f?.notas, 200),
    grupo: texto(f?.grupo, 30),
    radio: num(f?.radio, 0, 100, 0),
    puntaD: num(f?.puntaD, 0, 100, 0),
    conicidad: num(f?.conicidad, 0, 45, 0),
    portaD: num(f?.portaD, 0, 400, 0),
    portaLargo: num(f?.portaLargo, 0, 400, 0),
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
