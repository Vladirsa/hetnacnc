// @ts-nocheck
// Perfil CNC — un solo perfil del taller.
//
// Un taller puede tener dos caras: su perfil de la tienda (vendedor de Mercur,
// /talleres/<handle>) y su cotizador en línea de la app (/t/<slug>, negocio en
// Supabase). Las dos son del mismo taller cuando comparten correo. Aquí se
// ligan en ambos sentidos para que el cliente pase de una a la otra.
import { supa } from "./cotizador-suscripciones"

const correoFiltro = (correo: string | null | undefined) => {
  const c = String(correo || "").trim().toLowerCase()
  if (!c || !/^[^\s@,()*%\\]+@[^\s@,()*%\\]+$/.test(c)) return null
  return encodeURIComponent(c.replace(/_/g, "\\_"))
}

const cache = new Map<string, { valor: any; vence: number }>()
async function guardado<T>(clave: string, fn: () => Promise<T>): Promise<T> {
  const h = cache.get(clave)
  if (h && h.vence > Date.now()) return h.valor
  const valor = await fn()
  cache.set(clave, { valor, vence: Date.now() + 5 * 60_000 })
  return valor
}

/** Cotizador en línea activo del taller de la tienda (por su correo). */
export async function enLineaDeVendedor(knex: any, handle: string): Promise<{ slug: string } | null> {
  if (!/^[a-z0-9-]{2,120}$/i.test(handle) || !process.env.COTIZADOR_SUPABASE_SERVICE_KEY) return null
  return guardado(`v:${handle}`, async () => {
    const v = await knex("seller").where({ handle }).first("email")
    const filtro = correoFiltro(v?.email)
    if (!filtro) return null
    try {
      const negs = await supa<any[]>(`/rest/v1/negocios?select=id,slug&activo=eq.true&correo=ilike.${filtro}&limit=5`)
      for (const n of negs || []) {
        if (!n.slug) continue
        const pag = await supa<any[]>(`/rest/v1/negocios_pagina?negocio_id=eq.${n.id}&activa=eq.true&select=negocio_id&limit=1`).catch(() => [])
        if (pag?.length) return { slug: n.slug }
      }
    } catch {
      // sin dato: no se enseña el botón
    }
    return null
  })
}

/** Perfil de la tienda del negocio de la app con ese slug (por su correo). */
export async function tiendaDeSlug(knex: any, slug: string): Promise<{ handle: string } | null> {
  if (!/^[a-z0-9-]{2,60}$/.test(slug) || !process.env.COTIZADOR_SUPABASE_SERVICE_KEY) return null
  return guardado(`s:${slug}`, async () => {
    try {
      const n = (await supa<any[]>(`/rest/v1/negocios?slug=eq.${slug}&select=correo&limit=1`))[0]
      const c = String(n?.correo || "").trim().toLowerCase()
      if (!c) return null
      const v = await knex("seller")
        .whereRaw("lower(email) = ?", [c])
        .whereRaw("coalesce((metadata->>'prueba')::text, 'false') <> 'true'")
        .first("handle")
      return v?.handle ? { handle: v.handle } : null
    } catch {
      return null
    }
  })
}
