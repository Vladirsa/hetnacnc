// Láser de fibra (1064 nm) y UV (355 nm): marcado, grabado profundo, negro y
// color en metales; marcado de plásticos, vidrio y cerámica con UV; y corte de
// lámina con fuentes de 1 a 12 kW.
// Modelo: puntos de partida por fuente (Q-switch, MOPA, UV), material y efecto,
// con la velocidad escalada por potencia; tiempo por área, relleno (hatch) y
// pasadas. En corte: tablas por kW, gas, presión, boquilla, foco y perforación.

import { type Calculadora, type Campo, type Entrada, type Preset, type Resultado, bloque, clamp, fmt, interp, masCercana, minutos, nuevo, num, opciones, r, txt } from "./comun"

// ---------- fuentes de marcado ----------
export type Fuente = { nombre: string; w: number; tipo: "q" | "mopa" | "uv"; nota?: string }
export const FUENTES: Record<string, Fuente> = {
  q20: { nombre: "Fibra Q-switch 20 W (Raycus, JPT, Max)", w: 20, tipo: "q", nota: "La fuente más común en México: marca, graba y corta lámina muy delgada. Pulso fijo (~100 ns)." },
  q30: { nombre: "Fibra Q-switch 30 W", w: 30, tipo: "q" },
  q50: { nombre: "Fibra Q-switch 50 W", w: 50, tipo: "q", nota: "Grabado profundo y corte de lámina delgada (0.3–0.8 mm) con muchas pasadas." },
  mopa20: { nombre: "Fibra MOPA 20 W (JPT M7)", w: 20, tipo: "mopa", nota: "Pulso ajustable (2–500 ns) y frecuencia hasta 4 MHz: negro y color en inoxidable, blanco en anodizado sin quemar." },
  mopa30: { nombre: "Fibra MOPA 30 W", w: 30, tipo: "mopa" },
  mopa60: { nombre: "Fibra MOPA 60 W", w: 60, tipo: "mopa" },
  mopa100: { nombre: "Fibra MOPA 100 W", w: 100, tipo: "mopa", nota: "Grabado profundo de producción y corte de lámina hasta 1.5 mm." },
  uv3: { nombre: "UV 3 W (355 nm)", w: 3, tipo: "uv", nota: "Marca 'en frío' plásticos, vidrio, silicona, PCB y papel sin quemar; muy fino." },
  uv5: { nombre: "UV 5 W", w: 5, tipo: "uv" },
  uv10: { nombre: "UV 10 W", w: 10, tipo: "uv" },
}
export const PRESETS_FIBRA: Preset[] = Object.entries(FUENTES).map(([id, f]) => ({ id, nombre: f.nombre, valores: { fuente: id } }))

export const LENTES_F: Record<string, { nombre: string; area: string; punto: number; nota: string }> = {
  "110": { nombre: "F-theta 110 × 110 mm", area: "110 × 110", punto: 0.03, nota: "Punto más fino y más energía por punto: el mejor para grabado profundo y detalle." },
  "150": { nombre: "F-theta 150 × 150 mm", area: "150 × 150", punto: 0.04, nota: "La de uso general." },
  "200": { nombre: "F-theta 200 × 200 mm", area: "200 × 200", punto: 0.05, nota: "Área grande; baja un 20% la velocidad respecto a la de 110." },
  "300": { nombre: "F-theta 300 × 300 mm", area: "300 × 300", punto: 0.08, nota: "Para placas grandes; pierde potencia por punto: marca más tenue." },
}

