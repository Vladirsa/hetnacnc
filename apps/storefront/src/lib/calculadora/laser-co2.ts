// Láser CO₂: corte, grabado y marcado por potencia de tubo y lente.
// Modelo: tablas de velocidad de corte con tubo de 100 W por material y espesor
// (escala lineal con la potencia real del tubo), lente (foco, kerf y espesor
// máximo), pasadas cuando el espesor rebasa lo que corta el tubo, corriente
// máxima del tubo, y grabado por intervalo de línea (LPI/DPI) para el tiempo.

import { type Calculadora, type Campo, type Entrada, type Preset, type Resultado, bloque, clamp, fmt, interp, minutos, nuevo, num, opciones, r, txt } from "./comun"

export type TuboCO2 = { nombre: string; w: number; real: number; ma?: number; rf?: boolean; nota?: string }
export const TUBOS: Record<string, TuboCO2> = {
  k40: { nombre: "K40 (tubo 40 W, real ≈ 35 W)", w: 40, real: 35, ma: 18, nota: "El K40 rinde 30–35 W reales. Más de 18 mA acorta la vida del tubo." },
  "50": { nombre: "Tubo 50 W", w: 50, real: 45, ma: 20 },
  "60": { nombre: "Tubo 60 W", w: 60, real: 55, ma: 22 },
  "80": { nombre: "Tubo 80 W", w: 80, real: 75, ma: 26 },
  "100": { nombre: "Tubo 100 W", w: 100, real: 95, ma: 28 },
  "130": { nombre: "Tubo 130 W", w: 130, real: 125, ma: 30 },
  "150": { nombre: "Tubo 150 W", w: 150, real: 145, ma: 30 },
  "180": { nombre: "Tubo 180 W", w: 180, real: 175, ma: 32 },
  "300": { nombre: "Tubo 300 W (metal y acrílico grueso)", w: 300, real: 290, ma: 36, nota: "A 300 W ya corta lámina delgada de acero con oxígeno; necesita cabezal con gas." },
  rf30: { nombre: "RF 30 W (Epilog, Trotec, Universal)", w: 30, real: 30, rf: true, nota: "Los tubos RF tienen punto más fino y responden al instante: graban mejor que un tubo de vidrio del doble de potencia." },
  rf60: { nombre: "RF 60 W", w: 60, real: 60, rf: true },
  rf100: { nombre: "RF 100 W", w: 100, real: 100, rf: true },
}
export const PRESETS_CO2: Preset[] = Object.entries(TUBOS).map(([id, t]) => ({ id, nombre: t.nombre, valores: { tubo: id } }))

export const LENTES: Record<string, { nombre: string; kerf: number; espMax: number; puntoUm: number; nota: string }> = {
  "1.5": { nombre: '1.5" (38 mm): grabado fino', kerf: 0.1, espMax: 0.5, puntoUm: 100, nota: "Punto muy fino para fotos y detalle; sólo corta hasta ~3 mm." },
  "2": { nombre: '2" (50.8 mm): uso general', kerf: 0.15, espMax: 1, puntoUm: 150, nota: "La lente de todos los días: graba bien y corta hasta 8–10 mm." },
  "2.5": { nombre: '2.5" (63.5 mm): corte medio', kerf: 0.2, espMax: 1.25, puntoUm: 200, nota: "Más profundidad de foco: cantos más rectos en 10–15 mm." },
  "4": { nombre: '4" (101 mm): acrílico grueso', kerf: 0.3, espMax: 1.6, puntoUm: 300, nota: "Para acrílico de 15–25 mm con tubo grande; graba grueso." },
}

