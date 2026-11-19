"use server"

// Buzón de opiniones y encuesta de los 7 días (packages/api/src/lib/opiniones.ts).
import { getAuthHeaders } from "@/lib/data/cookies"

const BACKEND = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
const llave = () => ({ "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string })

export type Resultado = { ok: true } | { ok: false; mensaje: string; noAutenticado?: boolean }

async function postar(ruta: string, cuerpo: unknown, auth: Record<string, string> = {}): Promise<Resultado> {
  try {
    const r = await fetch(`${BACKEND}${ruta}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...llave(), ...auth },
      body: JSON.stringify(cuerpo),
      cache: "no-store",
    })
    if (r.status === 401) return { ok: false, mensaje: "Tu sesión expiró. Vuelve a iniciar sesión.", noAutenticado: true }
    const d = await r.json().catch(() => null)
    if (!r.ok) return { ok: false, mensaje: d?.message || "No se pudo enviar. Intenta de nuevo." }
    return { ok: true }
  } catch {
    return { ok: false, mensaje: "No se pudo enviar. Intenta de nuevo." }
  }
}

export async function haySesion(): Promise<boolean> {
  const auth = (await getAuthHeaders()) as Record<string, string>
  return !!auth.authorization
}

/** Datos de la liga de la encuesta, o null si ya no vale. */
export async function leerEncuesta(t: string): Promise<{ quien: "taller" | "cliente"; nombre: string } | null> {
  if (!t) return null
  try {
    const r = await fetch(`${BACKEND}/store/hetna-opinion/correo?t=${encodeURIComponent(t)}`, { headers: llave(), cache: "no-store" })
    return r.ok ? await r.json() : null
  } catch {
    return null
  }
}

export async function enviarOpinion(d: { t?: string; puntaje: number | null; comentario: string; pagina?: string }): Promise<Resultado> {
  if (d.t) return postar("/store/hetna-opinion/correo", { t: d.t, puntaje: d.puntaje, comentario: d.comentario })
  const auth = (await getAuthHeaders()) as Record<string, string>
  if (!auth.authorization) return { ok: false, mensaje: "Inicia sesión para enviarnos tu opinión.", noAutenticado: true }
  return postar("/store/hetna-opinion", { puntaje: d.puntaje, comentario: d.comentario, pagina: d.pagina }, auth)
}
