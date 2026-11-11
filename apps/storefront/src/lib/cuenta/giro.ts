"use server"

// Guarda el giro del cliente (metadata.giro). Se mezcla con lo que ya tiene la
// metadata para no borrar otras llaves (las protegidas las cuida además la API:
// api/store/customers/proteger-metadata.ts).
import { retrieveCustomer, updateCustomer } from "@/lib/data/customer"

export async function guardarGiro(giro: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const limpio = String(giro || "").replace(/[<>\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60)
  if (limpio.length < 3) return { ok: false, error: "Escribe tu giro (mínimo 3 letras)." }
  const c = await retrieveCustomer().catch(() => null)
  if (!c) return { ok: false, error: "Tu sesión terminó. Vuelve a entrar." }
  try {
    await updateCustomer({ metadata: { ...((c.metadata as Record<string, unknown>) || {}), giro: limpio } })
    return { ok: true }
  } catch {
    return { ok: false, error: "No se pudo guardar. Intenta de nuevo." }
  }
}
