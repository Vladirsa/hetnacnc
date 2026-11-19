// Instructores que escriben en el blog pagan menos comisión por curso vendido.
//
// Regla (cambiable con variables de entorno, sin tocar código):
//   ACADEMIA_AUTOR_ESCALONES="1:4,2:3"   artículos aprobados → % de comisión
//                                         (1 artículo = 4 %, 2 o más = 3 %)
//   ACADEMIA_AUTOR_DIAS=90                cuántos días cuenta cada artículo
// La comisión normal de cursos es la regla "cursos" de Mercur
// (scripts/setup-course-commission.ts); el descuento nunca la sube.
//
// Cómo se aplica: una regla de comisión de Mercur por taller, con código
// "autor-cursos-<seller_id>" y reglas seller + categoría Cursos. Mercur usa la
// regla más específica (dos dimensiones ganan a una), así que sólo cambia la
// comisión de los cursos de ese taller; sus demás productos no se tocan. Sólo
// afecta pedidos nuevos: la comisión de cada venta se calcula al pagar.
import type { MedusaContainer } from "@medusajs/framework/types"
import { MercurModules } from "@mercurjs/types"

import { servicioTalleres } from "./alta-taller"
import { servicioBlog } from "./blog"

export type Escalon = { articulos: number; pct: number }

export function escalones(texto = process.env.ACADEMIA_AUTOR_ESCALONES): Escalon[] {
  const lista = String(texto || "1:4,2:3")
    .split(",")
    .map((x) => x.split(":").map((n) => Number(n.trim())))
    .filter(([a, p]) => Number.isInteger(a) && a > 0 && Number.isFinite(p) && p >= 1 && p <= 100)
    .map(([articulos, pct]) => ({ articulos, pct }))
    .sort((a, b) => a.articulos - b.articulos)
  return lista.length ? lista : [{ articulos: 1, pct: 4 }, { articulos: 2, pct: 3 }]
}

export const diasVigencia = (texto = process.env.ACADEMIA_AUTOR_DIAS) => {
  const n = Math.round(Number(texto))
  return Number.isFinite(n) && n >= 7 && n <= 730 ? n : 90
}

/** % que paga un taller con `n` artículos vigentes. Nunca más que la comisión normal. */
export function comisionPara(n: number, base: number, lista = escalones()): number {
  let pct = base
  for (const e of lista) if (n >= e.articulos) pct = Math.min(pct, e.pct)
  return pct
}

/** El siguiente escalón que puede alcanzar (o null si ya está en el mejor). */
export function siguienteEscalon(n: number, base: number, lista = escalones()): Escalon | null {
  const actual = comisionPara(n, base, lista)
  return lista.find((e) => e.articulos > n && e.pct < actual) || null
}

export const codigoAutor = (sellerId: string) => `autor-cursos-${sellerId}`

const comisiones = (c: MedusaContainer) => c.resolve(MercurModules.COMMISSION) as any

/** Artículos aprobados y publicados del taller dentro de la ventana de días. */
export async function articulosVigentes(c: MedusaContainer, sellerId: string, ahora = new Date()) {
  const desde = new Date(ahora.getTime() - diasVigencia() * 86_400_000)
  const lista = await servicioBlog(c).listLearningArticles(
    { seller_id: sellerId, revision: null, published_at: { $ne: null }, aprobado_at: { $gte: desde } } as any,
    { take: 100, select: ["id", "aprobado_at"], order: { aprobado_at: "ASC" } }
  )
  return lista as { id: string; aprobado_at: Date }[]
}

export type ReglaCursos = { pct: number; categorias: string[] }

/** La regla normal de cursos: % y categorías a las que aplica. */
export async function reglaCursos(c: MedusaContainer): Promise<ReglaCursos | null> {
  const [r] = await comisiones(c).listCommissionRates({ code: "cursos" }, { relations: ["rules"] })
  if (!r || r.is_enabled === false) return null
  const categorias = (r.rules || []).filter((x: any) => x.reference === "product_category").map((x: any) => x.reference_id)
  return categorias.length ? { pct: Number(r.value), categorias } : null
}

export type ResumenAutor = {
  base: number | null
  actual: number | null
  articulos: number
  dias: number
  escalones: Escalon[]
  siguiente: Escalon | null
  vence: string | null // cuándo deja de contar el artículo más viejo
}

