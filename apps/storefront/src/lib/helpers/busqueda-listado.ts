// Qué productos pide el listado según los parámetros de la dirección (?query,
// ?page, ?sortBy, precios, existencia y filtros por atributo). Lo usan el
// servidor, que trae la primera página ya armada, y el navegador, que la
// vuelve a pedir cuando cambian los filtros: así los dos piden lo mismo.
import { PRODUCT_LIMIT } from "@/const"
import type { SortOptions } from "@/types/product"

// Parámetros que manejan el listado en sí y no son filtros por atributo.
export const PARAMS_RESERVADOS = new Set(["query", "page", "sortBy", "min_price", "max_price", "disponible"])

export type ArgsListado = {
  query?: string
  page: number
  limit: number
  sortBy?: SortOptions
  minPrice?: number
  maxPrice?: number
  onlyAvailable: boolean
  attributes: Record<string, string[]>
}

export function argsDeListado(params: URLSearchParams): ArgsListado {
  const attributes: Record<string, string[]> = {}
  params.forEach((raw, key) => {
    if (PARAMS_RESERVADOS.has(key) || !raw) return
    attributes[key] = raw.split(",").filter(Boolean)
  })
  const min = params.get("min_price") || ""
  const max = params.get("max_price") || ""
  return {
    query: params.get("query") || undefined,
    page: Math.max(1, Math.floor(Number(params.get("page")) || 1)),
    limit: PRODUCT_LIMIT,
    sortBy: (params.get("sortBy") as SortOptions | null) || undefined,
    minPrice: min ? Number(min) : undefined,
    maxPrice: max ? Number(max) : undefined,
    onlyAvailable: params.get("disponible") === "1",
    attributes,
  }
}

/** Una clave estable para saber si la primera página del servidor sirve para lo que pide el navegador. */
export const claveListado = (a: ArgsListado, extra: string) => JSON.stringify([extra, a.query ?? "", a.page, a.sortBy ?? "", a.minPrice ?? "", a.maxPrice ?? "", a.onlyAvailable, Object.entries(a.attributes).sort()])

/** Los parámetros que Next entrega a la página, como URLSearchParams. */
export function paramsDe(sp: Record<string, string | string[] | undefined> | undefined): URLSearchParams {
  const out = new URLSearchParams()
  for (const [k, v] of Object.entries(sp || {})) {
    if (Array.isArray(v)) v.forEach((x) => out.append(k, x))
    else if (typeof v === "string") out.set(k, v)
  }
  return out
}
