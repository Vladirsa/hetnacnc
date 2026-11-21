"use server"

// Escanear (ingeniería inversa, Fase 1 de uso interno) contra /store/escanear
// del backend. La sesión del cliente va en el Bearer de la cookie.
import { getAuthHeaders } from "@/lib/data/cookies"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export type Respuesta<T> = { ok: true; datos: T } | { ok: false; mensaje: string; noAutenticado?: boolean }

export type ArchivoEscanear = { id: string; tipo: "escaneo" | "foto" | "render" | "modelo"; nombre: string; tamano: number; de: "cliente" | "equipo"; creado: string }
export type ComentarioEscanear = { de: "cliente" | "equipo"; texto: string; accion?: "aprobar" | "ajuste"; creado: string }
export type SolicitudEscanear = {
  id: string
  folio: number
  folio_texto: string
  titulo: string
  descripcion: string
  uso: "precision" | "mueble" | "repuesto"
  salida: "reposicion" | "adaptacion" | "molde"
  material_original: string | null
  material_deseado: string | null
  medidas: { nombre: string; mm: number }[]
  zona: string | null
  estado: string
  nombre_estado: string
  archivos: ArchivoEscanear[]
  comentarios: ComentarioEscanear[]
  disenador: string | null
  verificacion: { medida: string; esperado_mm: number; medido_mm: number; tolerancia_mm: number; ok: boolean; nota?: string }[]
  tiempos: Record<string, string>
  aviso: string
  creado: string
  actualizado: string
}

async function pedir<T>(ruta: string, opciones: { metodo?: "GET" | "POST"; cuerpo?: unknown } = {}): Promise<Respuesta<T>> {
  const auth = (await getAuthHeaders()) as { authorization?: string }
  if (!auth.authorization) return { ok: false, mensaje: "Necesitas iniciar sesión.", noAutenticado: true }
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}${ruta}`, {
      method: opciones.metodo || "GET",
      headers: { "Content-Type": "application/json", "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string, ...auth },
      body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
      cache: "no-store",
    })
    const cuerpo = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (res.status === 401) return { ok: false, mensaje: "Tu sesión expiró.", noAutenticado: true }
    if (!res.ok) return { ok: false, mensaje: (cuerpo.message as string) || "No se pudo completar la operación." }
    return { ok: true, datos: cuerpo as T }
  } catch (e) {
    console.error(`[escanear] falló ${opciones.metodo || "GET"} ${ruta}`, e)
    return { ok: false, mensaje: "No se pudo conectar con el servidor. Intenta de nuevo." }
  }
}

export async function misSolicitudesEscanear() {
  return pedir<{ puede_pedir: boolean; aviso: string; solicitudes: SolicitudEscanear[] }>("/store/escanear")
}

export async function cargarSolicitudEscanear(id: string) {
  if (!/^esc_[a-f0-9]{24}$/.test(id)) return { ok: false, mensaje: "Solicitud inválida." } as Respuesta<never>
  return pedir<{ solicitud: SolicitudEscanear }>(`/store/escanear/${id}`)
}

export type NuevaSolicitud = {
  titulo: string
  descripcion: string
  uso: SolicitudEscanear["uso"]
  salida: SolicitudEscanear["salida"]
  material_original?: string
  material_deseado?: string
  medidas: { nombre: string; mm: number }[]
  zona?: string
}

export async function crearSolicitudEscanear(d: NuevaSolicitud) {
  return pedir<{ ok: true; id: string; folio: string }>("/store/escanear", { metodo: "POST", cuerpo: d })
}

export async function responderRender(id: string, accion: "aprobar" | "ajuste" | "comentar", texto?: string) {
  if (!/^esc_[a-f0-9]{24}$/.test(id)) return { ok: false, mensaje: "Solicitud inválida." } as Respuesta<never>
  return pedir<{ ok: true; solicitud: SolicitudEscanear }>(`/store/escanear/${id}`, { metodo: "POST", cuerpo: { accion, texto } })
}
