// Estimador para el cliente: el mismo motor del Simulador 2.0 de la app del
// taller (Cotizador/lib/simulador2/motor.dart), pero con los valores de
// referencia de HETNA en vez de los costos de un taller. Da un RANGO, no un
// precio: los talleres mandan su propuesta real por la licitación.
//
//   PRECIO = (máquina + operador + preparación + acabado + fijos) ÷ (1 − margen) + material
//   material = costo × (1 + merma) × (1 + recargo al material). El margen NO se
//   vuelve a cobrar sobre el material: ya lleva su recargo (decisión de Vlado,
//   21 nov 2026, tras comparar con precios de talleres en México).
//   tiempo de máquina = metros de corte ÷ velocidad (+ perforaciones), área ÷
//   velocidad de grabado, volumen a quitar ÷ remoción, o volumen ÷ cm³/h.
//
// Corre en el navegador: nada se manda al servidor hasta que el cliente pide
// propuestas.
import type { GeoCad } from "@/lib/cotizador/archivo-cad"

export type TipoMaquina = "router" | "laser_co2" | "plasma" | "laser_fibra" | "router_3d" | "impresora_3d"

export const SERVICIOS: { clave: TipoMaquina; nombre: string; emoji: string; solicitud: string; descripcion: string }[] = [
  { clave: "router", nombre: "Router CNC", emoji: "🪚", solicitud: "Corte CNC", descripcion: "Corte de MDF, triplay, acrílico, PVC, aluminio" },
  { clave: "laser_co2", nombre: "Corte láser", emoji: "🔦", solicitud: "Corte láser", descripcion: "MDF y acrílico delgados, grabado" },
  { clave: "plasma", nombre: "Corte plasma", emoji: "🔥", solicitud: "Corte plasma", descripcion: "Lámina y placa de acero, inoxidable, aluminio" },
  { clave: "laser_fibra", nombre: "Láser de fibra", emoji: "⚡", solicitud: "Corte láser", descripcion: "Lámina metálica con acabado fino" },
  { clave: "router_3d", nombre: "Relieve 3D", emoji: "🗿", solicitud: "Fresado de madera", descripcion: "Tallado de relieves y moldes en madera o espuma" },
  { clave: "impresora_3d", nombre: "Impresión 3D", emoji: "🖨️", solicitud: "Impresión 3D", descripcion: "Piezas en PLA, PETG, ABS, resina" },
]

export type MaterialRef = {
  clave: string // mdf, acrilico…
  nombre: string
  espesor: number // mm (0 = por kg)
  precio: number // MXN por hoja o por kg (referencia 2026)
  unidad: "hoja" | "kg"
  hoja?: [number, number] // mm
  densidad: number // g/cm³
  merma: number // %
}

