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

/**
 * A dónde manda el botón Cotizador: la liga de acceso de un solo uso si la
 * cuenta está vinculada; si no, la app con ?cuenta=<huella del correo> para que
 * cierre la sesión de otra persona que haya quedado abierta en ese navegador;
 * sin sesión en la tienda, la app normal (pide su propio inicio de sesión); con
 * sesión pero sin respuesta del backend (p. ej. correo sin confirmar), la app
 * con ?salir=1.
 */
export async function ligaEntradaCotizador(): Promise<string> {
  const auth = (await getAuthHeaders()) as { authorization?: string }
  if (!auth.authorization) return "/cotizador/"
  const r = await llamar<{ url: string | null; cuenta?: string | null }>({ accion: "entrar" })
  if (r?.url) return r.url
  if (r?.cuenta && /^[0-9a-f]{16}$/.test(r.cuenta)) return `/cotizador/?cuenta=${r.cuenta}`
  return "/cotizador/?salir=1"
}
