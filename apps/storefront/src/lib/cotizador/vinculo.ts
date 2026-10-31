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

const RUTA_ENTRAR = "/api/app/entrar-cotizador"
const RUTA_ACTIVAR = "/mx/cotizador/activar"

export type Entrada =
  | { url: string }
  | { confirmar: string }
  | { activar: { taller: string; telefono: string } }
  | { cuenta: string | null }

/** Qué toca para entrar al Cotizador con esta cuenta (backend: entradaCotizador). */
export async function entradaCotizador(): Promise<Entrada | null> {
  return llamar<Entrada>({ accion: "entrar" })
}

/**
 * A dónde manda el botón Cotizador. Una sola cuenta: con la de la tienda se
 * entra al Cotizador sin otra contraseña.
 *   - Sin sesión en la tienda: a iniciar sesión, y de regreso aquí.
 *   - Vinculada (o con un taller del mismo correo): liga de acceso de un solo uso.
 *   - Sin taller, o con el correo sin confirmar: /cotizador/activar.
 *   - Si el backend no responde: la app con ?cuenta=<huella del correo> (o
 *     ?salir=1), que cierra la sesión de otra persona que haya quedado abierta
 *     en ese navegador.
 */
export async function ligaEntradaCotizador(): Promise<string> {
  const auth = (await getAuthHeaders()) as { authorization?: string }
  if (!auth.authorization) return `/mx/login?volver=${encodeURIComponent(RUTA_ENTRAR)}`
  const r = await entradaCotizador()
  if (r && "url" in r && r.url) return r.url
  if (r && ("confirmar" in r || "activar" in r)) return RUTA_ACTIVAR
  if (r && "cuenta" in r && r.cuenta && /^[0-9a-f]{16}$/.test(r.cuenta)) return `/cotizador/?cuenta=${r.cuenta}`
  return "/cotizador/?salir=1"
}

/** Crea el taller del Cotizador con esta cuenta. Devuelve la liga para entrar o el error. */
export async function activarCotizador(datos: { taller: string; telefono: string }): Promise<{ url?: string; error?: string }> {
  const auth = (await getAuthHeaders()) as { authorization?: string }
  if (!auth.authorization) return { error: "Tu sesión venció. Vuelve a iniciar sesión." }
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}/store/cotizador-vinculo`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string,
        authorization: auth.authorization,
      },
      body: JSON.stringify({ accion: "activar", taller: datos.taller, telefono: datos.telefono }),
      cache: "no-store",
    })
    const j = (await res.json().catch(() => ({}))) as { url?: string; message?: string }
    if (res.ok && j.url) return { url: j.url }
    return { error: j.message || "No se pudo activar. Intenta de nuevo en un momento." }
  } catch {
    return { error: "No se pudo activar. Intenta de nuevo en un momento." }
  }
}

/** Vuelve a mandar la liga para confirmar el correo. */
export async function reenviarConfirmacionCotizador(): Promise<boolean> {
  return !!(await llamar<{ ok: boolean }>({ accion: "confirmar" }))?.ok
}