// Precios de referencia en México (2026, aproximados; los talleres ponen el suyo)
export const MATERIALES: MaterialRef[] = [
  { clave: "mdf", nombre: "MDF 3 mm", espesor: 3, precio: 190, unidad: "hoja", hoja: [1220, 2440], densidad: 0.75, merma: 15 },
  { clave: "mdf", nombre: "MDF 6 mm", espesor: 6, precio: 270, unidad: "hoja", hoja: [1220, 2440], densidad: 0.75, merma: 15 },
  { clave: "mdf", nombre: "MDF 9 mm", espesor: 9, precio: 340, unidad: "hoja", hoja: [1220, 2440], densidad: 0.75, merma: 15 },
  { clave: "mdf", nombre: "MDF 12 mm", espesor: 12, precio: 430, unidad: "hoja", hoja: [1220, 2440], densidad: 0.75, merma: 15 },
  { clave: "mdf", nombre: "MDF 15 mm", espesor: 15, precio: 530, unidad: "hoja", hoja: [1220, 2440], densidad: 0.75, merma: 15 },
  { clave: "mdf", nombre: "MDF 18 mm", espesor: 18, precio: 620, unidad: "hoja", hoja: [1220, 2440], densidad: 0.75, merma: 15 },
  { clave: "triplay", nombre: "Triplay 6 mm", espesor: 6, precio: 420, unidad: "hoja", hoja: [1220, 2440], densidad: 0.6, merma: 15 },
  { clave: "triplay", nombre: "Triplay 12 mm", espesor: 12, precio: 700, unidad: "hoja", hoja: [1220, 2440], densidad: 0.6, merma: 15 },
  { clave: "triplay", nombre: "Triplay 18 mm", espesor: 18, precio: 980, unidad: "hoja", hoja: [1220, 2440], densidad: 0.6, merma: 15 },
  { clave: "melamina", nombre: "Melamina 16 mm", espesor: 16, precio: 760, unidad: "hoja", hoja: [1830, 2440], densidad: 0.68, merma: 12 },
  { clave: "acrilico", nombre: "Acrílico 3 mm", espesor: 3, precio: 1150, unidad: "hoja", hoja: [1220, 1830], densidad: 1.19, merma: 12 },
  { clave: "acrilico", nombre: "Acrílico 6 mm", espesor: 6, precio: 2200, unidad: "hoja", hoja: [1220, 1830], densidad: 1.19, merma: 12 },
  { clave: "acrilico", nombre: "Acrílico 10 mm", espesor: 10, precio: 3600, unidad: "hoja", hoja: [1220, 1830], densidad: 1.19, merma: 12 },
  { clave: "pvc", nombre: "PVC espumado 3 mm", espesor: 3, precio: 720, unidad: "hoja", hoja: [1220, 2440], densidad: 0.55, merma: 12 },
  { clave: "pvc", nombre: "PVC espumado 6 mm", espesor: 6, precio: 1250, unidad: "hoja", hoja: [1220, 2440], densidad: 0.55, merma: 12 },
  { clave: "espuma", nombre: "Espuma de alta densidad 50 mm", espesor: 50, precio: 900, unidad: "hoja", hoja: [1220, 2440], densidad: 0.05, merma: 10 },
  // Maderas sólidas (23 nov 2026): se cotizan por tabla de 1" × 12" × 8'
  // (19 × 300 × 2440 mm = 8 pies tabla). Precio promedio por pie tabla en
  // México: pino #2 $33 (tabla de Home Depot a $265), cedro rojo ~$104
  // ($90–125), parota ~$110 ($103–115), encino americano ~$145. Merma 20 %
  // por nudos y veta. Se cambian en el panel "Precios calculadora".
  { clave: "madera", nombre: "Pino 19 mm (tabla)", espesor: 19, precio: 265, unidad: "hoja", hoja: [300, 2440], densidad: 0.5, merma: 20 },
  { clave: "madera", nombre: "Cedro rojo 19 mm (tabla)", espesor: 19, precio: 830, unidad: "hoja", hoja: [300, 2440], densidad: 0.45, merma: 20 },
  { clave: "madera", nombre: "Parota 19 mm (tabla)", espesor: 19, precio: 880, unidad: "hoja", hoja: [300, 2440], densidad: 0.5, merma: 20 },
  { clave: "madera", nombre: "Encino 19 mm (tabla)", espesor: 19, precio: 1160, unidad: "hoja", hoja: [300, 2440], densidad: 0.75, merma: 20 },
  { clave: "aluminio", nombre: "Aluminio 3 mm", espesor: 3, precio: 95, unidad: "kg", densidad: 2.7, merma: 15 },
  { clave: "aluminio", nombre: "Aluminio 6 mm", espesor: 6, precio: 95, unidad: "kg", densidad: 2.7, merma: 15 },
  { clave: "acero", nombre: "Acero cal. 14 (1.9 mm)", espesor: 1.9, precio: 34, unidad: "kg", densidad: 7.85, merma: 15 },
  { clave: "acero", nombre: "Acero 3 mm (1/8\")", espesor: 3.2, precio: 34, unidad: "kg", densidad: 7.85, merma: 15 },
  { clave: "acero", nombre: "Acero 6 mm (1/4\")", espesor: 6.4, precio: 34, unidad: "kg", densidad: 7.85, merma: 15 },
  { clave: "acero", nombre: "Acero 10 mm (3/8\")", espesor: 9.5, precio: 34, unidad: "kg", densidad: 7.85, merma: 15 },
  { clave: "inox", nombre: "Inoxidable 3 mm", espesor: 3, precio: 110, unidad: "kg", densidad: 7.9, merma: 15 },
  { clave: "pla", nombre: "PLA", espesor: 0, precio: 450, unidad: "kg", densidad: 1.24, merma: 5 },
  { clave: "petg", nombre: "PETG", espesor: 0, precio: 520, unidad: "kg", densidad: 1.27, merma: 5 },
  { clave: "abs", nombre: "ABS / ASA", espesor: 0, precio: 520, unidad: "kg", densidad: 1.04, merma: 5 },
  { clave: "tpu", nombre: "TPU flexible", espesor: 0, precio: 750, unidad: "kg", densidad: 1.21, merma: 5 },
  { clave: "resina", nombre: "Resina (SLA)", espesor: 0, precio: 950, unidad: "kg", densidad: 1.1, merma: 8 },
  // PLA con fibra de carbono: más rígido y mate; desgasta la boquilla (se imprime con boquilla endurecida)
  { clave: "placf", nombre: "PLA-CF (fibra de carbono)", espesor: 0, precio: 850, unidad: "kg", densidad: 1.3, merma: 5 },
]

