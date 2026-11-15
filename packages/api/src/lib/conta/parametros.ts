// Parámetros fiscales con su fuente. Verificados contra el texto oficial:
// LISR en www.diputados.gob.mx (texto vigente, última reforma DOF 01-04-2024,
// consultado el 15-nov-2026). Si una reforma los cambia, se actualizan aquí.

/** Pagos mayores a esto deben ser por transferencia, cheque nominativo, tarjeta o monedero (art. 27 fr. III LISR). */
export const TOPE_EFECTIVO = 2000

/** Combustible: siempre con medio electrónico, aunque no pase de $2,000 (art. 27 fr. III, 2º párrafo). */
// Claves de c_ClaveProdServ: sugerencia para detectar combustible; NO verificadas contra el catálogo
// del SAT (no se pudo abrir). El auditor sólo avisa, no bloquea, cuando las usa.
export const CLAVES_COMBUSTIBLE = ["15101505", "15101506", "15101514", "15101515"]

/** Formas de pago que NO son medio bancario (c_FormaPago): 01 efectivo. */
export const FORMA_EFECTIVO = "01"

/** Restaurantes: sólo es deducible el 8.5% (art. 28 fr. XX LISR: no deducible el 91.5%), pagado con tarjeta. */
export const DEDUCIBLE_RESTAURANTE = 0.085
// Sugerencia por clave (no verificada contra el catálogo); también se detecta por la descripción.
export const CLAVES_RESTAURANTE = ["90101500", "90101501", "90101502", "90101503", "90101504"]

/** Automóviles: inversión deducible hasta $175,000; eléctricos o híbridos $250,000 (art. 36 fr. II LISR). */
export const TOPE_AUTO = 175000
export const TOPE_AUTO_ELECTRICO = 250000

/** Por cientos máximos de depreciación anual (arts. 34 y 35 LISR). */
export const DEPRECIACION = {
  computo: { tasa: 0.3, fuente: "art. 34 fr. VII LISR (computadoras, servidores, impresoras)" },
  herramental: { tasa: 0.35, fuente: "art. 34 fr. VIII LISR (dados, troqueles, moldes, matrices y herramental)" },
  automovil: { tasa: 0.25, fuente: "art. 34 fr. VI LISR" },
  oficina: { tasa: 0.1, fuente: "art. 34 fr. III LISR (mobiliario y equipo de oficina)" },
  maquinaria_metal: { tasa: 0.08, fuente: "art. 35 fr. IV LISR (fabricación de productos de metal y de maquinaria)" },
  maquinaria_plastico: { tasa: 0.09, fuente: "art. 35 fr. V LISR (productos de plástico; impresión gráfica)" },
  maquinaria_otras: { tasa: 0.1, fuente: "art. 35 fr. XIV LISR (otras actividades no especificadas)" },
  construccion: { tasa: 0.05, fuente: "art. 34 fr. I inciso b) LISR" },
} as const
export type TipoActivo = keyof typeof DEPRECIACION

/** Tipo de activo sugerido por la clave de producto del CFDI. Es una suposición: el usuario la corrige. */
export function activoSugerido(claveProd: string): TipoActivo {
  if (/^4321|^4322|^4323/.test(claveProd)) return "computo"
  if (/^2510/.test(claveProd)) return "automovil"
  if (/^5612|^5610|^4412/.test(claveProd)) return "oficina"
  if (/^2710|^2711|^2712/.test(claveProd)) return "herramental"
  return "maquinaria_otras"
}

/** Tasas de IVA (LIVA arts. 1 y 29). */
export const IVA_GENERAL = 0.16
