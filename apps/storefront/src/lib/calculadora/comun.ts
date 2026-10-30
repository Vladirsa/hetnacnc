// Calculadora CNC profesional de HETNA: tipos y utilidades comunes.
// Cada proceso (router, láser CO₂, fibra, UV, plasma, impresión 3D) vive en su
// archivo y exporta una o varias `Calculadora`: campos del formulario + la
// función que calcula. La página /calculadora-cnc arma la interfaz a partir de
// esa descripción.
//
// Todos los números de las tablas son PUNTOS DE PARTIDA sacados de rangos
// típicos de fabricantes (fresas, tubos, fuentes, antorchas). Siempre se
// confirman con una prueba en un retazo.

export type Opcion = { v: string; t: string; grupo?: string }
export type Campo = {
  k: string
  etiqueta: string
  tipo: "numero" | "opcion" | "texto"
  unidad?: string
  opciones?: Opcion[]
  req?: boolean
  ayuda?: string
  min?: number
  max?: number
  paso?: number
  // valor inicial
  inicial?: string | number
  // sólo se muestra si otro campo tiene cierto valor
  si?: { k: string; v: string | string[] }
  // agrupa campos en una tarjeta ("Máquina", "Herramienta", "Material"…)
  seccion?: string
  // es parte del perfil de máquina (se guarda con "Mi máquina")
  maquina?: boolean
}
export type Fila = { etiqueta: string; valor: string; nota?: string; destacado?: boolean }
export type Bloque = { titulo: string; filas: Fila[] }
export type Resultado = {
  titulo: string
  bloques: Bloque[]
  avisos: string[] // cosas que pueden salir mal
  consejos: string[] // buenas prácticas para este caso
  faltan: string[]
  supuestos: string[]
  datos: Record<string, number | string>
  // 0–100: qué tan confiable es la recomendación con los datos dados
  confianza: number
}
export type Entrada = Record<string, unknown>
export type Calculadora = {
  id: string
  nombre: string
  proceso: string
  resumen: string
  campos: Campo[]
  calcular: (e: Entrada) => Resultado
}
export type Preset = { id: string; nombre: string; detalle?: string; valores: Record<string, string | number> }

// ---------- utilidades ----------
export const num = (v: unknown): number | undefined => {
  if (v === null || v === undefined || v === "") return undefined
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."))
  return Number.isFinite(n) ? n : undefined
}
export const txt = (v: unknown) => (typeof v === "string" ? v.trim() : v === undefined || v === null ? "" : String(v))
export const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x))
export const r = (x: number, d = 0) => {
  const f = Math.pow(10, d)
  return Math.round(x * f) / f
}
export const fmt = (x: number, d = 0) => r(x, d).toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: d })
export const pesos = (x: number) => "$" + x.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const minutos = (m: number) => {
  if (!Number.isFinite(m) || m <= 0) return "0 min"
  if (m < 1) return `${fmt(m * 60)} s`
  if (m < 60) return `${fmt(m, m < 10 ? 1 : 0)} min`
  const h = Math.floor(m / 60)
  return `${h} h ${fmt(m - h * 60)} min`
}
// interpola en una tabla [[x, y...]] ordenada por x; fuera del rango usa el extremo
export const interp = (tabla: number[][], x: number, col = 1, log = false): number => {
  if (x <= tabla[0][0]) return tabla[0][col]
  const u = tabla[tabla.length - 1]
  if (x >= u[0]) return u[col]
  for (let i = 1; i < tabla.length; i++) {
    const a = tabla[i - 1]
    const b = tabla[i]
    if (x <= b[0]) {
      const t = (x - a[0]) / (b[0] - a[0])
      if (log && a[col] > 0 && b[col] > 0) return Math.exp(Math.log(a[col]) + t * (Math.log(b[col]) - Math.log(a[col])))
      return a[col] + t * (b[col] - a[col])
    }
  }
  return u[col]
}
// la clave numérica más cercana de un diccionario
export const masCercana = (claves: string[], x: number) => {
  const ns = claves.map(Number)
  return String(ns.reduce((m, c) => (Math.abs(c - x) < Math.abs(m - x) ? c : m), ns[0]))
}
export const nuevo = (titulo: string): Resultado => ({ titulo, bloques: [], avisos: [], consejos: [], faltan: [], supuestos: [], datos: {}, confianza: 100 })
export const bloque = (R: Resultado, titulo: string) => {
  const b: Bloque = { titulo, filas: [] }
  R.bloques.push(b)
  return b
}
export const opciones = (o: Record<string, { nombre: string; grupo?: string }>): Opcion[] =>
  Object.entries(o).map(([v, x]) => ({ v, t: x.nombre, grupo: x.grupo }))