export function materialesPara(servicio: TipoMaquina): MaterialRef[] {
  const grupo = (c: string) =>
    ["pla", "petg", "abs", "tpu", "resina", "placf"].includes(c) ? "filamento" : ["aluminio", "acero", "inox"].includes(c) ? "metal" : "tabla"
  return MATERIALES.filter((m) => {
    const g = grupo(m.clave)
    if (servicio === "impresora_3d") return g === "filamento"
    if (servicio === "plasma" || servicio === "laser_fibra") return g === "metal"
    if (servicio === "laser_co2") return g === "tabla" && m.espesor <= 12 && m.clave !== "pvc" && m.clave !== "melamina"
    if (servicio === "router_3d") return g === "tabla" && m.espesor >= 12
    return g === "tabla" || m.clave === "aluminio"
  })
}

// Referencia HETNA por tipo de máquina: $/h, preparación por pedido, seg por perforación.
// `desatendida`: la máquina trabaja sola (impresora 3D): el operador y los
// gastos fijos sólo cuentan en la preparación y el manejo, no en las horas de
// impresión. Antes se cobraban operador y fijos durante TODA la impresión y un
// cubo de 10 cm salía en más de $10,000 (revisión de precios, 21 nov 2026).
const MAQUINA_REF: Record<TipoMaquina, { costoHora: number; prep: number; perf: number; remocion?: number; impresion?: number; desatendida?: boolean }> = {
  // Router y láser: promedio de talleres en México (21 nov 2026). Con operador
  // y fijos quedan en ~$480/h el router y ~$10/min el láser, ya con margen.
  router: { costoHora: 130, prep: 15, perf: 2 },
  laser_co2: { costoHora: 220, prep: 8, perf: 0.5 },
  plasma: { costoHora: 480, prep: 10, perf: 1.5 },
  laser_fibra: { costoHora: 950, prep: 8, perf: 0.3 },
  router_3d: { costoHora: 130, prep: 20, perf: 2, remocion: 15 },
  // $/h de impresora: luz, desgaste, boquillas y piezas fallidas
  impresora_3d: { costoHora: 45, prep: 10, perf: 0, impresion: 12, desatendida: true },
}
// Operador CNC: $12,922 al mes ≈ $76/h (Jooble, nov 2026) más ~35 % de IMSS,
// aguinaldo y vacaciones.
const OPERADOR_HORA = 100
const OPERADOR_BASE = OPERADOR_HORA
// Gastos fijos del taller (renta, luz general, software) repartidos por hora
// de trabajo de una máquina. Era 130 $/h: con eso la hora de router o láser
// salía en ~$14–15/min, arriba de lo que cobra un taller en México
// (~$8–13/min). Con 60 queda en ~$12–13/min (21 nov 2026).
// 21 nov 2026: 80 $/h, promedio de un taller chico (renta de 93–150 m² en
// Puebla $18–26 mil al mes, más luz e internet) repartido por hora trabajada.
const FIJOS_HORA = 80
const FIJOS_BASE = FIJOS_HORA
const MARGEN = 0.35
const MARKUP_MATERIAL = 0.2
// Manejo por pieza (sacarla de la hoja, limpiar, revisar), según su tamaño:
// 9 s para un llavero y 1 min de 1,000 cm² en adelante.
const MANEJO_MIN = 1
const MANEJO_MIN_CHICA = 0.15
const manejoPorPieza = (largoMm: number, anchoMm: number) =>
  Math.min(MANEJO_MIN, Math.max(MANEJO_MIN_CHICA, (largoMm * anchoMm) / 100 / 1000))