type MatCO2 = {
  nombre: string
  grupo: string
  corte?: number[][] // [espesor mm, velocidad mm/s con 100 W reales]
  grabado?: [number, number, number, number] // [vel min, vel max mm/s, potencia min %, potencia max %] con 80 W
  marcado?: [number, number] // vector score: [vel mm/s, potencia %] con 80 W
  aviso?: string
  prohibido?: string
}
export const MAT_CO2: Record<string, MatCO2> = {
  mdf: { nombre: "MDF", grupo: "Madera", corte: [[3, 20], [6, 8], [9, 4], [12, 2.5], [15, 1.5], [18, 0.9]], grabado: [250, 450, 15, 30], marcado: [300, 12] },
  triplay: { nombre: "Triplay / contrachapado", grupo: "Madera", corte: [[3, 22], [6, 10], [9, 5], [12, 3]], grabado: [250, 450, 15, 30], marcado: [300, 12], aviso: "El pegamento del triplay varía por lote: algunos no cortan parejo. Prueba en una esquina." },
  madera_blanda: { nombre: "Madera blanda (pino, balsa, cedro)", grupo: "Madera", corte: [[2, 30], [3, 22], [6, 10], [10, 4.5], [15, 2]], grabado: [250, 450, 15, 30], marcado: [300, 12] },
  madera_dura: { nombre: "Madera dura (encino, maple, nogal)", grupo: "Madera", corte: [[3, 14], [6, 5], [9, 2.5], [12, 1.5]], grabado: [200, 400, 20, 40], marcado: [250, 15], aviso: "Graba con más contraste que la madera blanda; el encino con vetas abiertas puede salir disparejo." },
  bambu: { nombre: "Bambú", grupo: "Madera", corte: [[3, 15], [5, 8], [8, 3.5]], grabado: [250, 450, 18, 35], marcado: [300, 12] },
  corcho: { nombre: "Corcho", grupo: "Madera", corte: [[2, 40], [5, 15], [10, 5]], grabado: [300, 500, 10, 20], marcado: [350, 8] },
  acrilico: { nombre: "Acrílico fundido (cast)", grupo: "Plásticos", corte: [[2, 28], [3, 20], [5, 12], [6, 10], [8, 6], [10, 4], [15, 2], [20, 1], [25, 0.6]], grabado: [300, 500, 20, 35], marcado: [350, 10], aviso: "Para canto pulido brillante usa fundido (cast); el extruido corta bien pero graba transparente y sin contraste." },
  acrilico_extruido: { nombre: "Acrílico extruido", grupo: "Plásticos", corte: [[2, 30], [3, 22], [5, 13], [6, 11], [8, 6.5], [10, 4.5], [15, 2.2]], grabado: [300, 500, 15, 30], marcado: [350, 10], aviso: "Corta un poco más rápido que el fundido y con canto brillante, pero el grabado queda transparente." },
  policarbonato: { nombre: "Policarbonato", grupo: "Plásticos", corte: [[1, 15], [2, 8]], grabado: [300, 500, 15, 25], aviso: "Corta mal con CO₂: amarillea, hace flama y deja el canto negro. Mejor router." },
  petg: { nombre: "PET-G", grupo: "Plásticos", corte: [[1, 25], [2, 12], [3, 7]], grabado: [300, 500, 15, 25], aviso: "Corta aceptable con canto algo fundido; ventila bien." },
  eva: { nombre: "Goma EVA / foamy", grupo: "Plásticos", corte: [[2, 60], [5, 25], [10, 10]], grabado: [400, 600, 8, 15], marcado: [400, 6], aviso: "Se funde con poca potencia: velocidad alta y aire. Verifica que sea EVA y no PVC espumado." },
  hule: { nombre: "Hule para sellos (láser)", grupo: "Plásticos", corte: [[2, 15], [3, 10]], grabado: [200, 350, 40, 70], aviso: "Usa hule especial para láser (sin cloro); huele fuerte: extracción." },
  carton: { nombre: "Cartón / cartulina", grupo: "Papel y tela", corte: [[1, 60], [3, 35], [5, 20]], grabado: [400, 600, 10, 20], marcado: [400, 8], aviso: "Vigila la flama: prende fácil. Nunca dejes la máquina sola." },
  corrugado: { nombre: "Cartón corrugado", grupo: "Papel y tela", corte: [[3, 45], [5, 30], [7, 20]], grabado: [400, 600, 8, 15], marcado: [400, 6], aviso: "Aire fuerte para que no prenda el canal interior." },
  papel: { nombre: "Papel", grupo: "Papel y tela", corte: [[0.2, 150], [0.5, 100]], grabado: [500, 800, 8, 15], marcado: [500, 5] },
  tela: { nombre: "Tela (algodón, fieltro, mezclilla)", grupo: "Papel y tela", corte: [[0.5, 100], [1, 70], [3, 30]], grabado: [400, 600, 10, 20], marcado: [400, 8], aviso: "Las sintéticas (poliéster) sellan el borde; el algodón se deshilacha menos con velocidad alta." },
  piel: { nombre: "Piel natural", grupo: "Papel y tela", corte: [[1, 40], [2, 25], [3, 15], [4, 10]], grabado: [300, 500, 15, 30], marcado: [350, 10], aviso: "Sólo piel curtida vegetal o natural; la sintética puede ser PVC (prohibido)." },
  piel_pu: { nombre: "Piel sintética PU (no PVC)", grupo: "Papel y tela", corte: [[1, 45], [1.5, 30]], grabado: [350, 550, 12, 25], aviso: "Confirma con el proveedor que es PU y no PVC: el PVC suelta cloro." },
  vidrio: { nombre: "Vidrio (sólo grabado)", grupo: "Sólo grabado", grabado: [200, 350, 20, 35], aviso: "No se corta con CO₂. Para grabar, moja un papel o pon jabón líquido encima: evita las astillas y aclara el grabado." },
  espejo: { nombre: "Espejo (grabado por atrás)", grupo: "Sólo grabado", grabado: [200, 350, 20, 35], aviso: "Graba por la cara del azogue, imagen en espejo; luego pinta el fondo." },
  pizarra: { nombre: "Pizarra", grupo: "Sólo grabado", grabado: [200, 350, 25, 45], aviso: "Graba blanco grisáceo con buen contraste; con poca potencia queda sutil." },
  ceramica: { nombre: "Cerámica esmaltada / azulejo", grupo: "Sólo grabado", grabado: [200, 350, 30, 60], aviso: "El CO₂ sólo marca el esmalte; para negro permanente usa el método Norton (pintura blanca y después limpiar)." },
  piedra: { nombre: "Piedra / mármol / granito", grupo: "Sólo grabado", grabado: [150, 300, 30, 60], aviso: "El mármol graba blanco y claro; el granito necesita más potencia y queda más tenue." },
  anodizado: { nombre: "Aluminio anodizado (sólo grabado)", grupo: "Sólo grabado", grabado: [300, 500, 20, 40], aviso: "El CO₂ sólo quita el anodizado; para marcar metal desnudo es láser de fibra." },
  metal_spray: { nombre: "Metal con spray de marcado (Cermark/LBT)", grupo: "Sólo grabado", grabado: [100, 200, 60, 100], aviso: "Velocidad baja y potencia alta para que el pigmento se funda al metal; lava el sobrante." },
  pvc: { nombre: "PVC / vinil", grupo: "No apto", prohibido: "NO LO CORTES: el PVC y el vinil sueltan cloro, gas tóxico y corrosivo que daña pulmones, óptica y máquina." },
  abs: { nombre: "ABS", grupo: "No apto", prohibido: "El ABS se funde, hace flama y suelta cianuro de hidrógeno. Mejor router o impresión 3D." },
  unicel: { nombre: "Unicel / poliestireno espumado", grupo: "No apto", prohibido: "Prende y se derrite: riesgo de incendio. No lo cortes con láser." },
  fibra_vidrio: { nombre: "Fibra de vidrio / carbono", grupo: "No apto", prohibido: "La resina epóxica suelta humos tóxicos y el vidrio no se corta. Router con extracción." },
  policarbonato_grueso: { nombre: "Policarbonato de más de 2 mm", grupo: "No apto", prohibido: "No atraviesa: sólo se quema y prende. Router." },
}

