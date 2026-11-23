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
  /** Estado oficial de México (normalizado) o "" si no se sabe. Sale de la hoja o
   *  de lo que la empresa dice de sí misma (nombre, servicios): se muestra en su perfil. */
  estado: string
  /** Zona para el mapa y el filtro: el estado, o si no se sabe, la ciudad de la
   *  búsqueda que la encontró ("taller de maquinados CNC en Saltillo"). Aproximada:
   *  sólo cuenta empresas por estado, nunca se muestra como su dirección. */
  zona: string
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

// Ciudades donde hay talleres CNC → su estado. Sirven cuando la hoja trae la
// ciudad pero no el estado, y para leer la ubicación del nombre o los servicios.
const CIUDADES: Record<string, string> = {
  saltillo: "Coahuila", torreon: "Coahuila", "ramos arizpe": "Coahuila", monclova: "Coahuila", "piedras negras": "Coahuila",
  leon: "Guanajuato", celaya: "Guanajuato", irapuato: "Guanajuato", salamanca: "Guanajuato", silao: "Guanajuato",
  apizaco: "Tlaxcala", huamantla: "Tlaxcala", calpulalpan: "Tlaxcala",
  guadalajara: "Jalisco", zapopan: "Jalisco", tlaquepaque: "Jalisco", tonala: "Jalisco", "el salto": "Jalisco",
  monterrey: "Nuevo León", apodaca: "Nuevo León", "san nicolas de los garza": "Nuevo León", escobedo: "Nuevo León",
  "santa catarina": "Nuevo León", "san pedro garza garcia": "Nuevo León", guadalupe: "Nuevo León",
  toluca: "Estado de México", naucalpan: "Estado de México", tlalnepantla: "Estado de México", ecatepec: "Estado de México",
  "cuautitlan izcalli": "Estado de México", nezahualcoyotl: "Estado de México", tultitlan: "Estado de México", lerma: "Estado de México",
  cdmx: "Ciudad de México", iztapalapa: "Ciudad de México", azcapotzalco: "Ciudad de México", "gustavo a. madero": "Ciudad de México",
  "san juan del rio": "Querétaro", "el marques": "Querétaro", corregidora: "Querétaro",
  tijuana: "Baja California", mexicali: "Baja California", ensenada: "Baja California",
  "ciudad juarez": "Chihuahua", juarez: "Chihuahua", "cd. juarez": "Chihuahua", delicias: "Chihuahua",
  hermosillo: "Sonora", "ciudad obregon": "Sonora", nogales: "Sonora",
  merida: "Yucatán", morelia: "Michoacán", uruapan: "Michoacán", cuernavaca: "Morelos",
  pachuca: "Hidalgo", tulancingo: "Hidalgo", xalapa: "Veracruz", "coatzacoalcos": "Veracruz", orizaba: "Veracruz", cordoba: "Veracruz",
  reynosa: "Tamaulipas", matamoros: "Tamaulipas", "nuevo laredo": "Tamaulipas", tampico: "Tamaulipas",
  culiacan: "Sinaloa", mazatlan: "Sinaloa", "los mochis": "Sinaloa", cancun: "Quintana Roo",
  "tuxtla gutierrez": "Chiapas", villahermosa: "Tabasco", tepic: "Nayarit", "la paz": "Baja California Sur",
  tehuacan: "Puebla", "san martin texmelucan": "Puebla", cholula: "Puebla",
}

// Para buscar dentro de un texto sólo se usan nombres que no se confunden:
// estados y ciudades de arriba, menos los que también son apellidos, calles o
// colonias ("Av. Juárez", "Maquinados Guerrero", "Grupo León").
const AMBIGUOS = new Set(["mexico", "hidalgo", "morelos", "guerrero", "juarez", "guadalupe", "leon", "cordoba", "la paz", "lerma", "corregidora", "el salto", "delicias", "matamoros", "nogales", "salamanca", "silao", "tonala", "escobedo", "el marques"])
const EN_TEXTO: [RegExp, string][] = [
  ...ESTADOS_MX.map((e) => [sinAcentos(e), e] as [string, string]),
  ...Object.entries(CIUDADES),
]
  .filter(([n]) => !AMBIGUOS.has(n))
  .sort((a, b) => b[0].length - a[0].length)
  .map(([n, e]) => [new RegExp(`(^|[^a-z])${n.replace(/[.]/g, "\\.")}([^a-z]|$)`), e])

/** Estado que se lee de un texto libre (nombre, servicios); "" si no aparece uno claro. */
export function estadoEnTexto(...textos: (string | undefined)[]): string {
  const t = sinAcentos(textos.filter(Boolean).join(" "))
  if (!t) return ""
  for (const [re, e] of EN_TEXTO) if (re.test(t)) return e
  return ""
}

export function estadoMx(region?: string, ciudad?: string): string {
  for (const v of [region, ciudad]) {
    const n = sinAcentos(String(v || ""))
    if (!n || n === "na") continue
    const oficial = ESTADOS_MX.find((e) => sinAcentos(e) === n)
    if (oficial) return oficial
    if (ALIAS[n]) return ALIAS[n]
    if (CIUDADES[n]) return CIUDADES[n]
  }
  return ""
}

type Crudo = Omit<EmpresaDirectorio, "estado" | "zona"> & { region?: string }

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
      .map(({ region, ...e }) => {
        // Si la hoja no trae estado ni una ciudad conocida, se busca en el nombre y
        // los servicios ("Corte láser CDMX", "Maquinados en Saltillo").
        const estado = estadoMx(region, e.ciudad) || estadoEnTexto(e.empresa, e.servicios)
        return { ...e, estado, zona: estado || estadoEnTexto(e.segmento) }
      })
  } catch {
    return []
  }
}

/** Sólo México: la tienda, el formulario de cotización y los envíos son de México. */
export async function directorioMexico(): Promise<EmpresaDirectorio[]> {
  return (await leerTodo()).filter((e) => sinAcentos(e.pais) === "mexico")
}

/** Empresas de otro país (páginas /latinoamerica/<país>). `nombres`: cómo puede venir
 *  escrito el país en la hoja ("Perú", "Peru"). Lo que el buscador agrega a la hoja
 *  aparece solo: se lee en vivo con caché de 1 hora. */
export async function directorioPais(...nombres: string[]): Promise<EmpresaDirectorio[]> {
  const buscados = new Set(nombres.map(sinAcentos))
  return (await leerTodo())
    .filter((e) => buscados.has(sinAcentos(e.pais)))
    .sort((a, b) => (a.ciudad || "zzz").localeCompare(b.ciudad || "zzz") || a.empresa.localeCompare(b.empresa))
}

/** Cualquier país: para «Quitar este perfil», que también sale en las páginas de Latinoamérica. */
export async function empresaCualquierPais(slug: string): Promise<EmpresaDirectorio | null> {
  const s = String(slug || "").toLowerCase()
  return (await leerTodo()).find((e) => e.slug === s) || null
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
    if (!e.zona) continue
    const mun = e.ciudad || "Otros municipios"
    const porMun = m.get(e.zona) ?? new Map<string, number>()
    porMun.set(mun, (porMun.get(mun) ?? 0) + 1)
    m.set(e.zona, porMun)
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
