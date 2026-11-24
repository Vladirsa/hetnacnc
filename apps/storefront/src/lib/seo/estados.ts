// Páginas "Talleres CNC en <estado>" (/mx/talleres/en/<ciudad>): juntan los
// talleres registrados en HETNA y los perfiles del directorio de ese estado.
//
// Regla anti "página puerta": sólo se indexan los estados con al menos
// MIN_EMPRESAS empresas reales; los que tienen menos se ven (noindex) y los que
// no tienen ninguna dan 404. Los conteos salen de los datos, nunca se inventan.
import { unstable_cache } from "next/cache"

import { directorioMexico, type EmpresaDirectorio } from "@/lib/hetna/directorio"
import { listarTalleres, type Taller } from "@/lib/hetna/talleres"
import { CIUDADES, enCiudad, type Ciudad } from "@/lib/seo/guias"

export const MIN_EMPRESAS = 4

// Servicios que se reconocen en el texto del directorio y su guía por ciudad
export const SERVICIOS_ESTADO = [
  { clave: "laser", nombre: "Corte y grabado láser", patron: /l[aá]ser/i, guia: "corte-laser-mdf" },
  { clave: "router", nombre: "Router CNC y carpintería", patron: /router|madera|\bmdf\b|carpinter/i, guia: "taller-router-cnc-mexico" },
  { clave: "plasma", nombre: "Corte plasma", patron: /plasma/i, guia: "corte-plasma" },
  { clave: "maquinado", nombre: "Maquinado, torno y fresado", patron: /maquin|mecaniz|torno|fresad/i, guia: null },
] as const

export type ClaveServicio = (typeof SERVICIOS_ESTADO)[number]["clave"]

// El texto del directorio viene de buscadores: a veces trae la fecha al inicio
// ("Sep 15, 2026 · …") o seguidores de redes. Se limpia para mostrarlo.
export const limpiarServicios = (s: string) =>
  s
    .replace(/^[A-Z][a-z]{2} \d{1,2}, \d{4}\s*·\s*/, "")
    .replace(/\s+/g, " ")
    .trim()

export type DatosEstado = {
  ciudad: Ciudad
  empresas: EmpresaDirectorio[]
  talleres: Taller[]
  total: number
  porServicio: Record<ClaveServicio, number>
  municipios: [string, number][]
}

// La dirección usa el nombre del estado: /talleres/en/estado-de-mexico, /talleres/en/nuevo-leon
export const slugEstado = (estado: string) =>
  estado.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
export const ciudadPorEstadoSlug = (slug: string) => CIUDADES.find((c) => slugEstado(c.estado) === slug)
export const rutaEstado = (c: Ciudad) => `/talleres/en/${slugEstado(c.estado)}`

export async function datosEstado(c: Ciudad): Promise<DatosEstado> {
  const [directorio, registrados] = await Promise.all([directorioMexico(), listarTalleres().catch(() => [] as Taller[])])
  const empresas = directorio
    .filter((e) => e.estado === c.estado)
    .sort((a, b) => Number(!!b.servicios) - Number(!!a.servicios) || a.empresa.localeCompare(b.empresa))
  const talleres = registrados.filter((t) => enCiudad(c, t.perfil.estado, t.perfil.ciudad))
  const porServicio = Object.fromEntries(SERVICIOS_ESTADO.map((s) => [s.clave, 0])) as Record<ClaveServicio, number>
  for (const e of empresas) {
    const texto = `${e.empresa} ${e.servicios}`
    for (const s of SERVICIOS_ESTADO) if (s.patron.test(texto)) porServicio[s.clave]++
  }
  for (const t of talleres) {
    const texto = t.perfil.servicios.join(" ")
    for (const s of SERVICIOS_ESTADO) if (s.patron.test(texto)) porServicio[s.clave]++
  }
  const conteo = new Map<string, number>()
  for (const e of empresas) if (e.ciudad) conteo.set(e.ciudad, (conteo.get(e.ciudad) ?? 0) + 1)
  const municipios = [...conteo.entries()].sort((a, b) => b[1] - a[1])
  return { ciudad: c, empresas, talleres, total: empresas.length + talleres.length, porServicio, municipios }
}

/** Estados que se indexan (para el mapa del sitio y los enlaces internos). */
export async function estadosIndexables(): Promise<{ ciudad: Ciudad; total: number }[]> {
  const datos = await Promise.all(CIUDADES.map((c) => datosEstado(c)))
  return datos.filter((d) => d.total >= MIN_EMPRESAS).map((d) => ({ ciudad: d.ciudad, total: d.total }))
}

/** Para enlazar las páginas por estado (pestaña Talleres de /categories): nombre,
 *  ruta y número de empresas, guardado 1 hora. Calcularlo en cada visita leía y
 *  revisaba el directorio completo una vez por estado (≈0.5 s por visita). */
export const estadosParaEnlaces = unstable_cache(
  async () =>
    (await estadosIndexables())
      .map((x) => ({ nombre: x.ciudad.estado, ruta: rutaEstado(x.ciudad), total: x.total }))
      .sort((a, b) => b.total - a.total),
  ["estados-para-enlaces"],
  { revalidate: 3600, tags: ["directorio-talleres"] }
)
