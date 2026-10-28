"use server"

// Archivos gratis, contra /store/descargas-gratis del backend.
//
// Un archivo gratis no pasa por el carrito: Mercado Pago no cobra un pedido de
// $0 y no hay nada que cobrar. El backend lleva el cupo (20 por semana con
// cuenta gratis, sin límite con un plan del Cotizador) y da una liga firmada
// de B2 que dura una hora.

import { getAuthHeaders } from "@/lib/data/cookies"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

const cabeceras = (auth: Record<string, string>) => ({
  "Content-Type": "application/json",
  "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string,
  ...auth,
})

export type EstadoDescargas = {
  ilimitado: boolean
  plan: string
  limite: number | null
  usadas: number
  restantes: number | null
  proxima_liberacion: string | null
}

export type RespuestaDescarga =
  | { ok: true; url: string; estado: EstadoDescargas }
  | { ok: false; mensaje: string; noAutenticado?: boolean; estado?: EstadoDescargas }

// null cuando no hay sesión: la ficha entonces invita a crear la cuenta.
export async function miCupoDeDescargas(): Promise<EstadoDescargas | null> {
  const auth = (await getAuthHeaders()) as { authorization?: string }
  if (!auth.authorization) return null
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/descargas-gratis`, {
      headers: cabeceras(auth as Record<string, string>),
      cache: "no-store",
    })
    if (!res.ok) return null
    return ((await res.json()) as { estado: EstadoDescargas }).estado
  } catch {
    return null
  }
}

export async function descargarArchivoGratis(productId: string): Promise<RespuestaDescarga> {
  const auth = (await getAuthHeaders()) as { authorization?: string }
  if (!auth.authorization) {
    return { ok: false, mensaje: "Entra con tu cuenta para descargar.", noAutenticado: true }
  }

  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/descargas-gratis`, {
      method: "POST",
      headers: cabeceras(auth as Record<string, string>),
      body: JSON.stringify({ product_id: productId }),
      cache: "no-store",
    })
    const cuerpo = (await res.json().catch(() => ({}))) as {
      url?: string
      estado?: EstadoDescargas
      message?: string
    }
    if (res.status === 401) {
      return { ok: false, mensaje: "Tu sesión expiró. Vuelve a entrar.", noAutenticado: true }
    }
    if (!res.ok || !cuerpo.url) {
      return {
        ok: false,
        mensaje: cuerpo.message || "No se pudo preparar la descarga.",
        estado: cuerpo.estado,
      }
    }
    return { ok: true, url: cuerpo.url, estado: cuerpo.estado as EstadoDescargas }
  } catch {
    return { ok: false, mensaje: "No se pudo conectar con el servidor." }
  }
}
