// Tarifas de publicidad de HETNA CNC (pesos mexicanos; precio final que paga el anunciante).
// Sirve en el navegador y en el servidor (no toca la base de datos).
// Para cambiar un precio, edita el número y vuelve a desplegar.
//
// Dos formas de comprar:
//   1. Por periodo: 7, 30, 90 o 365 días. La semana sirve para probar (sale más
//      cara por día); 3 meses llevan 10% menos y 1 año 25% menos.
//   2. Por vistas: un paquete de vistas garantizadas. El anuncio sale hasta
//      llegar a la cifra, tarde lo que tarde (nunca vence antes).
// Los precios son puntos de partida para probar el modelo.

import type { EspacioId } from "./tipos"

/**
 * Precio de 30 días por espacio: PRECIOS DE LANZAMIENTO (noviembre 2026).
 * Se bajaron frente a los primeros ($1,500 el carrusel) porque hoy un anuncio
 * recibe entre 50 y 400 vistas al mes según el espacio (ver vistasPorMes en
 * consultas.ts y /anunciate, que lo muestra en vivo). Cuando suban las visitas,
 * se suben aquí.
 */
export const PRECIO_30_DIAS: Record<EspacioId, number> = {
  carrusel_principal: 600,
  banner_promo: 400,
  franja_inicio: 300,
  banner_herramientas: 250,
  foro_lateral: 150,
  categorias_lateral: 200,
  vista_whatsapp: 250,
  ficha_producto: 300,
  ficha_lateral: 250,
  tienda_banner: 250,
  listado_productos: 200,
  directorio_talleres: 250,
  cotizar_disenar: 250,
}

export const PLANES = [
  { dias: 7, etiqueta: "1 semana", nota: "para probar", factor: 1.5 },
  { dias: 30, etiqueta: "1 mes", nota: "", factor: 1 },
  { dias: 90, etiqueta: "3 meses", nota: "10% menos", factor: 0.9 },
  { dias: 365, etiqueta: "1 año", nota: "25% menos", factor: 0.75 },
] as const

export const DIAS_VALIDOS: number[] = PLANES.map((p) => p.dias)

const redondear = (n: number) => Math.round(n / 10) * 10 // precios "limpios": $520, no $517.50

/** Monto por periodo. 0 si el periodo no existe. */
export function calcularMonto(espacio: EspacioId, dias: number): number {
  const plan = PLANES.find((p) => p.dias === dias)
  if (!plan) return 0
  return redondear(PRECIO_30_DIAS[espacio] * (dias / 30) * plan.factor)
}

// ---- Por vistas (CPM: precio por cada 1,000 vistas) ----
// Una "vista" = el anuncio se mostró a una persona (una vez por sesión, sin robots).
export const PRECIO_MIL_VISTAS: Record<EspacioId, number> = {
  carrusel_principal: 180,
  banner_promo: 150,
  franja_inicio: 120,
  banner_herramientas: 100,
  foro_lateral: 100,
  categorias_lateral: 100,
  vista_whatsapp: 120,
  ficha_producto: 140,
  ficha_lateral: 120,
  tienda_banner: 120,
  listado_productos: 110,
  directorio_talleres: 120,
  cotizar_disenar: 120,
}

export const PAQUETES_VISTAS = [1000, 5000, 10000, 25000] as const

/** Plazo de cortesía de un paquete de vistas: si no se alcanza, sigue gratis hasta llegar (dias = 365 en la base). */
export const DIAS_PAQUETE_VISTAS = 365

export function montoVistas(espacio: EspacioId, vistas: number): number {
  if (!(PAQUETES_VISTAS as readonly number[]).includes(vistas)) return 0
  return redondear((PRECIO_MIL_VISTAS[espacio] * vistas) / 1000)
}

export const pesos = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n)

export const miles = (n: number) => new Intl.NumberFormat("es-MX").format(Math.round(n))
