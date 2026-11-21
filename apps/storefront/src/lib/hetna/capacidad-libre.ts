// Capacidad libre del taller (estrategia 3.4): packages/api/src/lib/capacidad-libre.ts
export type CapacidadLibre = { descuento_pct: number; hasta: string; nota: string }

/** La vigente o null (vence sola). */
export function capacidadVigente(v: unknown): CapacidadLibre | null {
  const c = v as Partial<CapacidadLibre> | null
  if (!c || typeof c !== "object" || !c.hasta) return null
  const t = Date.parse(String(c.hasta))
  if (!Number.isFinite(t) || t < Date.now()) return null
  return { descuento_pct: Math.max(0, Math.min(30, Math.round(Number(c.descuento_pct) || 0))), hasta: String(c.hasta), nota: String(c.nota || "").slice(0, 140) }
}

export const textoCapacidad = (c: CapacidadLibre) =>
  `⚡ Máquina libre esta semana${c.descuento_pct ? ` · hasta ${c.descuento_pct}% de descuento` : ""}`