type Param = { v: number; p: number; f: number; pulso?: number; hatch: number; pasadas?: number; desenfoque?: number; nota?: string }
type MatFibra = {
  nombre: string
  grupo: string
  // por efecto, con fuente de 20 W (Q) o 20 W MOPA o 5 W UV según el caso
  marcado?: Param
  negro?: Param & { solo?: "mopa" }
  color?: Param & { solo?: "mopa" }
  blanco?: Param
  profundo?: Param & { mmPorPasada: number }
  uv?: Param
  aviso?: string
}
export const MAT_FIBRA: Record<string, MatFibra> = {
  inox: {
    nombre: "Acero inoxidable", grupo: "Metales",
    marcado: { v: 1000, p: 70, f: 40, hatch: 0.04 },
    negro: { v: 150, p: 60, f: 200, pulso: 200, hatch: 0.02, desenfoque: 0, nota: "Negro profundo por oxidación (recocido): no quita material y queda liso." },
    color: { v: 100, p: 40, f: 300, pulso: 300, hatch: 0.01, nota: "El color sale de una capa de óxido muy fina: varía 5% de potencia o 20 mm/s y cambia de tono. Haz matriz." },
    profundo: { v: 400, p: 100, f: 30, hatch: 0.03, mmPorPasada: 0.004 },
    uv: { v: 300, p: 60, f: 40, hatch: 0.02 },
  },
  acero: {
    nombre: "Acero al carbón / herramienta", grupo: "Metales",
    marcado: { v: 800, p: 80, f: 40, hatch: 0.04 },
    negro: { v: 200, p: 70, f: 100, pulso: 200, hatch: 0.02 },
    profundo: { v: 400, p: 100, f: 30, hatch: 0.03, mmPorPasada: 0.004 },
  },
  aluminio: {
    nombre: "Aluminio natural", grupo: "Metales",
    marcado: { v: 800, p: 80, f: 40, hatch: 0.04, nota: "Marca gris claro; para blanco brillante es mejor anodizado." },
    negro: { v: 100, p: 80, f: 20, hatch: 0.01, desenfoque: 2, pasadas: 3, nota: "El negro en aluminio es difícil: fuera de foco, lento y varias pasadas; queda gris oscuro." },
    profundo: { v: 500, p: 100, f: 30, hatch: 0.03, mmPorPasada: 0.006 },
  },
  anodizado: {
    nombre: "Aluminio anodizado", grupo: "Metales",
    marcado: { v: 2000, p: 35, f: 40, hatch: 0.03 },
    blanco: { v: 2500, p: 30, f: 60, pulso: 50, hatch: 0.02, nota: "Blanco limpio con poca energía; con más potencia se pone gris." },
    aviso: "Marca blanco quitando el anodizado; es de lo más fácil y rápido.",
  },
  laton: {
    nombre: "Latón / bronce", grupo: "Metales",
    marcado: { v: 600, p: 90, f: 30, hatch: 0.03, nota: "Refleja mucho: potencia alta y velocidad baja." },
    profundo: { v: 300, p: 100, f: 20, hatch: 0.03, mmPorPasada: 0.003 },
  },
  cobre: {
    nombre: "Cobre", grupo: "Metales",
    marcado: { v: 400, p: 100, f: 30, hatch: 0.03, nota: "El cobre refleja aún más: con 20 W marca tenue; con MOPA o 50 W mejora." },
    profundo: { v: 250, p: 100, f: 20, hatch: 0.02, mmPorPasada: 0.002 },
  },
  titanio: {
    nombre: "Titanio", grupo: "Metales",
    marcado: { v: 800, p: 70, f: 40, hatch: 0.04 },
    negro: { v: 150, p: 60, f: 200, pulso: 200, hatch: 0.02 },
    color: { v: 150, p: 40, f: 200, pulso: 200, hatch: 0.01, nota: "El titanio da los colores más vivos (azul, dorado, morado) por recocido." },
    profundo: { v: 400, p: 100, f: 30, hatch: 0.03, mmPorPasada: 0.003 },
  },
  oro_plata: {
    nombre: "Oro / plata (joyería)", grupo: "Metales",
    marcado: { v: 500, p: 80, f: 30, hatch: 0.02, nota: "Marca fina; para grabar profundo son 20–40 pasadas. Ventila: el oro no, pero la plata genera óxido fino." },
    profundo: { v: 300, p: 100, f: 20, hatch: 0.02, mmPorPasada: 0.0025 },
  },
  cromado: {
    nombre: "Cromado / niquelado", grupo: "Metales",
    marcado: { v: 1200, p: 50, f: 40, hatch: 0.03, nota: "Quita el cromo y muestra el metal de abajo; no profundices o se pela alrededor." },
  },
  abs: { nombre: "Plástico ABS / PC (oscuro)", grupo: "Plásticos", marcado: { v: 1500, p: 25, f: 30, hatch: 0.04, nota: "Depende del color y aditivos: los oscuros marcan blanco/gris; los claros casi no con fibra (usa UV)." }, uv: { v: 800, p: 40, f: 40, hatch: 0.02 } },
  pp_pe: { nombre: "Polipropileno / polietileno", grupo: "Plásticos", marcado: { v: 1200, p: 30, f: 30, hatch: 0.04, nota: "Con fibra marca poco; con UV queda gris oscuro nítido (botellas, tapas, cables)." }, uv: { v: 600, p: 50, f: 40, hatch: 0.02 } },
  pet: { nombre: "PET / botellas", grupo: "Plásticos", uv: { v: 800, p: 40, f: 40, hatch: 0.02, nota: "Marca en frío sin deformar la botella." } },
  nylon: { nombre: "Nylon / poliamida", grupo: "Plásticos", marcado: { v: 1000, p: 35, f: 30, hatch: 0.04 }, uv: { v: 600, p: 50, f: 40, hatch: 0.02 } },
  silicona: { nombre: "Silicona (teclados, pulseras)", grupo: "Plásticos", uv: { v: 500, p: 60, f: 40, hatch: 0.02, nota: "Sólo UV: la fibra la quema." } },
  piel: { nombre: "Piel", grupo: "Otros", marcado: { v: 1500, p: 20, f: 30, hatch: 0.04, nota: "La fibra marca oscuro y quema un poco; para detalle fino, UV o CO₂." }, uv: { v: 800, p: 40, f: 40, hatch: 0.02 } },
  vidrio: { nombre: "Vidrio", grupo: "Otros", uv: { v: 400, p: 50, f: 40, hatch: 0.02, nota: "La fibra pasa de largo por el vidrio; el UV graba blanco fino sin microfisuras grandes." } },
  ceramica: { nombre: "Cerámica / porcelana", grupo: "Otros", marcado: { v: 500, p: 60, f: 30, hatch: 0.03, nota: "Marca el esmalte en negro/gris con fibra; con UV, más fino." }, uv: { v: 400, p: 50, f: 40, hatch: 0.02 } },
  pcb: { nombre: "PCB / FR4", grupo: "Otros", uv: { v: 600, p: 50, f: 40, hatch: 0.02, nota: "Marca la máscara verde sin dañar el cobre." } },
  papel: { nombre: "Papel / cartón", grupo: "Otros", uv: { v: 1500, p: 30, f: 40, hatch: 0.03, nota: "Marca sin quemar (al contrario del CO₂)." } },
  madera: { nombre: "Madera", grupo: "Otros", marcado: { v: 800, p: 50, f: 30, hatch: 0.04, nota: "La fibra marca madera pero con contraste pobre; para madera es mejor CO₂." } },
}

