// Precios de referencia de los acabados (estrategia 2.1 + 3.1): salen de lo que
// los talleres ponen como "precio desde" en sus acabados (portal del taller).
// Se toma la mediana. Sólo se usan precios por pieza (o por doblez en el
// doblez): un precio por m², por hora o por lote no se puede sumar sin
// inventar, así que se omite. Sin talleres con precio, no hay tarifa: el
// acabado lo cotiza cada taller.
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import { ACABADOS_TALLER } from "./acabados"

const OTRA_UNIDAD = /lote|hora|m2|m²|metro|kg|juego|kilo|litro/

/** "$15 por doblez", "desde 12 pesos" → 15, 12; "$1,200 el lote", "$150 por pieza" → null (en el doblez). */
export function precioPorDoblez(texto: unknown): number | null {
  const t = String(texto || "").toLowerCase()
  if (!t) return null
  if ((OTRA_UNIDAD.test(t) || /pieza/.test(t)) && !/doblez|dobles/.test(t)) return null
  return numero(t)
}

/** Precio por pieza: "desde $80 por pieza", "$50 c/u", "$40" → 80, 50, 40; "$300 el m²" → null. */
export function precioPorPieza(texto: unknown): number | null {
  const t = String(texto || "").toLowerCase()
  if (!t || OTRA_UNIDAD.test(t)) return null
  return numero(t)
}

function numero(t: string): number | null {
  const m = t.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/)
  if (!m) return null
  const n = Number(m[1])
  return n > 0 && n < 50000 ? n : null
}

export function mediana(xs: number[]): number | null {
  if (!xs.length) return null
  const o = xs.slice().sort((a, b) => a - b)
  const k = Math.floor(o.length / 2)
  return o.length % 2 ? o[k] : (o[k - 1] + o[k]) / 2
}

export type TarifaAcabado = { clave: string; nombre: string; tarifa: number; unidad: "pieza" | "doblez"; talleres: number }

/** Tarifas de referencia a partir de los perfiles de los talleres (pura, para probarla). */
export function tarifasDePerfiles(perfiles: any[]): TarifaAcabado[] {
  const out: TarifaAcabado[] = []
  for (const a of ACABADOS_TALLER) {
    const precios = perfiles
      .map((p) => (Array.isArray(p?.acabados) ? p.acabados : []).find((x: any) => x?.clave === a.clave)?.precio)
      .map((t) => (a.clave === "doblez" ? precioPorDoblez(t) : precioPorPieza(t)))
      .filter((x): x is number => x != null)
    const m = mediana(precios)
    if (m) out.push({ clave: a.clave, nombre: a.nombre, tarifa: Math.round(m * 100) / 100, unidad: a.clave === "doblez" ? "doblez" : "pieza", talleres: precios.length })
  }
  return out
}

let cache: { t: number; v: TarifaAcabado[] } | null = null

export async function tarifasAcabados(scope: any): Promise<TarifaAcabado[]> {
  if (cache && Date.now() - cache.t < 3_600_000) return cache.v
  try {
    const knex = scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    const filas = (await knex("seller")
      .whereNull("deleted_at")
      .whereRaw(`jsonb_array_length(coalesce(metadata->'perfil'->'acabados', '[]'::jsonb)) > 0`)
      .limit(1000)
      .select("metadata")) as { metadata: any }[]
    cache = { t: Date.now(), v: tarifasDePerfiles(filas.map((f) => f.metadata?.perfil)) }
  } catch {
    cache = { t: Date.now(), v: [] }
  }
  return cache.v
}

export async function tarifaDoblez(scope: any): Promise<{ tarifa: number; talleres: number } | null> {
  const t = (await tarifasAcabados(scope)).find((x) => x.clave === "doblez")
  return t ? { tarifa: t.tarifa, talleres: t.talleres } : null
}
