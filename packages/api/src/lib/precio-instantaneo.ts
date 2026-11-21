// Precio al instante de HETNA (las calculadoras de /cotizar/corte-laser,
// /router-cnc, /corte-plasma e /impresion-3d, las guías, el correo del
// estimado y el asistente de IA).
//
// Desde el 21 nov 2026 usa el MISMO estimador que la calculadora de /cotizar
// (estimador-referencia.ts): material + máquina + operador + preparación +
// fijos ÷ (1 − margen), con metros de corte o volumen reales cuando el cliente
// sube su archivo. Antes usaba las tarifas del taller de Vlado
// (cotizador-datos.json) sin material ni mínimos: un llavero láser salía en
// $0.89 y una pieza 3D se cobraba por la caja completa.
//
// Es una función pura: no guarda nada ni manda correos.
import { type ConfigPrecios, estimar, MATERIALES, type MaterialRef, type Pieza, piezaAMano, type TipoMaquina } from "./estimador-referencia"

// Lo que la calculadora pública le pregunta al cliente, en sus palabras.
export const PLASMA_MATERIAL: Record<string, string> = {
  "Acero al carbón": "acero",
  "Acero inoxidable": "inox",
  "Aluminio": "aluminio",
}
export const PLASMA_CALIBRE: Record<string, string> = {
  "Lámina delgada (cal. 20 a 12)": "delgado",
  "Placa (cal. 10 o más grueso)": "placa",
}
export const IMPRESION_MATERIAL: Record<string, string> = {
  PLA: "PLA",
  PETG: "PETG",
  ABS: "ABS / ASA",
  "TPU (flexible)": "TPU flexible",
}
export const MATERIALES_LASER = ["MDF delgado (hasta 2.5mm)", "MDF/Madera (3-5mm)", "Acrílico, cuero, tela u otro"]
export const IMPRESION_CALIDAD = ["Prototipo rápido", "Pieza funcional", "Alta calidad"]
const RELLENO_CALIDAD: Record<string, number> = { "Prototipo rápido": 15, "Pieza funcional": 20, "Alta calidad": 35 }

const NOMBRES: Record<string, string> = { laser_co2: "Corte láser", router: "Router CNC", plasma: "Corte plasma", impresion_3d: "Impresión 3D" }
export const SERVICIOS_SOPORTADOS: Record<string, { nombre: string; maquina: TipoMaquina }> = {
  laser_co2: { nombre: NOMBRES.laser_co2, maquina: "laser_co2" },
  router: { nombre: NOMBRES.router, maquina: "router" },
  plasma: { nombre: NOMBRES.plasma, maquina: "plasma" },
  impresion_3d: { nombre: NOMBRES.impresion_3d, maquina: "impresora_3d" },
}

const mat = (nombre: string) => MATERIALES.find((m) => m.nombre === nombre) as MaterialRef

/** Material de referencia para lo que eligió el cliente (con aviso si es aproximado). */
function materialPara(servicio: string, material = "", calibre = ""): { m: MaterialRef; aviso?: string } {
  if (servicio === "laser_co2") {
    if (/delgado/i.test(material)) return { m: mat("MDF 3 mm") }
    if (/3-5/.test(material)) return { m: { ...mat("MDF 6 mm"), nombre: "MDF 4.5 mm", espesor: 4.5, precio: 230 } }
    return { m: mat("Acrílico 3 mm"), aviso: "Se calculó con acrílico de 3 mm; cuero y tela suelen salir más baratos." }
  }
  if (servicio === "router") {
    const mdf = material.match(/MDF\s*(\d+)/i)
    if (mdf) return { m: mat(`MDF ${mdf[1]} mm`) || mat("MDF 15 mm") }
    if (/acr[ií]lico/i.test(material)) return { m: mat("Acrílico 6 mm") }
    if (/aluminio/i.test(material)) return { m: mat("Aluminio 3 mm") }
    if (/pino|cedro|parota|encino|madera/i.test(material))
      return { m: { ...mat("Triplay 18 mm"), nombre: `${material} 19 mm` }, aviso: "La madera sólida varía mucho de precio: el taller confirma el costo del material." }
    return { m: mat("MDF 15 mm") }
  }
  if (servicio === "plasma") {
    const placa = PLASMA_CALIBRE[calibre] === "placa"
    const clave = PLASMA_MATERIAL[material] || "acero"
    if (clave === "inox") return { m: mat("Inoxidable 3 mm") }
    if (clave === "aluminio") return { m: mat(placa ? "Aluminio 6 mm" : "Aluminio 3 mm") }
    return { m: mat(placa ? 'Acero 6 mm (1/4")' : "Acero cal. 14 (1.9 mm)") }
  }
  return { m: mat(IMPRESION_MATERIAL[material] || "PLA") }
}

/** El precio de referencia del material, cambiado por el de mercado que mide el
 *  agente de precios (por hoja según el tamaño de hoja del material, o por kg). */
export function conPrecioDeMercado(m: MaterialRef, pm?: EntradaPrecio["precio_material"]): MaterialRef {
  if (!pm || !m) return m
  if (m.unidad === "hoja" && m.hoja && Number(pm.precio_m2) > 0) {
    return { ...m, precio: Math.round(Number(pm.precio_m2) * ((m.hoja[0] * m.hoja[1]) / 1_000_000)) }
  }
  if (m.unidad === "kg" && Number(pm.precio_kg) > 0) return { ...m, precio: Math.round(Number(pm.precio_kg) * 100) / 100 }
  return m
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
  /** Precio de mercado del material (base de precios, lib/materiales-precios.ts): reemplaza el de referencia */
  precio_material?: { nombre?: string; precio_m2?: number | null; precio_kg?: number | null; fecha?: string | null } | null
  /** Del archivo del cliente (ya a la escala pedida): metros de corte en mm, entradas, volumen real */
  corte_mm?: number
  perforaciones?: number
  volumen_cm3?: number
}

