// Cuánto cuestan en créditos las herramientas de diseño (muebles, cocina,
// molduras y tallados). Diseñar, ver, editar, cotizar y guardar es gratis; se
// cobra al bajar los archivos para fabricar, según el tamaño del trabajo.
//
// Referencia (nov. 2026): el crédito cuesta de $15 a $24 MXN según el paquete.
// Un mueble suelto (hasta 40 piezas) = 1 crédito; una cocina de 200 piezas = 5
// créditos (~$80–120). Un diseño de cocina con planos se cobra en México miles
// de pesos y los programas de carpintería cuestan de $2,000 a $6,000 al mes:
// aquí el taller paga sólo lo que fabrica. El costo de cómputo es de centavos.

export type HerramientaDiseno = "mueble" | "cocina" | "moldura" | "tallado"

export const PIEZAS_POR_CREDITO = Number(process.env.DISENO_PIEZAS_POR_CREDITO) || 40
export const MAX_CREDITOS_DESCARGA = Number(process.env.DISENO_MAX_CREDITOS) || 8
export const CREDITOS_MOLDURA = 1
export const CREDITOS_TALLADO = 2
// créditos de regalo al abrir la cuenta: alcanzan para probar 2–3 muebles o una cocina
export const CREDITOS_BIENVENIDA = Number(process.env.CREDITOS_BIENVENIDA ?? 5)
// diseños que cada cliente puede guardar en su cuenta (gratis)
export const MAX_DISENOS_GUARDADOS = Number(process.env.DISENO_MAX_GUARDADOS) || 50

export function creditosDescarga(herramienta: HerramientaDiseno, piezas: number): number {
  if (herramienta === "moldura") return CREDITOS_MOLDURA
  if (herramienta === "tallado") return CREDITOS_TALLADO
  const n = Math.max(1, Math.round(Number(piezas) || 1))
  return Math.min(MAX_CREDITOS_DESCARGA, Math.max(1, Math.ceil(n / PIEZAS_POR_CREDITO)))
}
