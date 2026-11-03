// @ts-nocheck
// Precio estimado para el cotizador en línea de cada taller (hetnacnc.com/t/<slug>).
//
// Es la parte del motor del simulador de la app (MotorCalculo en
// lib/screens/simulador_screen.dart del repo Cotizador) que se puede calcular
// sólo con el archivo del cliente: medidas, largo de corte, perforaciones y
// volumen. Usa las tarifas y costos que el taller ya capturó en su simulador.
// Las fórmulas que dependen de datos que el cliente no sabe (horas, kilos,
// diseño) no se estiman: la solicitud llega "a revisar" y el taller cotiza.
//
// Si cambia una fórmula en la app, hay que replicarla aquí.
//   Medidas: el motor de la app trabaja largo/ancho/alto en cm y el largo de
//   corte en mm; aquí se recibe todo en mm y se convierte.

export type Tarifas = Record<string, number>
export type Rango = { desde: number; hasta: number; precio: number }
export type Tipo = { id: string; nombre: string; formula: string; factor: number }
export type Costos = {
  costoHoraTaller: number
  costoHoraMaquina: number
  costoHoraOperador: number
  margenRecomendado: number
  margenMinimo: number
  ivaPct: number
  mermaPct: number
  markupMaterialPct: number
}
export type Medidas = {
  largo: number // mm
  ancho: number // mm
  alto?: number // mm (3D)
  corte_mm?: number // largo total de corte
  perforaciones?: number
  volumen_cm3?: number // volumen real de la pieza (STL/OBJ)
}

export const FORMULAS_ESTIMABLES = ["por_area", "por_volumen", "por_minuto", "por_metro", "por_pieza", "precio_fijo"]

/** Igual que SimTipoTrabajo._inferirFormula de la app, para tipos sin fórmula guardada. */
export function inferirFormula(nombre: string) {
  const n = String(nombre || "").toLowerCase()
  if (/diseño|diseno|vectori|model/.test(n)) return "por_diseno"
  if (/impresion|impresión|3d print|fdm/.test(n)) return "por_hora"
  if (/grabado|laser|láser|fibra/.test(n)) return "por_minuto"
  if (/metro|lineal|herrer|carpint/.test(n)) return "por_metro"
  if (/pieza|pza|promo/.test(n)) return "por_pieza"
  if (/3d|relieve|talla|escultura|rotativo/.test(n)) return "por_volumen"
  return "por_area"
}

const t = (tar: Tarifas, clave: string, def: number) => (Number(tar[clave]) > 0 ? Number(tar[clave]) : def)

function precioRango(rangos: Rango[], indice: number) {
  for (const r of rangos) if (indice >= r.desde && indice <= r.hasta) return r.precio
  return rangos.length ? rangos[rangos.length - 1].precio : 0
}

export type Estimado =
  | { estimable: false; motivo: string }
  | { estimable: true; minimo: number; recomendado: number; iva: number; ivaPct: number; horas: number; detalle: Record<string, number> }

