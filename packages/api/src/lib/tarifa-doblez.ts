// Precio de referencia del doblez (estrategia 3.1 + 2.1): sale de lo que los
// talleres ponen como "precio desde" en su acabado "Doblez de lámina" (portal
// del taller). Se toma la mediana del precio por doblez. Sin talleres con
// precio, no hay tarifa: el doblez lo cotiza cada taller.
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/** "$15 por doblez", "desde 12 pesos" → 15, 12; "$1,200 el lote", "$150 por pieza" → null. */
export function precioPorDoblez(texto: unknown): number | null {
  const t = String(texto || "").toLowerCase()
  if (!t) return null
  // Sólo precios por doblez (o sin otra unidad)
  if (/pieza|lote|hora|m2|m²|metro|kg|juego/.test(t) && !/doblez|dobles/.test(t)) return null
  const m = t.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/)
  if (!m) return null
  const n = Number(m[1])
  return n > 0 && n < 5000 ? n : null
}

export function mediana(xs: number[]): number | null {
  if (!xs.length) return null
  const o = xs.slice().sort((a, b) => a - b)
  const k = Math.floor(o.length / 2)
  return o.length % 2 ? o[k] : (o[k - 1] + o[k]) / 2
}

let cache: { t: number; v: { tarifa: number; talleres: number } | null } | null = null

export async function tarifaDoblez(scope: any): Promise<{ tarifa: number; talleres: number } | null> {
  if (cache && Date.now() - cache.t < 3_600_000) return cache.v
  try {
    const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    const filas = (await knex("seller")
      .whereNull("deleted_at")
      .whereRaw(`metadata->'perfil'->'acabados' @> '[{"clave":"doblez"}]'::jsonb`)
      .limit(500)
      .select("metadata")) as { metadata: any }[]
    const precios = filas
      .map((f) => (f.metadata?.perfil?.acabados || []).find((a: any) => a?.clave === "doblez")?.precio)
      .map(precioPorDoblez)
      .filter((x): x is number => x != null)
    const m = mediana(precios)
    cache = { t: Date.now(), v: m ? { tarifa: Math.round(m * 100) / 100, talleres: precios.length } : null }
  } catch {
    cache = { t: Date.now(), v: null }
  }
  return cache.v
}
