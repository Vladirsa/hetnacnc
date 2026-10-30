// Router CNC y fresadora: velocidades y avances profesionales.
// Modelo: carga de viruta por material y diámetro (fresa de carburo), velocidad
// de corte, límite de RPM y avance de la máquina, rigidez de la máquina,
// potencia (energía específica del material), par del spindle, adelgazamiento
// de viruta en desbaste adaptativo, deflexión de la fresa (viga en voladizo) y
// altura de cresta para punta bola.

import { type Calculadora, type Campo, type Entrada, type Preset, type Resultado, bloque, clamp, fmt, interp, minutos, nuevo, num, opciones, r, txt } from "./comun"

// ---------- máquinas ----------
export type ClaseMaquina = { nombre: string; potencia_kw: number; rpm_min: number; rpm_max: number; avance_max: number; rigidez: number; nota: string }
export const MAQUINAS_ROUTER: Record<string, ClaseMaquina> = {
  desktop: { nombre: "Desktop / 3018 (motor 775 o spindle 300–500 W)", potencia_kw: 0.3, rpm_min: 3000, rpm_max: 10000, avance_max: 1200, rigidez: 0.3, nota: "Máquina ligera: cortes poco profundos y fresas de 1 filo. Lo que la limita es la rigidez, no el spindle." },
  hobby: { nombre: "Hobby 6040 / 6090 con spindle 1.5 kW", potencia_kw: 1.5, rpm_min: 6000, rpm_max: 24000, avance_max: 3000, rigidez: 0.6, nota: "Rígida para madera y plásticos; aluminio sí, pero con pasadas de 0.3–0.5 mm y lubricación." },
  taller: { nombre: "Router 1325 / 1530 de taller (3–4.5 kW)", potencia_kw: 3.5, rpm_min: 6000, rpm_max: 24000, avance_max: 8000, rigidez: 1, nota: "La máquina típica de taller en México: MDF, melamina, acrílico y ACM a buen ritmo." },
  industrial: { nombre: "Industrial con ATC (9–12 kW, HSD/Hiteco)", potencia_kw: 9, rpm_min: 6000, rpm_max: 24000, avance_max: 20000, rigidez: 1.3, nota: "Puedes cortar melamina de 18 mm de una pasada con fresa de compresión de 10–12 mm." },
  fresadora: { nombre: "Fresadora / VMC para metal (7.5 kW, 8,000 RPM)", potencia_kw: 7.5, rpm_min: 100, rpm_max: 8000, avance_max: 10000, rigidez: 2, nota: "Para acero e inoxidable: refrigerante, fresas de 4 filos y desbaste adaptativo." },
}
export const PRESETS_ROUTER: Preset[] = Object.entries(MAQUINAS_ROUTER).map(([id, m]) => ({
  id,
  nombre: m.nombre,
  valores: { maquina: id, potencia_kw: m.potencia_kw, rpm_min: m.rpm_min, rpm_max: m.rpm_max, avance_max: m.avance_max },
}))

