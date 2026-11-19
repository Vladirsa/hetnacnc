// Lo mismo que packages/api/src/lib/precios-diseno.ts, para enseñar el precio
// antes de cobrar (quien cobra de verdad es el backend).
export type HerramientaDiseno = "mueble" | "cocina" | "moldura" | "tallado"
export const PIEZAS_POR_CREDITO = 40
export const MAX_CREDITOS_DESCARGA = 8
export const CREDITOS_BIENVENIDA = 5

export function creditosDescarga(herramienta: HerramientaDiseno, piezas: number): number {
  if (herramienta === "moldura") return 1
  if (herramienta === "tallado") return 2
  const n = Math.max(1, Math.round(Number(piezas) || 1))
  return Math.min(MAX_CREDITOS_DESCARGA, Math.max(1, Math.ceil(n / PIEZAS_POR_CREDITO)))
}
export const textoCreditos = (n: number) => `${n} ${n === 1 ? "crédito" : "créditos"}`
