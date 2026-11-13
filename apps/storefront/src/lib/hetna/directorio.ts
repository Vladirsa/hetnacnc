// Directorio de perfiles NO RECLAMADOS: empresas CNC de la hoja de prospectos
// (scripts/prospectos) que todavía no tienen cuenta en HETNA. Los arma el flujo de
// n8n «HETNA - Directorio de talleres» (scripts/prospectos/n8n/directorio) y sólo
// trae datos públicos de empresa: nombre, tipo, ciudad y servicios. Nunca correo,
// teléfono ni dirección.
//
// Reglas de confianza (no quitar):
// - Se muestran siempre como «Perfil no reclamado», separados de los talleres de HETNA.
// - Quien pide cotización desde uno de estos perfiles manda una solicitud ABIERTA a
//   la red (la reciben los talleres registrados) y además invitamos a la empresa a
//   reclamar su perfil, sin compartirle el contacto del cliente.
// - BAJA, REGISTRADO y publicar = NO no llegan aquí (lo filtra n8n).
// Si n8n no responde, todo esto desaparece de la página en silencio.

export type TipoDirectorio = "taller" | "proveedor" | "instructor"

export type EmpresaDirectorio = {
  slug: string
  empresa: string
  tipo: TipoDirectorio
  tamano: string
  pais: string
  /** Estado oficial de México (normalizado) o "" si no se sabe */
  estado: string
  ciudad: string
  servicios: string
  segmento: string
}

const URL_DIRECTORIO = process.env.HETNA_DIRECTORIO_URL || "https://n8n.hetnacnc.com/webhook/hetna-directorio"

export const ESTADOS_MX = [
  "Aguascalientes", "Baja California", "Baja California Sur", "Campeche", "Chiapas", "Chihuahua",
  "Ciudad de México", "Coahuila", "Colima", "Durango", "Estado de México", "Guanajuato", "Guerrero",
  "Hidalgo", "Jalisco", "Michoacán", "Morelos", "Nayarit", "Nuevo León", "Oaxaca", "Puebla", "Querétaro",
  "Quintana Roo", "San Luis Potosí", "Sinaloa", "Sonora", "Tabasco", "Tamaulipas", "Tlaxcala", "Veracruz",
  "Yucatán", "Zacatecas",
]

const sinAcentos = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim()

// Abreviaturas y ciudades que a veces llegan en lugar del estado
const ALIAS: Record<string, string> = {
  jal: "Jalisco", cdmx: "Ciudad de México", df: "Ciudad de México", "distrito federal": "Ciudad de México",
  edomex: "Estado de México", mexico: "Estado de México", "estado de mexico": "Estado de México",
  nl: "Nuevo León", qro: "Querétaro", gto: "Guanajuato", pue: "Puebla", bc: "Baja California",
  coah: "Coahuila", chih: "Chihuahua", slp: "San Luis Potosí", ver: "Veracruz", yuc: "Yucatán",
  guadalajara: "Jalisco", zapopan: "Jalisco", tlaquepaque: "Jalisco", monterrey: "Nuevo León",
  "ciudad de mexico": "Ciudad de México",
}

export function estadoMx(region?: string, ciudad?: string): string {
  for (const v of [region, ciudad]) {
    const n = sinAcentos(String(v || ""))
    if (!n || n === "na") continue
    const oficial = ESTADOS_MX.find((e) => sinAcentos(e) === n)
    if (oficial) return oficial
    if (ALIAS[n]) return ALIAS[n]
  }
  return ""
}

type Crudo = Omit<EmpresaDirectorio, "estado"> & { region?: string }

async function leerTodo(): Promise<EmpresaDirectorio[]> {
  try {
    const res = await fetch(URL_DIRECTORIO, {
      // Cloudflare rechaza clientes sin navegador conocido
      headers: { "User-Agent": "Mozilla/5.0 (compatible; HETNA-Tienda/1.0)", Accept: "application/json" },
      next: { revalidate: 3600, tags: ["directorio-talleres"] },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    const { empresas = [] } = (await res.json()) as { empresas?: Crudo[] }
    return empresas
      .filter((e) => e && e.slug && e.empresa)
      .map(({ region, ...e }) => ({ ...e, estado: estadoMx(region, e.ciudad) }))
  } catch {
    return []
  }
}

/** Sólo México: la tienda, el formulario de cotización y los envíos son de México. */
export async function directorioMexico(): Promise<EmpresaDirectorio[]> {
  return (await leerTodo()).filter((e) => sinAcentos(e.pais) === "mexico")
}

export async function empresaPorSlug(slug: string): Promise<EmpresaDirectorio | null> {
  const s = String(slug || "").toLowerCase()
  return (await directorioMexico()).find((e) => e.slug === s) || null
}

/** Para el mapa: cuántas empresas por estado y municipio (nunca nombres). */
export type PorUnirse = Record<string, { total: number; municipios: [string, number][] }>

export function contarPorEstado(empresas: EmpresaDirectorio[]): PorUnirse {
  const m = new Map<string, Map<string, number>>()
  for (const e of empresas) {
    if (!e.estado) continue
    const mun = e.ciudad || "Otros municipios"
    const porMun = m.get(e.estado) ?? new Map<string, number>()
    porMun.set(mun, (porMun.get(mun) ?? 0) + 1)
    m.set(e.estado, porMun)
  }
  const salida: PorUnirse = {}
  for (const [estado, porMun] of m) {
    const municipios = [...porMun.entries()].sort((a, b) => b[1] - a[1])
    salida[estado] = { total: municipios.reduce((a, [, n]) => a + n, 0), municipios }
  }
  return salida
}

export const NOMBRE_TIPO: Record<TipoDirectorio, string> = {
  taller: "Taller / servicios CNC",
  proveedor: "Proveedor de máquinas y herramientas",
  instructor: "Capacitación CNC",
}