export type PrecioInstantaneo =
  | { ok: true; servicioCfg: { nombre: string }; resultado: { pvMinimo: number; pvRecomendado: number; pvPremium: number; iva: number; total: number }; estimado: Extract<ReturnType<typeof estimar>, { ok: true }>; avisos: string[] }
  | { ok: false; mensaje: string }

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100

/** `cfg`: ajustes de precio del dueño (lib/precios-config.ts); sin él, valores de fábrica. */
export function precioInstantaneo(e: EntradaPrecio, cfg?: ConfigPrecios | null): PrecioInstantaneo {
  const { servicio, material, calibre, calidad } = e
  const ancho = Number(e.ancho)
  const largo = Number(e.largo)
  const alto = Number(e.alto)
  const cantidad = Number(e.cantidad)
  const soporte = servicio ? SERVICIOS_SOPORTADOS[servicio] : undefined
  if (!soporte) return { ok: false, mensaje: "servicio debe ser 'laser_co2', 'router', 'plasma' o 'impresion_3d'" }
  if (!(ancho > 0) || !(largo > 0) || !(cantidad > 0)) return { ok: false, mensaje: "Faltan ancho, largo o cantidad." }
  // La impresión 3D se calcula por volumen: sin la altura no hay precio.
  if (servicio === "impresion_3d" && !(alto > 0)) return { ok: false, mensaje: "Para impresión 3D falta la altura de la pieza." }

  const es3D = servicio === "impresion_3d"
  const base = piezaAMano(largo * 10, ancho * 10, es3D ? alto * 10 : 0, "normal", es3D)
  const pieza: Pieza = {
    ...base,
    metrosCorte: Number(e.corte_mm) > 0 ? Number(e.corte_mm) / 1000 : base.metrosCorte,
    perforaciones: Number(e.perforaciones) > 0 ? Math.round(Number(e.perforaciones)) : base.perforaciones,
    volumenCm3: Number(e.volumen_cm3) > 0 ? Number(e.volumen_cm3) : base.volumenCm3,
  }
  const { m: ref, aviso } = materialPara(servicio as string, material, calibre)
  const m = conPrecioDeMercado(ref, e.precio_material)
  const r = estimar({ servicio: soporte.maquina, pieza, material: m, cantidad, relleno: es3D ? RELLENO_CALIDAD[calidad || ""] ?? 20 : undefined, cfg })
  if (!r.ok) return { ok: false, mensaje: r.motivo }
  return {
    ok: true,
    servicioCfg: { nombre: soporte.nombre },
    resultado: { pvMinimo: r.min, pvRecomendado: r.total, pvPremium: r.max, iva: r2(r.total * 0.16), total: r2(r.total * 1.16) },
    estimado: r,
    avisos: [...(aviso ? [aviso] : []), ...r.avisos],
  }
}

// ── Precio desglosado y en vivo ────────────────────────────────────────
// Cómo se forma el precio y cuánto baja la pieza al pedir más.

export type PrecioDesglosado = {
  minimo: number
  recomendado: number
  maximo: number
  iva: number
  total: number
  /** Cómo se calculó, en palabras */
  calculo: string[]
  /** La preparación de la máquina pesa mucho: pedir más piezas baja el precio unitario */
  aplica_minimo: boolean
  por_volumen: { cantidad: number; unitario: number; total: number }[]
}

const pesos = (n: number) => `$${(Math.round(n * 100) / 100).toLocaleString("es-MX", { maximumFractionDigits: 2 })}`
const CANTIDADES_VOLUMEN = [1, 10, 50, 100]

export function precioDesglosado(e: EntradaPrecio, cfg?: ConfigPrecios | null): { ok: true; precio: PrecioDesglosado } | { ok: false; mensaje: string } {
  const p = precioInstantaneo(e, cfg)
  if (!p.ok) return p
  const cantidad = Math.max(1, Math.round(Number(e.cantidad) || 1))
  const est = p.estimado
  const aplica_minimo = est.partePrep >= 0.35
  const calculo = [
    `Tiempo de máquina: ${est.explicacion}`,
    est.hojas > 0 ? `Material: ${est.piezasPorHoja} pieza(s) por hoja, ${pesos(est.costoMaterial)} incluido` : est.gramos > 0 ? `Material: ${Math.round(est.gramos)} g, ${pesos(est.costoMaterial)} incluido` : "",
    aplica_minimo ? "La preparación de la máquina pesa mucho en pedidos chicos: con más piezas baja el precio de cada una" : "",
    ...p.avisos,
  ].filter(Boolean)
  const cantidades = [...new Set([...CANTIDADES_VOLUMEN, cantidad])].sort((a, b) => a - b)
  const por_volumen = cantidades
    .map((q) => {
      const x = q === cantidad ? p : precioInstantaneo({ ...e, cantidad: q }, cfg)
      if (!x.ok) return null
      const total = r2(x.resultado.pvRecomendado)
      return { cantidad: q, total, unitario: r2(total / q) }
    })
    .filter(Boolean) as PrecioDesglosado["por_volumen"]
  return {
    ok: true,
    precio: {
      minimo: r2(p.resultado.pvMinimo),
      recomendado: r2(p.resultado.pvRecomendado),
      maximo: r2(p.resultado.pvPremium),
      iva: p.resultado.iva,
      total: p.resultado.total,
      calculo,
      aplica_minimo,
      por_volumen,
    },
  }
}
