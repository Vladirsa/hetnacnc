// Capacidad libre (estrategia 3.4, lo que Geomiq planea: precio según la
// capacidad libre de los talleres). El taller avisa desde su panel que esta
// semana tiene máquina libre y, si quiere, cuánto descuento da por llenarla.
//
//   · Sus avisos de solicitudes nuevas le llegan antes (lib/difusion.ts).
//   · El cliente ve "⚡ Máquina libre" en sus propuestas y en su perfil.
//   · Se apaga sola al vencer (máximo 14 días): nadie se queda marcado de más.
//
// seller.metadata.capacidad_libre = { descuento_pct, hasta (ISO), nota }

export type CapacidadLibre = { descuento_pct: number; hasta: string; nota: string }

/** La capacidad libre vigente del taller, o null si no tiene o ya venció. */
export function capacidadVigente(metadata: any, ahora = Date.now()): CapacidadLibre | null {
  const c = metadata?.capacidad_libre
  if (!c || typeof c !== "object" || !c.hasta) return null
  const hasta = Date.parse(c.hasta)
  if (!Number.isFinite(hasta) || hasta < ahora) return null
  return {
    descuento_pct: Math.max(0, Math.min(30, Math.round(Number(c.descuento_pct) || 0))),
    hasta: new Date(hasta).toISOString(),
    nota: String(c.nota || "").slice(0, 140),
  }
}

/** Lo que manda el panel: { activa, descuento_pct (0-30), dias (1-14), nota }. null = apagar. */
export function nuevaCapacidad(b: any, ahora = Date.now()): CapacidadLibre | null {
  if (!b || b.activa !== true) return null
  const dias = Math.max(1, Math.min(14, Math.round(Number(b.dias) || 7)))
  const fin = new Date(ahora + dias * 86_400_000)
  fin.setHours(23, 59, 0, 0)
  return {
    descuento_pct: Math.max(0, Math.min(30, Math.round(Number(b.descuento_pct) || 0))),
    hasta: fin.toISOString(),
    nota: String(b.nota || "").replace(/[\u0000-\u001f<>]/g, " ").trim().slice(0, 140),
  }
}