const RANGO = 0.15
// Pedido mínimo: ningún trabajo sale en menos (sugerencia aprobada por Vlado,
// 21 nov 2026). Se cambia en el panel; 0 = sin mínimo.
const PEDIDO_MINIMO = 150
const MARGEN_BASE = MARGEN
const MARKUP_BASE = MARKUP_MATERIAL
const RANGO_BASE = RANGO

// ── Ajustes del dueño (Panel de HETNA > Precios de la calculadora) ─────────
// Todo lo de arriba son los valores de fábrica. El dueño puede cambiarlos
// desde el panel (tabla hetna_precios_config del API): llegan aquí como `cfg`
// y, lo que no traiga, se queda con el valor de fábrica.
export type ConfigPrecios = {
  maquinas?: Partial<Record<TipoMaquina, { costoHora?: number; prep?: number; velocidadPct?: number }>>
  operadorHora?: number
  fijosHora?: number
  margenPct?: number
  markupMaterialPct?: number
  rangoPct?: number
  /** Pedido mínimo en pesos (sin IVA); 0 = sin mínimo */
  pedidoMinimo?: number
  /** Precio por hoja o por kg, por nombre del material ("MDF 3 mm") */
  preciosMaterial?: Record<string, number>
}

/** Los valores de fábrica, completos (para el formulario del panel). */
export function configDeFabrica() {
  return {
    maquinas: Object.fromEntries(
      (Object.keys(MAQUINA_REF) as TipoMaquina[]).map((k) => [k, { costoHora: MAQUINA_REF[k].costoHora, prep: MAQUINA_REF[k].prep, velocidadPct: 100 }])
    ) as Record<TipoMaquina, { costoHora: number; prep: number; velocidadPct: number }>,
    operadorHora: OPERADOR_HORA,
    fijosHora: FIJOS_HORA,
    margenPct: MARGEN * 100,
    markupMaterialPct: MARKUP_MATERIAL * 100,
    rangoPct: RANGO * 100,
    pedidoMinimo: PEDIDO_MINIMO,
    preciosMaterial: Object.fromEntries(MATERIALES.map((m) => [m.nombre, m.precio])) as Record<string, number>,
  }
}

const entre = (v: unknown, min: number, max: number, def: number) => {
  const n = Number(v)
  return Number.isFinite(n) && n >= min && n <= max ? n : def
}

// Velocidades efectivas de corte (m/min) — mismas tablas que la app
const CORTE: Record<string, Record<string, [number, number][]>> = {
  router: {
    mdf: [[3, 4], [6, 3.5], [9, 3], [12, 2.5], [15, 2.2], [18, 2], [25, 1.4]],
    triplay: [[3, 3.6], [6, 3.2], [9, 2.7], [12, 2.2], [18, 1.8]],
    melamina: [[12, 2.4], [16, 2.0], [18, 1.9]],
    // Madera sólida (23 nov 2026): más lenta que el MDF por la veta y los nudos
    madera: [[12, 2.0], [19, 1.5], [25, 1.2], [38, 0.8]],
    acrilico: [[3, 2.5], [6, 1.5], [10, 1], [12, 0.8]],
    pvc: [[3, 4], [6, 3.5], [10, 2.5]],
    espuma: [[25, 5], [50, 3.5], [100, 2]],
    aluminio: [[1.5, 0.6], [3, 0.4], [6, 0.25]],
  },
  laser_co2: {
    mdf: [[3, 1.2], [6, 0.6], [9, 0.35], [12, 0.2]],
    triplay: [[3, 1], [6, 0.5], [9, 0.3]],
    acrilico: [[3, 0.8], [6, 0.4], [10, 0.2], [12, 0.15]],
  },
  plasma: {
    acero: [[1.5, 3.5], [3, 2.5], [4.8, 1.8], [6, 1.3], [10, 0.8], [12, 0.6]],
    inox: [[1.5, 3], [3, 1.8], [6, 1], [10, 0.6]],
    aluminio: [[1.5, 3.5], [3, 2.5], [6, 1.5], [10, 0.9]],
  },
  laser_fibra: {
    acero: [[1, 10], [2, 6], [3, 4], [5, 2], [6, 1.5], [10, 0.7]],
    inox: [[1, 8], [2, 4], [3, 2.5], [6, 0.9]],
    aluminio: [[1, 6], [2, 3], [3, 2], [6, 0.6]],
  },
}
const REMOCION: Record<string, number> = { mdf: 20, triplay: 18, melamina: 18, madera: 15, acrilico: 8, pvc: 25, espuma: 60, aluminio: 2 }
const IMPRESION: Record<string, number> = { pla: 12, petg: 10, abs: 10, tpu: 5, resina: 20, placf: 10 }

