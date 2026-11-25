// Diseños listos (piezas de las herramientas del Estudio) en la tienda.
//
// Cada diseño es UN producto del catálogo con dos opciones, Color × Calidad.
// HETNA ofrece una sola combinación (HETNA_OFRECE) con su precio recomendado,
// calculado por gramaje con el mismo motor del cotizador (precioDesglosado).
// Las demás combinaciones quedan abiertas: cualquier taller que imprime puede
// poner su oferta (su precio, su tiempo) y la ficha muestra todas: "Taller X
// te lo imprime en $Y". Ver apps/storefront/src/lib/disenos-listos/catalogo.ts.
//
// Las medidas y el volumen salen de datos.json, que arma el script de la
// tienda (apps/storefront/scripts/disenos-listos.mts).
import { readFileSync } from "fs"
import { resolve } from "path"

import type { ConfigPrecios } from "./estimador-referencia"
import { precioDesglosado, precioInstantaneo } from "./precio-instantaneo"

export const COLORES = ["Negro", "Blanco", "Gris", "Rojo", "Azul", "Naranja"] as const
export const CALIDADES = ["Estándar", "Alta"] as const
export type Color = (typeof COLORES)[number]
export type Calidad = (typeof CALIDADES)[number]
/** Lo que imprime HETNA; lo demás lo ofrecen los talleres. */
export const HETNA_OFRECE: { color: Color; calidad: Calidad } = { color: "Negro", calidad: "Estándar" }
/** Calidad del motor de precios para cada calidad de la tienda. */
export const CALIDAD_MOTOR: Record<Calidad, string> = { "Estándar": "Pieza funcional", Alta: "Alta calidad" }
/** Existencias de la oferta: se fabrica bajo pedido, así que se rellenan en cada corrida. */
export const EXISTENCIAS_BAJO_PEDIDO = 999
/** Empaque aproximado para la guía de envío. */
const EMPAQUE_KG = 0.12

export type DatoDiseno = {
  handle: string
  herramienta: string
  modelo: string
  nombre: string
  texto: string
  valores: Record<string, number>
  material: string
  calidad: string
  dias: number
  medidas_mm: [number, number, number]
  volumen_cm3: number
}

/** Ruta de datos.json: DISENOS_LISTOS_DATOS, o la de la tienda en este mismo repositorio. */
export const rutaDatos = () => process.env.DISENOS_LISTOS_DATOS || resolve(process.cwd(), "../../apps/storefront/src/lib/disenos-listos/datos.json")
export const rutaImagenes = () => process.env.DISENOS_LISTOS_IMAGENES || resolve(process.cwd(), "../../apps/storefront/public/disenos-listos")

export function leerDatos(ruta = rutaDatos()): DatoDiseno[] {
  const datos = JSON.parse(readFileSync(ruta, "utf8"))
  if (!Array.isArray(datos)) throw new Error(`${ruta} no trae una lista de diseños`)
  return datos as DatoDiseno[]
}

const quitarAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "")
export const skuDiseno = (handle: string, color: string, calidad: string) =>
  `${handle.replace(/^hetna-/, "DL-")}-${quitarAcentos(color).slice(0, 3)}-${quitarAcentos(calidad).slice(0, 3)}`.toUpperCase()

/** Precio final con IVA (como lo cobra la oferta), redondeado hacia arriba a múltiplos de $5. */
export const precioFinal = (recomendado: number) => Math.ceil((recomendado * 1.16) / 5) * 5

/**
 * Precio recomendado de una pieza (1 unidad) con su calidad, por gramaje y
 * tiempo de impresión. null si el motor no la puede calcular.
 */
