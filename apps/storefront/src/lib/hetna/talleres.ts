import { sdk } from "@/lib/client"

export type Maquina = { nombre: string; area?: string; detalle?: string }

export type Perfil = {
  ciudad?: string
  estado?: string
  lat?: number
  lng?: number
  lema?: string
  servicios: string[]
  capacidades: string[]
  maquinas: Maquina[]
  materiales: string[]
  entrega?: string
  anos?: number
  calificacion?: number
  resenas?: number
  whatsapp?: string
}

export type Taller = {
  id: string
  handle: string
  nombre: string
  descripcion?: string
  logo?: string | null
  banner?: string | null
  perfil: Perfil
}

type SellerCrudo = {
  id: string
  handle: string
  name: string
  description?: string | null
  logo?: string | null
  banner?: string | null
  metadata?: Record<string, unknown> | null
}

const lista = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "")
    : []

const num = (v: unknown): number | undefined => {
  const n = typeof v === "string" ? parseFloat(v) : (v as number)
  return typeof n === "number" && Number.isFinite(n) ? n : undefined
}

const texto = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : undefined

export const leerPerfil = (metadata?: Record<string, unknown> | null): Perfil => {
  const p = (metadata?.perfil ?? {}) as Record<string, unknown>
  const maquinas = Array.isArray(p.maquinas)
    ? (p.maquinas as Record<string, unknown>[])
        .map((m) => ({
          nombre: texto(m?.nombre) ?? "",
          area: texto(m?.area),
          detalle: texto(m?.detalle),
        }))
        .filter((m) => m.nombre)
    : []
  return {
    ciudad: texto(p.ciudad),
    estado: texto(p.estado),
    lat: num(p.lat),
    lng: num(p.lng),
    lema: texto(p.lema),
    servicios: lista(p.servicios),
    capacidades: lista(p.capacidades),
    maquinas,
    materiales: lista(p.materiales),
    entrega: texto(p.entrega),
    anos: num(p.anos),
    calificacion: num(p.calificacion),
    resenas: num(p.resenas),
    whatsapp: texto(p.whatsapp)?.replace(/\D/g, ""),
  }
}

export const aTaller = (s: SellerCrudo): Taller => ({
  id: s.id,
  handle: s.handle,
  nombre: s.name,
  descripcion: s.description ?? undefined,
  logo: s.logo,
  banner: s.banner,
  perfil: leerPerfil(s.metadata),
})

const CAMPOS = "id,name,handle,description,logo,banner,metadata"

export const listarTalleres = async (): Promise<Taller[]> => {
  try {
    const r = (await sdk.store.sellers.query({
      fields: CAMPOS,
      limit: 100,
      fetchOptions: { next: { revalidate: 300 } },
    } as never)) as unknown as { sellers: SellerCrudo[] }
    return (r.sellers ?? []).map(aTaller)
  } catch {
    return []
  }
}

export const tallerPorHandle = async (handle: string): Promise<Taller | null> => {
  try {
    const r = (await sdk.store.sellers.query({
      handle,
      fields: CAMPOS,
      fetchOptions: { next: { revalidate: 300 } },
    } as never)) as unknown as { sellers: SellerCrudo[] }
    const s = (r.sellers ?? []).find((x) => x.handle === handle)
    return s ? aTaller(s) : null
  } catch {
    return null
  }
}

export const ubicacion = (p: Perfil) =>
  [p.ciudad, p.estado].filter(Boolean).join(", ")
