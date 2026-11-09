// Estimador para el cliente: el mismo motor del Simulador 2.0 de la app del
// taller (Cotizador/lib/simulador2/motor.dart), pero con los valores de
// referencia de HETNA en vez de los costos de un taller. Da un RANGO, no un
// precio: los talleres mandan su propuesta real por la licitación.
//
//   PRECIO = (material + máquina + operador + preparación + acabado + fijos) ÷ (1 − margen)
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
]

export function materialesPara(servicio: TipoMaquina): MaterialRef[] {
  const grupo = (c: string) =>
    ["pla", "petg", "abs", "tpu", "resina"].includes(c) ? "filamento" : ["aluminio", "acero", "inox"].includes(c) ? "metal" : "tabla"
  return MATERIALES.filter((m) => {
    const g = grupo(m.clave)
    if (servicio === "impresora_3d") return g === "filamento"
    if (servicio === "plasma" || servicio === "laser_fibra") return g === "metal"
    if (servicio === "laser_co2") return g === "tabla" && m.espesor <= 12 && m.clave !== "pvc" && m.clave !== "melamina"
    if (servicio === "router_3d") return g === "tabla" && m.espesor >= 12
    return g === "tabla" || m.clave === "aluminio"
  })
}

// Referencia HETNA por tipo de máquina: $/h, preparación por pedido, seg por perforación
const MAQUINA_REF: Record<TipoMaquina, { costoHora: number; prep: number; perf: number; remocion?: number; impresion?: number }> = {
  router: { costoHora: 350, prep: 15, perf: 2 },
  laser_co2: { costoHora: 320, prep: 8, perf: 0.5 },
  plasma: { costoHora: 480, prep: 10, perf: 1.5 },
  laser_fibra: { costoHora: 950, prep: 8, perf: 0.3 },
  router_3d: { costoHora: 350, prep: 20, perf: 2, remocion: 15 },
  impresora_3d: { costoHora: 60, prep: 5, perf: 0, impresion: 12 },
}
const OPERADOR_HORA = 95
const FIJOS_HORA = 130
const MARGEN = 0.35
const MARKUP_MATERIAL = 0.2
const MANEJO_MIN = 1
const RANGO = 0.15

// Velocidades efectivas de corte (m/min) — mismas tablas que la app
const CORTE: Record<string, Record<string, [number, number][]>> = {
  router: {
    mdf: [[3, 4], [6, 3.5], [9, 3], [12, 2.5], [15, 2.2], [18, 2], [25, 1.4]],
    triplay: [[3, 3.6], [6, 3.2], [9, 2.7], [12, 2.2], [18, 1.8]],
    melamina: [[12, 2.4], [16, 2.0], [18, 1.9]],
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
const REMOCION: Record<string, number> = { mdf: 20, triplay: 18, melamina: 18, acrilico: 8, pvc: 25, espuma: 60, aluminio: 2 }
const IMPRESION: Record<string, number> = { pla: 12, petg: 10, abs: 10, tpu: 5, resina: 20 }

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
}): Estimado {
  const { servicio, pieza, material } = p
  const n = Math.max(1, Math.round(p.cantidad || 1))
  const maq = MAQUINA_REF[servicio]
  const avisos: string[] = []
  let tPieza = 0
  let como = ""

  if (servicio === "impresora_3d") {
    const imp = IMPRESION[material.clave] || maq.impresion || 12
    const factor = Math.min(1, (p.relleno ?? 20) / 100 + 0.25)
    if (pieza.volumenCm3 <= 0) return { ok: false, motivo: "Para impresión 3D necesito un STL u OBJ (o largo, ancho y alto)." }
    tPieza = ((pieza.volumenCm3 * factor) / imp) * 60
    como = `${pieza.volumenCm3.toFixed(1)} cm³ × ${Math.round(factor * 100)} % ÷ ${imp} cm³/h`
  } else if (servicio === "router_3d") {
    const rem = REMOCION[material.clave] || maq.remocion || 15
    const alto = pieza.alto > 0 ? pieza.alto : material.espesor
    const caja = (pieza.largo * pieza.ancho * alto) / 1000
    const quitar = Math.max(0, caja - pieza.volumenCm3)
    const acabado = (pieza.largo * pieza.ancho) / 100 * 0.006
    tPieza = quitar / rem + acabado
    como = `${quitar.toFixed(0)} cm³ a quitar ÷ ${rem} cm³/min + acabado`
    if (pieza.volumenCm3 <= 0) avisos.push("Sin modelo 3D se estima un relieve de profundidad media.")
  } else {
    const tabla = CORTE[servicio]?.[material.clave]
    if (!tabla) return { ok: false, motivo: `${material.nombre} no se corta normalmente con ${SERVICIOS.find((s) => s.clave === servicio)?.nombre}.` }
    const vel = interpolar(tabla, material.espesor)
    const perf = (pieza.perforaciones * maq.perf) / 60
    tPieza = pieza.metrosCorte / vel + perf
    como = `${pieza.metrosCorte.toFixed(2)} m de corte ÷ ${vel.toFixed(2)} m/min${pieza.perforaciones > 0 ? ` + ${pieza.perforaciones} entradas` : ""}`
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
      avisos.push(`La pieza (${Math.round(pieza.largo)}×${Math.round(pieza.ancho)} mm) es más grande que la hoja de ${material.nombre}; el taller la cortará en secciones.`)
      porHoja = 1
    }
    unidades = n / porHoja
    hojas = Math.ceil(unidades)
  }
  const costoMaterial = unidades * material.precio * (1 + material.merma / 100) * (1 + MARKUP_MATERIAL)

  const ac = ACABADOS.find((x) => x.clave === (p.acabado || "")) || ACABADOS[0]
  const areaM2 = (pieza.largo * pieza.ancho) / 1e6
  const tMaquina = tPieza * n
  const tManejo = (MANEJO_MIN + ac.min) * n
  const tTotal = tMaquina + tManejo + maq.prep
  const costoMaquina = (tMaquina / 60) * maq.costoHora
  const costoOperador = ((tMaquina + tManejo) / 60) * OPERADOR_HORA
  const costoPrep = (maq.prep / 60) * (maq.costoHora + OPERADOR_HORA)
  const costoAcabado = ac.pieza * n + ac.m2 * areaM2 * n
  const costoFijos = (tTotal / 60) * FIJOS_HORA
  const costo = costoMaterial + costoMaquina + costoOperador + costoPrep + costoAcabado + costoFijos
  const total = costo / (1 - MARGEN)
  const red = (v: number) => Math.round(v / 5) * 5

  return {
    ok: true,
    precioPieza: total / n,
    total: red(total),
    min: red(total * (1 - RANGO)),
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
