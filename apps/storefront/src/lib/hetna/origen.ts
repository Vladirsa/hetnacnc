// ¿Quién vende o presta esto? (auditoría del 19 nov 2026, punto 4)
//   hetna   lo vende o lo presta HETNA CNC, la tienda propia
//   taller  lo vende o lo presta un taller o proveedor de la plataforma
// La tienda propia se reconoce por su dirección en Mercur (NEXT_PUBLIC_HETNA_SELLER_HANDLE,
// por omisión "hetna-cnc") o por su nombre ("Hetna CNC").
export type Origen = "hetna" | "taller"

const HANDLE_HETNA = (process.env.NEXT_PUBLIC_HETNA_SELLER_HANDLE || "hetna-cnc").toLowerCase()

export function origenDe(seller?: { handle?: string | null; name?: string | null } | null): Origen {
  if (!seller) return "taller"
  const handle = (seller.handle || "").toLowerCase()
  const nombre = (seller.name || "").toLowerCase().replace(/\s+/g, " ").trim()
  return handle === HANDLE_HETNA || /^hetna( cnc)?$/.test(nombre) ? "hetna" : "taller"
}
