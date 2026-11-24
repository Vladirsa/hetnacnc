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

// ── Páginas por servicio y estado: /mx/talleres/en/<estado>/<servicio> ──
// "Corte láser en Ciudad de México", "Router CNC en Jalisco"… Es lo que busca
// quien hoy pide en sitios de contactos pagados: aquí llega directo a una
// licitación de HETNA. Sólo cuentan los talleres de servicio (no los
// proveedores de máquinas ni los cursos) y se indexa con MIN_EMPRESAS o más.
export const PAGINAS_SERVICIO: Record<
  ClaveServicio,
  { slug: string; nombre: string; servicioSolicitud: string; cotizar: string | null; queHacen: string; enviar: string[] }
> = {
  laser: {
    slug: "corte-laser",
    nombre: "Corte láser",
    servicioSolicitud: "Corte láser",
    cotizar: "/cotizar/corte-laser",
    queHacen: "corte y grabado láser de MDF, acrílico, madera, cartón, piel y tela: letreros, cajas, invitaciones, llaveros, piezas para maquetas y regalos personalizados",
    enviar: ["Archivo DXF, SVG, AI o PDF vectorial (o una imagen y el taller te hace el archivo)", "Material y grosor (por ejemplo MDF 3 mm o acrílico 3 mm)", "Medidas de la pieza y cantidad", "Si lleva grabado y en qué cara"],
  },
  router: {
    slug: "router-cnc",
    nombre: "Router CNC",
    servicioSolicitud: "Corte CNC",
    cotizar: "/cotizar/router-cnc",
    queHacen: "corte y tallado con router CNC de MDF, triplay, madera sólida, acrílico y aluminio: muebles, puertas, celosías, letras 3D, moldes y piezas de carpintería",
    enviar: ["Archivo DXF, SVG o STL (o un dibujo con medidas)", "Material y grosor (por ejemplo MDF 18 mm o pino)", "Medidas, cantidad y si lleva tallado 3D", "Acabado: sólo corte, lijado, sellado o pintado"],
  },
  plasma: {
    slug: "corte-plasma",
    nombre: "Corte plasma",
    servicioSolicitud: "Corte plasma",
    cotizar: "/cotizar/corte-plasma",
    queHacen: "corte plasma CNC de lámina y placa de acero al carbón, inoxidable y aluminio: letreros de metal, bases, cartelas, piezas para estructuras y decoración",
    enviar: ["Archivo DXF a escala 1:1 en milímetros", "Material y calibre o grosor", "Medidas de la pieza y cantidad", "Si el taller pone la lámina o tú la llevas"],
  },
  maquinado: {
    slug: "maquinado-cnc",
    nombre: "Maquinado CNC",
    servicioSolicitud: "Maquinado",
    cotizar: null,
    queHacen: "maquinado CNC en centro de maquinado, torno y fresadora: piezas de aluminio, acero, latón y plásticos de ingeniería, refacciones, prototipos y producción en serie",
    enviar: ["Plano con medidas y tolerancias (PDF) y, si tienes, el modelo STEP", "Material (por ejemplo aluminio 6061 o acero 1018)", "Cantidad y fecha en que lo necesitas", "Acabado o tratamiento (anodizado, pavonado, temple…)"],
  },
}

export const servicioPorSlug = (slug: string) =>
  SERVICIOS_ESTADO.find((s) => PAGINAS_SERVICIO[s.clave].slug === slug)
export const rutaServicioEstado = (c: Ciudad, clave: ClaveServicio) => `${rutaEstado(c)}/${PAGINAS_SERVICIO[clave].slug}`

export type DatosServicioEstado = {
  empresas: EmpresaDirectorio[]
  talleres: Taller[]
  total: number
  municipios: [string, number][]
}

/** Los talleres de un estado que hacen ese servicio (sin proveedores ni cursos). */
export function filtrarServicio(d: DatosEstado, clave: ClaveServicio): DatosServicioEstado {
  const s = SERVICIOS_ESTADO.find((x) => x.clave === clave)!
  const empresas = d.empresas.filter((e) => e.tipo === "taller" && s.patron.test(`${e.empresa} ${e.servicios}`))
  const talleres = d.talleres.filter((t) => s.patron.test(t.perfil.servicios.join(" ")))
  const conteo = new Map<string, number>()
  for (const e of empresas) if (e.ciudad && e.ciudad !== d.ciudad.estado) conteo.set(e.ciudad, (conteo.get(e.ciudad) ?? 0) + 1)
  for (const t of talleres) {
    const m = (t.perfil.ciudad || "").trim()
    if (m && m !== d.ciudad.estado) conteo.set(m, (conteo.get(m) ?? 0) + 1)
  }
  return { empresas, talleres, total: empresas.length + talleres.length, municipios: [...conteo.entries()].sort((a, b) => b[1] - a[1]) }
}

/** Servicio × estado que se indexan (mapa del sitio y enlaces). */
export const serviciosEstadoIndexables = unstable_cache(
  async () => {
    const datos = await Promise.all(CIUDADES.map((c) => datosEstado(c)))
    return datos.flatMap((d) =>
      SERVICIOS_ESTADO.map((s) => ({ ciudad: d.ciudad, clave: s.clave, total: filtrarServicio(d, s.clave).total })).filter(
        (x) => x.total >= MIN_EMPRESAS
      )
    )
  },
  ["servicios-estado-indexables"],
  { revalidate: 3600, tags: ["directorio-talleres"] }
)