export const EFECTOS: Record<string, { nombre: string }> = {
  marcado: { nombre: "Marcado (superficial, gris/blanco)" },
  negro: { nombre: "Negro (recocido, sin relieve)" },
  color: { nombre: "Color (inoxidable y titanio)" },
  blanco: { nombre: "Blanco (anodizado)" },
  profundo: { nombre: "Grabado profundo (quitar material)" },
}

const CAMPOS_MARCADO: Campo[] = [
  { k: "fuente", etiqueta: "Fuente", tipo: "opcion", opciones: opciones(FUENTES), inicial: "q20", seccion: "Máquina", maquina: true },
  { k: "lente", etiqueta: "Lente F-theta", tipo: "opcion", opciones: opciones(LENTES_F), inicial: "110", seccion: "Máquina", maquina: true },
  { k: "material", etiqueta: "Material", tipo: "opcion", opciones: opciones(MAT_FIBRA), inicial: "inox", seccion: "Material", req: true },
  { k: "efecto", etiqueta: "Efecto", tipo: "opcion", opciones: opciones(EFECTOS), inicial: "marcado", seccion: "Trabajo" },
  { k: "profundidad", etiqueta: "Profundidad deseada", tipo: "numero", unidad: "mm", inicial: 0.1, seccion: "Trabajo", si: { k: "efecto", v: "profundo" } },
  { k: "area_cm2", etiqueta: "Área a marcar (para el tiempo)", tipo: "numero", unidad: "cm²", seccion: "Trabajo" },
]

