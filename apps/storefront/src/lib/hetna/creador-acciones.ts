"use server"

import { headers } from "next/headers"

// Acciones de las páginas de creadores: van por el servidor de la tienda al
// backend (packages/api/src/api/api/creador*), sin exponerlo al navegador.
const BACKEND = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export async function contarVisitaCreador(codigo: string) {
  const c = String(codigo || "").trim().toUpperCase()
  if (!/^[A-Z0-9]{4,24}$/.test(c)) return
  await fetch(`${BACKEND}/api/creador/${c}`, { method: "POST", cache: "no-store" }).catch(() => null)
}

export type SolicitudCreador = { nombre: string; correo: string; red: string; canal_url: string; seguidores: string; mensaje: string; sitio_web: string }

export async function enviarSolicitudCreador(s: SolicitudCreador): Promise<{ ok: boolean; mensaje?: string }> {
  try {
    const h = await headers()
    const ip = h.get("cf-connecting-ip") || h.get("x-real-ip") || (h.get("x-forwarded-for") || "").split(",")[0] || ""
    const r = await fetch(`${BACKEND}/api/creador-solicitud`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(ip ? { "x-real-ip": ip } : {}) },
      body: JSON.stringify(s),
      cache: "no-store",
    })
    const j = (await r.json().catch(() => ({}))) as { message?: string }
    return r.ok ? { ok: true } : { ok: false, mensaje: j.message || "No se pudo enviar." }
  } catch {
    return { ok: false, mensaje: "No se pudo enviar. Intenta de nuevo en un momento." }
  }
}
