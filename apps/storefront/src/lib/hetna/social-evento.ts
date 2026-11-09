"use server"
// Conversión atribuida a una publicación de redes (Social Hub, Fase 5A): si la
// persona llegó por una liga hetnacnc.com/r/<codigo> en los últimos 30 días,
// se avisa al backend. Nunca bloquea ni falla la acción principal.
import { cookies } from "next/headers"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export async function eventoSocial(tipo: "registro_cliente" | "registro_taller" | "solicitud" | "venta", ref?: string, valor?: number) {
  try {
    const codigo = (await cookies()).get("hetna_social")?.value || ""
    if (!/^[a-z0-9]{7}$/.test(codigo) || !process.env.N8N_REDES_TOKEN) return
    await fetch(`${MEDUSA_BACKEND_URL}/hooks/social-hub/evento`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-hetna-token": process.env.N8N_REDES_TOKEN },
      body: JSON.stringify({ codigo, tipo, ref, valor }),
      signal: AbortSignal.timeout(4000),
    })
  } catch {
    // La medición nunca debe romper un registro, una solicitud o una venta.
  }
}