export const calcFibraMarcado = (e: Entrada): Resultado => {
  const R = nuevo("Láser de fibra / UV: marcado y grabado")
  const F = FUENTES[txt(e.fuente)] || FUENTES.q20
  const Lz = LENTES_F[txt(e.lente)] || LENTES_F["110"]
  const M = MAT_FIBRA[txt(e.material)] || MAT_FIBRA.inox
  const efecto = txt(e.efecto) || "marcado"
  const fLente = { "110": 1, "150": 0.9, "200": 0.8, "300": 0.6 }[txt(e.lente)] ?? 1
  const b = bloque(R, EFECTOS[efecto]?.nombre || "Marcado")

  let P: Param | undefined
  let base = 20
  if (F.tipo === "uv") {
    P = M.uv
    base = 5
    if (!P) {
      R.avisos.push(`${M.nombre} no es un material típico para UV; el UV destaca en plásticos, vidrio, silicona y PCB. ${M.marcado ? "Para este material usa fibra." : ""}`)
      R.confianza = 40
      P = M.marcado ? { ...M.marcado, v: M.marcado.v * 0.3 } : undefined
      if (!P) return R
    }
    if (efecto === "profundo" || efecto === "color" || efecto === "negro") R.avisos.push("El UV no graba profundo ni hace negro/color en metal: eso es trabajo de fibra (MOPA para color).")
  } else {
    P = (M as unknown as Record<string, Param | undefined>)[efecto]
    if (!P) {
      const disp = Object.keys(EFECTOS).filter((k) => (M as unknown as Record<string, unknown>)[k])
      R.avisos.push(`${M.nombre} no tiene ${EFECTOS[efecto]?.nombre.toLowerCase()} con fibra. Lo que sí: ${disp.map((k) => EFECTOS[k].nombre.split(" (")[0].toLowerCase()).join(", ") || "sólo UV"}.`)
      if (M.uv && !M.marcado) R.avisos.push("Este material se marca con láser UV, no con fibra.")
      R.confianza = 30
      return R
    }
    const solo = (P as { solo?: string }).solo
    if ((efecto === "color" || (efecto === "negro" && M.nombre.startsWith("Acero inox"))) && F.tipo !== "mopa") {
      R.avisos.push(`Para ${efecto === "color" ? "color" : "negro profundo en inoxidable"} necesitas fuente MOPA (pulso y frecuencia ajustables). Con Q-switch sólo sale un gris oscuro: fuera de foco 1–2 mm, 20 kHz, 100% y 100–200 mm/s, 2–3 pasadas.`)
      R.confianza -= 30
      if (solo === "mopa" && efecto === "color") return R
    }
  }
  const esc = Math.pow(F.w / base, 0.8) * fLente
  const v = clamp(P.v * esc, 20, 7000)
  const p = clamp(P.p / Math.pow(Math.max(1, F.w / base), 0.4), 10, 100)
  b.filas.push({ etiqueta: "Velocidad", valor: `${fmt(v)} mm/s`, destacado: true })
  b.filas.push({ etiqueta: "Potencia", valor: `${fmt(p)} %`, destacado: true })
  b.filas.push({ etiqueta: "Frecuencia", valor: `${P.f} kHz` })
  if (F.tipo === "mopa") b.filas.push({ etiqueta: "Ancho de pulso", valor: `${P.pulso ?? 200} ns` })
  b.filas.push({ etiqueta: "Relleno (hatch)", valor: `${fmt(P.hatch, 3)} mm`, nota: efecto === "profundo" ? "alterna 0° / 90° / 45° cada pasada" : "líneas a 0° o cruzado" })
  if (P.desenfoque) b.filas.push({ etiqueta: "Desenfoque", valor: `${P.desenfoque} mm`, nota: "sube la mesa o el foco" })
  else b.filas.push({ etiqueta: "Foco", valor: "exacto (busca el punto donde más chispea)" })
  const pasadas = P.pasadas ?? 1
  let total = pasadas
  if (efecto === "profundo") {
    const prof = num(e.profundidad)
    const mm = (P as { mmPorPasada?: number }).mmPorPasada ?? 0.004
    const porPasada = mm * Math.pow(F.w / 20, 0.9) * fLente
    b.filas.push({ etiqueta: "Profundidad por pasada", valor: `≈ ${fmt(porPasada * 1000, 1)} µm` })
    if (prof) {
      total = Math.ceil(prof / porPasada)
      b.filas.push({ etiqueta: "Pasadas necesarias", valor: fmt(total), nota: `para ${fmt(prof, 2)} mm`, destacado: true })
      if (total > 300) R.avisos.push("Son muchas pasadas: considera una fuente de más potencia (50–100 W) o aceptar menos profundidad.")
    } else R.faltan.push("Profundidad deseada (mm)")
    R.consejos.push("Cada 10–20 pasadas baja el foco lo que llevas grabado y sopla el residuo; si no, el rendimiento cae a la mitad.")
  } else if (pasadas > 1) b.filas.push({ etiqueta: "Pasadas", valor: String(pasadas) })
  const A = num(e.area_cm2)
  if (A && A > 0) {
    const t = (((A * 100) / P.hatch / v) * total * 1.15) / 60
    b.filas.push({ etiqueta: "Tiempo estimado", valor: minutos(t), nota: "incluye saltos del galvo" })
    R.datos.tiempo_min = r(t, 2)
  }
  const b2 = bloque(R, "Tu máquina")
  b2.filas.push({ etiqueta: "Fuente", valor: F.nombre })
  b2.filas.push({ etiqueta: "Lente", valor: Lz.nombre, nota: Lz.nota })
  b2.filas.push({ etiqueta: "Punto", valor: `≈ ${fmt(Lz.punto * 1000)} µm`, nota: P.hatch < Lz.punto * 0.5 ? "el hatch es más fino que el punto: sobrelapa mucho (está bien para negro/color)" : "hatch adecuado" })
  if (P.nota) R.consejos.push(P.nota)
  if (M.aviso) R.consejos.push(M.aviso)
  if (F.nota) R.consejos.push(F.nota)
  R.consejos.push("Haz una matriz de prueba (velocidad × potencia, 5 × 5 cuadros de 5 mm) en un retazo del mismo lote: cada fuente, lente y acabado del metal cambia el resultado.")
  if (M.grupo === "Metales" && efecto !== "profundo") R.consejos.push("Extracción de humos siempre: el marcado de metal genera partículas finas de óxido.")
  R.datos = { ...R.datos, velocidad_mm_s: r(v), potencia_pct: r(p), frecuencia_khz: P.f, hatch_mm: P.hatch, pasadas: total }
  R.confianza = clamp(R.confianza, 20, 100)
  return R
}