export function estimar(p: {
  tipo: Tipo
  tarifas: Tarifas
  rangos: Rango[]
  costos: Costos
  medidas: Medidas
  cantidad: number
}): Estimado {
  const { tipo, tarifas: tar, rangos, costos } = p
  const cantidad = Math.max(1, Math.min(10000, Math.round(Number(p.cantidad) || 1)))
  const formula = tipo.formula || inferirFormula(tipo.nombre)
  const factor = Number(tipo.factor) > 0 ? Number(tipo.factor) : 1
  const nombre = String(tipo.nombre || "").toLowerCase()
  if (!FORMULAS_ESTIMABLES.includes(formula)) return { estimable: false, motivo: "Este trabajo se cotiza a mano: el taller te manda el precio." }

  const largo = Math.max(0, Number(p.medidas.largo) || 0) / 10 // cm
  const ancho = Math.max(0, Number(p.medidas.ancho) || 0) / 10
  const alto = Math.max(0, Number(p.medidas.alto) || 0) / 10
  const corteMm = Math.max(0, Number(p.medidas.corte_mm) || 0)
  const perforaciones = Math.max(0, Math.round(Number(p.medidas.perforaciones) || 0))
  const volumenReal = Math.max(0, Number(p.medidas.volumen_cm3) || 0)
  if ((formula === "por_area" || formula === "por_minuto") && (!largo || !ancho))
    return { estimable: false, motivo: "Sube tu archivo para calcular las medidas." }
  if (formula === "por_volumen" && !(largo && ancho && (alto || volumenReal)))
    return { estimable: false, motivo: "Sube un archivo 3D (STL u OBJ) para calcular el volumen." }
  if (formula === "por_metro" && !corteMm) return { estimable: false, motivo: "Sube un archivo 2D (DXF o SVG) para medir el corte." }

  const det: Record<string, number> = {}
  let maquila = 0
  let horas = 0
  let cm = 0

  switch (formula) {
    case "por_area": {
      const areaM2 = (largo / 100) * (ancho / 100)
      const celosia = /celosia|celosía|calado/.test(nombre)
      const plasma = t(tar, "tarifa_m2_delgado", 0) > 0
      let tarifaM2: number
      if (plasma) {
        // Sin calibre del cliente se toma lámina delgada en acero negro
        tarifaM2 = t(tar, "tarifa_m2_delgado", 480) * (celosia ? factor : 1)
      } else {
        tarifaM2 = celosia ? t(tar, "tarifa_m2_celosia", 450) : t(tar, "tarifa_m2_normal", 350)
      }
      maquila = areaM2 * tarifaM2 * cantidad
      if (plasma) {
        const umbral = t(tar, "umbral_minimo_m2", 0.09)
        const minAp = t(tar, "minimo_apertura", 150)
        if (areaM2 < umbral && maquila < minAp) maquila = minAp
      }
      const minM2 = t(tar, "min_por_m2", plasma ? 12 : celosia ? 90 : 40)
      horas = (areaM2 * minM2 * cantidad + t(tar, "min_setup", 10)) / 60
      det.area_m2 = areaM2
      det.tarifa_m2 = tarifaM2
      break
    }
    case "por_volumen": {
      const volumen = largo * ancho * (alto || 1)
      const impresion = t(tar, "factor_rapida", 0) > 0 || t(tar, "costo_pla", 0) > 0
      if (impresion) {
        const relleno = t(tar, "relleno_pct", 20) / 100
        const volEf = volumenReal > 0 ? volumenReal * (0.3 + 0.7 * relleno) : volumen * relleno
        const gramos = volEf * 1.24 // PLA
        cm = gramos * t(tar, "costo_pla", 0.35) * cantidad
        const minutos = volEf * factor
        horas = (minutos / 60) * cantidad
        maquila = horas * t(tar, "tarifa_hora", 80)
        const minimo = t(tar, "minimo", 200)
        if (maquila + cm < minimo) maquila = minimo
        det.gramos = gramos
        det.volumen_cm3 = volumenReal || volumen
      } else {
        let base = precioRango(rangos, volumen)
        if (!base && volumen > 0) base = 580
        maquila = base * factor * cantidad
        const h =
          volumen <= 1200 ? 1 : volumen <= 3000 ? 2 : volumen <= 7000 ? 3.5 : volumen <= 20000 ? 5 : volumen <= 60000 ? 10 : volumen <= 150000 ? 20 : 40
        horas = h * factor * cantidad
        det.volumen_cm3 = volumen
      }
      break
    }
    case "por_minuto": {
      let minEst: number
      if (t(tar, "vel_mdf_fino", 0) > 0) {
        // Láser CO₂: MDF delgado por defecto; grabado si el tipo lo dice
        const velCorte = t(tar, "vel_mdf_fino", 30)
        const velGrab = t(tar, "vel_grabado", 190)
        const intervalo = t(tar, "intervalo_normal", 0.15)
        const perimetro = corteMm > 0 ? corteMm : 2 * (largo + ancho) * 10
        const minCorte = perimetro / velCorte / 60 + (perforaciones * t(tar, "seg_perforacion", 0.5)) / 60
        const minGrab = (largo * ancho * 100) / (intervalo * velGrab * 60)
        minEst = /ambos|corte y grabado/.test(nombre) ? (minCorte + minGrab) * factor : /grabado/.test(nombre) ? minGrab : minCorte
        det.desgaste_tubo = minEst * t(tar, "costo_tubo_min", 0.8) * cantidad
      } else {
        minEst = (largo / 100) * (ancho / 100) * 60 * factor
      }
      let tarifaMin: number
      if (t(tar, "tarifa_min_marcado", 0) > 0) {
        tarifaMin = /profundo/.test(nombre) ? t(tar, "tarifa_min_profundo", 18) : t(tar, "tarifa_min_marcado", 12)
      } else {
        tarifaMin = t(tar, "tarifa_min", 10)
      }
      horas = (minEst / 60) * cantidad
      maquila = minEst * tarifaMin * cantidad + (det.desgaste_tubo || 0)
      det.minutos = minEst * cantidad
      break
    }
    case "por_metro": {
      const metros = corteMm / 1000
      const tarifaMt = t(tar, "tarifa_metro_delgado", 0) > 0 ? t(tar, "tarifa_metro_delgado", 80) : t(tar, "tarifa_metro", 100)
      maquila = metros * tarifaMt * cantidad
      const vel = t(tar, "vel_corte_m_min", 1.2)
      horas = ((metros * cantidad) / vel + (perforaciones * cantidad * t(tar, "seg_perforacion", 2)) / 60 + t(tar, "min_setup", 10)) / 60
      const costoPerf = Number(tar.costo_perforacion) || 0
      if (perforaciones > 0 && costoPerf > 0) maquila += perforaciones * costoPerf * cantidad
      det.metros = metros
      break
    }
    case "por_pieza": {
      let tarifa: number
      if (t(tar, "precio_1_10", 0) > 0) {
        tarifa =
          cantidad <= 10 ? t(tar, "precio_1_10", 0) : cantidad <= 50 ? t(tar, "precio_11_50", 0) : cantidad <= 200 ? t(tar, "precio_51_200", 0) : t(tar, "precio_200_mas", 0)
        tarifa *= factor
        maquila = tarifa * cantidad
        const minAp = t(tar, "minimo_apertura", 150)
        if (maquila < minAp) maquila = minAp
      } else {
        tarifa = t(tar, "tarifa_pieza", 100)
        maquila = tarifa * cantidad
      }
      horas = (t(tar, "min_por_pieza", 1.5) * factor * cantidad + t(tar, "min_setup", 10)) / 60
      break
    }
    case "precio_fijo": {
      maquila = (Number(tar.precio_fijo) || 0) * cantidad
      horas = 0.5 * cantidad
      if (!maquila) return { estimable: false, motivo: "Este trabajo se cotiza a mano: el taller te manda el precio." }
      break
    }
  }

  // Costos directos (mismo orden que la app). Sin material: el taller lo
  // agrega al cotizar (el cliente no sabe cuál conviene).
  const cmaq = costos.costoHoraMaquina * horas
  const cmo = costos.costoHoraOperador * horas
  const cc = (Number(tar.consumibles_hora) > 0 ? Number(tar.consumibles_hora) : 25) * horas
  const ci = costos.costoHoraTaller * horas
  const costoReal = cm + cmaq + cmo + cc + ci

  const mMin = Math.min(0.85, Math.max(0, costos.margenMinimo / 100))
  const mRec = Math.min(0.85, Math.max(0, costos.margenRecomendado / 100))
  const cmVenta = cm * (1 + costos.markupMaterialPct / 100)
  const precioTarifa = maquila > 0 ? maquila + cmVenta : 0
  const precioCosto = costoReal > 0 ? costoReal / (1 - mRec) : 0
  let recomendado = Math.max(precioTarifa, precioCosto)
  // Cargo mínimo del taller (si lo capturó) para que un corte chiquito no salga en $20
  const minimoTaller = Number(tar.minimo_apertura) || Number(tar.minimo) || 0
  if (minimoTaller > 0 && recomendado > 0 && recomendado < minimoTaller) {
    recomendado = minimoTaller
    det.minimo_taller = minimoTaller
  }
  const minPorCosto = costoReal > 0 ? costoReal / (1 - mMin) : 0
  let minimo = Math.max(recomendado * 0.9, minPorCosto)
  if (minimo > recomendado) minimo = recomendado
  if (!(recomendado > 0)) return { estimable: false, motivo: "El taller todavía no tiene tarifa para este trabajo." }

  const r2 = (n: number) => Math.round(n * 100) / 100
  return {
    estimable: true,
    minimo: r2(minimo),
    recomendado: r2(recomendado),
    iva: r2(recomendado * (costos.ivaPct / 100)),
    ivaPct: costos.ivaPct,
    horas: r2(horas),
    detalle: Object.fromEntries(Object.entries(det).map(([k, v]) => [k, r2(v)])),
  }
}
