// @ts-nocheck
// Base de datos de precios de materiales CNC (agente «Monitor de precios»).
//
//   - El agente (scripts/prospectos/precios_materiales.py, lunes y jueves) mide
//     precios públicos en tiendas y distribuidores de México y n8n los manda a
//     POST /admin/hetna-materiales/importar. Aquí se guarda el historial.
//   - Estadísticas por material: mediana actual, mínimo y máximo, promedio de
//     las últimas mediciones, cambio contra la medición anterior, serie para la
//     gráfica y precio por m² (hojas) o por gramo (filamento).
//   - La usa: la pestaña «Precios de materiales» de los talleres (sólo eligen el
//     material) y el precio al instante de /cotizar, que suma el costo del
//     material a precio de mercado (PRECIO_INCLUYE_MATERIAL=0 lo quita).
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export const T_PRECIO = "hetna_precio_material"

type Unidad = "hoja" | "kg" | "litro"
export type Material = { clave: string; nombre: string; categoria: string; unidad: Unidad; ancho_m?: number; largo_m?: number; espesor_mm?: number; densidad?: number }

// Espesor de los calibres y de las placas (mm) y densidad (g/cm³), para pasar de
// precio por hoja a precio por kg: kg por m² = espesor (mm) × densidad.
const CALIBRE_MM: Record<number, number> = { 10: 3.42, 12: 2.66, 14: 1.9, 16: 1.52, 18: 1.21, 20: 0.91, 22: 0.76, 24: 0.61 }

const HOJA = { unidad: "hoja" as const, ancho_m: 1.22, largo_m: 2.44 }
const HOJA_4X8 = { unidad: "hoja" as const, ancho_m: 1.2192, largo_m: 2.4384 }

// Lo que mide el agente. Las claves deben ser las mismas de precios_materiales.py.
export const MATERIALES: Material[] = [
  ...[3, 6, 9, 12, 15, 18, 25].map((e) => ({ clave: `mdf_${e}`, nombre: `MDF ${e} mm`, categoria: "Madera y tableros", ...HOJA })),
  ...[6, 9, 12, 15, 18].map((e) => ({ clave: `triplay_${e}`, nombre: `Triplay de pino ${e} mm`, categoria: "Madera y tableros", ...HOJA })),
  { clave: "melamina_16", nombre: "Melamina blanca 16 mm", categoria: "Madera y tableros", ...HOJA },
  ...[2, 3, 4, 6, 9, 12].map((e) => ({ clave: `acrilico_${e}`, nombre: `Acrílico cristal ${e} mm`, categoria: "Plásticos", ...HOJA })),
  { clave: "acrilico_color_3", nombre: "Acrílico de color 3 mm", categoria: "Plásticos", ...HOJA },
  ...[3, 6, 10].map((e) => ({ clave: `pvc_${e}`, nombre: `PVC espumado ${e} mm`, categoria: "Plásticos", ...HOJA })),
  { clave: "acm_3", nombre: "Aluminio compuesto (ACM) 3 mm", categoria: "Plásticos", ...HOJA },
  { clave: "policarbonato_6", nombre: "Policarbonato celular 6 mm", categoria: "Plásticos", ...HOJA },
  ...[10, 12, 14, 16, 18, 20].map((c) => ({ clave: `negra_cal${c}`, nombre: `Lámina negra calibre ${c}`, categoria: "Metales", ...HOJA_4X8, espesor_mm: CALIBRE_MM[c], densidad: 7.85 })),
  ...[18, 20, 22, 24].map((c) => ({ clave: `galv_cal${c}`, nombre: `Lámina galvanizada calibre ${c}`, categoria: "Metales", ...HOJA_4X8, espesor_mm: CALIBRE_MM[c], densidad: 7.85 })),
  ...[14, 16, 18, 20].map((c) => ({ clave: `inox_cal${c}`, nombre: `Lámina inoxidable 304 calibre ${c}`, categoria: "Metales", ...HOJA_4X8, espesor_mm: CALIBRE_MM[c], densidad: 7.9 })),
  { clave: "aluminio_116", nombre: 'Lámina de aluminio 1/16"', categoria: "Metales", ...HOJA_4X8, espesor_mm: 1.59, densidad: 2.7 },
  { clave: "aluminio_18", nombre: 'Placa de aluminio 1/8"', categoria: "Metales", ...HOJA_4X8, espesor_mm: 3.18, densidad: 2.7 },
  { clave: "aluminio_14", nombre: 'Placa de aluminio 1/4"', categoria: "Metales", ...HOJA_4X8, espesor_mm: 6.35, densidad: 2.7 },
  { clave: "pla_1kg", nombre: "Filamento PLA 1.75 mm", categoria: "Impresión 3D", unidad: "kg" },
  { clave: "petg_1kg", nombre: "Filamento PETG 1.75 mm", categoria: "Impresión 3D", unidad: "kg" },
  { clave: "abs_1kg", nombre: "Filamento ABS 1.75 mm", categoria: "Impresión 3D", unidad: "kg" },
  { clave: "tpu_1kg", nombre: "Filamento TPU flexible 1.75 mm", categoria: "Impresión 3D", unidad: "kg" },
  { clave: "resina_1l", nombre: "Resina estándar para impresora 3D", categoria: "Impresión 3D", unidad: "litro" },
]
const POR_CLAVE = new Map(MATERIALES.map((m) => [m.clave, m]))
// Claves viejas del agente (13 nov) → nuevas
const RENOMBRES: Record<string, string> = { acero_cal14: "negra_cal14", acero_cal18: "galv_cal18" }