export function precioDiseno(d: DatoDiseno, calidad: Calidad, cfg?: ConfigPrecios | null) {
  const [x, y, z] = d.medidas_mm
  const entrada = { servicio: "impresion_3d", material: d.material, calidad: CALIDAD_MOTOR[calidad], ancho: x / 10, largo: y / 10, alto: z / 10, volumen_cm3: d.volumen_cm3, cantidad: 1 }
  const r = precioDesglosado(entrada, cfg)
  const i = precioInstantaneo(entrada, cfg)
  if (!r.ok || !i.ok) return null
  return { precio: precioFinal(r.precio.recomendado), gramos: Math.round(i.estimado.gramos), aplica_minimo: r.precio.aplica_minimo }
}

/** Peso para la guía (kg) y medidas de la caja (cm, con 2 cm de holgura). */
export function empaque(d: DatoDiseno, gramos: number) {
  const cm = d.medidas_mm.map((mm) => Math.ceil(mm / 10) + 2)
  return { weight: Math.round((gramos / 1000 + EMPAQUE_KG) * 1000) / 1000, length: cm[1], width: cm[0], height: cm[2] }
}

export const ligaMedidas = (d: Pick<DatoDiseno, "herramienta" | "modelo" | "valores">) => {
  const q = new URLSearchParams({ modelo: d.modelo })
  for (const [k, v] of Object.entries(d.valores || {})) q.set(k, String(v))
  return `/disenar/${d.herramienta}?${q.toString()}`
}

const mm = (d: DatoDiseno) => d.medidas_mm.map((n) => Math.round(n)).join(" × ")

/** Descripción del producto (texto; el publicador la pasa a HTML). */
export function descripcionDiseno(d: DatoDiseno, gramos: number) {
  return [
    d.texto,
    "",
    `Pieza impresa en 3D en ${d.material}. Medidas: ${mm(d)} mm. Peso aproximado: ${gramos} g.`,
    `HETNA la imprime en ${HETNA_OFRECE.color.toLowerCase()}, calidad ${HETNA_OFRECE.calidad.toLowerCase()}; otros colores y la calidad alta los ofrecen los talleres de la red.`,
    "¿La quieres de otro tamaño? Modifica las medidas en la herramienta gratis y descarga tu archivo, o pide que te la impriman.",
  ].join("\n")
}

/** Metadata del producto (lo que lee la ficha). */
export function metadataDiseno(d: DatoDiseno, gramos: number, precio: number) {
  return {
    diseno_listo: true,
    herramienta: d.herramienta,
    modelo: d.modelo,
    valores: d.valores,
    medidas_url: ligaMedidas(d),
    tipo_producto: "a_medida",
    tiempo_produccion: `${d.dias} ${d.dias === 1 ? "día hábil" : "días hábiles"} de impresión, más el envío`,
    material: d.material,
    medidas: `${mm(d)} mm`,
    gramos,
    precio_recomendado: precio,
    hetna_ofrece: `${HETNA_OFRECE.color} · ${HETNA_OFRECE.calidad}`,
    // para recalcular el precio recomendado sin datos.json (panel del taller)
    medidas_mm: d.medidas_mm,
    volumen_cm3: d.volumen_cm3,
    dias: d.dias,
    calidad_motor: d.calidad,
  }
}

/** El diseño a partir de la metadata del producto publicado (para el panel del taller). */
export function datoDeProducto(p: { handle: string; title?: string | null; metadata?: Record<string, unknown> | null }): DatoDiseno | null {
  const m = p.metadata || {}
  const medidas = m.medidas_mm as unknown
  if (!m.diseno_listo || !Array.isArray(medidas) || medidas.length !== 3 || !(Number(m.volumen_cm3) > 0)) return null
  return {
    handle: p.handle,
    herramienta: String(m.herramienta || ""),
    modelo: String(m.modelo || ""),
    nombre: String(p.title || ""),
    texto: "",
    valores: (m.valores as Record<string, number>) || {},
    material: String(m.material || "PLA"),
    calidad: String(m.calidad_motor || "Pieza funcional"),
    dias: Number(m.dias) || 2,
    medidas_mm: medidas.map(Number) as [number, number, number],
    volumen_cm3: Number(m.volumen_cm3),
  }
}
