// Copiloto IA CNC de HETNA: motor de calculo.
// Todas las cuentas del Copiloto salen de aqui, nunca de la IA. La IA solo decide
// que calculadora usar, con que datos, y explica el resultado.
// Cada calculadora se describe una sola vez (campos + funcion) y de esa descripcion
// salen el formulario de la pagina y la herramienta que usa la IA.
//
// Los valores de las tablas son PUNTOS DE PARTIDA tomados de rangos tipicos de
// fabricantes de herramientas y maquinas. Siempre se confirman con un corte de prueba.

export type Opcion = { v: string; t: string }
export type Campo = {
  k: string
  etiqueta: string
  tipo: "numero" | "opcion"
  unidad?: string
  opciones?: Opcion[]
  req?: boolean
  ayuda?: string
  min?: number
  max?: number
  // valor que se toma del perfil "Mi maquina" si el usuario no lo da
  deMaquina?: keyof Maquina
}
export type Fila = { etiqueta: string; valor: string; nota?: string }
export type Resultado = {
  titulo: string
  filas: Fila[]
  avisos: string[]
  faltan: string[]
  supuestos: string[]
  datos: Record<string, number | string>
}
export type Entrada = Record<string, unknown>
export type Calculo = { id: string; resultado: Resultado }
export type Calculadora = {
  id: string
  nombre: string
  maquina: string
  resumen: string
  ia: string
  campos: Campo[]
  calcular: (e: Entrada) => Resultado
}
export type Maquina = {
  id: string
  nombre: string
  tipo: string
  area?: string
  potencia_kw?: number
  potencia_w?: number
  amperaje?: number
  rpm_min?: number
  rpm_max?: number
  avance_max?: number
  rapido?: number
  controlador?: string
  software?: string
  notas?: string
}

// ---------- utilidades ----------
const num = (v: unknown): number | undefined => {
  if (v === null || v === undefined || v === "") return undefined
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."))
  return Number.isFinite(n) ? n : undefined
}
const txt = (v: unknown) => (typeof v === "string" ? v.trim() : v === undefined || v === null ? "" : String(v))
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x))
const r = (x: number, d = 0) => {
  const f = Math.pow(10, d)
  return Math.round(x * f) / f
}
export const fmt = (x: number, d = 0) =>
  r(x, d).toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: d })
