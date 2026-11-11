// Códigos de distribuidor del Cotizador (tabla codigos_promo en la base de la
// app). La página /distribuidores/<código> los lee del API.
const BACKEND = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export type Distribuidor = { codigo: string; nombre: string; dias: number }

export async function leerDistribuidor(codigo: string): Promise<Distribuidor | null> {
  const c = String(codigo || "").trim().toUpperCase()
  if (!/^[A-Z0-9]{4,24}$/.test(c)) return null
  try {
    const r = await fetch(`${BACKEND}/api/distribuidor/${c}`, { next: { revalidate: 300 } })
    if (!r.ok) return null
    return (await r.json()) as Distribuidor
  } catch {
    return null
  }
}

export const WHATSAPP_HETNA = process.env.NEXT_PUBLIC_WHATSAPP_DEFAULT || "522461217072"
export const ligaCotizador = (codigo?: string) => `https://hetnacnc.com/cotizador/${codigo ? `?ref=${encodeURIComponent(codigo)}` : ""}`