// ---------- materiales ----------
type MatRouter = {
  nombre: string
  grupo: string
  cl: number[][] // [diámetro mm, carga mín, carga máx] mm por filo, carburo, máquina rígida
  vc: [number, number] // velocidad de corte m/min (carburo)
  doc: number // profundidad por pasada en perfil, en veces el diámetro
  u: number // energía específica J/mm³ (≈ Kc / 1000)
  filos: number // filos recomendados
  entrada: number // avance de entrada como fracción del avance
  lub?: string // lubricación / refrigeración
  nota: string
}
export const MAT_ROUTER: Record<string, MatRouter> = {
  mdf: { nombre: "MDF", grupo: "Madera y tableros", cl: [[3, 0.1, 0.15], [6, 0.25, 0.3], [10, 0.35, 0.45], [12, 0.45, 0.55]], vc: [300, 900], doc: 1, u: 0.06, filos: 2, entrada: 0.35, nota: "Extracción de polvo obligatoria: el polvo de MDF es dañino. La fresa de compresión deja limpias las dos caras." },
  melamina: { nombre: "Melamina / aglomerado", grupo: "Madera y tableros", cl: [[3, 0.08, 0.13], [6, 0.2, 0.28], [10, 0.3, 0.4], [12, 0.4, 0.5]], vc: [300, 900], doc: 1, u: 0.07, filos: 2, entrada: 0.35, nota: "Para que no se astille la cara de arriba usa fresa de compresión; la primera pasada más profunda que la zona ascendente." },
  triplay: { nombre: "Triplay / contrachapado", grupo: "Madera y tableros", cl: [[3, 0.08, 0.13], [6, 0.23, 0.28], [10, 0.33, 0.42], [12, 0.43, 0.5]], vc: [300, 900], doc: 1, u: 0.06, filos: 2, entrada: 0.35, nota: "El pegamento desafila rápido las fresas HSS: mejor carburo. Compresión o downcut para que no se astille." },
  madera_blanda: { nombre: "Madera blanda (pino, cedro, caobilla)", grupo: "Madera y tableros", cl: [[3, 0.1, 0.15], [6, 0.25, 0.3], [10, 0.35, 0.45], [12, 0.45, 0.53]], vc: [300, 900], doc: 1, u: 0.04, filos: 2, entrada: 0.35, nota: "Corta a favor de la veta cuando puedas. Si se 'pela', usa downcut en la última pasada." },
  madera_dura: { nombre: "Madera dura (encino, parota, nogal, maple)", grupo: "Madera y tableros", cl: [[3, 0.08, 0.13], [6, 0.2, 0.25], [10, 0.3, 0.38], [12, 0.4, 0.48]], vc: [300, 800], doc: 0.75, u: 0.09, filos: 2, entrada: 0.3, nota: "Se quema si el avance es bajo: no bajes el avance, baja las RPM." },
  bambu: { nombre: "Bambú laminado", grupo: "Madera y tableros", cl: [[3, 0.07, 0.11], [6, 0.18, 0.23], [10, 0.25, 0.33], [12, 0.33, 0.42]], vc: [300, 800], doc: 0.7, u: 0.1, filos: 2, entrada: 0.3, nota: "Muy abrasivo por la sílice: fresas de carburo y espera menos vida de filo." },
  acrilico: { nombre: "Acrílico fundido (cast)", grupo: "Plásticos", cl: [[3, 0.08, 0.1], [6, 0.15, 0.2], [10, 0.22, 0.28], [12, 0.25, 0.3]], vc: [150, 350], doc: 0.5, u: 0.1, filos: 1, entrada: 0.3, lub: "aire a presión", nota: "Fresa de 1 filo (O-flute) pulida. Si ves plástico fundido pegado, sube el avance o baja RPM. Para canto cristal: fresa O-flute nueva y una pasada de acabado de 0.2 mm." },
  acrilico_extruido: { nombre: "Acrílico extruido", grupo: "Plásticos", cl: [[3, 0.08, 0.1], [6, 0.15, 0.2], [10, 0.22, 0.28], [12, 0.25, 0.3]], vc: [120, 300], doc: 0.5, u: 0.1, filos: 1, entrada: 0.3, lub: "aire a presión", nota: "Se funde más fácil que el fundido: viruta grande, RPM moderadas y aire. Sujeta bien, tiende a vibrar." },
  policarbonato: { nombre: "Policarbonato", grupo: "Plásticos", cl: [[3, 0.08, 0.12], [6, 0.18, 0.25], [10, 0.25, 0.32], [12, 0.3, 0.38]], vc: [150, 400], doc: 0.6, u: 0.11, filos: 1, entrada: 0.3, lub: "aire a presión", nota: "Corta muy bien con router (mal con láser). Fresa de 1 filo; no dejes que la viruta se reenrolle en la fresa." },
  pvc_espumado: { nombre: "PVC espumado (Sintra, Trovicel)", grupo: "Plásticos", cl: [[3, 0.08, 0.13], [6, 0.18, 0.25], [10, 0.25, 0.33], [12, 0.3, 0.38]], vc: [150, 400], doc: 1, u: 0.05, filos: 1, entrada: 0.35, nota: "Fresa de 1 filo para que la viruta salga y no se funda. Cuidado con el polvo: ventilación." },
  pvc_rigido: { nombre: "PVC rígido", grupo: "Plásticos", cl: [[3, 0.07, 0.11], [6, 0.15, 0.22], [10, 0.2, 0.28], [12, 0.25, 0.33]], vc: [120, 300], doc: 0.6, u: 0.09, filos: 1, entrada: 0.3, nota: "Frágil en frío: no fuerces la entrada. 1 filo, RPM moderadas." },
  hdpe: { nombre: "HDPE / Nylon / UHMW / POM", grupo: "Plásticos", cl: [[3, 0.08, 0.13], [6, 0.18, 0.25], [10, 0.25, 0.33], [12, 0.3, 0.38]], vc: [150, 400], doc: 0.75, u: 0.05, filos: 1, entrada: 0.3, nota: "Plásticos que se funden: carga de viruta alta, RPM moderadas y buena evacuación. Nylon absorbe humedad y cambia de medida." },
  petg: { nombre: "PET-G / PET lámina", grupo: "Plásticos", cl: [[3, 0.08, 0.1], [6, 0.15, 0.2], [10, 0.2, 0.26], [12, 0.25, 0.3]], vc: [120, 300], doc: 0.5, u: 0.1, filos: 1, entrada: 0.3, lub: "aire a presión", nota: "Se pega a la fresa si va lento: 1 filo y avance alto. Deja la película protectora puesta." },
  corian: { nombre: "Superficie sólida (Corian, Krion)", grupo: "Plásticos", cl: [[3, 0.06, 0.1], [6, 0.15, 0.2], [10, 0.2, 0.28], [12, 0.25, 0.33]], vc: [200, 500], doc: 0.5, u: 0.15, filos: 2, entrada: 0.3, nota: "Polvo muy abrasivo: carburo y extracción. Baja las RPM si huele a quemado." },
  g10: { nombre: "Fibra de vidrio (G10 / FR4 / PCB)", grupo: "Compuestos", cl: [[3, 0.04, 0.06], [6, 0.08, 0.12], [10, 0.1, 0.15], [12, 0.12, 0.18]], vc: [150, 300], doc: 0.5, u: 0.2, filos: 2, entrada: 0.25, nota: "El polvo de vidrio destruye los rodamientos y los pulmones: extracción y mascarilla. Fresas de diamante o carburo; cuenta con que duran poco." },
  carbono: { nombre: "Fibra de carbono", grupo: "Compuestos", cl: [[3, 0.03, 0.05], [6, 0.06, 0.1], [10, 0.08, 0.12], [12, 0.1, 0.15]], vc: [120, 250], doc: 0.4, u: 0.2, filos: 2, entrada: 0.25, nota: "Polvo conductor y peligroso: corta en húmedo o con extracción sellada. Fresas de diamante (PCD) o carburo recubierto; compresión para que no delamine." },
  acm: { nombre: "ACM (aluminio compuesto, Alucobond)", grupo: "Metales", cl: [[3, 0.05, 0.08], [6, 0.1, 0.15], [10, 0.13, 0.18], [12, 0.15, 0.2]], vc: [200, 500], doc: 1, u: 0.12, filos: 1, entrada: 0.3, nota: "Para doblar ACM usa fresa en V de 90° o 135° dejando 0.3–0.5 mm de material (la piel de abajo)." },
  aluminio: { nombre: "Aluminio (6061, 5052)", grupo: "Metales", cl: [[3, 0.025, 0.04], [6, 0.05, 0.08], [10, 0.07, 0.1], [12, 0.08, 0.12]], vc: [150, 400], doc: 0.2, u: 0.7, filos: 1, entrada: 0.2, lub: "alcohol, niebla o WD-40 + aire", nota: "Fresa de 1 filo pulida (2–3 filos en fresadora rígida). Entrada siempre en rampa o hélice, nunca vertical. Si la viruta se pega a la fresa (built-up edge): más lubricación y más avance." },
  laton: { nombre: "Latón", grupo: "Metales", cl: [[3, 0.02, 0.03], [6, 0.04, 0.06], [10, 0.05, 0.08], [12, 0.06, 0.09]], vc: [100, 250], doc: 0.15, u: 1.2, filos: 2, entrada: 0.2, nota: "Corta limpio y seco; fresa de 2 filos sin ángulo de desprendimiento agresivo para que no 'jale'." },
  cobre: { nombre: "Cobre", grupo: "Metales", cl: [[3, 0.015, 0.025], [6, 0.03, 0.05], [10, 0.04, 0.06], [12, 0.05, 0.07]], vc: [80, 200], doc: 0.12, u: 1.4, filos: 2, entrada: 0.2, lub: "aceite de corte", nota: "Pegajoso y blando: fresa afilada, lubricación y avance constante para que no se embarre." },
  acero_dulce: { nombre: "Acero dulce (1018, A36)", grupo: "Metales", cl: [[3, 0.01, 0.02], [6, 0.02, 0.04], [10, 0.03, 0.05], [12, 0.04, 0.06]], vc: [60, 120], doc: 0.05, u: 2.5, filos: 4, entrada: 0.15, lub: "refrigerante soluble", nota: "Un router de madera normalmente NO tiene rigidez para acero. Es para fresadora con refrigerante y fresa de 4 filos." },
  inoxidable: { nombre: "Acero inoxidable (304, 316)", grupo: "Metales", cl: [[3, 0.01, 0.015], [6, 0.02, 0.03], [10, 0.025, 0.04], [12, 0.03, 0.05]], vc: [40, 90], doc: 0.04, u: 3.2, filos: 4, entrada: 0.12, lub: "refrigerante soluble abundante", nota: "Se endurece si la fresa roza: nunca bajes la carga de viruta. Fresa recubierta (AlTiN), 4 filos, refrigerante." },
  espuma: { nombre: "Espuma XPS / PU / foam de modelado", grupo: "Espumas y otros", cl: [[3, 0.15, 0.25], [6, 0.3, 0.5], [10, 0.45, 0.7], [12, 0.5, 0.8]], vc: [300, 1000], doc: 2, u: 0.005, filos: 2, entrada: 0.5, nota: "Puedes cortar profundo y rápido; el límite suele ser el avance máximo de la máquina. Fresas largas de 2 filos." },
  cera: { nombre: "Cera de modelado / mecanizado", grupo: "Espumas y otros", cl: [[3, 0.1, 0.18], [6, 0.2, 0.35], [10, 0.3, 0.5], [12, 0.35, 0.55]], vc: [200, 600], doc: 1.5, u: 0.02, filos: 2, entrada: 0.5, nota: "Ideal para probar programas 3D antes de cortar el material bueno." },
  yeso_mdf_pintado: { nombre: "MDF pintado / laqueado", grupo: "Espumas y otros", cl: [[3, 0.08, 0.12], [6, 0.2, 0.26], [10, 0.3, 0.38], [12, 0.38, 0.48]], vc: [300, 800], doc: 0.8, u: 0.07, filos: 2, entrada: 0.3, nota: "Downcut o compresión para que la pintura no se descascare en la orilla." },
}

