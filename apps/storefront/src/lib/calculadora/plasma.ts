// Plasma CNC: velocidad, alturas, retardo de perforación, voltaje de arco (THC),
// kerf, aire y consumibles por amperaje y material.
// Modelo: tablas de velocidad en acero al carbón por amperaje (antorchas de
// aire tipo Powermax), factores por material y por calidad de la fuente.

import { type Calculadora, type Campo, type Entrada, type Preset, type Resultado, bloque, clamp, fmt, interp, masCercana, minutos, nuevo, num, opciones, r, txt } from "./comun"

// [espesor mm, velocidad mm/min] acero al carbón, corte de calidad
const TABLA: Record<string, number[][]> = {
  "30": [[1, 6500], [1.5, 5000], [3, 2000], [6, 600], [8, 350]],
  "45": [[1.5, 8000], [3, 5500], [6, 2200], [10, 900], [12, 600], [16, 350]],
  "65": [[3, 8000], [6, 3600], [10, 1900], [12, 1400], [16, 900], [20, 600], [25, 300]],
  "85": [[3, 9000], [6, 5000], [10, 2800], [12, 2100], [16, 1400], [20, 1000], [25, 600], [32, 380]],
  "105": [[6, 6000], [10, 3500], [12, 2800], [16, 1900], [20, 1400], [25, 900], [32, 550], [38, 380]],
  "125": [[6, 7000], [10, 4300], [12, 3400], [16, 2400], [20, 1800], [25, 1200], [32, 750], [38, 520], [44, 350]],
}
// alturas (mm) y voltaje de arco típico por amperaje
const AJUSTES: Record<string, { corte: number; perforacion: number; voltaje: [number, number]; kerf: number; aire: string; boquilla: string }> = {
  "30": { corte: 1.5, perforacion: 3.5, voltaje: [95, 115], kerf: 1.1, aire: "5.5 bar, 110 l/min", boquilla: "boquilla 30 A, electrodo estándar" },
  "45": { corte: 1.5, perforacion: 3.8, voltaje: [110, 130], kerf: 1.3, aire: "5.5 bar, 170 l/min", boquilla: "boquilla 45 A + escudo" },
  "65": { corte: 1.5, perforacion: 3.8, voltaje: [120, 140], kerf: 1.7, aire: "5.9 bar, 220 l/min", boquilla: "boquilla 65 A + escudo" },
  "85": { corte: 1.5, perforacion: 3.8, voltaje: [125, 150], kerf: 2.0, aire: "5.9 bar, 220 l/min", boquilla: "boquilla 85 A + escudo" },
  "105": { corte: 2.0, perforacion: 4.0, voltaje: [135, 160], kerf: 2.4, aire: "5.9 bar, 250 l/min", boquilla: "boquilla 105 A + escudo" },
  "125": { corte: 2.0, perforacion: 4.5, voltaje: [140, 170], kerf: 2.8, aire: "5.9 bar, 280 l/min", boquilla: "boquilla 125 A + escudo" },
}
export const MAT_PLASMA: Record<string, { nombre: string; vel: number; esp: number; gas?: string; nota?: string }> = {
  acero_dulce: { nombre: "Acero al carbón", vel: 1, esp: 1 },
  inoxidable: { nombre: "Acero inoxidable", vel: 0.75, esp: 0.8, gas: "aire (canto oscuro) o N₂ (más limpio)", nota: "Con aire el canto queda negro y oxidado; para soldar después, límpialo con disco." },
  aluminio: { nombre: "Aluminio", vel: 1.1, esp: 0.8, nota: "Más escoria que el acero: velocidad alta y altura exacta. Peligro: nunca cortes aluminio sobre una mesa de agua cerrada (hidrógeno)." },
  galvanizado: { nombre: "Lámina galvanizada", vel: 0.95, esp: 1, nota: "El zinc suelta humo tóxico: extracción obligatoria." },
}
export const FUENTES_PLASMA: Record<string, { nombre: string; vel: number; kerf: number; nota: string }> = {
  aire_calidad: { nombre: "Fuente de aire de marca (Hypertherm, Thermal Dynamics, Lincoln)", vel: 1, kerf: 1, nota: "Las tablas de abajo son de este tipo de antorcha." },
  aire_economica: { nombre: "Fuente económica (CUT-60/80, LGK, Jasic, Lotos)", vel: 0.75, kerf: 1.2, nota: "Rinden 70–80% de la tabla: baja la velocidad y espera más bisel y escoria. Usa consumibles originales de la antorcha (P80, SG-55, A141)." },
  alta_definicion: { nombre: "Alta definición (HPR, XPR, oxígeno)", vel: 1.2, kerf: 0.8, nota: "Corte casi sin bisel y canto apto para soldar; sigue la tabla de tu fuente." },
}
export const PRESETS_PLASMA: Preset[] = [45, 65, 85, 105, 125].map((a) => ({ id: `a${a}`, nombre: `${a} A`, valores: { amperaje: a } }))

