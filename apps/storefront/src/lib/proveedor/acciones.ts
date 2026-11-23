"use server"

// Panel de proveedores contra /store/proveedor del backend
// (packages/api/src/lib/proveedor-panel.ts). La sesión va en el Bearer de la cookie.
import { getAuthHeaders } from "@/lib/data/cookies"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export type Respuesta<T> = { ok: true; datos: T } | { ok: false; mensaje: string; noAutenticado?: boolean }

export type OrdenProveedor = {
  id: string
  folio: string
  taller: string
  estado: string
  nombre_estado: string
  fecha_entrega: string | null
  notas: string | null
  total: number
  enviada_en: string | null
  recibida_en: string | null
  renglones: { descripcion: string; unidad: string | null; cantidad: number; recibido: number; costo_unitario: number }[]
  confirmada_en: string | null
  fecha_compromiso: string | null
  marcada_enviada_en: string | null
  nota_proveedor: string | null
  puede_confirmar: boolean
  puede_marcar_enviada: boolean
}

export type PanelProveedor = {
  correo: string | null
  correo_confirmado: boolean
  es_proveedor: boolean
  acciones_activas: boolean
  ordenes: OrdenProveedor[]
}

async function pedir<T>(ruta: string, cuerpo?: unknown): Promise<Respuesta<T>> {
  const auth = (await getAuthHeaders()) as { authorization?: string }
  if (!auth.authorization) return { ok: false, mensaje: "Necesitas iniciar sesión.", noAutenticado: true }
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}${ruta}`, {
      method: cuerpo === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string, ...auth },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      cache: "no-store",
    })
    const datos = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (res.status === 401) return { ok: false, mensaje: "Tu sesión expiró.", noAutenticado: true }
    if (!res.ok) return { ok: false, mensaje: (datos.message as string) || "No se pudo completar la operación." }
    return { ok: true, datos: datos as T }
  } catch (e) {
    console.error(`[proveedor] falló ${ruta}`, e)
    return { ok: false, mensaje: "No se pudo conectar con el servidor. Intenta de nuevo." }
  }
}

export async function miPanelProveedor() {
  return pedir<PanelProveedor>("/store/proveedor/ordenes")
}

export async function responderOrden(id: string, accion: { accion: "confirmar"; fecha_compromiso: string; nota?: string } | { accion: "enviada"; nota?: string }) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, mensaje: "Orden inválida." } as Respuesta<never>
  return pedir<{ orden: OrdenProveedor }>(`/store/proveedor/ordenes/${id}`, accion)
}