export const TIPOS_FRESA: Record<string, { nombre: string; cl: number; doc: number; nota?: string }> = {
  upcut: { nombre: "Espiral ascendente (upcut)", cl: 1, doc: 1 },
  downcut: { nombre: "Espiral descendente (downcut)", cl: 1, doc: 0.6, nota: "Downcut empuja la viruta hacia abajo: pasadas más someras para que no se acumule." },
  compresion: { nombre: "Compresión", cl: 1, doc: 1, nota: "La primera pasada debe ser más profunda que la parte ascendente de la fresa (3–5 mm) para que ambas caras queden limpias." },
  recta: { nombre: "Recta (2 filos)", cl: 0.9, doc: 0.8 },
  un_filo: { nombre: "Un filo / O-flute", cl: 1, doc: 1 },
  bola: { nombre: "Punta bola (3D)", cl: 0.8, doc: 0.5 },
  v: { nombre: "Punta en V (grabado)", cl: 0.5, doc: 1 },
  planeadora: { nombre: "Planeadora / surfacing", cl: 0.9, doc: 0.1 },
  desbaste: { nombre: "Desbaste (rougher, dientes de sierra)", cl: 1.2, doc: 1.5, nota: "Rompe la viruta: admite más profundidad y avance, pero deja acabado rugoso." },
}
export const MATERIAL_FRESA: Record<string, { nombre: string; vc: number; cl: number; E: number }> = {
  carburo: { nombre: "Carburo (sólido)", vc: 1, cl: 1, E: 600000 },
  carburo_rec: { nombre: "Carburo recubierto (AlTiN, DLC, diamante)", vc: 1.25, cl: 1.05, E: 600000 },
  hss: { nombre: "HSS (acero rápido)", vc: 0.5, cl: 0.8, E: 210000 },
}
export const OPERACIONES: Record<string, { nombre: string; ae: number; doc: number; cl: number; nota?: string }> = {
  perfil: { nombre: "Corte de perfil / ranura (ancho completo)", ae: 1, doc: 1, cl: 1 },
  cajeado: { nombre: "Cajeado / desbaste convencional", ae: 0.45, doc: 1, cl: 1 },
  adaptativo: { nombre: "Desbaste adaptativo / HSM (trocoidal)", ae: 0.15, doc: 2, cl: 1, nota: "Poco ancho y mucha profundidad: usa toda la longitud de corte, la fresa dura más y la máquina sufre menos." },
  acabado: { nombre: "Acabado 3D (paralelo, por nivel)", ae: 0.1, doc: 0.2, cl: 0.8 },
  acabado_pared: { nombre: "Pasada de acabado en pared", ae: 0.05, doc: 3, cl: 0.7, nota: "Deja 0.2–0.5 mm en el desbaste y quítalos de una pasada a toda la profundidad." },
  grabado_v: { nombre: "Grabado en V", ae: 0.5, doc: 1, cl: 0.5 },
  planeado: { nombre: "Planeado de cama o pieza", ae: 0.7, doc: 0.05, cl: 0.8 },
}