/** Sólo calcula (no escribe): lo que paga hoy el taller y por qué. */
export async function resumenComision(c: MedusaContainer, sellerId: string, regla?: ReglaCursos | null): Promise<ResumenAutor> {
  const lista = escalones()
  const dias = diasVigencia()
  // Una tienda suspendida o cerrada no conserva el descuento.
  const taller = await servicioTalleres(c).retrieveSeller(sellerId).catch(() => null)
  const bloqueado = !taller || ["suspended", "terminated"].includes(String((taller as any).status))
  const vigentes = bloqueado ? [] : await articulosVigentes(c, sellerId)
  const n = vigentes.length
  const resumen: ResumenAutor = { base: null, actual: null, articulos: n, dias, escalones: lista, siguiente: null, vence: null }
  const r = regla === undefined ? await reglaCursos(c) : regla
  if (!r) return resumen
  resumen.base = r.pct
  resumen.actual = comisionPara(n, r.pct, lista)
  resumen.siguiente = siguienteEscalon(n, r.pct, lista)
  if (vigentes[0]) resumen.vence = new Date(new Date(vigentes[0].aprobado_at).getTime() + dias * 86_400_000).toISOString()
  return resumen
}

/**
 * Recalcula y guarda la comisión de cursos del taller. Se llama al aprobar,
 * rechazar, despublicar, editar o borrar uno de sus artículos, y cada día
 * (para que caduquen los artículos viejos). `regla` se puede pasar para no
 * leerla de nuevo (el job). Devuelve true si cambió algo.
 */
export async function recalcularComisionAutor(c: MedusaContainer, sellerId: string, regla?: ReglaCursos | null): Promise<ResumenAutor & { cambio: boolean }> {
  const r = regla === undefined ? await reglaCursos(c) : regla
  const resumen = await resumenComision(c, sellerId, r)
  const svc = comisiones(c)
  const codigo = codigoAutor(sellerId)
  const [existe] = await svc.listCommissionRates({ code: codigo }, { relations: ["rules"] })
  // Sin regla normal de cursos (se desactivó o borró) tampoco hay descuento.
  if (!r || resumen.actual === null) {
    if (existe && existe.is_enabled !== false) {
      await svc.updateCommissionRates({ id: existe.id, is_enabled: false })
      return { ...resumen, cambio: true }
    }
    return { ...resumen, cambio: false }
  }
  if (existe) {
    const actuales = (existe.rules || []).filter((x: any) => x.reference === "product_category").map((x: any) => x.reference_id).sort().join()
    if (actuales !== [...r.categorias].sort().join()) {
      c.resolve("logger").warn(`[comision-autores] ${codigo}: las categorías de Cursos cambiaron; revisa esa regla en el dashboard de comisiones.`)
    }
  }
  const pct = resumen.actual
  let cambio = false
  if (pct < r.pct) {
    if (!existe) {
      await svc.createCommissionRates({
        name: `Cursos: instructor con artículos en el blog (${sellerId})`,
        code: codigo,
        type: "percentage",
        value: pct,
        is_enabled: true,
        include_tax: false,
        include_shipping: false,
        rules: [
          { reference: "seller", reference_id: sellerId },
          ...r.categorias.map((id) => ({ reference: "product_category", reference_id: id })),
        ],
      })
      cambio = true
    } else if (Number(existe.value) !== pct || existe.is_enabled === false) {
      await svc.updateCommissionRates({ id: existe.id, value: pct, is_enabled: true })
      cambio = true
    }
  } else if (existe && existe.is_enabled !== false) {
    await svc.updateCommissionRates({ id: existe.id, is_enabled: false })
    cambio = true
  }
  return { ...resumen, cambio }
}

/** Igual, pero sin romper la petición que la llamó (aprobar, borrar…). null si falló. */
export async function recalcularSinFallar(c: MedusaContainer, sellerId: string | null | undefined): Promise<ResumenAutor | null> {
  if (!sellerId) return null
  try {
    return await recalcularComisionAutor(c, sellerId)
  } catch (e) {
    c.resolve("logger").error(`[comision-autores] ${sellerId}: ${(e as Error).message}`)
    return null
  }
}
