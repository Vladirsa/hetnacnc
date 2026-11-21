"use server"

import { headers } from "next/headers"

// Pre-registro de Latinoamérica (packages/api/src/lib/latam.ts).
const BACKEND = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export async function conteoLatam(): Promise<Record<string, { talleres: number; clientes: number }>> {
  try {
    const r = await fetch(`${BACKEND}/api/latam-registro`, { next: { revalidate: 300 } })
    return ((await r.json()) as { conteo?: Record<string, { talleres: number; clientes: number }> }).conteo || {}
  } catch {
    return {}
  }
}

export async function registrarLatam(datos: Record<string, string>): Promise<{ ok: boolean; mensaje?: string }> {
  try {
    const h = await headers()
    const ip = h.get("cf-connecting-ip") || h.get("x-real-ip") || (h.get("x-forwarded-for") || "").split(",")[0] || ""
    const r = await fetch(`${BACKEND}/api/latam-registro`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(ip ? { "x-real-ip": ip } : {}) },
      body: JSON.stringify(datos),
      cache: "no-store",
    })
    const j = (await r.json().catch(() => ({}))) as { message?: string }
    return r.ok ? { ok: true } : { ok: false, mensaje: j.message || "No se pudo enviar." }
  } catch {
    return { ok: false, mensaje: "No se pudo enviar. Intenta de nuevo en un momento." }
  }
}