const CAMPOS: Campo[] = [
  { k: "maquina", etiqueta: "Tipo de máquina", tipo: "opcion", opciones: opciones(MAQUINAS_ROUTER), inicial: "taller", seccion: "Máquina", maquina: true },
  { k: "potencia_kw", etiqueta: "Potencia del spindle", tipo: "numero", unidad: "kW", inicial: 3.5, seccion: "Máquina", maquina: true, ayuda: "La nominal; los spindles chinos la dan a sus RPM máximas." },
  { k: "rpm_min", etiqueta: "RPM mínimas", tipo: "numero", inicial: 6000, seccion: "Máquina", maquina: true },
  { k: "rpm_max", etiqueta: "RPM máximas", tipo: "numero", inicial: 24000, seccion: "Máquina", maquina: true },
  { k: "avance_max", etiqueta: "Avance máximo de corte", tipo: "numero", unidad: "mm/min", inicial: 8000, seccion: "Máquina", maquina: true },
  { k: "material", etiqueta: "Material", tipo: "opcion", opciones: opciones(MAT_ROUTER), inicial: "mdf", seccion: "Material", req: true },
  { k: "espesor", etiqueta: "Espesor o profundidad total", tipo: "numero", unidad: "mm", inicial: 18, seccion: "Material" },
  { k: "diametro", etiqueta: "Diámetro de la fresa", tipo: "numero", unidad: "mm", inicial: 6, seccion: "Fresa", req: true },
  { k: "filos", etiqueta: "Filos", tipo: "numero", inicial: 2, min: 1, max: 8, seccion: "Fresa" },
  { k: "tipo_fresa", etiqueta: "Tipo de fresa", tipo: "opcion", opciones: opciones(TIPOS_FRESA), inicial: "upcut", seccion: "Fresa" },
  { k: "material_fresa", etiqueta: "Material de la fresa", tipo: "opcion", opciones: opciones(MATERIAL_FRESA), inicial: "carburo", seccion: "Fresa" },
  { k: "voladizo", etiqueta: "Largo fuera del collet (voladizo)", tipo: "numero", unidad: "mm", inicial: 25, seccion: "Fresa", ayuda: "Para calcular cuánto se flexiona la fresa. Pon lo mínimo que te permita la pieza." },
  { k: "operacion", etiqueta: "Operación", tipo: "opcion", opciones: opciones(OPERACIONES), inicial: "perfil", seccion: "Corte" },
  { k: "paso_pct", etiqueta: "Paso lateral (stepover)", tipo: "numero", unidad: "% del diámetro", seccion: "Corte", ayuda: "Vacío = el típico de la operación." },
  { k: "longitud_corte", etiqueta: "Largo total de corte (para el tiempo)", tipo: "numero", unidad: "m", seccion: "Corte" },
]