export const FIBRA_MARCADO: Calculadora = {
  id: "fibra_marcado",
  nombre: "Fibra y UV: marcado y grabado",
  proceso: "fibra",
  resumen: "Marcado, negro, color, blanco y grabado profundo en metales con fibra Q-switch o MOPA; plásticos, vidrio, silicona y PCB con UV.",
  campos: CAMPOS_MARCADO,
  calcular: calcFibraMarcado,
}

// ---------- corte de lámina con fibra ----------
// [espesor mm, m/min] por potencia (kW)
const CORTE: Record<string, { nombre: string; gas: string; tablas: Record<string, number[][]> }> = {
  acero_dulce: {
    nombre: "Acero al carbón (A36, 1018)", gas: "oxígeno (0.5–0.8 bar); en ≤ 3 mm nitrógeno o aire a 10–14 bar va más rápido y sin óxido",
    tablas: {
      "1": [[1, 10], [2, 5], [3, 3.5], [4, 2.6], [6, 1.5], [8, 1]],
      "1.5": [[1, 14], [2, 6.5], [3, 4.2], [5, 2.2], [6, 1.9], [8, 1.3], [10, 0.9]],
      "2": [[1, 20], [2, 8], [3, 5], [6, 2.2], [8, 1.5], [10, 1.1], [12, 0.9]],
      "3": [[1, 30], [3, 5.5], [6, 2.6], [10, 1.4], [12, 1.1], [16, 0.8], [20, 0.6]],
      "6": [[3, 6], [6, 3], [10, 2], [16, 1.2], [20, 0.9], [25, 0.6]],
      "12": [[3, 7], [6, 3.5], [10, 2.5], [16, 1.6], [20, 1.2], [25, 0.9], [30, 0.6]],
    },
  },
  inoxidable: {
    nombre: "Acero inoxidable (304, 316)", gas: "nitrógeno 12–18 bar (canto limpio, sin oxidar)",
    tablas: {
      "1": [[1, 18], [2, 6], [3, 2.5], [4, 1.2]],
      "1.5": [[1, 22], [2, 9], [3, 4], [5, 1.8]],
      "2": [[1, 25], [2, 12], [3, 6], [5, 2.5], [6, 1.5]],
      "3": [[1, 35], [3, 10], [5, 4], [8, 1.5], [10, 1]],
      "6": [[3, 25], [6, 8], [10, 3], [12, 2], [16, 1]],
      "12": [[3, 40], [6, 15], [10, 6], [16, 2.5], [20, 1.5], [25, 0.8]],
    },
  },
  aluminio: {
    nombre: "Aluminio (5052, 6061)", gas: "nitrógeno 12–18 bar",
    tablas: {
      "1": [[1, 12], [2, 4], [3, 1.5]],
      "1.5": [[1, 16], [2, 6], [3, 2.5], [4, 1.2]],
      "2": [[1, 20], [2, 8], [3, 4], [5, 1.5]],
      "3": [[1, 28], [3, 7], [5, 3], [8, 1.2]],
      "6": [[3, 20], [6, 6], [10, 2], [12, 1.4]],
      "12": [[3, 35], [6, 12], [10, 4.5], [16, 1.8], [20, 1.1]],
    },
  },
  laton: {
    nombre: "Latón / cobre", gas: "nitrógeno 12–18 bar (cobre: cabezal con protección anti-reflejo)",
    tablas: {
      "1": [[1, 8], [2, 2.5]],
      "2": [[1, 15], [2, 5], [3, 2.5]],
      "3": [[1, 20], [3, 4.5], [5, 1.8]],
      "6": [[3, 12], [6, 3.5], [8, 1.8]],
      "12": [[3, 20], [6, 7], [10, 2.5]],
    },
  },
  galvanizado: {
    nombre: "Lámina galvanizada", gas: "nitrógeno o aire 10–14 bar (el oxígeno quema el zinc)",
    tablas: {
      "1": [[1, 9], [2, 4.5], [3, 2.5]],
      "1.5": [[1, 12], [2, 6], [3, 3.5]],
      "2": [[1, 18], [2, 7], [3, 4.5], [4, 2.5]],
      "3": [[1, 25], [3, 5], [5, 2.5], [6, 1.8]],
      "6": [[3, 6], [6, 2.8], [8, 1.8]],
      "12": [[3, 7], [6, 3.5], [10, 2]],
    },
  },
}
export const PRESETS_FIBRA_CORTE: Preset[] = [1, 1.5, 2, 3, 6, 12].map((kw) => ({ id: `kw${kw}`, nombre: `Fuente de ${kw} kW`, valores: { potencia_kw: kw } }))

