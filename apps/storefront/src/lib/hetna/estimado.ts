// Precio estimado por taller para una pieza que llega de "Fabrícamelo".
//
// Cada taller publica en su perfil (metadata.perfil.tarifas) un precio por m²
// de material, un precio por metro de corte (opcional) y un pedido mínimo,
// por proceso. Con el archivo de la pieza (DXF o SVG) se mide en el navegador
// el área que ocupa y los metros de corte, y de ahí sale un estimado por
// taller. Es orientativo: la propuesta formal la manda el taller.

import { leerDXF, leerSVG, medidas } from "@/lib/generador/vectores"

export type Tarifa = {
  m2: number // $ por m² de material (pieza + desperdicio)
  metro?: number // $ por metro de corte (opcional)
  minimo: number // pedido mínimo en $
}

// Clave: el proceso tal cual aparece en SERVICIOS_SOLICITUD ("Corte láser"…)
export type Tarifas = Record<string, Tarifa>

export const PROCESOS_TARIFA = ["Corte láser", "Corte CNC", "Corte plasma"] as const

export type MedidaPieza = { ancho: number; alto: number; largo: number } // mm

const num = (v: unknown) => {
  const n = typeof v === "string" ? parseFloat(v) : (v as number)
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : 0
}

export const leerTarifas = (v: unknown): Tarifas => {
  if (!v || typeof v !== "object") return {}
  const out: Tarifas = {}
  for (const [k, t] of Object.entries(v as Record<string, unknown>)) {
    if (!t || typeof t !== "object") continue
    const o = t as Record<string, unknown>
    const m2 = num(o.m2)
    const metro = num(o.metro)
    const minimo = num(o.minimo)
    if (m2 > 0 || metro > 0) out[k] = { m2, metro: metro || undefined, minimo }
  }
  return out
}

// Mide un DXF o SVG en el navegador. Devuelve null si no se puede (otro
// formato, archivo dañado o demasiado grande para leerlo al vuelo).
export async function medirArchivo(f: File): Promise<MedidaPieza | null> {
  const ext = (f.name.split(".").pop() || "").toLowerCase()
  if (!["dxf", "svg"].includes(ext) || f.size > 8 * 1024 * 1024) return null
  try {
    const texto = await f.text()
    // Por contenido, no por extensión: un SVG guardado como .dxf se lee igual
    const esSVG = /^\s*(<\?xml|<svg|<!DOCTYPE)/i.test(texto.slice(0, 200))
    const d = esSVG ? leerSVG(texto) : leerDXF(texto)
    const m = medidas(d)
    if (!(m.ancho > 0 && m.alto > 0)) return null
    return { ancho: m.ancho, alto: m.alto, largo: m.largo }
  } catch {
    return null
  }
}

// Estimado en pesos para `cantidad` piezas, redondeado a decenas.
export function estimar(t: Tarifa, m: MedidaPieza, cantidad: number): number {
  const area = (m.ancho * m.alto) / 1e6 // m²
  const largo = m.largo / 1000 // m
  const porPieza = area * t.m2 + largo * (t.metro || 0)
  const total = Math.max(t.minimo, porPieza * Math.max(1, cantidad))
  return Math.round(total / 10) * 10
}

// "3 piezas", "50", "1 pieza" → número
export const leerCantidad = (s: string) => {
  const n = parseInt((s || "").replace(/[^\d]/g, ""), 10)
  return Number.isFinite(n) && n > 0 ? n : 1
}

export const pesos = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 })
