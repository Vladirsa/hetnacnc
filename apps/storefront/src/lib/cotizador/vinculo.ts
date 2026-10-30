"use server"

// Cuenta de hetnacnc.com <-> taller del Cotizador, contra
// /store/cotizador-vinculo del backend (lib/cotizador-vinculo.ts).

import { getAuthHeaders } from "@/lib/data/cookies"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export type EstadoVinculo =
  | { vinculado: false }
  | { vinculado: true; taller: string; plan: string; correo_app: string; desde: string }

async function llamar<T>(cuerpo?: Record<string, unknown>): Promise<T | null> {
  const auth = (await getAuthHeaders()) as { authorization?: string }
  if (!auth.authorization) return null
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/cotizador-vinculo`, {
      method: cuerpo ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string,
        authorization: auth.authorization,
      },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      cache: "no-store",
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export async function estadoVinculoCotizador(): Promise<EstadoVinculo | null> {
  return llamar<EstadoVinculo>()
}

export async function pedirCodigoCotizador(): Promise<{ codigo: string; expira: string } | null> {
  return llamar({ accion: "codigo" })
}

export async function quitarVinculoCotizador(): Promise<boolean> {
  return !!(await llamar<{ ok: boolean }>({ accion: "quitar" }))?.ok
}

/** Liga de acceso de un solo uso a la app (null si no hay sesión o no está vinculada). */
export async function ligaEntradaCotizador(): Promise<string | null> {
  return (await llamar<{ url: string | null }>({ accion: "entrar" }))?.url || null
}
