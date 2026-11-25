// De dónde salen los planos: primero los del código (modelos.ts, sin pedir
// nada al backend) y después los publicados desde la base de datos (los que
// diseña el agente y aprueba el dueño: packages/api/src/lib/planos-biblioteca.ts).
// Sólo para el servidor (páginas y rutas).
import { PLANOS, planoPorSlug, type Plano } from "./modelos"

const BACKEND = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
const PK = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Planos publicados en la base de datos (caché de un minuto). */
async function publicadosDB(): Promise<Plano[]> {
  try {
    const r = await fetch(`${BACKEND}/store/hetna-planos`, { headers: { "x-publishable-api-key": PK }, next: { revalidate: 60, tags: ["planos-biblioteca"] } })
    if (!r.ok) return []
    const d = (await r.json()) as { planos?: Plano[] }
    return (d.planos || []).filter((p) => p && SLUG.test(p.slug) && Array.isArray(p.piezas) && !planoPorSlug(p.slug))
  } catch {
    return []
  }
}

/** Todos los planos: los del código y después los de la base de datos. */
export async function todosLosPlanos(): Promise<Plano[]> {
  return [...PLANOS, ...(await publicadosDB())]
}

/**
 * Un plano por slug. Los del código no piden nada; los de la base de datos se
 * piden sin caché (así un plano recién aprobado sale de inmediato). Con la firma
 * de vista previa (?borrador=…) también trae borradores.
 */
export async function buscarPlano(slug: string, borrador?: string): Promise<Plano | null> {
  const fijo = planoPorSlug(slug)
  if (fijo) return fijo
  if (!SLUG.test(slug) || slug.length > 40) return null
  try {
    const q = borrador ? `?borrador=${encodeURIComponent(borrador)}` : ""
    const r = await fetch(`${BACKEND}/store/hetna-planos/${slug}${q}`, { headers: { "x-publishable-api-key": PK }, cache: "no-store" })
    if (!r.ok) return null
    const d = (await r.json()) as { plano?: Plano }
    return d.plano && Array.isArray(d.plano.piezas) ? d.plano : null
  } catch {
    return null
  }
}