function interpolar(t: [number, number][], e: number) {
  if (e <= t[0][0]) return t[0][1]
  const u = t[t.length - 1]
  if (e >= u[0]) return (u[1] * u[0]) / e
  for (let i = 0; i + 1 < t.length; i++) {
    const [ea, va] = t[i], [eb, vb] = t[i + 1]
    if (e >= ea && e <= eb) return va + ((vb - va) * (e - ea)) / (eb - ea)
  }
  return u[1]
}

export const ACABADOS = [
  { clave: "", nombre: "Sin acabado (como sale de la máquina)", pieza: 0, m2: 0, min: 0 },
  { clave: "lijado", nombre: "Lijado de bordes", pieza: 8, m2: 40, min: 2 },
  { clave: "sellado", nombre: "Sellador / barniz", pieza: 15, m2: 180, min: 4 },
  { clave: "pintura", nombre: "Pintura", pieza: 25, m2: 320, min: 6 },
  { clave: "pulido", nombre: "Pulido (acrílico / metal)", pieza: 20, m2: 150, min: 5 },
]

export type Pieza = {
  nombre: string
  largo: number
  ancho: number
  alto: number
  metrosCorte: number
  perforaciones: number
  volumenCm3: number
  es3D: boolean
}

export function piezaDeGeo(g: GeoCad, nombre: string): Pieza {
  return {
    nombre,
    largo: g.largo,
    ancho: g.ancho,
    alto: g.alto,
    metrosCorte: g.corte_mm / 1000,
    perforaciones: Math.max(1, g.contornos + g.perforaciones),
    volumenCm3: g.volumen_cm3,
    es3D: g.tipo === "3d",
  }
}

export function piezaAMano(largo: number, ancho: number, alto: number, complejidad: "sencillo" | "normal" | "calado", es3D: boolean): Pieza {
  const perim = (2 * (largo + ancho)) / 1000
  const f = complejidad === "sencillo" ? 1 : complejidad === "calado" ? 8 : 2.5
  return {
    nombre: `Pieza ${Math.round(largo)}×${Math.round(ancho)}${alto ? `×${Math.round(alto)}` : ""} mm`,
    largo, ancho, alto,
    metrosCorte: perim * f,
    perforaciones: complejidad === "sencillo" ? 1 : complejidad === "calado" ? 20 : 4,
    volumenCm3: es3D ? (largo * ancho * alto) / 1000 * 0.6 : 0,
    es3D,
  }
}

export type Estimado = {
  ok: true
  precioPieza: number
  total: number
  min: number
  max: number
  tiempoPiezaMin: number
  tiempoTotalMin: number
  hojas: number
  piezasPorHoja: number
  gramos: number
  explicacion: string
  avisos: string[]
} | { ok: false; motivo: string }