const CAMPOS: Campo[] = [
  { k: "tubo", etiqueta: "Tubo / fuente", tipo: "opcion", opciones: opciones(TUBOS), inicial: "80", seccion: "Máquina", maquina: true },
  { k: "lente", etiqueta: "Lente", tipo: "opcion", opciones: opciones(LENTES), inicial: "2", seccion: "Máquina", maquina: true },
  { k: "operacion", etiqueta: "Qué vas a hacer", tipo: "opcion", opciones: [{ v: "corte", t: "Cortar" }, { v: "grabado", t: "Grabar (raster, relleno)" }, { v: "marcado", t: "Marcar líneas (vector, sin atravesar)" }], inicial: "corte", seccion: "Trabajo" },
  { k: "material", etiqueta: "Material", tipo: "opcion", opciones: opciones(MAT_CO2), inicial: "mdf", seccion: "Material", req: true },
  { k: "espesor", etiqueta: "Espesor", tipo: "numero", unidad: "mm", inicial: 3, seccion: "Material", si: { k: "operacion", v: "corte" } },
  { k: "dpi", etiqueta: "Resolución de grabado", tipo: "opcion", opciones: [{ v: "200", t: "200 DPI: rápido, relleno sencillo" }, { v: "300", t: "300 DPI: estándar" }, { v: "400", t: "400 DPI: detalle" }, { v: "500", t: "500 DPI: fotos (lente 1.5\")" }], inicial: "300", seccion: "Trabajo", si: { k: "operacion", v: "grabado" } },
  { k: "longitud_corte", etiqueta: "Largo total de corte (para el tiempo)", tipo: "numero", unidad: "m", seccion: "Trabajo", si: { k: "operacion", v: ["corte", "marcado"] } },
  { k: "area_cm2", etiqueta: "Área a grabar (para el tiempo)", tipo: "numero", unidad: "cm²", seccion: "Trabajo", si: { k: "operacion", v: "grabado" } },
]