export const calcRouter = (e: Entrada): Resultado => {
  const R = nuevo("Router CNC: velocidades y avances")
  const mq = MAQUINAS_ROUTER[txt(e.maquina)] || MAQUINAS_ROUTER.taller
  const M = MAT_ROUTER[txt(e.material)] || MAT_ROUTER.mdf
  const T = TIPOS_FRESA[txt(e.tipo_fresa)] || TIPOS_FRESA.upcut
  const MF = MATERIAL_FRESA[txt(e.material_fresa)] || MATERIAL_FRESA.carburo
  const OP = OPERACIONES[txt(e.operacion)] || OPERACIONES.perfil
  const D = num(e.diametro)
  if (!D || D <= 0) {
    R.faltan.push("Diámetro de la fresa (mm)")
    return R
  }
  let Z = num(e.filos) || M.filos
  Z = clamp(Math.round(Z), 1, 8)
  const P = num(e.potencia_kw) ?? mq.potencia_kw
  const rpmMax = num(e.rpm_max) ?? mq.rpm_max
  const rpmMin = num(e.rpm_min) ?? mq.rpm_min
  const avMax = num(e.avance_max) ?? mq.avance_max
  const prof = num(e.espesor)
  const L = num(e.voladizo) ?? 25
  const rig = mq.rigidez

  // --- carga de viruta ---
  let clMin = interp(M.cl, D, 1)
  let clMax = interp(M.cl, D, 2)
  if (D < M.cl[0][0]) {
    clMin = (M.cl[0][1] * D) / M.cl[0][0]
    clMax = (M.cl[0][2] * D) / M.cl[0][0]
  }
  const fRig = clamp(0.5 + 0.5 * rig, 0.5, 1.25)
  const factor = fRig * T.cl * MF.cl * OP.cl * (Z >= 3 && M.u < 0.5 ? 0.85 : 1)
  clMin *= factor
  clMax *= factor
  let cl = (clMin + clMax) / 2

  // --- ancho y profundidad ---
  const pasoPct = num(e.paso_pct)
  let ae = pasoPct ? D * clamp(pasoPct, 1, 100) / 100 : D * OP.ae
  if (txt(e.operacion) === "perfil") ae = D
  let doc = D * M.doc * T.doc * OP.doc * clamp(rig, 0.3, 1.5)
  if (txt(e.operacion) === "grabado_v") doc = prof || D * 0.3
  if (txt(e.operacion) === "planeado") doc = Math.min(1.5, D * 0.05)
  if (txt(e.operacion) === "acabado_pared") doc = prof ? Math.min(prof, D * 3) : D * 3

  // adelgazamiento de viruta: con poco ancho la viruta real es más delgada que el avance por filo
  let clProg = cl
  if (ae < D / 2) {
    const factorRCTF = D / (2 * Math.sqrt(ae * (D - ae)))
    clProg = cl * Math.min(factorRCTF, 2.5)
    if (factorRCTF > 1.15) R.supuestos.push(`Adelgazamiento de viruta: con ${fmt((ae / D) * 100)}% de paso el avance por filo se sube ×${fmt(factorRCTF, 2)} para que la viruta real tenga el grosor correcto.`)
  }

  // --- RPM y avance ---
  const vcMedia = ((M.vc[0] + M.vc[1]) / 2) * MF.vc
  const rpmIdeal = (vcMedia * 1000) / (Math.PI * D)
  let rpm = clamp(rpmIdeal, rpmMin, rpmMax)
  let avance = rpm * Z * clProg
  if (avance > avMax) {
    const rpm2 = avMax / (Z * clProg)
    if (rpm2 >= rpmMin) {
      rpm = rpm2
      avance = avMax
      R.avisos.push(`Tu máquina llega a ${fmt(avMax)} mm/min: bajé las RPM a ${fmt(rpm)} para conservar la carga de viruta y no quemar ni fundir.`)
    } else {
      rpm = rpmMin
      avance = avMax
      const clReal = avance / (rpm * Z)
      R.avisos.push(`Aun a ${fmt(rpmMin)} RPM la máquina no alcanza el avance ideal: la carga de viruta queda en ${fmt(clReal, 3)} mm (recomendado ${fmt(clMin, 3)}–${fmt(clMax, 3)}). Usa una fresa de menos filos o de menor diámetro.`)
      R.confianza -= 20
    }
  }
  const vcReal = (Math.PI * D * rpm) / 1000
  if (vcReal > M.vc[1] * MF.vc * 1.3) R.avisos.push(`Velocidad de corte alta (${fmt(vcReal)} m/min) para ${M.nombre}: si la fresa se calienta, baja RPM y conserva la carga de viruta.`)
  if (vcReal < M.vc[0] * MF.vc * 0.6) R.avisos.push(`Velocidad de corte baja (${fmt(vcReal)} m/min): el spindle no sube más RPM; está bien, pero baja el avance en proporción si vibra.`)

  // --- potencia y par ---
  const potDisp = P * 1000 * clamp(rpm / rpmMax, 0.25, 1) // spindles VFD: potencia proporcional a RPM bajo la nominal
  let potW = ((ae * doc * avance) / 60) * M.u
  if (potW > potDisp * 0.8) {
    const f = (potDisp * 0.8) / potW
    doc *= f
    potW *= f
    R.avisos.push(`Con la profundidad normal el spindle pasaría del 80% de su potencia a ${fmt(rpm)} RPM; la bajé a ${fmt(doc, 2)} mm por pasada.`)
  }
  const par = potW / ((2 * Math.PI * rpm) / 60) // N·m

  // --- deflexión de la fresa (viga en voladizo) ---
  const Ft = potW / (vcReal / 60) // fuerza tangencial media, N (P = F·v)
  const dCore = D * (T.nombre.startsWith("Un filo") ? 0.6 : 0.75)
  const I = (Math.PI * Math.pow(dCore, 4)) / 64
  const defl = (Ft * Math.pow(L, 3)) / (3 * MF.E * I) // mm
  if (defl > 0.05) {
    R.avisos.push(`La fresa se flexiona ≈ ${fmt(defl, 3)} mm con ${fmt(L)} mm fuera del collet: riesgo de vibración, paredes cónicas o rotura. Acorta el voladizo, baja la profundidad o usa fresa de mayor diámetro.`)
    R.confianza -= 15
  } else if (defl > 0.02) R.avisos.push(`Deflexión de la fresa ≈ ${fmt(defl, 3)} mm: aceptable en desbaste; para acabado fino deja una pasada ligera al final.`)

  // --- redondeos y pasadas ---
  rpm = Math.round(rpm / 100) * 100
  avance = Math.round(avance / 10) * 10
  const entrada = Math.round((avance * M.entrada) / 10) * 10
  let pasadas = 0
  if (prof && txt(e.operacion) !== "grabado_v" && txt(e.operacion) !== "acabado") pasadas = Math.max(1, Math.ceil(prof / doc - 1e-9))
  const docReal = pasadas ? (prof as number) / pasadas : doc
  const mrr = (ae * docReal * avance) / 1000
  const anguloRampa = M.u > 0.5 ? 2 : M.u > 0.1 ? 5 : 15

  const b1 = bloque(R, "Parámetros de corte")
  b1.filas.push({ etiqueta: "RPM", valor: fmt(rpm), destacado: true })
  b1.filas.push({ etiqueta: "Avance", valor: `${fmt(avance)} mm/min`, nota: `rango sano ${fmt(rpm * Z * clMin)}–${fmt(rpm * Z * clMax)}`, destacado: true })
  b1.filas.push({ etiqueta: "Avance de entrada (plunge)", valor: `${fmt(entrada)} mm/min`, nota: `mejor en rampa de ${anguloRampa}°` })
  b1.filas.push({ etiqueta: "Carga de viruta por filo", valor: `${fmt(clProg, 3)} mm`, nota: ae < D / 2 ? `viruta real ${fmt(cl, 3)} mm` : `recomendado ${fmt(clMin, 3)}–${fmt(clMax, 3)}` })
  if (pasadas) {
    b1.filas.push({ etiqueta: "Profundidad por pasada", valor: `${fmt(docReal, 2)} mm`, destacado: true })
    b1.filas.push({ etiqueta: "Pasadas", valor: String(pasadas), nota: `para ${fmt(prof as number, 1)} mm` })
  } else b1.filas.push({ etiqueta: "Profundidad por pasada (máx.)", valor: `${fmt(doc, 2)} mm` })
  if (txt(e.operacion) !== "perfil") b1.filas.push({ etiqueta: "Paso lateral (stepover)", valor: `${fmt(ae, 2)} mm`, nota: `${fmt((ae / D) * 100)}% del diámetro` })

  const b2 = bloque(R, "Revisión de la máquina")
  b2.filas.push({ etiqueta: "Velocidad de corte", valor: `${fmt(vcReal)} m/min`, nota: `típico ${fmt(M.vc[0] * MF.vc)}–${fmt(M.vc[1] * MF.vc)}` })
  b2.filas.push({ etiqueta: "Material removido", valor: `${fmt(mrr, 1)} cm³/min` })
  b2.filas.push({ etiqueta: "Potencia de corte", valor: `${fmt(potW / 1000, 2)} kW`, nota: `${fmt((potW / potDisp) * 100)}% de los ${fmt(potDisp / 1000, 1)} kW disponibles a ${fmt(rpm)} RPM` })
  b2.filas.push({ etiqueta: "Par en el spindle", valor: `${fmt(par, 2)} N·m` })
  b2.filas.push({ etiqueta: "Fuerza de corte", valor: `${fmt(Ft)} N`, nota: "media tangencial" })
  b2.filas.push({ etiqueta: "Deflexión de la fresa", valor: `${fmt(defl, 3)} mm`, nota: `${fmt(L)} mm de voladizo, núcleo ≈ ${fmt(dCore, 1)} mm` })

  if (T.nombre.startsWith("Punta bola")) {
    const Rb = D / 2
    const cresta = Rb - Math.sqrt(Math.max(0, Rb * Rb - (ae / 2) * (ae / 2)))
    const b3 = bloque(R, "Acabado")
    b3.filas.push({ etiqueta: "Altura de cresta (scallop)", valor: `${fmt(cresta * 1000, 0)} µm`, nota: cresta > 0.02 ? "se nota al tacto: baja el paso" : "liso al tacto" })
    const paso1 = 2 * Math.sqrt(Math.max(0, 2 * Rb * 0.01 - 0.01 * 0.01))
    b3.filas.push({ etiqueta: "Paso para cresta de 10 µm", valor: `${fmt(paso1, 2)} mm`, nota: `${fmt((paso1 / D) * 100)}% del diámetro` })
  }

  const Lc = num(e.longitud_corte)
  if (Lc && Lc > 0) {
    const t = ((Lc * 1000 * Math.max(1, pasadas)) / avance) * 1.15
    b2.filas.push({ etiqueta: "Tiempo de corte", valor: minutos(t), nota: "incluye 15% por aceleraciones" })
    R.datos.tiempo_min = r(t, 2)
  }

  // --- consejos ---
  if (M.lub) R.consejos.push(`Lubricación / refrigeración: ${M.lub}.`)
  R.consejos.push(M.nota)
  if (T.nota) R.consejos.push(T.nota)
  if (OP.nota) R.consejos.push(OP.nota)
  if (mq.nota) R.consejos.push(mq.nota)
  if (M.filos === 1 && Z > 2) R.avisos.push(`Para ${M.nombre} conviene fresa de 1 filo: con ${Z} filos la viruta no alcanza a salir y el material se funde o se pega.`)
  if (M.u >= 2 && rig < 1.5) {
    R.avisos.push(`${M.nombre} necesita una máquina rígida (fresadora): en un router de madera la fresa vibra y se rompe. Si lo intentas, pasadas de 0.1–0.2 mm y mucha paciencia.`)
    R.confianza -= 25
  }
  if (M.u >= 0.5 && rig < 0.5) {
    R.avisos.push("Máquina ligera para metal: pasadas de 0.2–0.3 mm, fresa de 1 filo de 3–4 mm y lubricación.")
    R.confianza -= 10
  }
  if (D >= 10 && rig < 0.5) R.avisos.push("Fresas grandes en máquina ligera: el collet y el motor sufren. Mejor 6 mm con más pasadas.")
  R.consejos.push("Primer corte siempre en un retazo: si quema o funde → sube avance o baja RPM; si vibra o suena a golpe → baja profundidad o avance.")
  R.datos = { ...R.datos, rpm, avance, entrada, carga_viruta: r(clProg, 3), profundidad_pasada: r(docReal, 2), pasadas, paso: r(ae, 2), potencia_kw: r(potW / 1000, 2), deflexion_mm: r(defl, 3), material: M.nombre }
  R.confianza = clamp(R.confianza, 20, 100)
  return R
}

