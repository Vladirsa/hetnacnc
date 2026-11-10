// El candado del CAM Studio, del lado del servidor de la tienda. Calcular y
// simular es libre; el programa (el G-code) sólo sale de aquí después de que
// el API confirma que el plan lo incluye y que queda cupo en el mes.
// La regla vive en el backend: packages/api/src/lib/cam-cupo.ts.
import { createHash } from "node:crypto"

import { getAuthHeaders } from "@/lib/data/cookies"

const BACKEND = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
const PK = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string

export type TipoCam = "2d" | "3d" | "torno" | "torno_grabado" | "multieje"
export type Cupo = { incluido: boolean; limite: number | null; usadas: number; restantes: number | null }
export type EstadoCam = { plan: string; plan_nombre: string; mes: string; basico: Cupo; torno: Cupo; grabado: boolean; multieje: boolean }
export type Negado = { ok: false; candado: true; codigo: "sesion" | "plan" | "cupo" | "servicio"; mensaje: string; plan_necesario?: string; estado?: EstadoCam }

/** Huella del programa: volver a bajar el mismo no gasta otro del cupo. */
export const huella = (texto: string) => createHash("sha1").update(texto).digest("hex")

async function encabezados() {
  const auth = (await getAuthHeaders()) as { authorization?: string }
  return { auth, headers: { "Content-Type": "application/json", "x-publishable-api-key": PK, ...auth } }
}

export async function leerCupo(): Promise<{ sesion: boolean; estado: EstadoCam | null }> {
  try {
    const { headers } = await encabezados()
    const r = await fetch(`${BACKEND}/store/cam/cupo`, { headers, cache: "no-store" })
    if (!r.ok) return { sesion: false, estado: null }
    return await r.json()
  } catch {
    return { sesion: false, estado: null }
  }
}

/** Pide permiso para entregar un programa. Devuelve null si se puede, o la negativa lista para mandarla al navegador. */
export async function autorizarDescarga(tipo: TipoCam, ref: string): Promise<{ negado: Negado; status: number } | null> {
  const { auth, headers } = await encabezados()
  if (!auth.authorization) {
    return { status: 401, negado: { ok: false, candado: true, codigo: "sesion", mensaje: "Entra a tu cuenta para descargar el programa. Es gratis y tienes 5 al mes en 2D y 3D." } }
  }
  let r: Response
  try {
    r = await fetch(`${BACKEND}/store/cam/cupo`, { method: "POST", headers, body: JSON.stringify({ tipo, ref }), cache: "no-store" })
  } catch {
    return { status: 503, negado: { ok: false, candado: true, codigo: "servicio", mensaje: "No pudimos revisar tu plan en este momento. Intenta de nuevo en un minuto." } }
  }
  if (r.ok) return null
  const c = (await r.json().catch(() => ({}))) as { codigo?: string; message?: string; plan_necesario?: string; estado?: EstadoCam }
  if (r.status === 401) return { status: 401, negado: { ok: false, candado: true, codigo: "sesion", mensaje: "Tu sesión expiró. Vuelve a entrar para descargar el programa." } }
  if (r.status === 402 || r.status === 429) {
    return { status: r.status, negado: { ok: false, candado: true, codigo: r.status === 402 ? "plan" : "cupo", mensaje: c.message || "Tu plan no incluye esta descarga.", plan_necesario: c.plan_necesario, estado: c.estado } }
  }
  return { status: 503, negado: { ok: false, candado: true, codigo: "servicio", mensaje: "No pudimos revisar tu plan en este momento. Intenta de nuevo en un minuto." } }
}