export const pesos = (x: number) =>
  "$" + x.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const minutos = (m: number) => {
  if (!Number.isFinite(m) || m <= 0) return "0 min"
  if (m < 1) return `${fmt(m * 60)} s`
  if (m < 60) return `${fmt(m, m < 10 ? 1 : 0)} min`
  const h = Math.floor(m / 60)
  return `${h} h ${fmt(m - h * 60)} min`
}
// interpola en una tabla [[x, y...]] ordenada por x; fuera del rango usa el extremo
const interp = (tabla: number[][], x: number, col = 1, log = false): number => {
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
const nuevo = (titulo: string): Resultado => ({ titulo, filas: [], avisos: [], faltan: [], supuestos: [], datos: {} })
const opciones = (o: Record<string, { nombre: string }>): Opcion[] => Object.entries(o).map(([v, x]) => ({ v, t: x.nombre }))

// ======================================================================
// 1. ROUTER CNC: velocidades y avances
// ======================================================================
type MatRouter = {
  nombre: string
  cl: number[][] // [diametro mm, carga min, carga max] mm por filo, fresa de carburo
  vc: [number, number] // velocidad de corte m/min
  doc: number // profundidad por pasada en perfil/ranura, en veces el diametro
  u: number // energia especifica J/mm3 (para revisar potencia)
  filos: number // filos recomendados
  entrada: number // velocidad de entrada como fraccion del avance
  nota: string
}
export const MAT_ROUTER: Record<string, MatRouter> = {
  mdf: { nombre: "MDF", cl: [[3, 0.1, 0.15], [6, 0.25, 0.3], [12, 0.45, 0.55]], vc: [300, 900], doc: 1, u: 0.06, filos: 2, entrada: 0.35, nota: "Usa buena extracción de polvo; el polvo de MDF es dañino. Fresa de compresión da bordes limpios arriba y abajo." },
  triplay: { nombre: "Triplay / contrachapado", cl: [[3, 0.08, 0.13], [6, 0.23, 0.28], [12, 0.43, 0.5]], vc: [300, 900], doc: 1, u: 0.06, filos: 2, entrada: 0.35, nota: "Para evitar astillado en las caras usa fresa de compresión o downcut." },
  madera_blanda: { nombre: "Madera blanda (pino, cedro)", cl: [[3, 0.1, 0.15], [6, 0.25, 0.3], [12, 0.45, 0.53]], vc: [300, 900], doc: 1, u: 0.04, filos: 2, entrada: 0.35, nota: "Corta a favor de la veta cuando puedas para mejor acabado." },
  madera_dura: { nombre: "Madera dura (encino, parota, nogal)", cl: [[3, 0.08, 0.13], [6, 0.2, 0.25], [12, 0.4, 0.48]], vc: [300, 800], doc: 0.75, u: 0.08, filos: 2, entrada: 0.3, nota: "Madera dura quema con facilidad si el avance es bajo: no bajes el avance, baja RPM." },
  acrilico: { nombre: "Acrílico (fundido)", cl: [[3, 0.08, 0.1], [6, 0.15, 0.2], [12, 0.25, 0.3]], vc: [150, 350], doc: 0.5, u: 0.1, filos: 1, entrada: 0.3, nota: "Usa fresa de 1 filo (O-flute). Si ves plástico derretido pegado, sube el avance o baja RPM. Aire a presión ayuda a sacar la viruta." },
  pvc_espumado: { nombre: "PVC espumado (Sintra, trovicel)", cl: [[3, 0.08, 0.13], [6, 0.18, 0.25], [12, 0.3, 0.38]], vc: [150, 400], doc: 1, u: 0.05, filos: 1, entrada: 0.35, nota: "Fresa de 1 filo para que la viruta salga y no se funda." },
  hdpe: { nombre: "HDPE / Nylon / UHMW", cl: [[3, 0.08, 0.13], [6, 0.18, 0.25], [12, 0.3, 0.38]], vc: [150, 400], doc: 0.75, u: 0.05, filos: 1, entrada: 0.3, nota: "Plástico que se funde: carga de viruta alta, RPM moderadas y buena evacuación." },
  acm: { nombre: "ACM (aluminio compuesto, Alucobond)", cl: [[3, 0.05, 0.08], [6, 0.1, 0.15], [12, 0.15, 0.2]], vc: [200, 500], doc: 1, u: 0.12, filos: 1, entrada: 0.3, nota: "Para doblar ACM usa fresa en V de 90° o 135° dejando ~0.3–0.5 mm de material." },
  aluminio: { nombre: "Aluminio (6061, 5052)", cl: [[3, 0.025, 0.04], [6, 0.05, 0.08], [12, 0.08, 0.12]], vc: [150, 400], doc: 0.2, u: 0.7, filos: 1, entrada: 0.2, nota: "Fresa de 1 filo pulida para aluminio, lubricación (alcohol, niebla o WD-40) y aire para sacar viruta. Entrada en rampa, nunca vertical." },
  laton: { nombre: "Latón", cl: [[3, 0.02, 0.03], [6, 0.04, 0.06], [12, 0.06, 0.09]], vc: [100, 250], doc: 0.15, u: 1.2, filos: 2, entrada: 0.2, nota: "El latón se corta limpio; usa fresa de 2 filos sin recubrimiento de filo agresivo." },
  acero_dulce: { nombre: "Acero dulce", cl: [[3, 0.01, 0.02], [6, 0.02, 0.04], [12, 0.04, 0.06]], vc: [60, 120], doc: 0.05, u: 2.5, filos: 4, entrada: 0.15, nota: "Un router de madera normalmente NO tiene la rigidez para acero. Es para máquinas rígidas (fresadora) con refrigerante." },
  espuma: { nombre: "Espuma / foam de modelado", cl: [[3, 0.15, 0.25], [6, 0.3, 0.5], [12, 0.5, 0.8]], vc: [300, 1000], doc: 2, u: 0.005, filos: 2, entrada: 0.5, nota: "Puedes cortar profundo y rápido; el límite suele ser el avance máximo de la máquina." },
}

const TIPOS_FRESA: Opcion[] = [
  { v: "recta", t: "Recta" },
  { v: "upcut", t: "Espiral ascendente (upcut)" },
  { v: "downcut", t: "Espiral descendente (downcut)" },
  { v: "compresion", t: "Compresión" },
  { v: "un_filo", t: "Un filo / O-flute" },
  { v: "bola", t: "Punta bola (3D)" },
  { v: "v", t: "Punta en V (grabado)" },
  { v: "planeadora", t: "Planeadora (surfacing)" },
]
const OPERACIONES: Opcion[] = [
  { v: "perfil", t: "Corte de perfil (atravesar)" },
  { v: "cajeado", t: "Cajeado / desbaste" },
  { v: "acabado", t: "Acabado 3D" },
  { v: "grabado_v", t: "Grabado en V" },
  { v: "planeado", t: "Planeado de cama o pieza" },
]

export const calcRouter = (e: Entrada): Resultado => {
  const R = nuevo("Router CNC: velocidades y avances")
  const matK = txt(e.material) || "mdf"
  const M = MAT_ROUTER[matK] || MAT_ROUTER.mdf
  if (!MAT_ROUTER[matK]) R.supuestos.push(`No conozco el material "${matK}"; usé valores de MDF.`)
  const D = num(e.diametro)
  if (!D || D <= 0) {
    R.faltan.push("Diámetro de la fresa (mm)")
    return R
  }
  let Z = num(e.filos)
  if (!Z) {
    Z = M.filos
    R.supuestos.push(`Filos: supuse ${Z} (lo recomendado para ${M.nombre}).`)
    R.faltan.push("Número de filos de la fresa")
  }
  Z = clamp(Math.round(Z), 1, 8)
  const tipo = txt(e.tipo_fresa) || (M.filos === 1 ? "un_filo" : "upcut")
  if (!txt(e.tipo_fresa)) R.faltan.push("Tipo de fresa (upcut, downcut, compresión, 1 filo, bola, V)")
  const op = txt(e.operacion) || "perfil"
  let rpmMax = num(e.rpm_max)
  if (!rpmMax) {
    rpmMax = 24000
    R.supuestos.push("RPM máximas del spindle: supuse 24,000.")
    R.faltan.push("RPM máximas de tu spindle")
  }
  let rpmMin = num(e.rpm_min)
  if (!rpmMin) {
    rpmMin = Math.min(6000, rpmMax * 0.25)
    R.supuestos.push(`RPM mínimas: supuse ${fmt(rpmMin)}.`)
  }
  const P = num(e.potencia_kw)
  if (!P) R.faltan.push("Potencia del spindle (kW) para revisar que no se sobrecargue")
  let avMax = num(e.avance_max)
  if (!avMax) {
    avMax = 6000
    R.faltan.push("Avance máximo de corte de tu máquina (mm/min)")
    R.supuestos.push("Avance máximo de la máquina: supuse 6,000 mm/min (router tipo 1325/6090).")
  }
  const prof = num(e.profundidad_total)
  if (!prof && (op === "perfil" || op === "cajeado")) R.faltan.push("Profundidad total o espesor del material (mm)")

  // carga de viruta por filo
  let clMin = interp(M.cl, D, 1)
  let clMax = interp(M.cl, D, 2)
  if (D < M.cl[0][0]) {
    clMin = (M.cl[0][1] * D) / M.cl[0][0]
    clMax = (M.cl[0][2] * D) / M.cl[0][0]
  }
  let factor = 1
  if (op === "acabado") factor *= 0.8
  if (op === "grabado_v") factor *= 0.5
  if (op === "planeado") factor *= 0.8
  if (tipo === "bola") factor *= 0.8
  if (tipo === "v") factor *= 0.5
  if (Z >= 3 && M.u < 0.5) factor *= 0.85 // mas filos en madera: menos espacio para viruta
  clMin *= factor
  clMax *= factor
  const cl = (clMin + clMax) / 2

  // RPM segun velocidad de corte, limitada por el spindle
  const vcMedia = (M.vc[0] + M.vc[1]) / 2
  const rpmIdeal = (vcMedia * 1000) / (Math.PI * D)
  let rpm = clamp(rpmIdeal, rpmMin, rpmMax)
  let avance = rpm * Z * cl
  if (avMax && avance > avMax) {
    const rpm2 = avMax / (Z * cl)
    if (rpm2 >= rpmMin) {
      rpm = rpm2
      avance = avMax
      R.avisos.push(`Tu máquina llega a ${fmt(avMax)} mm/min: bajé las RPM a ${fmt(rpm, 0)} para mantener la carga de viruta y no quemar.`)
    } else {
      rpm = rpmMin
      avance = avMax
      const clReal = avance / (rpm * Z)
      R.avisos.push(`Aun a ${fmt(rpmMin)} RPM la máquina no llega al avance ideal: la carga de viruta queda en ${fmt(clReal, 3)} mm (recomendado ${fmt(clMin, 3)}–${fmt(clMax, 3)}). Puede calentar la fresa; considera una fresa de menos filos.`)
    }
  }
  const vcReal = (Math.PI * D * rpm) / 1000
  if (vcReal > M.vc[1] * 1.3) R.avisos.push(`La velocidad de corte (${fmt(vcReal)} m/min) está alta para ${M.nombre}. Si la fresa se calienta, baja RPM y conserva la carga de viruta.`)

  // profundidad por pasada y ancho de corte
  let doc = D * M.doc
  let ae = D
  if (op === "cajeado") { ae = D * 0.4; doc = D * M.doc }
  if (op === "acabado") { ae = D * (tipo === "bola" ? 0.1 : 0.3); doc = Math.min(doc, D * 0.2) }
  if (op === "planeado") { ae = D * 0.7; doc = Math.min(1, D * 0.05) }
  if (op === "grabado_v") { ae = D * 0.5; doc = num(e.profundidad_total) || D * 0.3 }
  if (tipo === "downcut" && op === "perfil" && M.u < 0.5) {
    doc = Math.min(doc, D * 0.5)
    R.avisos.push("Downcut empuja la viruta hacia abajo: por eso bajé la profundidad por pasada a la mitad del diámetro.")
  }
  if (tipo === "compresion" && op === "perfil") {
    R.avisos.push("Con fresa de compresión la primera pasada debe ser más profunda que la parte ascendente de la fresa (normalmente más de 3–5 mm) para que las dos caras queden limpias.")
  }

  // potencia: reduce la profundidad si el spindle no alcanza
  let potW = ((ae * doc * avance) / 60) * M.u
  let potDisp: number | undefined
  if (P) {
    // los spindles chinos de aire/agua dan la potencia nominal a sus RPM maximas; abajo es proporcional
    potDisp = P * 1000 * Math.min(1, rpm / rpmMax)
    if (potW > potDisp * 0.8) {
      const f = (potDisp * 0.8) / potW
      doc = doc * f
      potW = potW * f
      R.avisos.push(`Con la profundidad normal el spindle pasaría del 80% de su potencia a ${fmt(rpm)} RPM; la bajé a ${fmt(doc, 2)} mm por pasada.`)
    }
  }

  rpm = Math.round(rpm / 100) * 100
  avance = Math.round(avance / 10) * 10
  const entrada = Math.round((avance * M.entrada) / 10) * 10
  let pasadas = 0
  if (prof && op !== "grabado_v" && op !== "acabado") pasadas = Math.max(1, Math.ceil(prof / doc - 1e-9))
  const docReal = pasadas ? (prof as number) / pasadas : doc
  const mrr = (ae * docReal * avance) / 1000

  R.filas.push({ etiqueta: "RPM", valor: fmt(rpm, 0) })
  R.filas.push({ etiqueta: "Avance", valor: `${fmt(avance, 0)} mm/min`, nota: `rango ${fmt(rpm * Z * clMin)}–${fmt(rpm * Z * clMax)}` })
  R.filas.push({ etiqueta: "Velocidad de entrada (plunge)", valor: `${fmt(entrada, 0)} mm/min`, nota: M.u > 0.5 ? "entra en rampa" : undefined })
  R.filas.push({ etiqueta: "Carga de viruta por filo", valor: `${fmt(cl, 3)} mm`, nota: `recomendado ${fmt(clMin, 3)}–${fmt(clMax, 3)}` })
  if (pasadas) {
    R.filas.push({ etiqueta: "Profundidad por pasada", valor: `${fmt(docReal, 2)} mm` })
    R.filas.push({ etiqueta: "Número de pasadas", valor: String(pasadas), nota: `para ${fmt(prof as number, 1)} mm` })
  } else {
    R.filas.push({ etiqueta: "Profundidad por pasada (máx.)", valor: `${fmt(doc, 2)} mm` })
  }
  if (op === "cajeado" || op === "acabado" || op === "planeado") R.filas.push({ etiqueta: "Paso lateral (stepover)", valor: `${fmt(ae, 2)} mm`, nota: `${fmt((ae / D) * 100)}% del diámetro` })
  R.filas.push({ etiqueta: "Velocidad de corte", valor: `${fmt(vcReal, 0)} m/min` })
  R.filas.push({ etiqueta: "Material removido", valor: `${fmt(mrr, 1)} cm³/min` })
  if (potDisp) R.filas.push({ etiqueta: "Potencia estimada", valor: `${fmt(potW / 1000, 2)} kW`, nota: `${fmt((potW / potDisp) * 100)}% de lo disponible a esas RPM` })
  else R.filas.push({ etiqueta: "Potencia estimada", valor: `${fmt(potW / 1000, 2)} kW` })

  const L = num(e.longitud_corte)
  if (L && L > 0) {
    const t = ((L * 1000 * Math.max(1, pasadas)) / avance) * 1.15
    R.filas.push({ etiqueta: "Tiempo de corte estimado", valor: minutos(t), nota: "incluye 15% por aceleraciones" })
    R.datos.tiempo_min = r(t, 2)
  }
  if (M.nota) R.avisos.push(M.nota)
  if (M.filos === 1 && Z > 2) R.avisos.push(`Para ${M.nombre} conviene fresa de 1 filo: con ${Z} filos la viruta no alcanza a salir y el material se funde o se pega.`)
  R.datos = { ...R.datos, rpm: r(rpm), avance: r(avance), entrada: r(entrada), carga_viruta: r(cl, 3), profundidad_pasada: r(docReal, 2), pasadas, material: M.nombre }
  return R
}

// Revisa parametros que el usuario ya esta usando (diagnostico)
export const calcRevisar = (e: Entrada): Resultado => {
  const R = nuevo("Revisión de parámetros de router")
  const M = MAT_ROUTER[txt(e.material)] || MAT_ROUTER.mdf
  const D = num(e.diametro)
  const Z = num(e.filos)
  const rpm = num(e.rpm)
  const av = num(e.avance)
  if (!D) R.faltan.push("Diámetro de la fresa (mm)")
  if (!Z) R.faltan.push("Número de filos")
  if (!rpm) R.faltan.push("RPM que estás usando")
  if (!av) R.faltan.push("Avance que estás usando (mm/min)")
  if (!D || !Z || !rpm || !av) return R
  const cl = av / (rpm * Z)
  let clMin = interp(M.cl, D, 1)
  let clMax = interp(M.cl, D, 2)
  if (D < M.cl[0][0]) {
    clMin = (M.cl[0][1] * D) / M.cl[0][0]
    clMax = (M.cl[0][2] * D) / M.cl[0][0]
  }
  const vc = (Math.PI * D * rpm) / 1000
  R.filas.push({ etiqueta: "Carga de viruta actual", valor: `${fmt(cl, 3)} mm/filo`, nota: `recomendado ${fmt(clMin, 3)}–${fmt(clMax, 3)}` })
  R.filas.push({ etiqueta: "Velocidad de corte", valor: `${fmt(vc)} m/min`, nota: `típico ${M.vc[0]}–${M.vc[1]}` })
  let diag = "Dentro de rango"
  if (cl < clMin * 0.6) {
    diag = "Muy baja: la fresa roza en lugar de cortar"
    R.avisos.push("Carga de viruta muy baja: la fresa frota, se calienta, quema la madera o funde el plástico y se desafila rápido. Sube el avance o baja las RPM.")
  } else if (cl < clMin) {
    diag = "Algo baja"
    R.avisos.push("Carga de viruta un poco baja: si ves quemado o fundido, sube el avance o baja RPM.")
  } else if (cl > clMax * 1.5) {
    diag = "Muy alta: riesgo de romper la fresa"
    R.avisos.push("Carga de viruta muy alta para ese diámetro: riesgo de romper la fresa, vibración y mal acabado. Baja el avance o la profundidad.")
  } else if (cl > clMax) {
    diag = "Algo alta"
    R.avisos.push("Carga de viruta algo alta: vigila vibración y ruido; baja un poco el avance si el acabado sale mal.")
  }
  R.filas.unshift({ etiqueta: "Diagnóstico", valor: diag })
  const clObj = (clMin + clMax) / 2
  R.filas.push({ etiqueta: "Avance sugerido a tus RPM", valor: `${fmt(rpm * Z * clObj)} mm/min` })
  const rpmSug = av / (Z * clObj)
  R.filas.push({ etiqueta: "RPM sugeridas a tu avance", valor: rpmSug < 6000 ? "menos de 6,000: mejor sube el avance" : fmt(rpmSug) })
  R.datos = { carga_viruta: r(cl, 4), recomendado_min: r(clMin, 3), recomendado_max: r(clMax, 3), diagnostico: diag }
  return R
}

// ======================================================================
// 2. LASER CO2
// ======================================================================
type MatLaser = { nombre: string; corte?: number[][]; grabado: [number, number, number, number]; aviso?: string; prohibido?: boolean }
// corte: [espesor mm, velocidad mm/s con tubo de 100 W]
// grabado: [vel min, vel max mm/s, potencia min %, potencia max %]
export const MAT_LASER: Record<string, MatLaser> = {
  mdf: { nombre: "MDF", corte: [[3, 20], [6, 8], [9, 4], [12, 2.5], [15, 1.5], [18, 0.9]], grabado: [250, 450, 15, 30] },
  triplay: { nombre: "Triplay / contrachapado", corte: [[3, 22], [6, 10], [9, 5], [12, 3]], grabado: [250, 450, 15, 30], aviso: "El pegamento del triplay varía: algunos lotes no cortan parejo. Haz una prueba en una esquina." },
  madera: { nombre: "Madera natural (balsa, pino)", corte: [[2, 30], [3, 20], [6, 9], [10, 4]], grabado: [250, 450, 15, 30] },
  acrilico: { nombre: "Acrílico fundido", corte: [[2, 28], [3, 20], [5, 12], [6, 10], [8, 6], [10, 4], [15, 2], [20, 1]], grabado: [300, 500, 20, 35], aviso: "Para canto pulido brillante usa acrílico fundido (cast); el extruido corta pero graba feo." },
  carton: { nombre: "Cartón / cartulina", corte: [[1, 60], [3, 35], [5, 20]], grabado: [400, 600, 10, 20], aviso: "Vigila la flama: el cartón prende fácil. Nunca dejes la máquina sola." },
  piel: { nombre: "Piel natural", corte: [[1, 40], [2, 25], [3, 15], [4, 10]], grabado: [300, 500, 15, 30], aviso: "Solo piel curtida vegetal o natural; la sintética puede ser PVC." },
  tela: { nombre: "Tela (algodón, fieltro)", corte: [[0.5, 100], [1, 70], [3, 30]], grabado: [400, 600, 10, 20] },
  papel: { nombre: "Papel", corte: [[0.2, 150], [0.5, 100]], grabado: [500, 800, 8, 15] },
  hule: { nombre: "Hule para sellos (láser)", corte: [[2, 15], [3, 10]], grabado: [200, 350, 40, 70], aviso: "Usa hule especial para láser (sin cloro)." },
  vidrio: { nombre: "Vidrio (solo grabado)", grabado: [200, 350, 20, 35], aviso: "El vidrio no se corta con CO₂. Para grabar, humedece un papel o usa jabón encima para evitar astillas." },
  anodizado: { nombre: "Aluminio anodizado (solo grabado)", grabado: [300, 500, 20, 40], aviso: "El CO₂ solo quita el anodizado; no marca metal desnudo (eso es láser de fibra)." },
  pvc: { nombre: "PVC o vinil", prohibido: true, grabado: [0, 0, 0, 0], aviso: "NO LO CORTES CON LÁSER: el PVC y el vinil sueltan cloro (gas tóxico y corrosivo) que daña tus pulmones, la óptica y la máquina." },
  policarbonato: { nombre: "Policarbonato", corte: [[1, 15], [2, 8]], grabado: [300, 500, 15, 25], aviso: "El policarbonato corta mal con CO₂: se amarillea, hace flama y deja el canto negro. Mejor router." },
}

export const calcLaser = (e: Entrada): Resultado => {
  const R = nuevo("Láser CO₂: velocidad y potencia")
  const k = txt(e.material) || "mdf"
  const M = MAT_LASER[k] || MAT_LASER.mdf
  let W = num(e.potencia_w)
  if (!W) {
    W = 80
    R.faltan.push("Potencia del tubo (W)")
    R.supuestos.push("Tubo de 80 W supuesto.")
  }
  const op = txt(e.operacion) || "corte"
  if (M.prohibido) {
    R.avisos.push(M.aviso || "Material no apto para láser.")
    R.filas.push({ etiqueta: "Resultado", valor: "No apto para láser" })
    return R
  }
  if (op === "corte") {
    if (!M.corte) {
      R.avisos.push(M.aviso || "Este material no se corta con láser CO₂.")
      R.filas.push({ etiqueta: "Corte", valor: "No se corta con CO₂" })
      return R
    }
    const esp = num(e.espesor)
    if (!esp) {
      R.faltan.push("Espesor del material (mm)")
      return R
    }
    const escala = W / 100
    const espMax = M.corte[M.corte.length - 1][0] * Math.pow(escala, 0.8)
    let v = interp(M.corte, esp, 1, true) * escala
    if (esp > M.corte[M.corte.length - 1][0]) {
      const u = M.corte[M.corte.length - 1]
      v = u[1] * Math.pow(u[0] / esp, 2) * escala
    }
    const pot = W >= 100 ? [75, 85] : [80, 90]
    R.filas.push({ etiqueta: "Velocidad de corte", valor: `${fmt(v, 1)} mm/s`, nota: `${fmt(v * 60)} mm/min` })
    R.filas.push({ etiqueta: "Potencia", valor: `${pot[0]}–${pot[1]} %`, nota: "no uses el tubo al 100%, se acorta su vida" })
    R.filas.push({ etiqueta: "Pasadas", valor: esp > espMax * 0.8 ? "2 (más lento no siempre corta mejor)" : "1" })
    R.filas.push({ etiqueta: "Enfoque", valor: esp >= 6 ? `a ${fmt(esp / 2, 1)} mm dentro del material` : "en la superficie" })
    R.filas.push({ etiqueta: "Aire (air assist)", valor: "encendido, fuerte en corte" })
    R.filas.push({ etiqueta: "Ancho de corte (kerf)", valor: `${fmt(0.1 + esp * 0.015, 2)} mm aprox.` })
    if (esp > espMax) R.avisos.push(`${fmt(esp, 1)} mm está por encima de lo que un tubo de ${fmt(W)} W corta bien en ${M.nombre} (≈ ${fmt(espMax, 1)} mm). Espera canto quemado o que no atraviese; considera router.`)
    const L = num(e.longitud_corte)
    if (L && L > 0) {
      const t = ((L * 1000) / v / 60) * 1.2 * (esp > espMax * 0.8 ? 2 : 1)
      R.filas.push({ etiqueta: "Tiempo de corte", valor: minutos(t), nota: "incluye 20% por movimientos" })
      R.datos.tiempo_min = r(t, 2)
    }
    R.datos = { ...R.datos, velocidad_mm_s: r(v, 1), potencia_pct: `${pot[0]}-${pot[1]}` }
  } else {
    const g = M.grabado
    const f = Math.pow(80 / W, 0.7) // mas potencia -> menos porcentaje
    const pmin = clamp(g[2] * f, 5, 90)
    const pmax = clamp(g[3] * f, 8, 95)
    const v = (g[0] + g[1]) / 2
    const intervalo = 0.1
    R.filas.push({ etiqueta: "Velocidad de grabado", valor: `${g[0]}–${g[1]} mm/s` })
    R.filas.push({ etiqueta: "Potencia", valor: `${fmt(pmin)}–${fmt(pmax)} %` })
    R.filas.push({ etiqueta: "Intervalo de línea", valor: "0.08–0.10 mm", nota: "≈ 250–320 DPI" })
    R.filas.push({ etiqueta: "Aire", valor: "bajo en grabado" })
    const A = num(e.area_cm2)
    if (A && A > 0) {
      const t = (((A * 100) / intervalo / v) * 1.25) / 60
      R.filas.push({ etiqueta: "Tiempo de grabado", valor: minutos(t), nota: "raster, incluye sobrerecorrido" })
      R.datos.tiempo_min = r(t, 2)
    } else R.faltan.push("Área a grabar (cm²) para estimar el tiempo")
    R.datos = { ...R.datos, velocidad_mm_s: v, potencia_pct: `${fmt(pmin)}-${fmt(pmax)}` }
  }
  if (M.aviso) R.avisos.push(M.aviso)
  R.avisos.push("Haz una prueba en un retazo: la potencia real de cada tubo cambia con la edad, el enfoque y la limpieza de espejos.")
  return R
}

// ======================================================================
// 3. PLASMA (aire)
// ======================================================================
// [espesor mm, velocidad mm/min] en acero dulce, antorchas de aire tipicas
const PLASMA: Record<string, number[][]> = {
  "30": [[1.5, 5000], [3, 2000], [6, 600], [8, 350]],
  "45": [[1.5, 8000], [3, 5500], [6, 2200], [10, 900], [12, 600], [16, 350]],
  "65": [[3, 8000], [6, 3600], [10, 1900], [12, 1400], [16, 900], [20, 600], [25, 300]],
  "85": [[3, 9000], [6, 5000], [10, 2800], [12, 2100], [16, 1400], [20, 1000], [25, 600], [32, 380]],
  "105": [[6, 6000], [10, 3500], [12, 2800], [16, 1900], [20, 1400], [25, 900], [32, 550], [38, 380]],
}
export const MAT_PLASMA: Record<string, { nombre: string; vel: number; esp: number }> = {
  acero_dulce: { nombre: "Acero dulce / al carbón", vel: 1, esp: 1 },
  inoxidable: { nombre: "Acero inoxidable", vel: 0.75, esp: 0.8 },
  aluminio: { nombre: "Aluminio", vel: 1.1, esp: 0.8 },
}

export const calcPlasma = (e: Entrada): Resultado => {
  const R = nuevo("Plasma CNC: velocidad y altura")
  const Mk = txt(e.material) || "acero_dulce"
  const M = MAT_PLASMA[Mk] || MAT_PLASMA.acero_dulce
  const A = num(e.amperaje)
  const esp = num(e.espesor)
  if (!A) R.faltan.push("Amperaje de tu fuente (A)")
  if (!esp) R.faltan.push("Espesor de la lámina (mm)")
  if (!A || !esp) return R
  const claves = Object.keys(PLASMA).map(Number).sort((a, b) => a - b)
  const clave = String(claves.reduce((m, c) => (Math.abs(c - A) < Math.abs(m - A) ? c : m), claves[0]))
  const tabla = PLASMA[clave]
  if (Number(clave) !== A) R.supuestos.push(`Usé la tabla de ${clave} A (la más cercana a ${A} A).`)
  const espEq = esp / M.esp
  const maxCalidad = tabla[tabla.length - 1][0] * M.esp
  let v = interp(tabla, espEq, 1, true) * M.vel
  if (espEq > tabla[tabla.length - 1][0]) {
    const u = tabla[tabla.length - 1]
    v = u[1] * Math.pow(u[0] / espEq, 1.5) * M.vel
  }
  const retardo = esp <= 3 ? 0.1 : esp <= 6 ? 0.3 : esp <= 10 ? 0.5 : esp <= 16 ? 0.8 : 1.2
  R.filas.push({ etiqueta: "Velocidad de corte", valor: `${fmt(v, 0)} mm/min`, nota: "ajusta ±15% según la escoria" })
  R.filas.push({ etiqueta: "Altura de corte", valor: "1.5 mm", nota: "la de tu antorcha manda" })
  R.filas.push({ etiqueta: "Altura de perforación", valor: "3.8 mm", nota: "≈ 2.5 veces la de corte" })
  R.filas.push({ etiqueta: "Retardo de perforación", valor: `${fmt(retardo, 1)} s` })
  R.filas.push({ etiqueta: "Ancho de corte (kerf)", valor: `${fmt(1.2 + esp * 0.05, 1)} mm aprox.`, nota: "compensa en el CAM" })
  if (esp > maxCalidad) R.avisos.push(`${fmt(esp)} mm pasa del espesor de corte de calidad para ${clave} A en ${M.nombre} (≈ ${fmt(maxCalidad)} mm): será corte de separación, con más escoria y bisel. Empieza fuera de la pieza, no perfores.`)
  if (esp > maxCalidad * 0.5) R.avisos.push("Espesor grueso: arranca desde el borde o perfora en zona de desperdicio; perforar grueso gasta rápido los consumibles.")
  const L = num(e.longitud_corte)
  const n = num(e.perforaciones) || 0
  if (L && L > 0) {
    const t = (L * 1000) / v + (n * (retardo + 1.5)) / 60
    R.filas.push({ etiqueta: "Tiempo estimado", valor: minutos(t * 1.1), nota: n ? `${n} perforaciones incluidas` : "sin perforaciones" })
    R.datos.tiempo_min = r(t * 1.1, 2)
  }
  R.avisos.push("Escoria abajo con bolitas: vas lento. Escoria dura con chispa hacia adelante: vas rápido. Bisel: revisa altura y consumibles.")
  R.avisos.push("Son valores típicos de tablas de antorchas de aire. La tabla del fabricante de TU antorcha y consumibles manda.")
  R.datos = { ...R.datos, velocidad_mm_min: r(v), retardo_s: retardo, tabla_amperes: clave }
  return R
}

// ======================================================================
// 4. LASER DE FIBRA (marcado y corte de lamina)
// ======================================================================
// marcado con fuente de 20 W: [vel mm/s, potencia %, frecuencia kHz, profundidad por pasada mm (grabado profundo)]
const FIBRA_MARCA: Record<string, { nombre: string; marcado: [number, number, number]; profundo?: number; nota?: string }> = {
  inox: { nombre: "Acero inoxidable", marcado: [1000, 70, 40], profundo: 0.004 },
  acero: { nombre: "Acero al carbón", marcado: [800, 80, 40], profundo: 0.004 },
  aluminio: { nombre: "Aluminio natural", marcado: [800, 80, 40], profundo: 0.006, nota: "El aluminio natural marca gris; para blanco brillante es mejor anodizado." },
  anodizado: { nombre: "Aluminio anodizado", marcado: [2500, 30, 40], nota: "Marca blanco con poca potencia; demasiada potencia lo pone gris." },
  laton: { nombre: "Latón / cobre", marcado: [600, 90, 30], profundo: 0.003, nota: "Latón y cobre reflejan mucho: sube potencia y baja velocidad." },
  plastico: { nombre: "Plástico ABS / policarbonato", marcado: [1500, 25, 30], nota: "Depende mucho del color y aditivos; haz matriz de prueba." },
  piel: { nombre: "Piel", marcado: [1500, 20, 30] },
}
// corte de lamina: [espesor mm, m/min] por potencia (kW); acero dulce con oxigeno
const FIBRA_CORTE: Record<string, Record<string, number[][]>> = {
  acero_dulce: {
    "1": [[1, 10], [2, 5], [3, 3.5], [4, 2.6], [6, 1.5], [8, 1]],
    "2": [[1, 20], [2, 8], [3, 5], [6, 2.2], [8, 1.5], [10, 1.1], [12, 0.9]],
    "3": [[1, 30], [3, 5.5], [6, 2.6], [10, 1.4], [12, 1.1], [16, 0.8], [20, 0.6]],
    "6": [[3, 6], [6, 3], [10, 2], [16, 1.2], [20, 0.9], [25, 0.6]],
  },
  inoxidable: {
    "1": [[1, 18], [2, 6], [3, 2.5], [4, 1.2]],
    "2": [[1, 25], [2, 12], [3, 6], [5, 2.5], [6, 1.5]],
    "3": [[1, 35], [3, 10], [5, 4], [8, 1.5], [10, 1]],
    "6": [[3, 25], [6, 8], [10, 3], [12, 2], [16, 1]],
  },
  aluminio: {
    "1": [[1, 12], [2, 4], [3, 1.5]],
    "2": [[1, 20], [2, 8], [3, 4], [5, 1.5]],
    "3": [[1, 28], [3, 7], [5, 3], [8, 1.2]],
    "6": [[3, 20], [6, 6], [10, 2], [12, 1.4]],
  },
}

export const calcFibra = (e: Entrada): Resultado => {
  const op = txt(e.operacion) || "marcado"
  if (op === "corte") {
    const R = nuevo("Láser de fibra: corte de lámina")
    const mk = txt(e.material_corte) || "acero_dulce"
    const tablas = FIBRA_CORTE[mk] || FIBRA_CORTE.acero_dulce
    const kw = num(e.potencia_kw)
    const esp = num(e.espesor)
    if (!kw) R.faltan.push("Potencia de la fuente (kW)")
    if (!esp) R.faltan.push("Espesor de la lámina (mm)")
    if (!kw || !esp) return R
    const claves = Object.keys(tablas).map(Number)
    const c = String(claves.reduce((m, x) => (Math.abs(x - kw) < Math.abs(m - kw) ? x : m), claves[0]))
    if (Number(c) !== kw) R.supuestos.push(`Usé la tabla de ${c} kW (la más cercana).`)
    const t = tablas[c]
    const max = t[t.length - 1][0]
    const v = esp > max ? t[t.length - 1][1] * Math.pow(max / esp, 2) : interp(t, esp, 1, true)
    R.filas.push({ etiqueta: "Velocidad de corte", valor: `${fmt(v, 1)} m/min` })
    R.filas.push({ etiqueta: "Gas", valor: mk === "acero_dulce" ? (esp <= 3 && Number(c) >= 3 ? "Oxígeno (o aire/nitrógeno en delgado para más velocidad)" : "Oxígeno") : "Nitrógeno" })
    R.filas.push({ etiqueta: "Foco", valor: mk === "acero_dulce" ? "positivo, sobre la superficie" : "negativo, dentro del material" })
    if (esp > max) R.avisos.push(`${fmt(esp)} mm pasa del espesor de producción para ${c} kW en este material (≈ ${max} mm).`)
    const L = num(e.longitud_corte)
    if (L && L > 0) {
      const tm = (L / v) * 1.2
      R.filas.push({ etiqueta: "Tiempo de corte", valor: minutos(tm) })
      R.datos.tiempo_min = r(tm, 2)
    }
    R.avisos.push("Son valores típicos de tablas de fuentes de fibra. Las tablas de proceso de tu máquina (cabezal, boquilla, gas) mandan.")
    R.datos = { ...R.datos, velocidad_m_min: r(v, 2) }
    return R
  }
  const R = nuevo("Láser de fibra: marcado y grabado")
  const M = FIBRA_MARCA[txt(e.material) || "inox"] || FIBRA_MARCA.inox
  let W = num(e.potencia_w)
  if (!W) {
    W = 20
    R.faltan.push("Potencia de tu láser de fibra (W)")
    R.supuestos.push("Fuente de 20 W supuesta.")
  }
  const esc = W / 20
  const [v0, p0, f0] = M.marcado
  if (op === "profundo") {
    if (!M.profundo) {
      R.avisos.push(`En ${M.nombre} no se recomienda grabado profundo con fibra.`)
      return R
    }
    const prof = num(e.profundidad)
    const porPasada = M.profundo * esc
    const vel = clamp(300 * esc, 200, 1500)
    R.filas.push({ etiqueta: "Velocidad", valor: `${fmt(vel)} mm/s` })
    R.filas.push({ etiqueta: "Potencia", valor: "90–100 %" })
    R.filas.push({ etiqueta: "Frecuencia", valor: "20–30 kHz" })
    R.filas.push({ etiqueta: "Relleno (hatch)", valor: "0.03–0.05 mm, alterna ángulo cada pasada" })
    R.filas.push({ etiqueta: "Profundidad por pasada", valor: `≈ ${fmt(porPasada, 4)} mm` })
    if (prof) {
      const n = Math.ceil(prof / porPasada)
      R.filas.push({ etiqueta: "Pasadas necesarias", valor: fmt(n), nota: `para ${prof} mm` })
      const A = num(e.area_cm2)
      if (A) {
        const t = (((A * 100) / 0.04 / vel) * n * 1.2) / 60
        R.filas.push({ etiqueta: "Tiempo estimado", valor: minutos(t) })
        R.datos.tiempo_min = r(t, 2)
      }
    } else R.faltan.push("Profundidad deseada (mm)")
    R.avisos.push("Limpia el residuo cada 10–20 pasadas o baja el foco lo que vas profundizando para mantener el rendimiento.")
  } else {
    const vel = v0 * Math.pow(esc, 0.8)
    R.filas.push({ etiqueta: "Velocidad", valor: `${fmt(vel)} mm/s` })
    R.filas.push({ etiqueta: "Potencia", valor: `${fmt(clamp(p0 / Math.pow(esc, 0.5), 10, 100))} %` })
    R.filas.push({ etiqueta: "Frecuencia", valor: `${f0} kHz` })
    R.filas.push({ etiqueta: "Relleno (hatch)", valor: "0.03–0.05 mm" })
    const A = num(e.area_cm2)
    if (A) {
      const t = (((A * 100) / 0.04 / vel) * 1.2) / 60
      R.filas.push({ etiqueta: "Tiempo estimado", valor: minutos(t) })
      R.datos.tiempo_min = r(t, 2)
    }
    if (M.nombre.startsWith("Acero inox")) R.avisos.push("Para marcado negro o de color en inoxidable necesitas fuente MOPA (frecuencia alta y pulso ajustable) y velocidad lenta.")
  }
  if (M.nota) R.avisos.push(M.nota)
  R.avisos.push("Haz una matriz de prueba (velocidad contra potencia) en un retazo: cada fuente y lente cambia.")
  return R
}

// ======================================================================
// 5. IMPRESION 3D
// ======================================================================
export const MAT_3D: Record<string, { nombre: string; dens: number; temp: string; cama: string; resina?: boolean }> = {
  pla: { nombre: "PLA", dens: 1.24, temp: "200–215 °C", cama: "55–60 °C" },
  petg: { nombre: "PETG", dens: 1.27, temp: "230–245 °C", cama: "70–85 °C" },
  abs: { nombre: "ABS", dens: 1.04, temp: "235–250 °C", cama: "95–110 °C (con cerramiento)" },
  asa: { nombre: "ASA", dens: 1.07, temp: "240–255 °C", cama: "95–105 °C" },
  tpu: { nombre: "TPU (flexible)", dens: 1.21, temp: "220–235 °C", cama: "40–60 °C" },
  nylon: { nombre: "Nylon", dens: 1.14, temp: "245–265 °C", cama: "70–90 °C (filamento seco)" },
  resina: { nombre: "Resina estándar (SLA/MSLA)", dens: 1.12, temp: "—", cama: "—", resina: true },
}
export const calc3D = (e: Entrada): Resultado => {
  const R = nuevo("Impresión 3D: material, tiempo y costo")
  const M = MAT_3D[txt(e.material) || "pla"] || MAT_3D.pla
  const V = num(e.volumen_cm3)
  if (!V) {
    R.faltan.push("Volumen de la pieza (cm³); si subes el STL lo calculo")
    return R
  }
  const cant = Math.max(1, Math.round(num(e.cantidad) || 1))
  let gramos: number
  let tMin: number
  if (M.resina) {
    gramos = V * M.dens * 1.1
    const alto = num(e.altura_mm)
    const capa = num(e.altura_capa) || 0.05
    const exp = num(e.exposicion_s) || 2.5
    if (!alto) R.faltan.push("Altura de la pieza en la impresora (mm)")
    tMin = alto ? ((alto / capa) * (exp + 6)) / 60 : 0
    R.filas.push({ etiqueta: "Resina", valor: `${fmt(gramos * cant, 0)} g`, nota: "incluye 10% de soportes" })
    if (tMin) R.filas.push({ etiqueta: "Tiempo de impresión", valor: minutos(tMin), nota: "todas las piezas de la cama tardan lo mismo" })
    R.avisos.push("Usa guantes y ventilación; la resina sin curar irrita la piel. Lava con alcohol isopropílico y cura con UV.")
  } else {
    const rel = clamp(num(e.relleno) ?? 20, 0, 100) / 100
    const capa = num(e.altura_capa) || 0.2
    const boq = num(e.boquilla) || 0.4
    const vel = num(e.velocidad) || 60
    if (num(e.relleno) === undefined) R.supuestos.push("Relleno 20% supuesto.")
    const paredes = clamp(0.35 * Math.pow(10 / V, 0.25), 0.12, 0.8) // piezas chicas son casi todo pared
    const efectivo = V * (paredes + (1 - paredes) * rel)
    gramos = efectivo * M.dens * 1.05
    const flujo = capa * boq * 1.1 * vel * 0.55 // mm3/s real (aceleraciones, viajes)
    tMin = (efectivo * 1000) / flujo / 60 + 3
    R.filas.push({ etiqueta: "Material", valor: `${fmt(gramos * cant, 0)} g`, nota: `${fmt(gramos, 1)} g por pieza` })
    R.filas.push({ etiqueta: "Tiempo estimado", valor: minutos(tMin * cant), nota: cant > 1 ? `${minutos(tMin)} por pieza` : undefined })
    R.filas.push({ etiqueta: "Temperatura", valor: M.temp })
    R.filas.push({ etiqueta: "Cama", valor: M.cama })
    R.supuestos.push(`Capa ${capa} mm, boquilla ${boq} mm, ${vel} mm/s. El laminador (Cura, PrusaSlicer, Orca) da el tiempo exacto.`)
  }
  const precioKg = num(e.precio_kg)
  const costoHora = num(e.costo_hora)
  if (precioKg) {
    const cm = (gramos * cant * precioKg) / 1000
    R.filas.push({ etiqueta: "Costo de material", valor: pesos(cm) })
    R.datos.costo_material = r(cm, 2)
  } else R.faltan.push("Precio del material por kg (para el costo)")
  if (costoHora && tMin) {
    const ch = ((tMin * (M.resina ? 1 : cant)) / 60) * costoHora
    R.filas.push({ etiqueta: "Costo de máquina", valor: pesos(ch) })
    R.datos.costo_maquina = r(ch, 2)
  }
  R.datos = { ...R.datos, gramos: r(gramos * cant, 1), tiempo_min: r(M.resina ? tMin : tMin * cant, 1) }
  return R
}

// ======================================================================
// 6. COSTO Y PRECIO DE UN TRABAJO
// ======================================================================
export const calcCosto = (e: Entrada): Resultado => {
  const R = nuevo("Costo y precio del trabajo")
  const t = num(e.tiempo_min)
  if (!t) {
    R.faltan.push("Tiempo de máquina por pieza (min)")
    return R
  }
  const cant = Math.max(1, Math.round(num(e.cantidad) || 1))
  const prep = num(e.preparacion_min) ?? 15
  let ch = num(e.costo_hora)
  if (!ch) {
    ch = 161.38 // costo hora total por defecto del Cotizador HETNA (taller + maquina + operador)
    R.supuestos.push("Costo por hora: usé $161 (taller + máquina + operador del Cotizador HETNA). Pon el tuyo.")
    R.faltan.push("Tu costo por hora (máquina + operador + gastos fijos)")
  }
  const mat = num(e.costo_material) ?? 0
  const cons = num(e.consumibles) ?? 0
  const margen = clamp(num(e.margen) ?? 55, 0, 90)
  const iva = num(e.iva) ?? 16
  const horas = (t * cant + prep) / 60
  const costoMaq = horas * ch
  const costo = costoMaq + mat + cons
  const precio = costo / (1 - margen / 100)
  const conIva = precio * (1 + iva / 100)
  R.filas.push({ etiqueta: "Tiempo total", valor: minutos(t * cant + prep), nota: `incluye ${fmt(prep)} min de preparación` })
  R.filas.push({ etiqueta: "Costo de máquina y mano de obra", valor: pesos(costoMaq) })
  if (mat) R.filas.push({ etiqueta: "Material", valor: pesos(mat) })
  if (cons) R.filas.push({ etiqueta: "Consumibles / herramienta", valor: pesos(cons) })
  R.filas.push({ etiqueta: "Costo total", valor: pesos(costo) })
  R.filas.push({ etiqueta: `Precio con ${fmt(margen)}% de margen`, valor: pesos(precio), nota: "sin IVA" })
  R.filas.push({ etiqueta: `Precio con IVA (${fmt(iva)}%)`, valor: pesos(conIva) })
  if (cant > 1) R.filas.push({ etiqueta: "Por pieza (con IVA)", valor: pesos(conIva / cant) })
  R.filas.push({ etiqueta: "Utilidad", valor: pesos(precio - costo) })
  if (margen < 30) R.avisos.push("Un margen menor a 30% casi no deja para herramienta rota, retrabajos ni tiempos muertos.")
  R.datos = { costo: r(costo, 2), precio: r(precio, 2), precio_iva: r(conIva, 2), utilidad: r(precio - costo, 2) }
  return R
}

// ======================================================================
// Catalogo de calculadoras
// ======================================================================
const opsMat = (o: Record<string, { nombre: string }>) => opciones(o)

export const CALCULADORAS: Calculadora[] = [
  {
    id: "router_parametros",
    nombre: "Router CNC: RPM y avances",
    maquina: "router",
    resumen: "RPM, avance, entrada, profundidad por pasada, potencia y tiempo según material y fresa.",
    ia: "Calcula parámetros iniciales de corte para router CNC (RPM, avance, velocidad de entrada, carga de viruta, profundidad por pasada, número de pasadas, potencia requerida y tiempo). Úsala siempre que pregunten por velocidades, avances o cómo cortar un material con router.",
    campos: [
      { k: "material", etiqueta: "Material", tipo: "opcion", opciones: opsMat(MAT_ROUTER), req: true },
      { k: "diametro", etiqueta: "Diámetro de la fresa", tipo: "numero", unidad: "mm", req: true, min: 0.1, max: 60 },
      { k: "filos", etiqueta: "Filos", tipo: "numero", min: 1, max: 8 },
      { k: "tipo_fresa", etiqueta: "Tipo de fresa", tipo: "opcion", opciones: TIPOS_FRESA },
      { k: "operacion", etiqueta: "Operación", tipo: "opcion", opciones: OPERACIONES },
      { k: "profundidad_total", etiqueta: "Espesor o profundidad total", tipo: "numero", unidad: "mm" },
      { k: "longitud_corte", etiqueta: "Longitud total de corte", tipo: "numero", unidad: "m", ayuda: "Para calcular el tiempo" },
      { k: "potencia_kw", etiqueta: "Potencia del spindle", tipo: "numero", unidad: "kW", deMaquina: "potencia_kw" },
      { k: "rpm_max", etiqueta: "RPM máximas del spindle", tipo: "numero", deMaquina: "rpm_max" },
      { k: "rpm_min", etiqueta: "RPM mínimas del spindle", tipo: "numero", deMaquina: "rpm_min" },
      { k: "avance_max", etiqueta: "Avance máximo de la máquina", tipo: "numero", unidad: "mm/min", deMaquina: "avance_max" },
    ],
    calcular: calcRouter,
  },
  {
    id: "router_revisar",
    nombre: "Revisar mis parámetros (diagnóstico)",
    maquina: "router",
    resumen: "¿Se quema, se funde o se rompe la fresa? Revisa la carga de viruta de lo que ya usas.",
    ia: "Revisa parámetros que el usuario YA está usando (RPM, avance, fresa) y calcula la carga de viruta real para diagnosticar quemado, fundido, fresa rota, vibración o mal acabado.",
    campos: [
      { k: "material", etiqueta: "Material", tipo: "opcion", opciones: opsMat(MAT_ROUTER), req: true },
      { k: "diametro", etiqueta: "Diámetro de la fresa", tipo: "numero", unidad: "mm", req: true },
      { k: "filos", etiqueta: "Filos", tipo: "numero", req: true },
      { k: "rpm", etiqueta: "RPM que usas", tipo: "numero", req: true },
      { k: "avance", etiqueta: "Avance que usas", tipo: "numero", unidad: "mm/min", req: true },
    ],
    calcular: calcRevisar,
  },
  {
    id: "laser_co2",
    nombre: "Láser CO₂: corte y grabado",
    maquina: "laser_co2",
    resumen: "Velocidad, potencia, enfoque y tiempo según material, espesor y watts del tubo.",
    ia: "Calcula velocidad y potencia iniciales para láser CO2 (corte o grabado), enfoque, kerf y tiempo. También detecta materiales prohibidos (PVC, vinil).",
    campos: [
      { k: "material", etiqueta: "Material", tipo: "opcion", opciones: opsMat(MAT_LASER), req: true },
      { k: "operacion", etiqueta: "Operación", tipo: "opcion", opciones: [{ v: "corte", t: "Corte" }, { v: "grabado", t: "Grabado" }] },
      { k: "espesor", etiqueta: "Espesor", tipo: "numero", unidad: "mm" },
      { k: "potencia_w", etiqueta: "Potencia del tubo", tipo: "numero", unidad: "W", deMaquina: "potencia_w" },
      { k: "longitud_corte", etiqueta: "Longitud de corte", tipo: "numero", unidad: "m" },
      { k: "area_cm2", etiqueta: "Área a grabar", tipo: "numero", unidad: "cm²" },
    ],
    calcular: calcLaser,
  },
  {
    id: "plasma",
    nombre: "Plasma CNC",
    maquina: "plasma",
    resumen: "Velocidad, alturas, retardo de perforación, kerf y tiempo según amperaje y espesor.",
    ia: "Calcula velocidad de corte de plasma con aire, altura de corte y de perforación, retardo, kerf y tiempo, según amperaje, material y espesor.",
    campos: [
      { k: "material", etiqueta: "Material", tipo: "opcion", opciones: opsMat(MAT_PLASMA), req: true },
      { k: "espesor", etiqueta: "Espesor", tipo: "numero", unidad: "mm", req: true },
      { k: "amperaje", etiqueta: "Amperaje de la fuente", tipo: "numero", unidad: "A", req: true, deMaquina: "amperaje" },
      { k: "longitud_corte", etiqueta: "Longitud de corte", tipo: "numero", unidad: "m" },
      { k: "perforaciones", etiqueta: "Perforaciones", tipo: "numero" },
    ],
    calcular: calcPlasma,
  },
  {
    id: "laser_fibra",
    nombre: "Láser de fibra",
    maquina: "fibra",
    resumen: "Marcado, grabado profundo y corte de lámina: velocidad, potencia, frecuencia y tiempo.",
    ia: "Calcula parámetros iniciales de láser de fibra: marcado/grabado (W, velocidad, potencia, frecuencia, pasadas) o corte de lámina (kW, velocidad, gas, foco).",
    campos: [
      { k: "operacion", etiqueta: "Operación", tipo: "opcion", opciones: [{ v: "marcado", t: "Marcado" }, { v: "profundo", t: "Grabado profundo" }, { v: "corte", t: "Corte de lámina" }], req: true },
      { k: "material", etiqueta: "Material (marcado)", tipo: "opcion", opciones: opsMat(FIBRA_MARCA) },
      { k: "potencia_w", etiqueta: "Potencia (marcado)", tipo: "numero", unidad: "W", deMaquina: "potencia_w" },
      { k: "profundidad", etiqueta: "Profundidad deseada", tipo: "numero", unidad: "mm" },
      { k: "area_cm2", etiqueta: "Área", tipo: "numero", unidad: "cm²" },
      { k: "material_corte", etiqueta: "Material (corte)", tipo: "opcion", opciones: opsMat(MAT_PLASMA) },
      { k: "potencia_kw", etiqueta: "Potencia (corte)", tipo: "numero", unidad: "kW" },
      { k: "espesor", etiqueta: "Espesor (corte)", tipo: "numero", unidad: "mm" },
      { k: "longitud_corte", etiqueta: "Longitud de corte", tipo: "numero", unidad: "m" },
    ],
    calcular: calcFibra,
  },
  {
    id: "impresion_3d",
    nombre: "Impresión 3D",
    maquina: "impresora_3d",
    resumen: "Gramos, tiempo y costo de una pieza en FDM o resina.",
    ia: "Estima gramos de material, tiempo y costo de impresión 3D (FDM o resina) a partir del volumen de la pieza.",
    campos: [
      { k: "material", etiqueta: "Material", tipo: "opcion", opciones: opsMat(MAT_3D), req: true },
      { k: "volumen_cm3", etiqueta: "Volumen de la pieza", tipo: "numero", unidad: "cm³", req: true },
      { k: "cantidad", etiqueta: "Piezas", tipo: "numero" },
      { k: "relleno", etiqueta: "Relleno", tipo: "numero", unidad: "%" },
      { k: "altura_capa", etiqueta: "Altura de capa", tipo: "numero", unidad: "mm" },
      { k: "boquilla", etiqueta: "Boquilla", tipo: "numero", unidad: "mm" },
      { k: "velocidad", etiqueta: "Velocidad", tipo: "numero", unidad: "mm/s" },
      { k: "altura_mm", etiqueta: "Altura de la pieza (resina)", tipo: "numero", unidad: "mm" },
      { k: "precio_kg", etiqueta: "Precio del material", tipo: "numero", unidad: "$/kg" },
      { k: "costo_hora", etiqueta: "Costo por hora de máquina", tipo: "numero", unidad: "$/h" },
    ],
    calcular: calc3D,
  },
  {
    id: "costo_trabajo",
    nombre: "Costo y precio de un trabajo",
    maquina: "todas",
    resumen: "Del tiempo de máquina al precio de venta con margen e IVA.",
    ia: "Calcula el costo y el precio de venta de un trabajo CNC a partir del tiempo de máquina, costo por hora, material, consumibles, margen e IVA. Usa el tiempo de otra calculadora o del G-code.",
    campos: [
      { k: "tiempo_min", etiqueta: "Tiempo de máquina por pieza", tipo: "numero", unidad: "min", req: true },
      { k: "cantidad", etiqueta: "Piezas", tipo: "numero" },
      { k: "preparacion_min", etiqueta: "Preparación", tipo: "numero", unidad: "min" },
      { k: "costo_hora", etiqueta: "Costo por hora", tipo: "numero", unidad: "$/h" },
      { k: "costo_material", etiqueta: "Material", tipo: "numero", unidad: "$" },
      { k: "consumibles", etiqueta: "Consumibles / herramienta", tipo: "numero", unidad: "$" },
      { k: "margen", etiqueta: "Margen", tipo: "numero", unidad: "%" },
      { k: "iva", etiqueta: "IVA", tipo: "numero", unidad: "%" },
    ],
    calcular: calcCosto,
  },
]

export const buscarCalculadora = (id: string) => CALCULADORAS.find((c) => c.id === id)

// Esquema de herramienta (formato de la API de Claude) para cada calculadora
export const herramientasIA = () =>
  CALCULADORAS.map((c) => ({
    name: c.id,
    description: c.ia,
    input_schema: {
      type: "object",
      properties: Object.fromEntries(
        c.campos.map((f) => [
          f.k,
          f.tipo === "opcion"
            ? { type: "string", enum: (f.opciones || []).map((o) => o.v), description: `${f.etiqueta}: ${(f.opciones || []).map((o) => `${o.v}=${o.t}`).join(", ")}` }
            : { type: "number", description: `${f.etiqueta}${f.unidad ? ` (${f.unidad})` : ""}${f.ayuda ? `. ${f.ayuda}` : ""}` },
        ])
      ),
      required: [] as string[],
    },
  }))

// Ejecuta una calculadora con validacion basica (la entrada puede venir de la IA)
export const ejecutar = (id: string, entrada: Entrada, maquina?: Maquina | null): Resultado => {
  const c = buscarCalculadora(id)
  if (!c) return { ...nuevo("Calculadora desconocida"), avisos: [`No existe la calculadora ${id}`] }
  const e: Entrada = {}
  for (const f of c.campos) {
    let v = entrada ? entrada[f.k] : undefined
    if ((v === undefined || v === null || v === "") && maquina && f.deMaquina) v = maquina[f.deMaquina]
    if (v === undefined || v === null || v === "") continue
    if (f.tipo === "numero") {
      const n = num(v)
      if (n === undefined) continue
      e[f.k] = clamp(n, f.min ?? -1e9, f.max ?? 1e9)
    } else {
      const s = txt(v)
      if ((f.opciones || []).some((o) => o.v === s)) e[f.k] = s
    }
  }
  try {
    return c.calcular(e)
  } catch {
    return { ...nuevo(c.nombre), avisos: ["No se pudo calcular con esos datos."] }
  }
}
