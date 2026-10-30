// Impresión 3D: parámetros de impresión (FDM y resina), tiempo, material y costo.
// Modelo FDM: temperaturas y velocidades por material y clase de impresora,
// flujo volumétrico máximo del hotend como límite real de velocidad, tiempo por
// volumen efectivo (paredes + relleno). Resina: exposición por tipo de pantalla
// y tiempo por capas.

import { type Calculadora, type Campo, type Entrada, type Preset, type Resultado, bloque, clamp, fmt, minutos, nuevo, num, opciones, pesos, r, txt } from "./comun"

export const IMPRESORAS: Record<string, { nombre: string; vel: number; flujo: number; acel: number; cerrada: boolean; nota: string }> = {
  basica: { nombre: "Básica (Ender 3, Anet, Creality clásica)", vel: 60, flujo: 10, acel: 500, cerrada: false, nota: "Hotend de PTFE: máximo 240–250 °C; no imprimas nylon ni policarbonato sin cambiarlo a all-metal." },
  directa: { nombre: "Mejorada / extrusor directo (Ender 3 S1, Sovol, Prusa MK3)", vel: 80, flujo: 15, acel: 1500, cerrada: false, nota: "Buena con TPU y PETG; ABS sólo con cerramiento improvisado." },
  rapida: { nombre: "Rápida CoreXY (Bambu P1/X1, Creality K1, Voron, Prusa MK4)", vel: 200, flujo: 25, acel: 10000, cerrada: true, nota: "El límite ya no es la velocidad del eje sino el flujo del hotend: capas gruesas van a menos mm/s." },
  industrial: { nombre: "Industrial cerrada (Ultimaker, Raise3D, Fortus)", vel: 100, flujo: 20, acel: 3000, cerrada: true, nota: "Cámara caliente: ABS, ASA, PC y nylon sin deformación." },
  resina_mono: { nombre: "Resina LCD mono 2K–4K (Mars, Photon Mono, Saturn)", vel: 0, flujo: 0, acel: 0, cerrada: true, nota: "Exposición corta (1.5–3 s) y capas de 0.05 mm." },
  resina_8k: { nombre: "Resina LCD 8K–12K (Saturn 3, Photon M5, Sonic Mighty)", vel: 0, flujo: 0, acel: 0, cerrada: true, nota: "Píxel de 18–24 µm: detalle de joyería y miniaturas; necesita resinas 8K de baja viscosidad." },
}
export const PRESETS_3D: Preset[] = Object.entries(IMPRESORAS).map(([id, p]) => ({ id, nombre: p.nombre, valores: { impresora: id } }))

