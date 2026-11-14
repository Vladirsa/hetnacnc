// Precio al instante de HETNA (las calculadoras de /cotizar/corte-laser,
// /router-cnc, /corte-plasma e /impresion-3d). Usa el motor real del Cotizador
// CNC (cotizador-engine.ts) con las tarifas de cotizador-datos.json.
//
// Es una función pura: no guarda nada ni manda correos. La usan la ruta
// pública /store/quote-leads (que además registra el lead) y el asistente de
// IA para talleres (lib/ia-fabricacion.ts).
import { calcular } from "./cotizador-engine"
import cotizadorDatos from "./cotizador-datos.json"

// Lo que la calculadora pública le pregunta al cliente, en sus palabras, y
// cómo se traduce a los parámetros del motor. Plasma e impresión 3D usan las
// mismas tarifas que el Cotizador de los talleres (cotizador-datos.json).
export const PLASMA_MATERIAL: Record<string, string> = {
  "Acero al carbón": "acero_negro",
  "Acero inoxidable": "inox",
  "Aluminio": "aluminio",
}
export const PLASMA_CALIBRE: Record<string, string> = {
  "Lámina delgada (cal. 20 a 12)": "Cal 14",
  "Placa (cal. 10 o más grueso)": "Cal 10",
}
export const IMPRESION_MATERIAL: Record<string, string> = {
  PLA: "pla",
  PETG: "petg",
  ABS: "abs",
  "TPU (flexible)": "tpu",
}
export const IMPRESION_CALIDAD = ["Prototipo rápido", "Pieza funcional", "Alta calidad"]

export const SERVICIOS_SOPORTADOS: Record<string, { tipoNombre: string; materialLaserPorMaterial?: Record<string, string> }> = {
  laser_co2: {
    tipoNombre: "Solo corte",
    materialLaserPorMaterial: {
      "MDF delgado (hasta 2.5mm)": "mdf_fino",
      "MDF/Madera (3-5mm)": "mdf_medio",
      "Acrílico, cuero, tela u otro": "otros",
    },
  },
  router: {
    tipoNombre: "Corte simple",
  },
  plasma: {
    tipoNombre: "Corte por m²",
  },
  impresion_3d: {
    // Se reemplaza por la calidad que elija el cliente.
    tipoNombre: "Pieza funcional",
  },
}

export type EntradaPrecio = {
  servicio?: string
  material?: string
  ancho?: number // cm
  largo?: number // cm
  alto?: number // cm (sólo impresión 3D)
  calibre?: string
  calidad?: string
  cantidad?: number
}

export type PrecioInstantaneo =
  | { ok: true; servicioCfg: any; resultado: any }
  | { ok: false; mensaje: string }

export function precioInstantaneo(e: EntradaPrecio): PrecioInstantaneo {
  const { servicio, material, calibre, calidad } = e
  const ancho = Number(e.ancho)
  const largo = Number(e.largo)
  const alto = Number(e.alto)
  const cantidad = Number(e.cantidad)
  const soporte = servicio ? SERVICIOS_SOPORTADOS[servicio] : undefined
  if (!soporte) return { ok: false, mensaje: "servicio debe ser 'laser_co2', 'router', 'plasma' o 'impresion_3d'" }
  if (!(ancho > 0) || !(largo > 0) || !(cantidad > 0)) return { ok: false, mensaje: "Faltan ancho, largo o cantidad." }
  // La impresión 3D se cobra por volumen: sin la altura no hay precio.
  if (servicio === "impresion_3d" && !(alto > 0)) return { ok: false, mensaje: "Para impresión 3D falta la altura de la pieza." }

  const datos = cotizadorDatos as any
  const servicioCfg = datos.servicios.find((s: any) => s.clave === servicio)
  const nombreTipo =
    servicio === "impresion_3d" && calidad && IMPRESION_CALIDAD.includes(calidad) ? calidad : soporte.tipoNombre
  const tipo = servicioCfg.tipos.find((t: any) => t.n === nombreTipo)

  const materialLaser =
    servicio === "laser_co2" && material && soporte.materialLaserPorMaterial
      ? soporte.materialLaserPorMaterial[material] || "otros"
      : undefined

  const resultado = calcular({
    cfg: { tarifas: servicioCfg.tarifas, rangos: servicioCfg.rangos },
    costos: datos.costos,
    tipo: { nombre: tipo.n, formula: tipo.f, factor: tipo.k },
    nombreServicio: servicioCfg.nombre,
    emojiServicio: servicioCfg.emoji,
    ancho,
    largo,
    cantidad,
    materialLaser,
    ...(servicio === "plasma"
      ? {
          material: PLASMA_MATERIAL[material || ""] || "acero_negro",
          calibre: PLASMA_CALIBRE[calibre || ""] || "Cal 14",
        }
      : {}),
    ...(servicio === "impresion_3d" ? { alto, materialImpresion: IMPRESION_MATERIAL[material || ""] || "pla" } : {}),
    aplicarIva: true,
  })
  return { ok: true, servicioCfg, resultado }
}
