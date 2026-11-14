// Filtros de precio y existencia del listado de productos.
//
// La API de la tienda (/store/products) no filtra por precio ni por existencia:
// el precio se calcula después de la consulta. Por eso se traen los productos
// (hasta unos cientos; el catálogo cabe de sobra) y aquí se filtran, ordenan y
// paginan. Lo usan el listado del servidor (ProductListing) y el del navegador
// (searchProducts en lib/data/products.ts).
//
// Parámetros de la URL: min_price, max_price (pesos), disponible=1 y sortBy.
import type { HttpTypes } from "@medusajs/types"

import type { SortOptions } from "@/types/product"
import { licenciaDe } from "@/lib/hetna/licencias"
import { tipoFicha } from "@/lib/hetna/tipo-ficha"

// Filtro por licencia de diseños (?licencia=): "comercial" = permite vender
// las piezas (comercial limitada o ampliada). Sólo deja diseños digitales.
export type FiltroLicencia = "personal" | "comercial" | "comercial_ampliada"
export const leerFiltroLicencia = (v: unknown): FiltroLicencia | undefined => {
  const s = String(Array.isArray(v) ? v[0] : v ?? "")
  return s === "personal" || s === "comercial" || s === "comercial_ampliada" ? s : undefined
}
export function cumpleLicencia(p: HttpTypes.StoreProduct, f: FiltroLicencia): boolean {
  if (tipoFicha(p as never) !== "digital") return false
  const clave = licenciaDe(p.metadata as Record<string, unknown> | null).licencia.clave
  if (f === "comercial") return clave === "comercial_limitada" || clave === "comercial_ampliada"
  return clave === f
}

export type FiltrosListado = { min?: number; max?: number; disponible?: boolean; licencia?: FiltroLicencia }

const numero = (v: unknown): number | undefined => {
  const n = Number(Array.isArray(v) ? v[0] : v)
  return Number.isFinite(n) && n >= 0 && String(Array.isArray(v) ? v[0] : v ?? "").trim() !== "" ? n : undefined
}

export function leerFiltros(p: Record<string, unknown> | URLSearchParams | undefined | null): FiltrosListado {
  const get = (k: string) => (p instanceof URLSearchParams ? p.get(k) : (p as Record<string, unknown> | undefined)?.[k])
  const d = get("disponible")
  return { min: numero(get("min_price")), max: numero(get("max_price")), disponible: d === "1" || d === "true", licencia: leerFiltroLicencia(get("licencia")) }
}

export const hayFiltros = (f: FiltrosListado) => f.min !== undefined || f.max !== undefined || Boolean(f.disponible) || Boolean(f.licencia)

/** Precio más bajo del producto (pesos), o null si ninguna variante tiene precio. */
export function precioMinimo(p: HttpTypes.StoreProduct): number | null {
  const precios = (p.variants || [])
    .map((v) => v?.calculated_price?.calculated_amount)
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n))
  return precios.length ? Math.min(...precios) : null
}

/** Tiene al menos una variante con precio que se puede comprar hoy. */
export function hayExistencia(p: HttpTypes.StoreProduct): boolean {
  return (p.variants || []).some((v) => {
    if (typeof v?.calculated_price?.calculated_amount !== "number") return false
    const x = v as { manage_inventory?: boolean | null; allow_backorder?: boolean | null; inventory_quantity?: number | null }
    if (x.manage_inventory === false || x.allow_backorder) return true
    // Si la API no mandó la cantidad, no se esconde el producto
    return typeof x.inventory_quantity !== "number" || x.inventory_quantity > 0
  })
}

export function filtrarYOrdenar(
  productos: HttpTypes.StoreProduct[],
  f: FiltrosListado,
  sortBy?: SortOptions
): HttpTypes.StoreProduct[] {
  let lista = productos.filter((p) => {
    if (f.disponible && !hayExistencia(p)) return false
    if (f.licencia && !cumpleLicencia(p, f.licencia)) return false
    if (f.min === undefined && f.max === undefined) return true
    const precio = precioMinimo(p)
    if (precio === null) return false
    if (f.min !== undefined && precio < f.min) return false
    if (f.max !== undefined && precio > f.max) return false
    return true
  })
  if (sortBy === "price_asc" || sortBy === "price_desc") {
    const signo = sortBy === "price_asc" ? 1 : -1
    lista = [...lista].sort((a, b) => signo * ((precioMinimo(a) ?? Infinity) - (precioMinimo(b) ?? Infinity)))
  } else {
    lista = [...lista].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
  }
  return lista
}

export const ordenValido = (v: unknown): SortOptions | undefined =>
  v === "price_asc" || v === "price_desc" || v === "created_at" ? v : undefined
