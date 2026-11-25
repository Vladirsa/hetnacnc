// Diseños listos: piezas que salen de las herramientas del Estudio y se
// venden en la tienda HETNA de dos formas: el archivo gratis (con correo) y la
// pieza ya fabricada por HETNA, con precio por gramaje y tiempo de entrega.
//
// Una sola fuente para todo: de aquí salen
//   - scripts/disenos-listos.mts: la imagen (public/disenos-listos/*.png) y las
//     medidas y el volumen (datos.json), que el API usa para el precio,
//   - el producto en la tienda (packages/api/src/scripts/publicar-disenos-listos.ts),
//   - la liga "Modifica las medidas" (abre la herramienta con estos valores),
//   - el archivo gratis, que se arma en el navegador con el mismo motor.
//
// Agregar un diseño: una línea aquí, correr el script de imágenes y el de
// publicar (ver el comando en packages/api/src/scripts/publicar-disenos-listos.ts).
export type MaterialImpresion = "PLA" | "PETG"
export type CalidadImpresion = "Prototipo rápido" | "Pieza funcional" | "Alta calidad"

export type DisenoListo = {
  /** handle del producto en la tienda */
  handle: string
  /** herramienta del Estudio y modelo dentro de ella */
  herramienta: "modelos-3d"
  modelo: string
  /** medidas distintas a las de fábrica del modelo (lo demás queda como viene) */
  valores?: Record<string, number>
  /** nombre en la tienda (si no, el del modelo) */
  nombre?: string
  material: MaterialImpresion
  calidad: CalidadImpresion
  /** días hábiles para imprimirlo antes de enviarlo */
  dias: number
}

export const DISENOS_LISTOS: DisenoListo[] = [
  { handle: "hetna-maceta-con-drenaje", herramienta: "modelos-3d", modelo: "maceta", nombre: "Maceta con drenaje y plato", material: "PETG", calidad: "Pieza funcional", dias: 2 },
  { handle: "hetna-maceta-grande", herramienta: "modelos-3d", modelo: "maceta", valores: { arriba: 160, abajo: 120, alto: 140, pared: 2.4, drenaje: 14 }, nombre: "Maceta grande con drenaje y plato", material: "PETG", calidad: "Pieza funcional", dias: 3 },
  { handle: "hetna-lapicero-hexagonal", herramienta: "modelos-3d", modelo: "porta-lapices", nombre: "Lapicero hexagonal para escritorio", material: "PLA", calidad: "Pieza funcional", dias: 2 },
  { handle: "hetna-soporte-celular", herramienta: "modelos-3d", modelo: "soporte-celular", nombre: "Soporte para celular con paso de cable", material: "PLA", calidad: "Pieza funcional", dias: 2 },
  { handle: "hetna-soporte-tableta", herramienta: "modelos-3d", modelo: "soporte-celular", valores: { ancho: 180, grosor: 14 }, nombre: "Soporte para tableta con paso de cable", material: "PLA", calidad: "Pieza funcional", dias: 2 },
  { handle: "hetna-posavasos", herramienta: "modelos-3d", modelo: "posavasos", nombre: "Posavasos", material: "PLA", calidad: "Pieza funcional", dias: 2 },
  { handle: "hetna-gancho-pared", herramienta: "modelos-3d", modelo: "gancho-pared", nombre: "Gancho de pared", material: "PETG", calidad: "Pieza funcional", dias: 2 },
  { handle: "hetna-organizador-fresas", herramienta: "modelos-3d", modelo: "organizador-fresas", nombre: "Organizador de fresas y brocas", material: "PLA", calidad: "Pieza funcional", dias: 2 },
  { handle: "hetna-organizador-llaves-allen", herramienta: "modelos-3d", modelo: "llaves-allen", nombre: "Organizador de llaves Allen", material: "PLA", calidad: "Pieza funcional", dias: 2 },
  { handle: "hetna-contenedor-apilable", herramienta: "modelos-3d", modelo: "contenedor-apilable", nombre: "Contenedor apilable", material: "PLA", calidad: "Pieza funcional", dias: 2 },
  { handle: "hetna-caja-tapa-presion", herramienta: "modelos-3d", modelo: "caja-tapa", nombre: "Caja con tapa a presión", material: "PLA", calidad: "Pieza funcional", dias: 2 },
  { handle: "hetna-clip-bolsas", herramienta: "modelos-3d", modelo: "clip-bolsa", nombre: "Clip para bolsas", material: "PLA", calidad: "Pieza funcional", dias: 2 },
]

/** Liga a la herramienta con las medidas del diseño ("Modifica las medidas"). */
export function ligaMedidas(d: Pick<DisenoListo, "herramienta" | "modelo" | "valores">) {
  const q = new URLSearchParams({ modelo: d.modelo })
  for (const [k, v] of Object.entries(d.valores || {})) q.set(k, String(v))
  return `/disenar/${d.herramienta}?${q.toString()}`
}