type Mat3D = { nombre: string; grupo: "fdm" | "resina"; dens: number; temp?: [number, number]; cama?: [number, number]; vel?: number; velFactor?: number; ventilador?: string; retraccion?: string; secar?: string; nota: string; precioKg: number }
export const MAT_3D: Record<string, Mat3D> = {
  pla: { nombre: "PLA", grupo: "fdm", dens: 1.24, temp: [200, 215], cama: [55, 60], velFactor: 1, ventilador: "100% desde la capa 2", retraccion: "bowden 5–6 mm / directo 0.8–1.5 mm a 40 mm/s", nota: "El más fácil. Se ablanda a 55 °C: no para piezas al sol o en el coche.", precioKg: 380 },
  pla_plus: { nombre: "PLA+ / PLA Pro", grupo: "fdm", dens: 1.24, temp: [210, 225], cama: [55, 65], velFactor: 1, ventilador: "100%", retraccion: "igual que PLA", nota: "Más tenaz que el PLA normal; mismo manejo.", precioKg: 420 },
  petg: { nombre: "PETG", grupo: "fdm", dens: 1.27, temp: [230, 245], cama: [70, 85], velFactor: 0.8, ventilador: "30–50%", retraccion: "bowden 4–5 mm / directo 0.8–1.2 mm, más lenta (30 mm/s)", secar: "sí, 65 °C 4–6 h si lleva semanas abierto", nota: "Resistente y algo flexible; hila (stringing) si va caliente o con poca retracción. No lo imprimas sobre PEI liso sin pegamento: se pega de más y arranca la cama.", precioKg: 420 },
  abs: { nombre: "ABS", grupo: "fdm", dens: 1.04, temp: [235, 250], cama: [95, 110], velFactor: 0.8, ventilador: "0–20%", retraccion: "bowden 5 mm / directo 1 mm", secar: "sí, 70 °C 4 h", nota: "Necesita cerramiento: sin él se despega y agrieta. Huele y suelta estireno: ventila.", precioKg: 400 },
  asa: { nombre: "ASA", grupo: "fdm", dens: 1.07, temp: [240, 255], cama: [95, 105], velFactor: 0.8, ventilador: "0–20%", retraccion: "como ABS", secar: "sí, 70 °C 4 h", nota: "Como ABS pero resiste sol e intemperie: para piezas de exterior.", precioKg: 520 },
  tpu: { nombre: "TPU 95A (flexible)", grupo: "fdm", dens: 1.21, temp: [220, 235], cama: [40, 60], velFactor: 0.35, ventilador: "50–100%", retraccion: "mínima o cero en bowden; directo 0.5–1 mm", secar: "sí, 60 °C 4 h", nota: "Lento (20–35 mm/s) y mejor con extrusor directo. En bowden, desactiva retracción y baja la velocidad a 15–20.", precioKg: 650 },
  nylon: { nombre: "Nylon / PA (incl. PA-CF)", grupo: "fdm", dens: 1.14, temp: [245, 270], cama: [70, 100], velFactor: 0.7, ventilador: "0–30%", retraccion: "directo 1–2 mm", secar: "OBLIGATORIO, 80 °C 8–12 h y caja seca al imprimir", nota: "Absorbe humedad en horas: si burbujea o sale con pelos, está húmedo. Hotend all-metal y cama con pegamento (PVA) o garolite.", precioKg: 900 },
  pc: { nombre: "Policarbonato / PC-CF", grupo: "fdm", dens: 1.2, temp: [260, 290], cama: [100, 120], velFactor: 0.6, ventilador: "0–20%", retraccion: "directo 1–1.5 mm", secar: "sí, 80 °C 6 h", nota: "Pieza de ingeniería (resiste calor y golpes): cerramiento, hotend all-metal y cama a 110 °C.", precioKg: 1100 },
  resina_estandar: { nombre: "Resina estándar", grupo: "resina", dens: 1.12, nota: "Frágil pero muy detallada; para piezas decorativas y moldes maestros.", precioKg: 600 },
  resina_abs: { nombre: "Resina tipo ABS / tenaz", grupo: "resina", dens: 1.1, nota: "Aguanta golpes y roscas; exposición un poco más larga.", precioKg: 750 },
  resina_lavable: { nombre: "Resina lavable con agua", grupo: "resina", dens: 1.13, nota: "Sin alcohol: más fácil de limpiar, un poco más frágil.", precioKg: 650 },
  resina_dental: { nombre: "Resina dental / modelo", grupo: "resina", dens: 1.15, nota: "Baja contracción para modelos precisos; sigue la ficha del fabricante.", precioKg: 1400 },
}

