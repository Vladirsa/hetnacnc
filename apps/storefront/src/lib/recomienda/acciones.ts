"use server"

// Mi cuenta > Recomienda y gana (packages/api/src/lib/cupones.ts).
import { getAuthHeaders } from "@/lib/data/cookies"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export type Recomienda = {
  codigo: string
  liga: string
  monto: number
  minimo: number
  dias_espera: number
  amigos_registrados: number
  amigos_con_recompensa: number
  cupones: { codigo: string; vence: string | null; usado: boolean; vencido: boolean }[]
  bienvenida: { codigo: string; disponible: boolean }
}

export type RespuestaRecomienda =
  | { ok: true; datos: Recomienda }
  | { ok: false; mensaje: string; noAutenticado?: boolean; sinConfirmar?: boolean }

export async function obtenerRecomienda(): Promise<RespuestaRecomienda> {
  const auth = (await getAuthHeaders()) as Record<string, string>
  if (!auth.authorization) return { ok: false, mensaje: "Necesitas iniciar sesión.", noAutenticado: true }
  try {
    const r = await fetch(`${MEDUSA_BACKEND_URL}/store/hetna-recomienda`, {
      headers: { "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string, ...auth },
      cache: "no-store",
    })
    if (r.status === 401) return { ok: false, mensaje: "Tu sesión expiró.", noAutenticado: true }
    if (r.status === 403) return { ok: false, mensaje: "Confirma tu correo para usar Recomienda y gana.", sinConfirmar: true }
    if (!r.ok) return { ok: false, mensaje: "No se pudo cargar. Intenta de nuevo." }
    return { ok: true, datos: (await r.json()) as Recomienda }
  } catch {
    return { ok: false, mensaje: "No se pudo cargar. Intenta de nuevo." }
  }
}
