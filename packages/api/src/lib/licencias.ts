// Licencias de diseños digitales (respuesta jurídica del 14 nov 2026, pregunta
// 8): tres licencias tipo, para que el cliente sepa qué puede fabricar y
// vender ANTES de comprar.
//
//   personal            fabricar para uso propio; no vender piezas
//   comercial_limitada  vender las piezas físicas que fabrique, hasta N piezas
//   comercial_ampliada  producción comercial sin límite de piezas
//
// Cada vendedor elige la licencia de cada diseño (panel del taller ›
// Licencias). Se guarda en metadata.licencia y metadata.licencia_piezas. Un
// diseño sin licencia elegida se vende con la personal.
//
// El texto completo vive en la tienda: apps/storefront/src/lib/hetna/licencias.ts
// (mismas claves). Si se cambia una, se cambian las dos.
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"

export const LICENCIAS = ["personal", "comercial_limitada", "comercial_ampliada"] as const
export type Licencia = (typeof LICENCIAS)[number]
export const PIEZAS_POR_OMISION = 100

export class ErrorLicencia extends Error {}

/** Lo que trae el producto, normalizado. */
export function leerLicencia(metadata?: Record<string, unknown> | null): { licencia: Licencia; piezas: number | null } {
  const v = String(metadata?.licencia || "").trim().toLowerCase()
  const licencia = (LICENCIAS as readonly string[]).includes(v) ? (v as Licencia) : "personal"
  const n = Math.floor(Number(metadata?.licencia_piezas))
  return { licencia, piezas: licencia === "comercial_limitada" ? (n > 0 ? n : PIEZAS_POR_OMISION) : null }
}

/** Valida lo que manda el vendedor o el admin. */
export function validarLicencia(licencia: unknown, piezas?: unknown): { licencia: Licencia; licencia_piezas: number | "" } {
  const l = String(licencia || "").trim().toLowerCase()
  if (!(LICENCIAS as readonly string[]).includes(l)) throw new ErrorLicencia("Elige una licencia: personal, comercial limitada o comercial ampliada.")
  if (l !== "comercial_limitada") return { licencia: l as Licencia, licencia_piezas: "" }
  const n = Math.floor(Number(piezas))
  if (!(n >= 1 && n <= 1_000_000)) throw new ErrorLicencia("Escribe cuántas piezas permite la licencia comercial limitada (de 1 a 1,000,000).")
  return { licencia: "comercial_limitada", licencia_piezas: n }
}

const esDigital = (m: Record<string, any> | null | undefined) =>
  !!m && (m.producto_digital === true || m.producto_digital === "true") && !m.producto_servicio && !m.hetna_cam_service

/** Diseños digitales del taller con su licencia. */
export async function disenosDelTaller(container: any, sellerId: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "seller",
    fields: ["id", "products.id", "products.title", "products.handle", "products.thumbnail", "products.status", "products.metadata", "products.tags.value"],
    filters: { id: sellerId },
  })
  type P = { id: string; title: string; handle: string; thumbnail: string | null; status: string; metadata: Record<string, any> | null; tags?: { value?: string }[] }
  return ((data?.[0]?.products || []) as P[])
    .filter((p) => p && (esDigital(p.metadata) || (p.tags || []).some((t) => String(t?.value || "").toLowerCase() === "digital")) && !p.metadata?.producto_servicio && !p.metadata?.hetna_cam_service)
    .sort((a, b) => String(a.title).localeCompare(String(b.title), "es"))
    .map((p) => ({ id: p.id, titulo: p.title, handle: p.handle, foto: p.thumbnail, estado: p.status, ...leerLicencia(p.metadata) }))
}

/** Cambia la licencia si el producto es del taller. Conserva el resto del metadata. */
export async function guardarLicencia(container: any, sellerId: string, productId: string, licencia: unknown, piezas?: unknown) {
  const v = validarLicencia(licencia, piezas)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "product", fields: ["id", "metadata", "sellers.id"], filters: { id: productId } })
  const p = data?.[0]
  if (!p || !(p.sellers || []).some((s: any) => s?.id === sellerId)) throw new ErrorLicencia("Ese producto no es tuyo o ya no existe.")
  const meta = { ...(p.metadata || {}), licencia: v.licencia, licencia_piezas: v.licencia_piezas, licencia_actualizada: new Date().toISOString() }
  await updateProductsWorkflow(container).run({ input: { selector: { id: productId }, update: { metadata: meta } } })
  return leerLicencia(meta)
}
