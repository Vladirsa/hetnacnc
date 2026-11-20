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

// ── Precio desglosado y en vivo (estrategia 1.2) ─────────────────────────
// Lo que JLC o Ponoko muestran: cómo se forma el precio y cuánto baja la pieza
// al pedir más. Sale del mismo motor (su "detalle": minutos × tarifa, m² ×
// tarifa, mínimo por pedido, gramos); no se inventan partidas.

export type PrecioDesglosado = {
  minimo: number
  recomendado: number
  maximo: number
  iva: number
  total: number
  /** Cómo se calculó, en palabras (sale del detalle del motor) */
  calculo: string[]
  /** El pedido quedó en el cobro mínimo del servicio */
  aplica_minimo: boolean
  por_volumen: { cantidad: number; unitario: number; total: number }[]
}

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100
const pesos = (n: number) => `$${(Math.round(n * 100) / 100).toLocaleString("es-MX", { maximumFractionDigits: 2 })}`
const num = (n: number, d = 2) => (Math.round(n * 10 ** d) / 10 ** d).toLocaleString("es-MX", { maximumFractionDigits: d })
const CANTIDADES_VOLUMEN = [1, 10, 50, 100]

function lineasCalculo(servicio: string, d: Record<string, number>, cantidad: number, recomendado: number): { calculo: string[]; minimo: boolean } {
  const c: string[] = []
  let minimo = false
  const pz = cantidad === 1 ? "1 pieza" : `${cantidad} piezas`
  if (servicio === "laser_co2") {
    if (d.minutos_estimados) c.push(`Tiempo de corte estimado: ${num(d.minutos_estimados, 1)} min para ${pz}`)
    if (d.tarifa_min) c.push(`Tarifa de máquina: ${pesos(d.tarifa_min)} por minuto`)
  } else if (servicio === "router" || servicio === "plasma") {
    if (d.area_m2) c.push(`Área a cortar: ${num(d.area_m2, 3)} m² por pieza × ${pz}`)
    if (d.tarifa_m2) c.push(`Tarifa: ${pesos(d.tarifa_m2 * (d.material_factor || 1))} por m²${d.material_factor && d.material_factor !== 1 ? " (según el material)" : ""}`)
    if (d.minimo_apertura) {
      minimo = recomendado <= d.minimo_apertura + 0.01
      c.push(`Cobro mínimo por pedido: ${pesos(d.minimo_apertura)}${minimo ? " (tu pedido quedó en el mínimo)" : ""}`)
    }
  } else if (servicio === "impresion_3d") {
    if (d.volumen_cm3) c.push(`Volumen: ${num(d.volumen_cm3, 0)} cm³ por pieza`)
    if (d.gramos_estimados) c.push(`Material estimado: ${num(d.gramos_estimados, 0)} g por pieza`)
    if (d.tiempo_min) c.push(`Tiempo de impresión estimado: ${num(d.tiempo_min / 60, 1)} h por pieza`)
    if (d.precio_minimo) {
      minimo = recomendado <= d.precio_minimo + 0.01
      c.push(`Precio mínimo: ${pesos(d.precio_minimo)}${minimo ? " (tu pedido quedó en el mínimo)" : ""}`)
    }
  }
  return { calculo: c, minimo }
}

export function precioDesglosado(e: EntradaPrecio): { ok: true; precio: PrecioDesglosado } | { ok: false; mensaje: string } {
  const p = precioInstantaneo(e)
  if (!p.ok) return p
  const r = p.resultado
  const cantidad = Math.max(1, Math.round(Number(e.cantidad) || 1))
  const { calculo, minimo } = lineasCalculo(String(e.servicio), r.detalle || {}, cantidad, r.pvRecomendado)
  const cantidades = [...new Set([...CANTIDADES_VOLUMEN, cantidad])].sort((a, b) => a - b)
  const por_volumen = cantidades
    .map((q) => {
      const x = q === cantidad ? p : precioInstantaneo({ ...e, cantidad: q })
      if (!x.ok) return null
      const total = r2(x.resultado.pvRecomendado)
      return { cantidad: q, total, unitario: r2(total / q) }
    })
    .filter(Boolean) as PrecioDesglosado["por_volumen"]
  return {
    ok: true,
    precio: {
      minimo: r2(r.pvMinimo),
      recomendado: r2(r.pvRecomendado),
      maximo: r2(r.pvPremium),
      iva: r2(r.iva),
      total: r2(r.total),
      calculo,
      aplica_minimo: minimo,
      por_volumen,
    },
  }
}
