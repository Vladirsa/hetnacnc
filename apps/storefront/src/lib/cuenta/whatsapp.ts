"use server"
// Verificar el WhatsApp del cliente (packages/api/src/api/store/customers/me/whatsapp).
import { getAuthHeaders } from "@/lib/data/cookies"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

async function pedir(cuerpo?: Record<string, string>) {
  const r = await fetch(`${MEDUSA_BACKEND_URL}/store/customers/me/whatsapp`, {
    method: cuerpo ? "POST" : "GET",
    headers: { "Content-Type": "application/json", "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string, ...(await getAuthHeaders()) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) return { error: String(d?.message || `Error ${r.status}`) }
  return d
}

export async function estadoWhatsapp() {
  return pedir()
}
export async function iniciarWhatsapp(numero: string) {
  return pedir({ accion: "iniciar", numero })
}
export async function codigoWhatsapp(numero: string) {
  return pedir({ accion: "codigo", numero })
}
export async function confirmarWhatsapp(numero: string, codigo: string) {
  return pedir({ accion: "confirmar", numero, codigo })
}
