// Ciudad y estado del perfil público de un taller (seller.metadata.perfil) para
// las listas públicas que la tienda ordena por cercanía al cliente
// (apps/storefront/src/lib/ubicacion/cercania.ts). Nunca el código postal.
export function ubicacionPublica(metadata: unknown): { ciudad?: string; estado?: string } {
  const p = ((metadata as { perfil?: Record<string, unknown> } | null)?.perfil || {}) as Record<string, unknown>
  const t = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined)
  return { ciudad: t(p.ciudad, 80), estado: t(p.estado, 40) }
}