// Lo que elige el cliente en /cotizar → material de la base
export function materialDelCotizador(servicio: string, material?: string, calibre?: string): string | null {
  const m = String(material || "").toLowerCase()
  if (servicio === "laser_co2") {
    if (m.includes("hasta 2.5")) return "mdf_3"
    if (m.includes("3-5")) return "mdf_6"
    if (m.includes("acr")) return "acrilico_3"
    return null
  }
  if (servicio === "router") {
    const e = m.match(/(\d+)\s*mm/)?.[1]
    if (m.includes("mdf") && e && POR_CLAVE.has(`mdf_${e}`)) return `mdf_${e}`
    if (m.includes("acr")) return "acrilico_6"
    if (m.includes("triplay") && e && POR_CLAVE.has(`triplay_${e}`)) return `triplay_${e}`
    if (m.includes("alumin")) return "aluminio_14"
    return null
  }
  if (servicio === "plasma") {
    const c = String(calibre || "")
    const grueso = /placa|cal\. 10/i.test(c)
    const medio = /1\/8/.test(c) // lámina gruesa de 3 mm
    if (m.includes("inox")) return grueso || medio ? "inox_cal14" : "inox_cal18"
    if (m.includes("alumin")) return grueso ? "aluminio_14" : "aluminio_18"
    return grueso || medio ? "negra_cal10" : "negra_cal14"
  }
  if (servicio === "impresion_3d") {
    if (m.includes("petg")) return "petg_1kg"
    if (m.includes("abs")) return "abs_1kg"
    if (m.includes("tpu")) return "tpu_1kg"
    return "pla_1kg"
  }
  return null
}

let listo = false
export async function asegurarTablaPrecios(knex) {
  if (listo) return
  if (!(await knex.schema.hasTable(T_PRECIO))) {
    await knex.schema.createTable(T_PRECIO, (t) => {
      t.increments("id").primary()
      t.text("clave").notNullable().index()
      t.date("fecha").notNullable()
      t.decimal("mediana", 12, 2).notNullable()
      t.decimal("minimo", 12, 2).nullable()
      t.decimal("maximo", 12, 2).nullable()
      t.integer("n").notNullable().defaultTo(0)
      t.jsonb("fuentes").nullable()
      t.unique(["clave", "fecha"])
    })
  }
  listo = true
}

