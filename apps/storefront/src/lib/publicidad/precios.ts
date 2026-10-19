// Precios de los espacios publicitarios (pesos mexicanos, por 30 días).
// Para cambiar un precio, edita el número y vuelve a compilar.
// Sirve en el navegador y en el servidor (no toca la base de datos).

import type { EspacioId } from "./tipos"

export const PRECIO_30_DIAS: Record<EspacioId, number> = {
  carrusel_principal: 1500,
  banner_promo: 900,
  franja_inicio: 700,
  banner_herramientas: 500,
  foro_lateral: 400,
  categorias_lateral: 400,
}

export const PLANES = [
  { dias: 30, etiqueta: "1 mes", descuento: 0 },
  { dias: 90, etiqueta: "3 meses (10% menos)", descuento: 0.1 },
] as const

export const DIAS_VALIDOS: number[] = PLANES.map((p) => p.dias)

export function calcularMonto(espacio: EspacioId, dias: number): number {
  const plan = PLANES.find((p) => p.dias === dias)
  if (!plan) return 0
  const bruto = PRECIO_30_DIAS[espacio] * (dias / 30) * (1 - plan.descuento)
  return Math.round(bruto * 100) / 100
}

export const pesos = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n)
