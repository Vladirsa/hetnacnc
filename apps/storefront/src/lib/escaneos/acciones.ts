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
  // Ojo: son las dimensiones crudas de la malla. TripoSR entrega coordenadas
  // normalizadas, no milímetros -- por eso el campo no dice la unidad.
  bounding_box: number[] | null
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
}) {
  return pedir<{ escaneo: Escaneo }>("/store/escaneos", { metodo: "POST", cuerpo })
}

// --- Subida de fotos ---
//
// El backend entrega un permiso de subida de B2 y este servidor releva los
// bytes. El permiso NO puede llegar al navegador: autoriza a escribir en el
// bucket completo, no sólo en la ruta que trae. Por eso la subida ocurre aquí
// y no en el cliente.
export type SubidaResultado =
  | { ok: true; lote: string; storage_key: string }
  | { ok: false; mensaje: string }

export async function subirFoto(contenido: ArrayBuffer, contentType: string, lote?: string): Promise<SubidaResultado> {
  const boleto = await pedir<{
    lote: string
    storage_key: string
    upload_url: string
    token: string
  }>("/store/escaneos/subida", { metodo: "POST", cuerpo: { content_type: contentType, lote } })

  if (!boleto.ok) {
    return { ok: false, mensaje: boleto.mensaje }
  }

  const datos = Buffer.from(contenido)
  const { createHash } = await import("node:crypto")

  try {
    const res = await fetch(boleto.datos.upload_url, {
      method: "POST",
      headers: {
        Authorization: boleto.datos.token,
        "X-Bz-File-Name": boleto.datos.storage_key.split("/").map(encodeURIComponent).join("/"),
        "Content-Type": contentType,
        "Content-Length": String(datos.length),
        // B2 verifica el SHA1 del otro lado: si no coincide rechaza el
        // archivo en vez de guardar algo corrupto en silencio.
        "X-Bz-Content-Sha1": createHash("sha1").update(datos).digest("hex"),
      },
      body: new Uint8Array(datos),
    })
    if (!res.ok) {
      console.error("[escaneos] B2 rechazó la foto:", res.status, await res.text().catch(() => ""))
      return { ok: false, mensaje: "No se pudo guardar la foto. Intenta de nuevo." }
    }
  } catch (e) {
    console.error("[escaneos] falló la subida a B2", e)
    return { ok: false, mensaje: "No se pudo guardar la foto. Intenta de nuevo." }
  }

  return { ok: true, lote: boleto.datos.lote, storage_key: boleto.datos.storage_key }
}
