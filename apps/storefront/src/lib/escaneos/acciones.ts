"use server"

// Capa de datos de los escaneos 3D del taller, contra /store/escaneos del
// backend. Mismo trato que el cotizador: la sesión del cliente va en el
// Bearer de la cookie y sin sesión no se llama al backend.

import { getAuthHeaders } from "@/lib/data/cookies"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export type Respuesta<T> =
  | { ok: true; datos: T }
  | { ok: false; mensaje: string; noAutenticado?: boolean }

async function pedir<T>(
  ruta: string,
  opciones: { metodo?: "GET" | "POST"; cuerpo?: unknown } = {}
): Promise<Respuesta<T>> {
  const auth = (await getAuthHeaders()) as { authorization?: string }
  if (!auth.authorization) {
    return { ok: false, mensaje: "Necesitas iniciar sesión.", noAutenticado: true }
  }

  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}${ruta}`, {
      method: opciones.metodo || "GET",
      headers: {
        "Content-Type": "application/json",
        "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string,
        ...auth,
      },
      body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
      cache: "no-store",
    })

    const cuerpo = await res.json().catch(() => ({}) as Record<string, unknown>)

    if (res.status === 401) {
      return { ok: false, mensaje: "Tu sesión expiró.", noAutenticado: true }
    }
    if (!res.ok) {
      return {
        ok: false,
        mensaje: (cuerpo as { message?: string }).message || "No se pudo completar la operación.",
      }
    }
    return { ok: true, datos: cuerpo as T }
  } catch (e) {
    console.error(`[escaneos] falló ${opciones.metodo || "GET"} ${ruta}`, e)
    return { ok: false, mensaje: "No se pudo conectar con el servidor. Intenta de nuevo." }
  }
}

export type Escaneo = {
  id: string
  modo: "preview" | "scan"
  titulo: string | null
  estatus: "pendiente" | "procesando" | "listo" | "fallido"
  n_fotos: number
  job_externo: string | null
  obj_storage_key: string | null
  stl_storage_key: string | null
  vertices: number | null
  caras: number | null
  watertight: boolean | null
  // Dimensiones de la malla: milímetros sólo si escala_real es true; si no,
  // son proporciones (la reconstrucción no sabe el tamaño real).
  bounding_box: number[] | null
  // Lado más largo medido por el taller, con el que se escala el STL.
  medida_mm: number | null
  escala_real: boolean | null
  creditos_cobrados: number
  error: string | null
  iniciado_en: string | null
  terminado_en: string | null
  created_at: string
}

export async function listarEscaneos(opciones: { estatus?: string; limite?: number } = {}) {
  const query = new URLSearchParams()
  if (opciones.estatus) query.set("estatus", opciones.estatus)
  if (opciones.limite) query.set("limit", String(opciones.limite))
  const sufijo = query.toString() ? `?${query}` : ""
  return pedir<{ escaneos: Escaneo[]; count: number; creditos_por_escaneo: number }>(
    `/store/escaneos${sufijo}`
  )
}

export async function cargarEscaneo(id: string) {
  return pedir<{ escaneo: Escaneo; descargas: Record<string, string> }>(
    `/store/escaneos/${encodeURIComponent(id)}`
  )
}

export async function crearEscaneo(cuerpo: {
  modo: "preview" | "scan"
  titulo?: string | null
  fotos: string[]
  medida_mm?: number | null
}) {
  return pedir<{ escaneo: Escaneo }>("/store/escaneos", { metodo: "POST", cuerpo })
}

// --- Subida de fotos ---
//
// La foto se manda al backend y él la sube a B2: el permiso de subida de B2
// autoriza a escribir en todo el bucket y por eso nunca sale del backend.
export type SubidaResultado =
  | { ok: true; lote: string; storage_key: string }
  | { ok: false; mensaje: string }

export async function subirFoto(contenido: ArrayBuffer, contentType: string, lote?: string): Promise<SubidaResultado> {
  const auth = (await getAuthHeaders()) as { authorization?: string }
  if (!auth.authorization) {
    return { ok: false, mensaje: "Necesitas iniciar sesión." }
  }

  const form = new FormData()
  form.append("foto", new Blob([contenido], { type: contentType }), "foto")
  if (lote) form.append("lote", lote)

  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/escaneos/subida`, {
      method: "POST",
      headers: {
        "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string,
        ...auth,
      },
      body: form,
      cache: "no-store",
    })
    const cuerpo = (await res.json().catch(() => ({}))) as { lote?: string; storage_key?: string; message?: string }
    if (!res.ok || !cuerpo.lote || !cuerpo.storage_key) {
      return { ok: false, mensaje: cuerpo.message || "No se pudo guardar la foto. Intenta de nuevo." }
    }
    return { ok: true, lote: cuerpo.lote, storage_key: cuerpo.storage_key }
  } catch (e) {
    console.error("[escaneos] falló la subida de la foto", e)
    return { ok: false, mensaje: "No se pudo guardar la foto. Intenta de nuevo." }
  }
}