export const ROUTER: Calculadora = {
  id: "router",
  nombre: "Router CNC y fresadora",
  proceso: "router",
  resumen: "RPM, avance, profundidad, pasadas, potencia, par y deflexión de la fresa para madera, plásticos, compuestos y metales.",
  campos: CAMPOS,
  calcular: calcRouter,
}

// Diagnóstico de parámetros que el usuario ya usa
export const REVISAR_ROUTER: Calculadora = {
  id: "router_revisar",
  nombre: "Revisar mis parámetros",
  proceso: "router",
  resumen: "Dime qué RPM y avance usas y te digo si la fresa está cortando o rozando.",
  campos: [
    { k: "material", etiqueta: "Material", tipo: "opcion", opciones: opciones(MAT_ROUTER), inicial: "mdf", req: true },
    { k: "diametro", etiqueta: "Diámetro de la fresa", tipo: "numero", unidad: "mm", inicial: 6, req: true },
    { k: "filos", etiqueta: "Filos", tipo: "numero", inicial: 2, req: true },
    { k: "rpm", etiqueta: "RPM que usas", tipo: "numero", inicial: 18000, req: true },
    { k: "avance", etiqueta: "Avance que usas", tipo: "numero", unidad: "mm/min", inicial: 2000, req: true },
    { k: "profundidad", etiqueta: "Profundidad por pasada que usas", tipo: "numero", unidad: "mm" },
  ],
  calcular: (e) => {
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
    let diag = "Dentro de rango"
    if (cl < clMin * 0.6) {
      diag = "Muy baja: la fresa roza en lugar de cortar"
      R.avisos.push("La fresa frota, se calienta, quema la madera o funde el plástico y se desafila rápido. Sube el avance o baja las RPM.")
    } else if (cl < clMin) {
      diag = "Algo baja"
      R.avisos.push("Si ves quemado o fundido, sube el avance o baja RPM.")
    } else if (cl > clMax * 1.5) {
      diag = "Muy alta: riesgo de romper la fresa"
      R.avisos.push("Riesgo de romper la fresa, vibración y mal acabado. Baja el avance o la profundidad.")
    } else if (cl > clMax) {
      diag = "Algo alta"
      R.avisos.push("Vigila vibración y ruido; baja un poco el avance si el acabado sale mal.")
    }
    const b = bloque(R, "Diagnóstico")
    b.filas.push({ etiqueta: "Veredicto", valor: diag, destacado: true })
    b.filas.push({ etiqueta: "Carga de viruta actual", valor: `${fmt(cl, 3)} mm/filo`, nota: `recomendado ${fmt(clMin, 3)}–${fmt(clMax, 3)}` })
    b.filas.push({ etiqueta: "Velocidad de corte", valor: `${fmt(vc)} m/min`, nota: `típico ${M.vc[0]}–${M.vc[1]}` })
    const prof = num(e.profundidad)
    if (prof) b.filas.push({ etiqueta: "Profundidad por pasada", valor: `${fmt(prof, 2)} mm`, nota: prof > D * M.doc * 1.3 ? `alta: típico hasta ${fmt(D * M.doc, 1)} mm` : `típico hasta ${fmt(D * M.doc, 1)} mm` })
    const clObj = (clMin + clMax) / 2
    const b2 = bloque(R, "Qué cambiar")
    b2.filas.push({ etiqueta: "Avance sugerido a tus RPM", valor: `${fmt(rpm * Z * clObj)} mm/min` })
    const rpmSug = av / (Z * clObj)
    b2.filas.push({ etiqueta: "RPM sugeridas a tu avance", valor: rpmSug < 6000 ? "menos de 6,000: mejor sube el avance" : fmt(rpmSug) })
    R.datos = { carga_viruta: r(cl, 4), recomendado_min: r(clMin, 3), recomendado_max: r(clMax, 3), diagnostico: diag }
    return R
  },
}
