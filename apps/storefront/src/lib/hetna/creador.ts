// Programa de creadores (packages/api/src/lib/creadores.ts): la página
// /creadores/<código> lee al creador del API.
const BACKEND = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export type Creador = { codigo: string; nombre: string; red: string | null; canal_url: string | null; mensaje: string | null; dias: number }

export async function leerCreador(codigo: string): Promise<Creador | null> {
  const c = String(codigo || "").trim().toUpperCase()
  if (!/^[A-Z0-9]{4,24}$/.test(c)) return null
  try {
    const r = await fetch(`${BACKEND}/api/creador/${c}`, { next: { revalidate: 300 } })
    if (!r.ok) return null
    return (await r.json()) as Creador
  } catch {
    return null
  }
}

export const NOMBRE_RED: Record<string, string> = { youtube: "YouTube", tiktok: "TikTok", instagram: "Instagram", facebook: "Facebook", otra: "su canal" }