const CAMPOS: Campo[] = [
  { k: "impresora", etiqueta: "Impresora", tipo: "opcion", opciones: opciones(IMPRESORAS), inicial: "directa", seccion: "Máquina", maquina: true },
  { k: "material", etiqueta: "Material", tipo: "opcion", opciones: opciones(MAT_3D), inicial: "pla", seccion: "Material", req: true },
  { k: "boquilla", etiqueta: "Boquilla", tipo: "numero", unidad: "mm", inicial: 0.4, seccion: "Impresión", si: { k: "material", v: ["pla", "pla_plus", "petg", "abs", "asa", "tpu", "nylon", "pc"] } },
  { k: "altura_capa", etiqueta: "Altura de capa", tipo: "numero", unidad: "mm", inicial: 0.2, seccion: "Impresión" },
  { k: "relleno", etiqueta: "Relleno", tipo: "numero", unidad: "%", inicial: 20, seccion: "Impresión", si: { k: "material", v: ["pla", "pla_plus", "petg", "abs", "asa", "tpu", "nylon", "pc"] } },
  { k: "paredes", etiqueta: "Paredes (perímetros)", tipo: "numero", inicial: 3, seccion: "Impresión", si: { k: "material", v: ["pla", "pla_plus", "petg", "abs", "asa", "tpu", "nylon", "pc"] } },
  { k: "volumen_cm3", etiqueta: "Volumen de la pieza", tipo: "numero", unidad: "cm³", inicial: 50, seccion: "Pieza", ayuda: "Lo da el laminador o el convertidor de HETNA al subir el STL." },
  { k: "altura_mm", etiqueta: "Altura de la pieza en la cama", tipo: "numero", unidad: "mm", inicial: 50, seccion: "Pieza" },
  { k: "cantidad", etiqueta: "Cantidad", tipo: "numero", inicial: 1, seccion: "Pieza" },
  { k: "precio_kg", etiqueta: "Precio del material por kg", tipo: "numero", unidad: "$", seccion: "Costo", ayuda: "Vacío = precio típico en México." },
  { k: "costo_hora", etiqueta: "Costo de máquina por hora", tipo: "numero", unidad: "$", inicial: 35, seccion: "Costo", ayuda: "Luz + desgaste + amortización. Típico $25–60/h." },
  { k: "margen", etiqueta: "Margen de utilidad", tipo: "numero", unidad: "%", inicial: 50, seccion: "Costo" },
]