const CAMPOS_CORTE: Campo[] = [
  { k: "potencia_kw", etiqueta: "Potencia de la fuente", tipo: "numero", unidad: "kW", inicial: 1.5, seccion: "Máquina", maquina: true },
  { k: "material", etiqueta: "Material", tipo: "opcion", opciones: opciones(Object.fromEntries(Object.entries(CORTE).map(([k, v]) => [k, { nombre: v.nombre }]))), inicial: "acero_dulce", seccion: "Material", req: true },
  { k: "espesor", etiqueta: "Espesor", tipo: "numero", unidad: "mm", inicial: 3, seccion: "Material", req: true },
  { k: "longitud_corte", etiqueta: "Largo total de corte", tipo: "numero", unidad: "m", seccion: "Trabajo" },
  { k: "perforaciones", etiqueta: "Perforaciones (contornos)", tipo: "numero", seccion: "Trabajo" },
]

export const calcFibraCorte = (e: Entrada): Resultado => {
  const R = nuevo("Láser de fibra: corte de lámina")
  const M = CORTE[txt(e.material)] || CORTE.acero_dulce
  const kw = num(e.potencia_kw)
  const esp = num(e.espesor)
  if (!kw) R.faltan.push("Potencia de la fuente (kW)")
  if (!esp) R.faltan.push("Espesor de la lámina (mm)")
  if (!kw || !esp) return R
  const c = masCercana(Object.keys(M.tablas), kw)
  if (Number(c) !== kw) R.supuestos.push(`Usé la tabla de ${c} kW (la más cercana a ${kw} kW).`)
  const t = M.tablas[c]
  const max = t[t.length - 1][0]
  const v = esp > max ? t[t.length - 1][1] * Math.pow(max / esp, 2) : interp(t, esp, 1, true)
  const b = bloque(R, "Corte")
  b.filas.push({ etiqueta: "Velocidad de corte", valor: `${fmt(v, 1)} m/min`, nota: `${fmt(v * 1000)} mm/min`, destacado: true })
  b.filas.push({ etiqueta: "Gas de asistencia", valor: M.gas, destacado: true })
  const boquilla = esp <= 2 ? "1.0–1.5 mm simple" : esp <= 6 ? "1.5–2.0 mm" : esp <= 12 ? "2.0–3.0 mm doble" : "3.0–4.0 mm doble"
  b.filas.push({ etiqueta: "Boquilla", valor: boquilla })
  const foco = txt(e.material) === "acero_dulce" ? (esp <= 3 ? "0 a +1 mm (en la superficie)" : `+${fmt(Math.min(esp / 4, 6), 1)} mm (sobre la superficie)`) : `−${fmt(Math.min(esp * 0.6, 8), 1)} mm (dentro del material)`
  b.filas.push({ etiqueta: "Foco", valor: foco })
  b.filas.push({ etiqueta: "Altura de boquilla", valor: esp <= 6 ? "0.8–1.0 mm" : "0.5–0.8 mm" })
  const pierce = esp <= 2 ? 0.2 : esp <= 6 ? 0.5 : esp <= 12 ? 1.2 : esp <= 20 ? 2.5 : 4
  b.filas.push({ etiqueta: "Tiempo de perforación", valor: `≈ ${fmt(pierce, 1)} s`, nota: esp > 6 ? "perforación progresiva (rampa de potencia)" : "perforación directa" })
  b.filas.push({ etiqueta: "Ancho de corte (kerf)", valor: `${fmt(0.1 + esp * 0.02, 2)} mm` })
  if (esp > max) {
    R.avisos.push(`${fmt(esp)} mm pasa del espesor de producción para ${c} kW en ${M.nombre} (≈ ${max} mm): corte lento, con escoria y canto rugoso.`)
    R.confianza -= 30
  }
  const L = num(e.longitud_corte)
  const n = num(e.perforaciones) || 0
  if (L && L > 0) {
    const tm = (L / v) * 1.15 + (n * (pierce + 0.8)) / 60
    b.filas.push({ etiqueta: "Tiempo de corte", valor: minutos(tm), nota: n ? `${n} perforaciones incluidas` : "sin perforaciones" })
    R.datos.tiempo_min = r(tm, 2)
  }
  R.consejos.push("Las tablas de proceso de tu máquina (cabezal, boquilla, gas) mandan: usa esto para cotizar y como punto de partida.")
  if (txt(e.material) === "acero_dulce" && esp >= 10) R.consejos.push("En grueso con oxígeno, lámina sin óxido ni cascarilla; si la placa es de laminado en caliente, baja la velocidad 10–15%.")
  if (txt(e.material) === "aluminio" || txt(e.material) === "laton") R.consejos.push("Metales reflejantes: revisa que tu fuente tenga protección anti-reflejo; nunca cortes espejo pulido.")
  R.datos = { ...R.datos, velocidad_m_min: r(v, 2), perforacion_s: pierce }
  R.confianza = clamp(R.confianza, 20, 100)
  return R
}

export const FIBRA_CORTE: Calculadora = {
  id: "fibra_corte",
  nombre: "Fibra: corte de lámina",
  proceso: "fibra_corte",
  resumen: "Velocidad, gas, boquilla, foco y perforación por kW para acero, inoxidable, aluminio, latón y galvanizado.",
  campos: CAMPOS_CORTE,
  calcular: calcFibraCorte,
}