export function estimar(p: {
  servicio: TipoMaquina
  pieza: Pieza
  material: MaterialRef
  cantidad: number
  acabado?: string
  relleno?: number
  /** Grabado (texto o logo) en cm²: láser por barrido, router en V */
  grabadoCm2?: number
  /** Ajustes del dueño; lo que falte usa el valor de fábrica */
  cfg?: ConfigPrecios | null
}): Estimado {
  const { servicio, pieza } = p
  const c = p.cfg || {}
  const n = Math.max(1, Math.round(p.cantidad || 1))
  const ajusteMaq = c.maquinas?.[servicio] || {}
  const maq = {
    ...MAQUINA_REF[servicio],
    costoHora: entre(ajusteMaq.costoHora, 0, 100000, MAQUINA_REF[servicio].costoHora),
    prep: entre(ajusteMaq.prep, 0, 600, MAQUINA_REF[servicio].prep),
  }
  // Más rápido que la referencia = menos minutos (100 % = igual)
  const vel = entre(ajusteMaq.velocidadPct, 10, 500, 100) / 100
  const OPERADOR_HORA = entre(c.operadorHora, 0, 10000, OPERADOR_BASE)
  const FIJOS_HORA = entre(c.fijosHora, 0, 10000, FIJOS_BASE)
  const MARGEN = entre(c.margenPct, 0, 80, MARGEN_BASE * 100) / 100
  const MARKUP_MATERIAL = entre(c.markupMaterialPct, 0, 300, MARKUP_BASE * 100) / 100
  const RANGO = entre(c.rangoPct, 0, 50, RANGO_BASE * 100) / 100
  const MINIMO = entre(c.pedidoMinimo, 0, 100000, PEDIDO_MINIMO)
  const material = { ...p.material, precio: entre(c.preciosMaterial?.[p.material.nombre], 0, 1_000_000, p.material.precio) }
  const avisos: string[] = []
  let tPieza = 0
  let como = ""

  if (servicio === "impresora_3d") {
    const imp = IMPRESION[material.clave] || maq.impresion || 12
    const factor = Math.min(1, (p.relleno ?? 20) / 100 + 0.25)
    if (pieza.volumenCm3 <= 0) return { ok: false, motivo: "Para impresión 3D necesito un STL u OBJ (o largo, ancho y alto)." }
    tPieza = ((pieza.volumenCm3 * factor) / (imp * vel)) * 60
    como = `${pieza.volumenCm3.toFixed(1)} cm³ × ${Math.round(factor * 100)} % ÷ ${imp} cm³/h`
  } else if (servicio === "router_3d") {
    const rem = REMOCION[material.clave] || maq.remocion || 15
    const alto = pieza.alto > 0 ? pieza.alto : material.espesor
    const caja = (pieza.largo * pieza.ancho * alto) / 1000
    const quitar = Math.max(0, caja - pieza.volumenCm3)
    const acabado = (pieza.largo * pieza.ancho) / 100 * 0.006
    tPieza = (quitar / rem + acabado) / vel
    como = `${quitar.toFixed(0)} cm³ a quitar ÷ ${rem} cm³/min + acabado`
    if (pieza.volumenCm3 <= 0) avisos.push("Sin modelo 3D se estima un relieve de profundidad media.")
  } else {
    const tabla = CORTE[servicio]?.[material.clave]
    if (!tabla) return { ok: false, motivo: `${material.nombre} no se corta normalmente con ${SERVICIOS.find((s) => s.clave === servicio)?.nombre}.` }
    const velCorte = interpolar(tabla, material.espesor) * vel
    const perf = (pieza.perforaciones * maq.perf) / 60
    tPieza = pieza.metrosCorte / velCorte + perf
    como = `${pieza.metrosCorte.toFixed(2)} m de corte ÷ ${velCorte.toFixed(2)} m/min${pieza.perforaciones > 0 ? ` + ${pieza.perforaciones} entradas` : ""}`
  }

  // Grabado: láser a 190 mm/s con paso de 0.15 mm; router ~6 cm²/min en V
  const grab = Math.max(0, p.grabadoCm2 || 0)
  if (grab > 0) {
    if (servicio === "laser_co2" || servicio === "laser_fibra") {
      const minG = (grab * 100) / (0.15 * 190 * 60)
      tPieza += minG
      como += ` + grabado ${Math.round(grab)} cm² (${minG.toFixed(1)} min)`
    } else if (servicio === "router" || servicio === "router_3d") {
      const minG = grab / 6
      tPieza += minG
      como += ` + grabado ${Math.round(grab)} cm² (${minG.toFixed(1)} min)`
    } else if (servicio === "plasma") {
      avisos.push("El plasma no graba: el texto se haría como calado (corte) o con otro proceso.")
    }
  }

  // Material
  let unidades = 0, gramos = 0, hojas = 0, porHoja = 0
  if (material.unidad === "kg") {
    const alto = servicio === "impresora_3d" ? 0 : pieza.alto > 0 ? pieza.alto : material.espesor
    const vol = servicio === "impresora_3d" ? pieza.volumenCm3 * Math.min(1, (p.relleno ?? 20) / 100 + 0.25) * 1.05 : (pieza.largo * pieza.ancho * alto) / 1000
    gramos = vol * material.densidad * n
    unidades = gramos / 1000
  } else if (material.hoja) {
    const [hl, ha] = material.hoja
    const sep = 6, marg = 10
    const cols = (pl: number) => Math.floor((hl - 2 * marg + sep) / (pl + sep))
    const rows = (pa: number) => Math.floor((ha - 2 * marg + sep) / (pa + sep))
    const a = Math.max(0, cols(pieza.largo)) * Math.max(0, rows(pieza.ancho))
    const b = Math.max(0, cols(pieza.ancho)) * Math.max(0, rows(pieza.largo))
    porHoja = Math.max(a, b)
    if (porHoja <= 0) {
      // Más grande que la hoja o la tabla: se cobra el área que ocupa (en
      // madera sólida el taller pega tablas para hacer el panel)
      const corto = Math.min(pieza.largo, pieza.ancho), largo = Math.max(pieza.largo, pieza.ancho)
      const anchoUtil = Math.min(hl, ha) - 2 * marg, largoUtil = Math.max(hl, ha) - 2 * marg
      if (material.clave === "madera" && largo <= largoUtil) {
        // Tiras del ancho de la tabla, pegadas a lo largo
        const tiras = Math.ceil(corto / anchoUtil)
        const porTabla = Math.max(1, Math.floor((largoUtil + sep) / (largo + sep)))
        porHoja = porTabla / tiras
        avisos.push(`La pieza (${Math.round(pieza.largo)}×${Math.round(pieza.ancho)} mm) es más ancha que una tabla: el taller pega ${tiras} tiras para formar el panel.`)
      } else {
        const porPieza = Math.ceil(((pieza.largo * pieza.ancho) / (hl * ha)) * 1.1)
        avisos.push(`La pieza (${Math.round(pieza.largo)}×${Math.round(pieza.ancho)} mm) es más grande que la ${material.clave === "madera" ? "tabla" : "hoja"} de ${material.nombre}; el taller la hará en secciones.`)
        porHoja = 1 / porPieza
      }
    }
    unidades = n / porHoja
    hojas = Math.ceil(unidades)
  }
  const costoMaterial = unidades * material.precio * (1 + material.merma / 100) * (1 + MARKUP_MATERIAL)

  const ac = ACABADOS.find((x) => x.clave === (p.acabado || "")) || ACABADOS[0]
  const areaM2 = (pieza.largo * pieza.ancho) / 1e6
  const tMaquina = tPieza * n
  const tManejo = (manejoPorPieza(pieza.largo, pieza.ancho) + ac.min) * n
  const tTotal = tMaquina + tManejo + maq.prep
  // Tiempo en que alguien del taller está ocupado con el pedido
  const tAtendido = (maq.desatendida ? 0 : tMaquina) + tManejo + maq.prep
  const costoMaquina = (tMaquina / 60) * maq.costoHora
  const costoOperador = ((tAtendido - maq.prep) / 60) * OPERADOR_HORA
  const costoPrep = (maq.prep / 60) * (maq.costoHora + OPERADOR_HORA)
  const costoAcabado = ac.pieza * n + ac.m2 * areaM2 * n
  const costoFijos = (tAtendido / 60) * FIJOS_HORA
  const costo = costoMaterial + costoMaquina + costoOperador + costoPrep + costoAcabado + costoFijos
  // El margen sobre máquina y trabajo; el material ya trae su merma y recargo.
  const calculado = (costo - costoMaterial) / (1 - MARGEN) + costoMaterial
  const total = Math.max(calculado, MINIMO)
  if (calculado < MINIMO) avisos.push(`Pedido mínimo: $${MINIMO}. Con más piezas aprovechas mejor ese mínimo.`)
  const red = (v: number) => Math.round(v / 5) * 5

  return {
    ok: true,
    precioPieza: total / n,
    total: red(total),
    min: red(Math.max(MINIMO, total * (1 - RANGO))),
    max: red(total * (1 + RANGO)),
    tiempoPiezaMin: tPieza,
    tiempoTotalMin: tTotal,
    hojas,
    piezasPorHoja: porHoja,
    gramos,
    explicacion: como,
    avisos,
  }
}