export const calc3D = (e: Entrada): Resultado => {
  const R = nuevo("Impresión 3D: parámetros, tiempo y costo")
  const Pz = IMPRESORAS[txt(e.impresora)] || IMPRESORAS.directa
  const M = MAT_3D[txt(e.material)] || MAT_3D.pla
  const esResina = M.grupo === "resina"
  const impResina = txt(e.impresora).startsWith("resina")
  if (esResina !== impResina) {
    R.avisos.push(esResina ? "Elegiste resina con una impresora de filamento: cambia la impresora a una de resina." : "Elegiste filamento con una impresora de resina: cambia la impresora o el material.")
    R.confianza = 30
  }
  const V = num(e.volumen_cm3)
  const cant = Math.max(1, Math.round(num(e.cantidad) || 1))
  const alto = num(e.altura_mm)
  let capa = num(e.altura_capa) || (esResina ? 0.05 : 0.2)
  if (esResina && capa > 0.1) {
    R.supuestos.push(`Capa de ${capa} mm es de filamento; para resina usé 0.05 mm.`)
    capa = 0.05
  }
  let gramos = 0
  let tMin = 0

  if (esResina) {
    const b = bloque(R, "Parámetros")
    const k8 = txt(e.impresora) === "resina_8k"
    const expo = (M.nombre.includes("tenaz") ? 2.8 : M.nombre.includes("dental") ? 2.2 : 2.3) * (k8 ? 0.9 : 1) * (capa / 0.05)
    b.filas.push({ etiqueta: "Altura de capa", valor: `${fmt(capa, 3)} mm`, nota: capa > 0.1 ? "resina a más de 0.1 mm pierde detalle y pega capas mal" : "estándar" })
    b.filas.push({ etiqueta: "Exposición por capa", valor: `${fmt(expo, 1)} s`, nota: "pantalla mono; afina con una prueba de calibración (XP2, Cones of Calibration)", destacado: true })
    b.filas.push({ etiqueta: "Capas base", valor: `4–6 capas a ${fmt(expo * 12)} s` })
    b.filas.push({ etiqueta: "Velocidad de elevación", valor: "60–80 mm/min, 4–6 mm de elevación" })
    b.filas.push({ etiqueta: "Transición", valor: "6–8 capas" })
    if (V) {
      gramos = V * M.dens * 1.12
      if (alto) tMin = ((alto / capa) * (expo + (k8 ? 5 : 6))) / 60
    } else R.faltan.push("Volumen de la pieza (cm³)")
    if (!alto) R.faltan.push("Altura de la pieza en la impresora (mm): define el tiempo")
    const b2 = bloque(R, "Tiempo y material")
    if (gramos) b2.filas.push({ etiqueta: "Resina", valor: `${fmt(gramos * cant)} g`, nota: "incluye ~12% de soportes y merma" })
    if (tMin) b2.filas.push({ etiqueta: "Tiempo de impresión", valor: minutos(tMin), nota: "todas las piezas que quepan en la cama tardan lo mismo", destacado: true })
    R.consejos.push("Guantes de nitrilo y ventilación: la resina sin curar irrita la piel. Lava 3–5 min en alcohol isopropílico (o agua, si es lavable) y cura 3–10 min con UV.")
    R.consejos.push("Inclina las piezas 20–30° y pon soportes ligeros en voladizos: menos fuerza de succión y menos marcas.")
  } else {
    const boq = num(e.boquilla) || 0.4
    const rel = clamp(num(e.relleno) ?? 20, 0, 100) / 100
    const par = Math.max(1, Math.round(num(e.paredes) ?? 3))
    const velBase = Pz.vel * (M.velFactor ?? 1)
    // límite por flujo del hotend: mm³/s = capa × ancho × velocidad
    const ancho = boq * 1.1
    const velFlujo = (Pz.flujo * (M.velFactor ?? 1)) / (capa * ancho)
    const vel = Math.round(Math.min(velBase, velFlujo) / 5) * 5
    const b = bloque(R, "Parámetros")
    b.filas.push({ etiqueta: "Temperatura de boquilla", valor: `${M.temp![0]}–${M.temp![1]} °C`, nota: vel > 120 ? "sube 5–10 °C a velocidad alta" : undefined, destacado: true })
    b.filas.push({ etiqueta: "Cama", valor: `${M.cama![0]}–${M.cama![1]} °C`, destacado: true })
    b.filas.push({ etiqueta: "Velocidad de impresión", valor: `${fmt(vel)} mm/s`, nota: velFlujo < velBase ? `limitada por el flujo del hotend (${fmt(Pz.flujo * (M.velFactor ?? 1))} mm³/s)` : "paredes exteriores a la mitad", destacado: true })
    b.filas.push({ etiqueta: "Primera capa", valor: `${fmt(Math.min(25, vel / 2))} mm/s, ${fmt(capa * 1.2, 2)} mm, ${M.temp![0] + 5} °C` })
    b.filas.push({ etiqueta: "Ventilador de capa", valor: M.ventilador || "100%" })
    b.filas.push({ etiqueta: "Retracción", valor: M.retraccion || "estándar" })
    b.filas.push({ etiqueta: "Ancho de línea", valor: `${fmt(ancho, 2)} mm`, nota: `capa ${capa} mm (${fmt((capa / boq) * 100)}% de la boquilla; sano 25–75%)` })
    if (capa > boq * 0.75) R.avisos.push(`Capa de ${capa} mm es demasiado alta para boquilla de ${boq} mm (máximo ≈ ${fmt(boq * 0.75, 2)} mm): las capas no se pegan bien.`)
    if (capa < boq * 0.2) R.avisos.push("Capa muy fina para esa boquilla: tarda mucho sin ganar detalle visible; 0.12–0.16 mm suele ser el punto dulce con 0.4 mm.")
    if (M.secar) b.filas.push({ etiqueta: "Secar el filamento", valor: M.secar })
    if ((M.cama![0] >= 90) && !Pz.cerrada) {
      R.avisos.push(`${M.nombre} necesita impresora cerrada: en una abierta se despega de la cama y se agrieta entre capas. Cúbrela o usa PETG.`)
      R.confianza -= 20
    }
    if (M.temp![1] > 250 && (txt(e.impresora) === "basica")) {
      R.avisos.push(`${M.nombre} pasa de 250 °C: el hotend con tubo de PTFE de una impresora básica se degrada (humo tóxico). Necesitas hotend all-metal.`)
      R.confianza -= 20
    }
    if (V) {
      // volumen efectivo: paredes + tapas (como fracción) + relleno
      const fracParedes = clamp((par * ancho * 6 * Math.pow(V, 2 / 3) * 100) / (V * 1000), 0.1, 0.9) // 6 caras de un cubo equivalente
      const efectivo = V * (fracParedes + (1 - fracParedes) * rel)
      gramos = efectivo * M.dens * 1.05
      const flujoReal = capa * ancho * vel * 0.55 // mm³/s con aceleraciones, viajes y perímetros lentos
      tMin = (efectivo * 1000) / flujoReal / 60 + 4
      const b2 = bloque(R, "Tiempo y material")
      b2.filas.push({ etiqueta: "Material", valor: `${fmt(gramos * cant)} g`, nota: `${fmt(gramos, 1)} g por pieza, ${fmt((gramos / M.dens / 1000 / (Math.PI * 0.875 * 0.875)) * 1000 * 1000 / 1000, 1)} m de filamento 1.75` })
      b2.filas.push({ etiqueta: "Tiempo", valor: minutos(tMin * cant), nota: cant > 1 ? `${minutos(tMin)} por pieza` : "estimado; el laminador da el exacto", destacado: true })
      R.supuestos.push(`${fmt(fracParedes * 100)}% del volumen es pared y tapas con ${par} perímetros; el resto va al ${fmt(rel * 100)}% de relleno.`)
    } else R.faltan.push("Volumen de la pieza (cm³): súbela al convertidor de HETNA o míralo en el laminador")
    R.consejos.push(M.nota)
    R.consejos.push(Pz.nota)
  }

  // costo
  const precioKg = num(e.precio_kg) || M.precioKg
  const costoHora = num(e.costo_hora) ?? 35
  const margen = clamp(num(e.margen) ?? 50, 0, 90)
  if (gramos && tMin) {
    const horas = (esResina ? tMin : tMin * cant) / 60
    const cMat = (gramos * cant * precioKg) / 1000
    const cMaq = horas * costoHora
    const post = esResina ? cant * 8 : cant * 3 // lavado/curado o quitar soportes
    const costo = cMat + cMaq + post
    const precio = costo / (1 - margen / 100)
    const b3 = bloque(R, "Costo y precio")
    b3.filas.push({ etiqueta: "Material", valor: pesos(cMat), nota: `${pesos(precioKg)}/kg` })
    b3.filas.push({ etiqueta: "Máquina", valor: pesos(cMaq), nota: `${fmt(horas, 1)} h × ${pesos(costoHora)}` })
    b3.filas.push({ etiqueta: "Postproceso", valor: pesos(post), nota: esResina ? "lavar y curar" : "quitar soportes y limpiar" })
    b3.filas.push({ etiqueta: "Costo total", valor: pesos(costo) })
    b3.filas.push({ etiqueta: `Precio con ${fmt(margen)}% de margen`, valor: pesos(precio), nota: "sin IVA", destacado: true })
    if (cant > 1) b3.filas.push({ etiqueta: "Por pieza", valor: pesos(precio / cant) })
    R.datos = { ...R.datos, costo: r(costo, 2), precio: r(precio, 2) }
    if (!num(e.precio_kg)) R.supuestos.push(`Precio del material: ${pesos(precioKg)}/kg (típico en México). Pon el tuyo.`)
  }
  R.datos = { ...R.datos, gramos: r(gramos * cant, 1), tiempo_min: r(esResina ? tMin : tMin * cant, 1) }
  R.confianza = clamp(R.confianza, 20, 100)
  return R
}

export const IMPRESION3D: Calculadora = {
  id: "impresion_3d",
  nombre: "Impresión 3D",
  proceso: "impresion_3d",
  resumen: "Temperaturas, velocidad real (limitada por el hotend), retracción, secado, tiempo, gramos y precio para filamento y resina.",
  campos: CAMPOS,
  calcular: calc3D,
}
