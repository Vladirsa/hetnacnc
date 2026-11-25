// Productos de planos en la tienda (packages/api/src/lib/planos-catalogo.ts):
// el precio recomendado por HETNA de cada variante (acabado y color).
import type { VariantePlano } from "@/components/hetna/planos/TalleresPlano"

type ProductoPlano = {
  metadata?: Record<string, unknown> | null
  variants?: { id: string; title?: string | null; metadata?: Record<string, unknown> | null }[] | null
}

const claveAcabado = (titulo: string) => (/^pintado/i.test(titulo) ? "pintura" : /^sellado/i.test(titulo) ? "sellado" : "lijado")

export function variantesPlano(p: ProductoPlano): VariantePlano[] {
  const rec = (p.metadata?.precio_recomendado || {}) as Record<string, unknown>
  return (p.variants || []).map((v) => {
    const titulo = v.title || ""
    const n = Number(v.metadata?.precio_recomendado ?? rec[claveAcabado(titulo)])
    return { id: v.id, titulo, recomendado: Number.isFinite(n) && n > 0 ? n : null }
  })
}