/** Guarda una medición del agente (una fila por material y fecha; si se repite la fecha, se reemplaza). */
export async function importarPrecios(knex, cuerpo: { fecha?: string; materiales?: any[] }) {
  await asegurarTablaPrecios(knex)
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(String(cuerpo?.fecha || "")) ? cuerpo.fecha : new Date().toISOString().slice(0, 10)
  let guardados = 0
  for (const m of cuerpo?.materiales || []) {
    const mediana = Number(m?.mediana)
    if (!m?.clave || !(mediana > 0)) continue
    const clave = RENOMBRES[m.clave] || String(m.clave).slice(0, 40)
    const fila = {
      clave,
      fecha,
      mediana,
      minimo: Number(m.minimo) || null,
      maximo: Number(m.maximo) || null,
      n: Number(m.n) || 0,
      fuentes: JSON.stringify((m.fuentes || []).slice(0, 10).map((f) => ({ tienda: String(f.tienda || "").slice(0, 80), precio: Number(f.precio) || 0, url: String(f.url || "").slice(0, 400) }))),
    }
    await knex(T_PRECIO).insert(fila).onConflict(["clave", "fecha"]).merge()
    guardados++
  }
  return { guardados, fecha }
}

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100

/** Estadísticas de todos los materiales del catálogo. */
export async function estadisticasMateriales(knex) {
  await asegurarTablaPrecios(knex)
  const filas = await knex(T_PRECIO).where("fecha", ">", knex.raw("current_date - interval '400 days'")).orderBy("fecha", "asc")
  const porClave = new Map<string, any[]>()
  for (const f of filas) {
    const l = porClave.get(f.clave) || []
    l.push(f)
    porClave.set(f.clave, l)
  }
  return MATERIALES.map((m) => {
    const serie = porClave.get(m.clave) || []
    const ult = serie[serie.length - 1]
    const ant = serie[serie.length - 2]
    const ultimas = serie.slice(-8).map((f) => Number(f.mediana))
    const area = m.ancho_m && m.largo_m ? m.ancho_m * m.largo_m : null
    const mediana = ult ? Number(ult.mediana) : null
    return {
      ...m,
      area_m2: area ? r2(area) : null,
      fecha: ult?.fecha ? new Date(ult.fecha).toISOString().slice(0, 10) : null,
      mediana,
      minimo: ult?.minimo != null ? Number(ult.minimo) : null,
      maximo: ult?.maximo != null ? Number(ult.maximo) : null,
      tiendas: ult?.n || 0,
      promedio: ultimas.length ? r2(ultimas.reduce((a, b) => a + b, 0) / ultimas.length) : null,
      cambio_pct: ult && ant && Number(ant.mediana) > 0 ? Math.round(((Number(ult.mediana) - Number(ant.mediana)) / Number(ant.mediana)) * 1000) / 10 : null,
      precio_m2: mediana && area ? r2(mediana / area) : null,
      precio_gramo: mediana && m.unidad === "kg" ? Math.round((mediana / 1000) * 10000) / 10000 : null,
      // Por kg: filamentos (precio del rollo de 1 kg) y metales (hoja ÷ su peso)
      precio_kg:
        mediana && (m.unidad === "kg" || m.unidad === "litro")
          ? mediana
          : mediana && area && m.espesor_mm && m.densidad
            ? r2(mediana / (area * m.espesor_mm * m.densidad))
            : null,
      serie: serie.slice(-26).map((f) => ({ fecha: new Date(f.fecha).toISOString().slice(0, 10), mediana: Number(f.mediana) })),
      fuentes: typeof ult?.fuentes === "string" ? JSON.parse(ult.fuentes) : ult?.fuentes || [],
    }
  })
}

// Caché corto para el precio al instante (se consulta en cada cálculo)
let cache: { t: number; datos: any[] } | null = null
export async function estadisticasEnCache(knex) {
  if (cache && Date.now() - cache.t < 10 * 60_000) return cache.datos
  const datos = await estadisticasMateriales(knex)
  cache = { t: Date.now(), datos }
  return datos
}

export const precioIncluyeMaterial = () => !["0", "false", "no"].includes(String(process.env.PRECIO_INCLUYE_MATERIAL || "").toLowerCase())

/** Precio de mercado del material para el precio al instante (o null si no hay dato). */
export async function precioMaterialParaCotizar(container, servicio: string, material?: string, calibre?: string) {
  if (!precioIncluyeMaterial()) return null
  const clave = materialDelCotizador(servicio, material, calibre)
  if (!clave) return null
  try {
    const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    const m = (await estadisticasEnCache(knex)).find((x) => x.clave === clave)
    if (!m?.mediana) return null
    return { clave, nombre: m.nombre, precio_m2: m.precio_m2, precio_kg: m.precio_kg, fecha: m.fecha }
  } catch {
    return null
  }
}
