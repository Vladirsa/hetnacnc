// Licitaciones 3.0 — Fase 2: propuesta formal del taller y comparación.
// (docs/licitaciones-especificacion-maestra.md, sección 14 "Propuesta formal")
//
// Además de precio, días, vigencia, envío, condiciones y anticipo, cada
// propuesta puede llevar: moneda, materiales, operaciones, fecha estimada de
// entrega, condiciones de pago, garantía, observaciones técnicas y archivos
// adjuntos (PDF, planos, fotos), guardados en el bucket privado de B2.
//
// La comparación detecta diferencias y omisiones con reglas propias y, si hay
// llave de Claude en el servidor, agrega un resumen escrito por IA. La IA
// nunca elige ganador: sólo explica (regla de la especificación).
import { T_PROPUESTA, T_SOLICITUD } from "./licitacion"

export const MONEDAS = ["MXN", "USD"] as const
export type Moneda = (typeof MONEDAS)[number]
export const MAX_ADJUNTOS_PROPUESTA = 5
export const MAX_MB_ADJUNTO_PROPUESTA = 25

export type AdjuntoPropuesta = { clave: string; nombre: string; tamano: number }

let lista = false
export async function asegurarPropuestaFormal(knex: any) {
  if (lista) return
  const cols: [string, string, string][] = [
    [T_PROPUESTA, "moneda", "text"],
    [T_PROPUESTA, "materiales", "text"],
    [T_PROPUESTA, "operaciones", "text"],
    [T_PROPUESTA, "fecha_entrega", "date"],
    [T_PROPUESTA, "condiciones_pago", "text"],
    [T_PROPUESTA, "garantia", "text"],
    [T_PROPUESTA, "observaciones", "text"],
    [T_PROPUESTA, "adjuntos", "jsonb"],
    // Fase 2: fabricación (piezas a la medida) o suministro (material/insumos)
    [T_SOLICITUD, "tipo", "text"],
    // Resumen de la IA ya calculado, con la "huella" de las propuestas que vio
    [T_SOLICITUD, "analisis", "jsonb"],
    // Fase 3 (Membresía Empresarial): sólo propuestas de talleres verificados
    [T_SOLICITUD, "solo_verificados", "boolean"],
  ]
  for (const [tabla, col, tipo] of cols) {
    await knex.raw(`alter table ?? add column if not exists ?? ${tipo}`, [tabla, col])
  }
  lista = true
}

const corto = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max)

/** Lee los campos formales del cuerpo de la propuesta (todos opcionales). */
export function leerPropuestaFormal(b: Record<string, unknown>, ocultar: (s: string) => string) {
  const moneda = MONEDAS.includes(String(b.moneda || "").toUpperCase() as Moneda) ? String(b.moneda).toUpperCase() : "MXN"
  const f = String(b.fecha_entrega || "").trim()
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(f) && !Number.isNaN(Date.parse(f)) ? f : null
  return {
    moneda,
    materiales: ocultar(corto(b.materiales, 600)) || null,
    operaciones: ocultar(corto(b.operaciones, 800)) || null,
    fecha_entrega: fecha,
    condiciones_pago: ocultar(corto(b.condiciones_pago, 600)) || null,
    garantia: ocultar(corto(b.garantia, 600)) || null,
    observaciones: ocultar(corto(b.observaciones, 1500)) || null,
  }
}

export type PropuestaComparable = {
  id: string
  taller: string
  precio: number
  moneda?: string | null
  dias: number
  incluye_envio: boolean
  anticipo_pct?: number | null
  materiales?: string | null
  operaciones?: string | null
  fecha_entrega?: string | null
  condiciones_pago?: string | null
  garantia?: string | null
  observaciones?: string | null
  condiciones?: string | null
  calificacion?: number | null
  verificado?: boolean
  adjuntos?: number
}

/** Lo que le falta a una propuesta para que el cliente compare con confianza. */
export function omisiones(p: PropuestaComparable): string[] {
  const f: string[] = []
  if (!p.garantia) f.push("No dice qué garantía ofrece")
  if (!p.condiciones_pago) f.push("No explica cómo se paga")
  if (!p.materiales) f.push("No dice qué material usará")
  if (!p.operaciones) f.push("No detalla los procesos (corte, acabado…)")
  if (!p.fecha_entrega) f.push("No da una fecha de entrega concreta")
  if (!p.incluye_envio) f.push("El envío no está incluido")
  return f
}

/** Comparación con reglas: diferencias que conviene que el cliente vea. */
export function compararPropuestas(lista: PropuestaComparable[]) {
  const enMxn = lista.filter((p) => (p.moneda || "MXN") === "MXN")
  const precios = enMxn.map((p) => p.precio).sort((a, b) => a - b)
  const mediana = precios.length ? precios[Math.floor(precios.length / 2)] : 0
  const minDias = Math.min(...lista.map((p) => p.dias))
  const notas = lista.map((p) => {
    const n: string[] = []
    if ((p.moneda || "MXN") !== "MXN") n.push(`Cotiza en ${p.moneda}: conviértelo a pesos para comparar.`)
    else if (mediana && precios.length >= 2) {
      const dif = Math.round(((p.precio - mediana) / mediana) * 100)
      if (dif <= -25) n.push(`Precio ${-dif}% abajo de la mediana: pregunta qué incluye y qué no.`)
      else if (dif >= 25) n.push(`Precio ${dif}% arriba de la mediana.`)
    }
    if (p.dias === minDias && lista.length > 1) n.push("Es la entrega más rápida.")
    if (p.anticipo_pct && p.anticipo_pct < 100) n.push(`Pide ${p.anticipo_pct}% de anticipo.`)
    if (p.verificado) n.push("Taller verificado por HETNA.")
    if (!p.calificacion) n.push("Todavía no tiene calificaciones en HETNA.")
    return { id: p.id, notas: n, faltan: omisiones(p) }
  })
  return { mediana: mediana || null, notas }
}

/** Huella de las propuestas: si cambia, el resumen de la IA se recalcula. */
export const huellaPropuestas = (lista: PropuestaComparable[]) =>
  lista
    .map((p) => [p.id, p.precio, p.dias, p.garantia, p.condiciones_pago, p.materiales, p.operaciones, p.fecha_entrega].join("|"))
    .sort()
    .join("#")