export const calcCO2 = (e: Entrada): Resultado => {
  const R = nuevo("Láser CO₂: velocidad y potencia")
  const T = TUBOS[txt(e.tubo)] || TUBOS["80"]
  const Lz = LENTES[txt(e.lente)] || LENTES["2"]
  const M = MAT_CO2[txt(e.material)] || MAT_CO2.mdf
  const op = txt(e.operacion) || "corte"
  if (M.prohibido) {
    R.avisos.push(M.prohibido)
    bloque(R, "Resultado").filas.push({ etiqueta: "Veredicto", valor: "No apto para láser CO₂", destacado: true })
    R.confianza = 100
    return R
  }
  const Wreal = T.real
  // ventaja de los RF en corte delgado y grabado (punto fino)
  const fRF = T.rf ? 1.15 : 1
  const b = bloque(R, op === "corte" ? "Corte" : op === "grabado" ? "Grabado" : "Marcado")

  if (op === "corte") {
    if (!M.corte) {
      R.avisos.push(M.aviso || "Este material no se corta con CO₂.")
      b.filas.push({ etiqueta: "Veredicto", valor: "No se corta con CO₂: sólo grabado", destacado: true })
      return R
    }
    const esp = num(e.espesor)
    if (!esp) {
      R.faltan.push("Espesor del material (mm)")
      return R
    }
    const escala = (Wreal / 100) * fRF
    const ultimo = M.corte[M.corte.length - 1]
    // espesor máximo que atraviesa en una pasada con este tubo y lente
    const espMax = ultimo[0] * Math.pow(escala, 0.8) * Lz.espMax
    let v = esp <= ultimo[0] ? interp(M.corte, esp, 1, true) * escala : ultimo[1] * Math.pow(ultimo[0] / esp, 2) * escala
    let pasadas = 1
    if (esp > espMax) {
      pasadas = Math.min(4, Math.ceil(esp / espMax))
      v = interp(M.corte, esp / pasadas, 1, true) * escala
      R.avisos.push(`${fmt(esp, 1)} mm pasa de lo que un tubo de ${T.w} W con lente ${Lz.nombre.split(":")[0]} corta de una pasada en ${M.nombre} (≈ ${fmt(espMax, 1)} mm). Te propongo ${pasadas} pasadas bajando el foco ${fmt(esp / pasadas, 1)} mm cada una; espera canto más quemado.`)
      R.confianza -= 20
    }
    const vMin = T.rf ? 1 : 2
    if (v < vMin) {
      R.avisos.push(`La velocidad sale muy baja (${fmt(v, 1)} mm/s): el material se va a quemar o a derretir antes de atravesar. Es trabajo para un tubo más grande o para router.`)
      R.confianza -= 25
    }
    const potPct = Wreal >= 100 ? [70, 80] : T.rf ? [90, 100] : [80, 90]
    b.filas.push({ etiqueta: "Velocidad de corte", valor: `${fmt(v, 1)} mm/s`, nota: `${fmt(v * 60)} mm/min`, destacado: true })
    b.filas.push({ etiqueta: "Potencia", valor: `${potPct[0]}–${potPct[1]} %`, nota: T.ma ? `no pases de ${T.ma} mA en el amperímetro` : "RF: puedes usar 100%", destacado: true })
    b.filas.push({ etiqueta: "Pasadas", valor: String(pasadas) })
    b.filas.push({ etiqueta: "Foco", valor: esp >= 6 ? `${fmt(Math.min(esp / 3, 4), 1)} mm dentro del material` : "en la superficie", nota: "en grueso, el foco dentro endereza el canto" })
    b.filas.push({ etiqueta: "Aire (air assist)", valor: M.grupo === "Plásticos" && M.nombre.startsWith("Acrílico") ? "bajo (mucho aire empaña el canto)" : "fuerte" })
    b.filas.push({ etiqueta: "Ancho de corte (kerf)", valor: `${fmt(Lz.kerf + esp * 0.012, 2)} mm`, nota: "compénsalo en el CAM si las piezas deben encajar" })
    b.filas.push({ etiqueta: "Espesor máximo de una pasada", valor: `≈ ${fmt(espMax, 1)} mm`, nota: `${M.nombre} con este tubo y lente` })
    const L = num(e.longitud_corte)
    if (L && L > 0) {
      const t = ((L * 1000) / v / 60) * 1.2 * pasadas
      b.filas.push({ etiqueta: "Tiempo de corte", valor: minutos(t), nota: "incluye 20% por movimientos y perforaciones" })
      R.datos.tiempo_min = r(t, 2)
    }
    R.datos = { ...R.datos, velocidad_mm_s: r(v, 1), potencia_pct: `${potPct[0]}-${potPct[1]}`, pasadas, kerf_mm: r(Lz.kerf + esp * 0.012, 2) }
    if (M.nombre.startsWith("Acrílico")) R.consejos.push("Quita la película protectora de arriba para grabar; déjala para cortar (protege del humo). Levanta la pieza de la cama con puntas para que no marque el reverso.")
    if (M.grupo === "Madera") R.consejos.push("Cinta de enmascarar (masking) encima evita la mancha de humo; madera con humedad corta más lento.")
  } else if (op === "grabado") {
    if (!M.grabado) {
      R.avisos.push("Este material no se graba con CO₂.")
      return R
    }
    const g = M.grabado
    const f = Math.pow(80 / Wreal, 0.7) / (T.rf ? 1.2 : 1)
    const pmin = clamp(g[2] * f, 5, 90)
    const pmax = clamp(g[3] * f, 8, 100)
    const dpi = num(e.dpi) || 300
    const intervalo = 25.4 / dpi
    const v = (g[0] + g[1]) / 2
    b.filas.push({ etiqueta: "Velocidad", valor: `${g[0]}–${g[1]} mm/s`, nota: "empieza por el medio", destacado: true })
    b.filas.push({ etiqueta: "Potencia", valor: `${fmt(pmin)}–${fmt(pmax)} %`, destacado: true })
    b.filas.push({ etiqueta: "Intervalo de línea", valor: `${fmt(intervalo, 3)} mm`, nota: `${dpi} líneas por pulgada` })
    b.filas.push({ etiqueta: "Punto del láser", valor: `≈ ${Lz.puntoUm} µm`, nota: intervalo * 1000 < Lz.puntoUm * 0.6 ? "más fino que el punto: las líneas se enciman, baja el DPI o usa lente 1.5\"" : "adecuado para esta lente" })
    b.filas.push({ etiqueta: "Foco", valor: "en la superficie (o 1–2 mm desenfocado para relleno parejo)" })
    b.filas.push({ etiqueta: "Aire", valor: "bajo" })
    const A = num(e.area_cm2)
    if (A && A > 0) {
      const t = (((A * 100) / intervalo / v) * 1.3) / 60
      b.filas.push({ etiqueta: "Tiempo de grabado", valor: minutos(t), nota: "raster bidireccional, incluye sobrerecorrido" })
      R.datos.tiempo_min = r(t, 2)
    }
    R.datos = { ...R.datos, velocidad_mm_s: v, potencia_pct: `${fmt(pmin)}-${fmt(pmax)}`, intervalo_mm: r(intervalo, 3) }
    R.consejos.push("Para fotos: convierte a escala de grises, aplica tramado (Jarvis o Stucki) y graba a 300–400 DPI. Para relleno sólido, 200–250 DPI basta y va más rápido.")
  } else {
    const m = M.marcado || (M.grabado ? [M.grabado[1], M.grabado[2]] : undefined)
    if (!m) {
      R.avisos.push("Este material no se marca con CO₂.")
      return R
    }
    const f = Math.pow(80 / Wreal, 0.7)
    b.filas.push({ etiqueta: "Velocidad", valor: `${fmt(m[0])} mm/s`, destacado: true })
    b.filas.push({ etiqueta: "Potencia", valor: `${fmt(clamp(m[1] * f, 3, 60))} %`, nota: "sube de 2 en 2 hasta que marque sin atravesar", destacado: true })
    b.filas.push({ etiqueta: "Foco", valor: "en la superficie" })
    const L = num(e.longitud_corte)
    if (L && L > 0) {
      const t = ((L * 1000) / m[0] / 60) * 1.3
      b.filas.push({ etiqueta: "Tiempo", valor: minutos(t) })
      R.datos.tiempo_min = r(t, 2)
    }
    R.consejos.push("Marcar en vector es hasta 10 veces más rápido que grabar en raster: úsalo para contornos, texto delgado y dobleces.")
  }

  const b2 = bloque(R, "Tu máquina")
  b2.filas.push({ etiqueta: "Potencia real estimada", valor: `${fmt(Wreal)} W`, nota: T.rf ? "RF, punto fino" : "tubo de vidrio DC" })
  if (T.ma) b2.filas.push({ etiqueta: "Corriente máxima recomendada", valor: `${T.ma} mA`, nota: "más corriente = menos vida del tubo, no más corte" })
  b2.filas.push({ etiqueta: "Lente", valor: Lz.nombre, nota: Lz.nota })
  if (M.aviso) R.avisos.push(M.aviso)
  if (T.nota) R.consejos.push(T.nota)
  R.consejos.push("Prueba en un retazo: la potencia real cambia con la edad del tubo, el enfoque y la limpieza de espejos y lente. Limpia la lente cada semana si cortas MDF.")
  R.confianza = clamp(R.confianza, 20, 100)
  return R
}

export const CO2: Calculadora = {
  id: "laser_co2",
  nombre: "Láser CO₂",
  proceso: "laser_co2",
  resumen: "Corte, grabado y marcado por potencia de tubo (K40 a 300 W, RF) y lente: velocidad, potencia, pasadas, foco, kerf y tiempo.",
  campos: CAMPOS,
  calcular: calcCO2,
}
