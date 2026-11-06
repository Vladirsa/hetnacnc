"use server"

// Reseñas de producto, contra /store/resenas del backend.
//
// Las reseñas son de Mercur: su dominio Review ya traía el modelo, la
// validación de compra y la moderación. Lo que el backend de HETNA agregó son
// las rutas de tienda, porque Mercur sólo expone las de Admin y Vendor.
//
// Leerlas es público a propósito -- son el argumento de venta de la ficha y
// tienen que salir sin cuenta, también para Google. Escribir una sí pide sesión.

import { getAuthHeaders } from "@/lib/data/cookies"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

const cabeceras = (auth?: Record<string, string>) => ({
  "Content-Type": "application/json",
  "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string,
  ...(auth || {}),
})

export type Resena = {
  id: string
  calificacion: number
  comentario: string | null
  respuesta_taller: string | null
  creado: string
  fotos?: string[]
}

export type ResenasDeProducto = {
  promedio: number | null
  total: number
  desglose: { estrellas: number; total: number }[]
  resenas: Resena[]
  con_fotos?: number
}

const VACIO: ResenasDeProducto = {
  promedio: null,
  total: 0,
  desglose: [5, 4, 3, 2, 1].map((estrellas) => ({ estrellas, total: 0 })),
  resenas: [],
}

export async function resenasDeProducto(productId: string): Promise<ResenasDeProducto> {
  try {
    const res = await fetch(
      `${MEDUSA_BACKEND_URL}/store/resenas?product_id=${encodeURIComponent(productId)}`,
      { headers: cabeceras(), next: { revalidate: 120 } }
    )
    if (!res.ok) return VACIO
    return (await res.json()) as ResenasDeProducto
  } catch (e) {
    // Una ficha sin reseñas se puede leer; una ficha caída, no. Si el backend
    // no contesta, el módulo simplemente no aparece.
    console.error("[resenas] no se pudieron leer", e)
    return VACIO
  }
}

// El ⭐4.9 de las tarjetas: una llamada para la lista entera.
export async function promediosDeProductos(
  ids: string[]
): Promise<Map<string, { promedio: number; total: number }>> {
  const mapa = new Map<string, { promedio: number; total: number }>()
  if (!ids.length) return mapa

  try {
    const res = await fetch(
      `${MEDUSA_BACKEND_URL}/store/resenas/promedios?product_ids=${encodeURIComponent(ids.join(","))}`,
      { headers: cabeceras(), next: { revalidate: 300 } }
    )
    if (!res.ok) return mapa
    const { promedios } = (await res.json()) as {
      promedios: Record<string, { promedio: number; total: number }>
    }
    for (const [id, datos] of Object.entries(promedios || {})) mapa.set(id, datos)
  } catch {
    return mapa
  }
  return mapa
}

export type Pendiente = {
  order_id: string
  product_id: string
  titulo: string
  thumbnail: string | null
  comprado: string
}

export async function resenasPendientes(): Promise<Pendiente[]> {
  const auth = (await getAuthHeaders()) as { authorization?: string }
  if (!auth.authorization) return []

  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/resenas/pendientes`, {
      headers: cabeceras(auth as Record<string, string>),
      cache: "no-store",
    })
    if (!res.ok) return []
    const { pendientes } = (await res.json()) as { pendientes: Pendiente[] }
    return pendientes || []
  } catch {
    return []
  }
}

export type RespuestaEnvio =
  | { ok: true; moderacion: boolean }
  | { ok: false; mensaje: string; noAutenticado?: boolean }

export async function enviarResena(datos: {
  product_id: string
  order_id: string
  calificacion: number
  comentario?: string
  fotos?: string[]
}): Promise<RespuestaEnvio> {
  const auth = (await getAuthHeaders()) as { authorization?: string }
  if (!auth.authorization) {
    return { ok: false, mensaje: "Necesitas iniciar sesión.", noAutenticado: true }
  }

  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/resenas`, {
      method: "POST",
      headers: cabeceras(auth as Record<string, string>),
      body: JSON.stringify(datos),
      cache: "no-store",
    })
    const cuerpo = (await res.json().catch(() => ({}))) as {
      message?: string
      moderacion?: boolean
    }

    if (res.status === 401) {
      return { ok: false, mensaje: "Tu sesión expiró.", noAutenticado: true }
    }
    if (!res.ok) {
      return { ok: false, mensaje: cuerpo.message || "No se pudo guardar tu reseña." }
    }
    return { ok: true, moderacion: Boolean(cuerpo.moderacion) }
  } catch {
    return { ok: false, mensaje: "No se pudo conectar con el servidor." }
  }
}

/** Sube una foto (ya reducida en el navegador) para la reseña. Devuelve su id. */
export async function subirFotoResena(imagen: string): Promise<{ ok: true; id: string } | { ok: false; mensaje: string }> {
  const auth = (await getAuthHeaders()) as { authorization?: string }
  if (!auth.authorization) return { ok: false, mensaje: "Necesitas iniciar sesión." }
  if (typeof imagen !== "string" || imagen.length > 2_100_000) return { ok: false, mensaje: "La foto es muy pesada." }
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/resenas/fotos`, {
      method: "POST",
      headers: cabeceras(auth as Record<string, string>),
      body: JSON.stringify({ imagen }),
      cache: "no-store",
    })
    const cuerpo = (await res.json().catch(() => ({}))) as { id?: string; message?: string }
    return res.ok && cuerpo.id ? { ok: true, id: cuerpo.id } : { ok: false, mensaje: cuerpo.message || "No se pudo subir la foto." }
  } catch {
    return { ok: false, mensaje: "No se pudo subir la foto." }
  }
}
