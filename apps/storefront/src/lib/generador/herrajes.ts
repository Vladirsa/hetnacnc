// Biblioteca de herrajes de unión (como en los plugins de carpintería): cada
// herraje dice qué barrenos lleva en la unión de dos tableros y cuánto cuesta.
//
// En una unión, Q es el tablero que llega con su canto a la cara de P:
//  - caraP: barreno en la cara de P, al centro del grueso de Q (perno, confirmat, taquete).
//  - cantoQ: barreno en el canto de Q, hacia adentro.
//  - caraQ: barreno en la cara de Q a L mm de su orilla (la caja del minifix o del Rafix).
//  - acompañante: otro herraje (un taquete) a C mm, con sus propios barrenos.
// Se ponen a "borde" mm de cada orilla de la unión y repartidos a no más de
// "separacion" mm; con sistema 32 las separaciones son múltiplos de 32 mm.
// Un barreno con prof 0 es pasado (atraviesa el tablero).

export type Agujero = { d: number; prof: number; capa?: string }
export type DefHerraje = {
  id: string
  nombre: string
  compra: string // cómo aparece en la lista de compra
  precio: number // por pieza, en pesos (0 = sin precio)
  borde: number
  separacion: number
  sistema32: boolean
  minimo: number // herrajes por unión, al menos
  largoMinQ?: number // el tablero que llega debe medir al menos esto (mm)
  caraP?: Agujero
  cantoQ?: Agujero
  caraQ?: Agujero & { L: number }
  acompanante?: { C: number; compra: string; precio: number; caraP?: Agujero; cantoQ?: Agujero }
  nota?: string
}

export const HERRAJES_BASE: DefHerraje[] = [
  {
    id: "minifix-taquete",
    nombre: "Minifix 15 + taquete",
    compra: "Minifix 15 mm (caja y perno)",
    precio: 6,
    borde: 50,
    separacion: 320,
    sistema32: true,
    minimo: 1,
    largoMinQ: 80,
    caraP: { d: 8, prof: 11 },
    cantoQ: { d: 8, prof: 34 },
    caraQ: { d: 15, prof: 13.5, L: 34 },
    acompanante: { C: 32, compra: "Taquete de madera 8 × 30", precio: 0.5, caraP: { d: 8, prof: 12 }, cantoQ: { d: 8, prof: 25 } },
    nota: "Se arma y desarma: cocinas y closets.",
  },
  {
    id: "minifix",
    nombre: "Minifix 15 sencillo",
    compra: "Minifix 15 mm (caja y perno)",
    precio: 6,
    borde: 50,
    separacion: 320,
    sistema32: true,
    minimo: 1,
    largoMinQ: 80,
    caraP: { d: 8, prof: 11 },
    cantoQ: { d: 8, prof: 34 },
    caraQ: { d: 15, prof: 13.5, L: 34 },
  },
  {
    id: "confirmat",
    nombre: "Confirmat 7 × 50",
    compra: "Tornillo confirmat 7 × 50",
    precio: 1.5,
    borde: 50,
    separacion: 320,
    sistema32: false,
    minimo: 1,
    caraP: { d: 7, prof: 0 },
    cantoQ: { d: 5, prof: 45 },
    nota: "Broca escalonada; avellana la cara de afuera.",
  },
  {
    id: "taquete",
    nombre: "Taquete 8 × 30 con pegamento",
    compra: "Taquete de madera 8 × 30",
    precio: 0.5,
    borde: 40,
    separacion: 200,
    sistema32: true,
    minimo: 2,
    caraP: { d: 8, prof: 12 },
    cantoQ: { d: 8, prof: 25 },
  },
  {
    id: "rafix",
    nombre: "Rafix 20 (conector de repisa)",
    compra: "Conector Rafix 20",
    precio: 9,
    borde: 50,
    separacion: 400,
    sistema32: true,
    minimo: 1,
    caraP: { d: 5, prof: 11 },
    caraQ: { d: 20, prof: 12.5, L: 9.5 },
    nota: "Revisa las medidas con tu proveedor: varían por marca.",
  },
  {
    id: "tornillo",
    nombre: "Tornillo para madera 4 × 40",
    compra: "Tornillo para madera 4 × 40",
    precio: 0.4,
    borde: 50,
    separacion: 250,
    sistema32: false,
    minimo: 2,
    caraP: { d: 4, prof: 0 },
    cantoQ: { d: 2.5, prof: 30 },
    nota: "El más económico; avellana por fuera.",
  },
]

// soportes de repisa movible (sistema 32): dos filas de barrenos en cada costado
export type DefSoporte = { d: number; prof: number; delFrente: number; deAtras: number; paso: number; margen: number; precio: number; compra: string }
export const SOPORTE_BASE: DefSoporte = { d: 5, prof: 12, delFrente: 37, deAtras: 37, paso: 32, margen: 100, precio: 0.8, compra: "Soporte de repisa (pin) Ø5" }

// las uniones de siempre, como herrajes de la biblioteca
export const HERRAJE_DE_UNION: Record<string, string> = { confirmat: "confirmat", minifix: "minifix-taquete", taquete: "taquete" }
export const herrajeDe = (id: string | undefined, lista: DefHerraje[] = HERRAJES_BASE) => lista.find((h) => h.id === id) || HERRAJES_BASE[0]