const CAMPOS: Campo[] = [
  { k: "fuente", etiqueta: "Tipo de fuente", tipo: "opcion", opciones: opciones(FUENTES_PLASMA), inicial: "aire_calidad", seccion: "Máquina", maquina: true },
  { k: "amperaje", etiqueta: "Amperaje de corte", tipo: "numero", unidad: "A", inicial: 65, seccion: "Máquina", maquina: true },
  { k: "thc", etiqueta: "Control de altura (THC)", tipo: "opcion", opciones: [{ v: "si", t: "Sí, por voltaje de arco" }, { v: "no", t: "No (altura fija)" }], inicial: "si", seccion: "Máquina", maquina: true },
  { k: "material", etiqueta: "Material", tipo: "opcion", opciones: opciones(MAT_PLASMA), inicial: "acero_dulce", seccion: "Material", req: true },
  { k: "espesor", etiqueta: "Espesor", tipo: "numero", unidad: "mm", inicial: 6, seccion: "Material", req: true },
  { k: "longitud_corte", etiqueta: "Largo total de corte", tipo: "numero", unidad: "m", seccion: "Trabajo" },
  { k: "perforaciones", etiqueta: "Perforaciones (contornos)", tipo: "numero", seccion: "Trabajo" },
]

export const calcPlasma = (e: Entrada): Resultado => {
  const R = nuevo("Plasma CNC: velocidad y alturas")
  const M = MAT_PLASMA[txt(e.material)] || MAT_PLASMA.acero_dulce
  const F = FUENTES_PLASMA[txt(e.fuente)] || FUENTES_PLASMA.aire_calidad
  const A = num(e.amperaje)
  const esp = num(e.espesor)
  if (!A) R.faltan.push("Amperaje de tu fuente (A)")
  if (!esp) R.faltan.push("Espesor de la lámina (mm)")
  if (!A || !esp) return R
  const clave = masCercana(Object.keys(TABLA), A)
  if (Number(clave) !== A) R.supuestos.push(`Usé la tabla de ${clave} A (la más cercana a ${A} A).`)
  const tabla = TABLA[clave]
  const aj = AJUSTES[clave]
  const espEq = esp / M.esp
  const maxCalidad = tabla[tabla.length - 1][0] * M.esp
  let v = interp(tabla, espEq, 1, true) * M.vel * F.vel
  if (espEq > tabla[tabla.length - 1][0]) {
    const u = tabla[tabla.length - 1]
    v = u[1] * Math.pow(u[0] / espEq, 1.5) * M.vel * F.vel
  }
  // amperaje de más para lámina muy delgada: escala la velocidad al mínimo útil
  if (espEq < tabla[0][0]) {
    v = tabla[0][1] * Math.min(2, tabla[0][0] / espEq) * M.vel * F.vel
    R.avisos.push(`${fmt(esp, 1)} mm es delgado para ${clave} A: va a derretir la orilla. Baja el amperaje (30–45 A con boquilla fina) o sube la velocidad al máximo de tu máquina.`)
    R.confianza -= 15
  }
  const retardo = esp <= 3 ? 0.1 : esp <= 6 ? 0.3 : esp <= 10 ? 0.5 : esp <= 16 ? 0.8 : esp <= 25 ? 1.2 : 2
  const kerf = aj.kerf * F.kerf + esp * 0.03

  const b = bloque(R, "Corte")
  b.filas.push({ etiqueta: "Velocidad de corte", valor: `${fmt(v)} mm/min`, nota: "ajusta ±15% según la escoria", destacado: true })
  b.filas.push({ etiqueta: "Altura de corte", valor: `${fmt(aj.corte, 1)} mm`, destacado: true })
  b.filas.push({ etiqueta: "Altura de perforación", valor: `${fmt(aj.perforacion, 1)} mm`, nota: "≈ 2.5 veces la de corte" })
  b.filas.push({ etiqueta: "Retardo de perforación", valor: `${fmt(retardo, 1)} s` })
  if (txt(e.thc) !== "no") b.filas.push({ etiqueta: "Voltaje de arco (THC)", valor: `${aj.voltaje[0]}–${aj.voltaje[1]} V`, nota: "mide el real a la altura de corte y fija ese; sube 1–2 V por cada 0.1 mm más de altura" })
  b.filas.push({ etiqueta: "Ancho de corte (kerf)", valor: `${fmt(kerf, 1)} mm`, nota: "compénsalo en el CAM" })
  b.filas.push({ etiqueta: "Entrada (lead-in)", valor: esp <= 6 ? "arco o recta de 3–5 mm" : `recta de ${fmt(Math.min(esp, 15))} mm, perfora en el desperdicio` })
  if (esp > maxCalidad) {
    R.avisos.push(`${fmt(esp)} mm pasa del espesor de corte de calidad para ${clave} A en ${M.nombre} (≈ ${fmt(maxCalidad)} mm): será corte de separación, con escoria y bisel. Empieza desde el borde, no perfores.`)
    R.confianza -= 30
  } else if (esp > maxCalidad * 0.6) R.avisos.push("Espesor grueso: perfora en zona de desperdicio o arranca desde el borde; perforar grueso gasta rápido los consumibles.")

  const b2 = bloque(R, "Tu máquina")
  b2.filas.push({ etiqueta: "Consumibles", valor: aj.boquilla, nota: "escudo o guía de arrastre si cortas sin THC" })
  b2.filas.push({ etiqueta: "Aire", valor: aj.aire, nota: "seco y sin aceite: secador o filtro coalescente, si no los consumibles duran la mitad" })
  if (M.gas) b2.filas.push({ etiqueta: "Gas", valor: M.gas })
  const vida = Math.round((esp <= 6 ? 600 : esp <= 12 ? 350 : 200) * (F.vel >= 1 ? 1 : 0.6))
  b2.filas.push({ etiqueta: "Vida típica del electrodo", valor: `≈ ${fmt(vida)} perforaciones`, nota: "cámbialo cuando el hueco pase de 1 mm; la boquilla cuando el corte se abra" })

  const L = num(e.longitud_corte)
  const n = num(e.perforaciones) || 0
  if (L && L > 0) {
    const t = ((L * 1000) / v) * 1.1 + (n * (retardo + 1.5)) / 60
    b.filas.push({ etiqueta: "Tiempo estimado", valor: minutos(t), nota: n ? `${n} perforaciones incluidas` : "sin perforaciones" })
    R.datos.tiempo_min = r(t, 2)
  }
  R.consejos.push("Escoria abajo en bolitas que se caen: vas lento. Escoria dura pegada con chispa hacia adelante: vas rápido. Bisel en un solo lado: revisa la boquilla y la altura.")
  if (M.nota) R.consejos.push(M.nota)
  R.consejos.push(F.nota)
  R.consejos.push("La tabla del fabricante de TU antorcha y consumibles manda; esto sirve para cotizar y arrancar.")
  R.datos = { ...R.datos, velocidad_mm_min: r(v), altura_corte: aj.corte, altura_perforacion: aj.perforacion, retardo_s: retardo, kerf_mm: r(kerf, 1), voltaje: `${aj.voltaje[0]}-${aj.voltaje[1]}`, tabla_amperes: clave }
  R.confianza = clamp(R.confianza, 20, 100)
  return R
}

export const PLASMA: Calculadora = {
  id: "plasma",
  nombre: "Plasma CNC",
  proceso: "plasma",
  resumen: "Velocidad, alturas, retardo de perforación, voltaje para el THC, kerf, aire y consumibles de 30 a 125 A.",
  campos: CAMPOS,
  calcular: calcPlasma,
}