export const pesos = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 })

// ── Mueble completo (Biblioteca de planos: "Cómpralo hecho") ──────────────
// Varias piezas de varios materiales que salen de hojas ya acomodadas
// (lib/planos/calculo.ts). Mismo motor que estimar(), pero el material se cobra
// por las hojas que diga quien llama (pueden ser fracción, ya con merma) y la
// preparación una vez por material.
export type GrupoMueble = { material: MaterialRef; hojas: number; piezas: { largo: number; ancho: number; cantidad: number }[] }
export type EstimadoMueble = { total: number; min: number; max: number; minutosMaquina: number; minutosTotal: number; costoMaterial: number }

export function estimarMueble(grupos: GrupoMueble[], o: { servicio?: TipoMaquina; acabado?: string; cfg?: ConfigPrecios | null } = {}): EstimadoMueble {
  const servicio = o.servicio || "router"
  const c = o.cfg || {}
  const ajusteMaq = c.maquinas?.[servicio] || {}
  const costoHora = entre(ajusteMaq.costoHora, 0, 100000, MAQUINA_REF[servicio].costoHora)
  const prep = entre(ajusteMaq.prep, 0, 600, MAQUINA_REF[servicio].prep)
  const vel = entre(ajusteMaq.velocidadPct, 10, 500, 100) / 100
  const operador = entre(c.operadorHora, 0, 10000, OPERADOR_BASE)
  const fijos = entre(c.fijosHora, 0, 10000, FIJOS_BASE)
  const margen = entre(c.margenPct, 0, 80, MARGEN_BASE * 100) / 100
  const markup = entre(c.markupMaterialPct, 0, 300, MARKUP_BASE * 100) / 100
  const rango = entre(c.rangoPct, 0, 50, RANGO_BASE * 100) / 100
  const minimo = entre(c.pedidoMinimo, 0, 100000, PEDIDO_MINIMO)
  const ac = ACABADOS.find((x) => x.clave === (o.acabado || "")) || ACABADOS[0]
  let tMaq = 0, tManejo = 0, tPrep = 0, costoMaterial = 0, costoAcabado = 0
  for (const g of grupos) {
    const precio = entre(c.preciosMaterial?.[g.material.nombre], 0, 1_000_000, g.material.precio)
    costoMaterial += g.hojas * precio * (1 + markup)
    const tabla = CORTE[servicio]?.[g.material.clave]
    const velCorte = tabla ? interpolar(tabla, g.material.espesor) * vel : 1
    for (const p of g.piezas) {
      tMaq += ((2 * (p.largo + p.ancho)) / 1000 / velCorte + MAQUINA_REF[servicio].perf / 60) * p.cantidad
      tManejo += (manejoPorPieza(p.largo, p.ancho) + ac.min) * p.cantidad
      costoAcabado += (ac.pieza + (ac.m2 * p.largo * p.ancho) / 1e6) * p.cantidad
    }
    tPrep += prep
  }
  const costoMaquina = (tMaq / 60) * costoHora
  const costoOperador = ((tMaq + tManejo) / 60) * operador
  const costoPrep = (tPrep / 60) * (costoHora + operador)
  const costoFijos = ((tMaq + tManejo + tPrep) / 60) * fijos
  const trabajo = costoMaquina + costoOperador + costoPrep + costoAcabado + costoFijos
  const total = Math.max(trabajo / (1 - margen) + costoMaterial, minimo)
  const red = (v: number) => Math.round(v / 5) * 5
  return { total: red(total), min: red(Math.max(minimo, total * (1 - rango))), max: red(total * (1 + rango)), minutosMaquina: tMaq, minutosTotal: tMaq + tManejo + tPrep, costoMaterial }
}
