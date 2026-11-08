import { sdk } from "@/lib/client"
import { type Tarifas, leerTarifas } from "@/lib/hetna/estimado"

// Tipos de máquina (mismos valores que apps/vendor/src/routes/perfil-taller)
export const TIPOS_MAQUINA: [string, string][] = [
  ["router", "Router CNC"],
  ["laser_co2", "Láser CO2"],
  ["laser_fibra", "Láser de fibra"],
  ["plasma", "Plasma CNC"],
  ["fresadora", "Fresadora / centro de maquinado"],
  ["torno", "Torno CNC"],
  ["impresora_3d", "Impresora 3D"],
  ["waterjet", "Chorro de agua"],
  ["dobladora", "Dobladora / plegadora"],
  ["otra", "Otra"],
]
export const nombreTipoMaquina = (t?: string) => TIPOS_MAQUINA.find(([v]) => v === t)?.[1] ?? ""

export type Maquina = {
  nombre: string
  tipo?: string
  marca?: string
  // Área de trabajo en mm (las fichas de antes sólo traen `area` en texto)
  x?: number
  y?: number
  z?: number
  area?: string
  potencia?: string
  controlador?: string
  detalle?: string
}

export type Perfil = {
  // Licitaciones 3.0: taller (fabrica), proveedor (vende productos) o ambos
  tipo_cuenta?: "taller" | "proveedor" | "ambos"
  marcas?: string[]
  ciudad?: string
  estado?: string
  // Código postal del taller (no se publica; sirve para "cerca de ti")
  cp?: string
  // "diseno" | "entrega_local" | "envio": lo que ofrece además de maquinar
  ofrece: string[]
  // Tarifas por proceso para el estimado rápido de "Fabrícamelo"
  tarifas: Tarifas
  lema?: string
  servicios: string[]
  capacidades: string[]
  maquinas: Maquina[]
  materiales: string[]
  entrega?: string
  anos?: number
  calificacion?: number
  resenas?: number
  galeria: string[]
}

export type Taller = {
  id: string
  handle: string
  nombre: string
  descripcion?: string
  logo?: string | null
  banner?: string | null
  fundador: boolean
  // Aprobado por HETNA con identificación y fotos del taller (lo marca solo el administrador)
  verificado: boolean
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
          tipo: texto(m?.tipo),
          marca: texto(m?.marca),
          x: num(m?.x),
          y: num(m?.y),
          z: num(m?.z),
          area: texto(m?.area),
          potencia: texto(m?.potencia),
          controlador: texto(m?.controlador),
          detalle: texto(m?.detalle),
        }))
        .filter((m) => m.nombre)
    : []
  return {
    tipo_cuenta: p.tipo_cuenta === "proveedor" || p.tipo_cuenta === "ambos" ? p.tipo_cuenta : "taller",
    marcas: lista(p.marcas).slice(0, 20),
    ciudad: texto(p.ciudad),
    estado: texto(p.estado),
    cp: texto(p.cp),
    ofrece: lista(p.ofrece),
    tarifas: leerTarifas(p.tarifas),
    lema: texto(p.lema),
    servicios: lista(p.servicios),
    capacidades: lista(p.capacidades),
    maquinas,
    materiales: lista(p.materiales),
    entrega: texto(p.entrega),
    anos: num(p.anos),
    calificacion: num(p.calificacion),
    resenas: num(p.resenas),
    galeria: lista(p.galeria).filter((u) => /^https?:\/\//.test(u)).slice(0, 12),
  }
}

export const aTaller = (s: SellerCrudo): Taller => ({
  id: s.id,
  handle: s.handle,
  nombre: s.name,
  descripcion: s.description ?? undefined,
  logo: s.logo,
  banner: s.banner,
  fundador: s.metadata?.fundador === true,
  verificado: s.metadata?.verificado === true,
  perfil: leerPerfil(s.metadata),
})

// Cuentas de prueba (metadata.prueba = true) no se muestran al público.
const esPrueba = (s: SellerCrudo) => s.metadata?.prueba === true

const CAMPOS = "id,name,handle,description,logo,banner,metadata"

// Todos los talleres, de 100 en 100 (hasta 2,000), para el directorio.
export const listarTalleres = async (): Promise<Taller[]> => {
  const todos: SellerCrudo[] = []
  try {
    for (let offset = 0; offset < 2000; offset += 100) {
      const r = (await sdk.store.sellers.query({
        fields: CAMPOS,
        limit: 100,
        offset,
        fetchOptions: { next: { revalidate: 300 } },
      } as never)) as unknown as { sellers: SellerCrudo[]; count?: number }
      const lote = r.sellers ?? []
      todos.push(...lote)
      if (lote.length < 100 || (r.count !== undefined && todos.length >= r.count)) break
    }
  } catch {
    // con lo que se alcanzó a leer
  }
  return todos.filter((s) => !esPrueba(s)).map(aTaller)
}

/** ¿Tiene una máquina (de ese tipo, si se pide) con al menos esa área en mm? */
export const tieneMaquina = (t: Taller, tipo: string, minimo: number) =>
  t.perfil.maquinas.some((m) => {
    if (tipo && m.tipo !== tipo) return false
    if (!minimo) return true
    const lados = [m.x, m.y].filter((n): n is number => typeof n === "number" && n > 0)
    if (lados.length < 2) return false
    return Math.min(...lados) >= minimo
  })

/** "1500 × 3000 mm" o el texto que capturó el taller. */
export const areaTexto = (m: Maquina) =>
  m.x && m.y ? `${m.x.toLocaleString("es-MX")} × ${m.y.toLocaleString("es-MX")}${m.z ? ` × ${m.z.toLocaleString("es-MX")}` : ""} mm` : m.area || ""

export const tallerPorHandle = async (handle: string): Promise<Taller | null> => {
  try {
    const r = (await sdk.store.sellers.query({
      handle,
      fields: CAMPOS,
      fetchOptions: { next: { revalidate: 300 } },
    } as never)) as unknown as { sellers: SellerCrudo[] }
    const s = (r.sellers ?? []).find((x) => x.handle === handle)
    return s && !esPrueba(s) ? aTaller(s) : null
  } catch {
    return null
  }
}

export const ubicacion = (p: Perfil) =>
  [p.ciudad, p.estado].filter(Boolean).join(", ")
