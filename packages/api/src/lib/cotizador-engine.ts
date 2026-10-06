// Copia 1:1 de hetna/cotizador/engine.js (motor de cálculo del Cotizador CNC),
// para poder correrlo en el backend de Medusa sin depender del bundle
// estático del storefront. Si cambia la fórmula allá, hay que replicar el
// cambio aquí también — son el mismo cálculo en dos runtimes distintos.
//
// Fórmula maestra:  PV = (CM + CMO + CMaq + CC + CA + CI) ÷ (1 - Margen)

type Tarifas = Record<string, number>
type Rango = { desde: number; hasta: number; precio: number }

export type CotizadorCfg = {
  tarifas?: Tarifas
  rangos?: Rango[]
}

export type CotizadorCostos = {
  costoHoraTaller: number
  costoHoraMaquina: number
  costoHoraOperador: number
  margenMinimo: number
  margenRecomendado: number
  ivaPct: number
}

export type CotizadorTipo = { n: string; nombre?: string; f?: string; formula?: string; k?: number; factor?: number }

function getTarifa(cfg: CotizadorCfg, clave: string): number {
  const t = cfg.tarifas && cfg.tarifas[clave]
  return typeof t === "number" ? t : 0
}

function calcularPrecioRango(cfg: CotizadorCfg, indice: number): number {
  const rangos = cfg.rangos || []
  for (const r of rangos) {
    if (indice >= r.desde && indice <= r.hasta) return r.precio
  }
  return rangos.length ? rangos[rangos.length - 1].precio : 0
}

export function calcular(params: any): any {
  const {
    cfg, costos, tipo,
    nombreServicio, emojiServicio,
    largo = 0, ancho = 0, alto = 0,
    peso = 0, metros = 0,
    horas = 0, minutos = 0,
    cantidad = 1, complejidad = "normal",
    clienteTraeMaterial = false,
    usarInventario = false,
    materialInv = null,
    materialLibreNombre = "",
    materialLibrePrecio = 0,
    acabado = null, // {nombre, precio} | null
    aplicarIva = false,
    extrasSeleccionados = [], // [{nombre, precio}]
    descripcionEditable = "",
    // Diseño Digital
    clienteTraeArchivo = false,
    archivoEsVector = false,
    entregaUrgente = false,
    revisionesExtra = 0,
    archivoEditableAlCliente = false,
    // Router 2D
    horasLijado = 0,
    horasBarnizado = 0,
    llevaDiseno = false,
    // Plasma CNC
    calibre = "Cal 14",
    material = "acero_negro",
    llevaLimpieza = false,
    llevaFlete = false,
    llevaDisenoPlasma = false,
    clienteTraeArchivoDXF = false,
    horasDisenoPlasma = 1.0,
    // Láser CO2
    materialLaser = "mdf_fino",
    densidadLaser = "normal",
    tipoLaser = "corte",
    // Láser Fibra
    llevaPlantilla = false,
    llevaRotativo = false,
    // Impresión 3D
    materialImpresion = "pla",
    // HETNA: medidas reales leídas del archivo (0 = usar la caja)
    perimetroRealMm = 0,
    volumenRealCm3 = 0,
  } = params

  const formula = tipo.formula
  const desglose: Record<string, number> = {}

  let precioMaquila = 0
  let tiempoHoras = 0
  let cm = 0

  switch (formula) {
    // ── ROUTER 2D / PLASMA CNC: por área × tarifa ──────────
    case "por_area": {
      const areaM2 = (largo / 100) * (ancho / 100)
      const nombreLower = tipo.nombre.toLowerCase()
      const esCelosia = nombreLower.includes("celosia") || nombreLower.includes("celosía") || nombreLower.includes("calado")
      const esPlasma = getTarifa(cfg, "tarifa_m2_delgado") > 0
      let tarifaM2
      if (esPlasma) {
        const calibresDelgados = ["Cal 20", "Cal 18", "Cal 16", "Cal 14", "Cal 12"]
        const esDelgado = calibresDelgados.includes(calibre)
        const tarifaBase = esDelgado
          ? (getTarifa(cfg, "tarifa_m2_delgado") > 0 ? getTarifa(cfg, "tarifa_m2_delgado") : 480)
          : (getTarifa(cfg, "tarifa_m2_medio") > 0 ? getTarifa(cfg, "tarifa_m2_medio") : 680)
        const factorMat = material === "inox"
          ? (getTarifa(cfg, "factor_inox") > 0 ? getTarifa(cfg, "factor_inox") : 1.4)
          : material === "aluminio"
            ? (getTarifa(cfg, "factor_aluminio") > 0 ? getTarifa(cfg, "factor_aluminio") : 1.3)
            : 1.0
        tarifaM2 = tarifaBase * factorMat * (esCelosia ? tipo.factor : 1.0)
        desglose.material_factor = factorMat
        const umbral = getTarifa(cfg, "umbral_minimo_m2") > 0 ? getTarifa(cfg, "umbral_minimo_m2") : 0.09
        const minAp = getTarifa(cfg, "minimo_apertura") > 0 ? getTarifa(cfg, "minimo_apertura") : 150
        if (areaM2 < umbral) desglose.minimo_apertura = minAp
      } else {
        tarifaM2 = esCelosia
          ? (getTarifa(cfg, "tarifa_m2_celosia") > 0 ? getTarifa(cfg, "tarifa_m2_celosia") : 450)
          : (getTarifa(cfg, "tarifa_m2_normal") > 0 ? getTarifa(cfg, "tarifa_m2_normal") : 350)
        // HETNA: usa las tarifas de grabado del router cuando existen
        if (nombreLower.includes("grabado")) {
          const kG = nombreLower.includes("2.5") ? "tarifa_m2_grabado_2_5d" : (nombreLower.includes("complejo") ? "tarifa_m2_grabado_complejo" : "tarifa_m2_grabado_simple")
          if (getTarifa(cfg, kG) > 0) tarifaM2 = getTarifa(cfg, kG)
        }
      }
      precioMaquila = areaM2 * tarifaM2 * cantidad
      if (esPlasma) {
        const umbral2 = getTarifa(cfg, "umbral_minimo_m2") > 0 ? getTarifa(cfg, "umbral_minimo_m2") : 0.09
        const minAp2 = getTarifa(cfg, "minimo_apertura") > 0 ? getTarifa(cfg, "minimo_apertura") : 150
        if (areaM2 < umbral2 && precioMaquila < minAp2) precioMaquila = minAp2
      }
      desglose.area_m2 = areaM2
      desglose.tarifa_m2 = tarifaM2
      if (horasLijado > 0) {
        const tl = getTarifa(cfg, "costo_lijado_hora") > 0 ? getTarifa(cfg, "costo_lijado_hora") : 150
        desglose.mano_obra_lijado = horasLijado * tl * cantidad
      }
      if (horasBarnizado > 0) {
        const tb = getTarifa(cfg, "costo_barnizado") > 0 ? getTarifa(cfg, "costo_barnizado") : 200
        desglose.mano_obra_barnizado = horasBarnizado * tb * cantidad
      }
      if (llevaDiseno) {
        const td = getTarifa(cfg, "costo_diseno") > 0 ? getTarifa(cfg, "costo_diseno") : 300
        desglose.diseno_adicional = td
      }
      tiempoHoras = areaM2 * 0.5 * cantidad
      break
    }

    // ── ROUTER 3D / IMPRESIÓN 3D / CARPINTERÍA ─────────────
    case "por_volumen": {
      const volumen = largo * ancho * alto
      const esImpresion = getTarifa(cfg, "factor_rapida") > 0 || getTarifa(cfg, "costo_pla") > 0

      if (esImpresion) {
        const volumen3D = volumenRealCm3 > 0 ? volumenRealCm3 : volumen
        const relleno = getTarifa(cfg, "relleno_pct") > 0 ? getTarifa(cfg, "relleno_pct") / 100 : 0.20
        const volEfectivo = volumen3D * relleno
        const densidades: Record<string, number> = { pla: 1.24, abs: 1.04, petg: 1.27, tpu: 1.20 }
        const densidad = densidades[materialImpresion] || 1.24
        const gramos = volEfectivo * densidad
        const costoGrClaves: Record<string, string> = { pla: "costo_pla", abs: "costo_abs", petg: "costo_petg", tpu: "costo_tpu" }
        const claveGr = costoGrClaves[materialImpresion] || "costo_pla"
        const costoGr = getTarifa(cfg, claveGr) > 0 ? getTarifa(cfg, claveGr) : 0.35
        cm = gramos * costoGr * cantidad
        const factorCalidad = tipo.factor as number // rapida=0.8, normal=1.2, alta=2.0
        const minutos3D = volEfectivo * factorCalidad
        tiempoHoras = (minutos3D / 60) * cantidad
        const tarifaHr3D = getTarifa(cfg, "tarifa_hora") > 0 ? getTarifa(cfg, "tarifa_hora") : 80
        precioMaquila = tiempoHoras * tarifaHr3D
        desglose.volumen_cm3 = volumen3D
        desglose.gramos_estimados = gramos
        desglose.tiempo_min = minutos3D
        const minImp = getTarifa(cfg, "minimo") > 0 ? getTarifa(cfg, "minimo") : 200
        if (precioMaquila + cm < minImp) {
          precioMaquila = minImp
          desglose.precio_minimo = minImp
        }
      } else {
        // Router 3D / Carpintería: precio por tabla de rangos
        let precioRango = calcularPrecioRango(cfg, volumen)
        if (precioRango === 0 && volumen > 0) precioRango = 580
        precioMaquila = precioRango * (tipo.factor as number) * cantidad
        desglose.volumen_cm3 = volumen
        desglose.precio_rango_base = precioRango
        desglose.factor_tipo = tipo.factor as number
        let horasBase
        if (volumen <= 1200) horasBase = 1.0
        else if (volumen <= 3000) horasBase = 2.0
        else if (volumen <= 7000) horasBase = 3.5
        else if (volumen <= 20000) horasBase = 5.0
        else if (volumen <= 60000) horasBase = 10.0
        else if (volumen <= 150000) horasBase = 20.0
        else horasBase = 40.0
        tiempoHoras = horasBase * (tipo.factor as number) * cantidad
        desglose.tiempo_estimado_ref = tiempoHoras
      }
      break
    }

    // ── DISEÑO DIGITAL ──────────────────────────────
    case "por_diseno": {
      if (clienteTraeArchivo && archivoEsVector) {
        precioMaquila = getTarifa(cfg, "tarifa_setup") > 0 ? getTarifa(cfg, "tarifa_setup") : 75
        tiempoHoras = 0.25
        desglose.setup_montaje = precioMaquila
      } else {
        let tarifaHr
        const nombreU = tipo.nombre
        if (nombreU.includes("3D") || nombreU.includes("3d")) {
          tarifaHr = getTarifa(cfg, "tarifa_hora_3d") > 0 ? getTarifa(cfg, "tarifa_hora_3d") : 500
        } else if (nombreU.toUpperCase().includes("CAM")) {
          tarifaHr = getTarifa(cfg, "tarifa_hora_cam") > 0 ? getTarifa(cfg, "tarifa_hora_cam") : 400
        } else {
          tarifaHr = getTarifa(cfg, "tarifa_hora_2d") > 0 ? getTarifa(cfg, "tarifa_hora_2d") : 300
        }
        tiempoHoras = tipo.factor as number
        precioMaquila = tiempoHoras * tarifaHr
        desglose.horas_diseno = tiempoHoras
        desglose.tarifa_hora = tarifaHr
        if (clienteTraeArchivo && !archivoEsVector) {
          desglose.vectorizacion_imagen = precioMaquila
        }
      }
      if (entregaUrgente) {
        const pctUrgente = getTarifa(cfg, "cargo_urgente") > 0 ? getTarifa(cfg, "cargo_urgente") : 40
        const cargoUrgente = (precioMaquila * pctUrgente) / 100
        precioMaquila += cargoUrgente
        desglose.cargo_urgente = cargoUrgente
      }
      if (revisionesExtra > 0) {
        const cargoRev = getTarifa(cfg, "cargo_revision") > 0 ? getTarifa(cfg, "cargo_revision") : 150
        const totalRev = cargoRev * revisionesExtra
        precioMaquila += totalRev
        desglose.revisiones_extra = totalRev
      }
      if (archivoEditableAlCliente) {
        const pctArch = getTarifa(cfg, "cargo_archivo_editable") > 0 ? getTarifa(cfg, "cargo_archivo_editable") : 200
        const cargoArch = (precioMaquila * pctArch) / 100
        precioMaquila += cargoArch
        desglose.archivo_editable = cargoArch
      }
      break
    }

    // ── HERRERÍA (y genérico por hora) ─────────────────────
    case "por_hora": {
      tiempoHoras = horas > 0 ? horas : 1.0
      const tarifaHr = getTarifa(cfg, "tarifa_hora") > 0 ? getTarifa(cfg, "tarifa_hora") : costos.costoHoraTaller * 1.5
      precioMaquila = tiempoHoras * tarifaHr * cantidad
      if (getTarifa(cfg, "material_hora") > 0 && !clienteTraeMaterial) {
        const matHr = getTarifa(cfg, "material_hora")
        precioMaquila += matHr * tiempoHoras * cantidad
        desglose.material_estimado = matHr * tiempoHoras * cantidad
      }
      tiempoHoras *= cantidad
      break
    }

    // ── LÁSER CO2 (por minuto) ──────────────────────────────
    case "por_minuto": {
      const areaM2min = (largo / 100) * (ancho / 100)
      let minEst = 0
      const tieneVelLaser = getTarifa(cfg, "vel_mdf_fino") > 0
      if (tieneVelLaser) {
        let velCorte
        switch (materialLaser) {
          case "mdf_fino": velCorte = getTarifa(cfg, "vel_mdf_fino") > 0 ? getTarifa(cfg, "vel_mdf_fino") : 30; break
          case "mdf_medio": velCorte = getTarifa(cfg, "vel_mdf_medio") > 0 ? getTarifa(cfg, "vel_mdf_medio") : 21; break
          default: velCorte = getTarifa(cfg, "vel_otros") > 0 ? getTarifa(cfg, "vel_otros") : 15
        }
        const velGrab = getTarifa(cfg, "vel_grabado") > 0 ? getTarifa(cfg, "vel_grabado") : 190
        const intervalo = densidadLaser === "ligero"
          ? (getTarifa(cfg, "intervalo_ligero") > 0 ? getTarifa(cfg, "intervalo_ligero") : 0.2)
          : densidadLaser === "denso"
            ? (getTarifa(cfg, "intervalo_denso") > 0 ? getTarifa(cfg, "intervalo_denso") : 0.1)
            : (getTarifa(cfg, "intervalo_normal") > 0 ? getTarifa(cfg, "intervalo_normal") : 0.15)
        const perimetro = perimetroRealMm > 0 ? perimetroRealMm : 2 * (largo + ancho) * 10
        const minCorte = perimetro / velCorte / 60
        const areaGrab = largo * ancho
        const minGrabado = (areaGrab * 100) / (intervalo * velGrab * 60)
        switch (tipoLaser) {
          case "grabado": minEst = minGrabado; break
          case "ambos": minEst = (minCorte + minGrabado) * (tipo.factor as number); break
          default: minEst = minCorte
        }
        const costoTubo = getTarifa(cfg, "costo_tubo_min") > 0 ? getTarifa(cfg, "costo_tubo_min") : 0.80
        desglose.desgaste_tubo = minEst * costoTubo * cantidad
      } else {
        minEst = minutos > 0 ? minutos : areaM2min * 60 * (tipo.factor as number)
      }
      const tieneMinFibra = getTarifa(cfg, "tarifa_min_marcado") > 0
      let tarifaMinuto
      if (tieneMinFibra) {
        const esProfundo = tipo.nombre.toLowerCase().includes("profundo")
        tarifaMinuto = esProfundo
          ? (getTarifa(cfg, "tarifa_min_profundo") > 0 ? getTarifa(cfg, "tarifa_min_profundo") : 18)
          : (getTarifa(cfg, "tarifa_min_marcado") > 0 ? getTarifa(cfg, "tarifa_min_marcado") : 12)
      } else {
        tarifaMinuto = getTarifa(cfg, "tarifa_min") > 0 ? getTarifa(cfg, "tarifa_min") : 10
      }
      tiempoHoras = (minEst / 60) * cantidad
      precioMaquila = minEst * tarifaMinuto * cantidad
      desglose.minutos_estimados = minEst * cantidad
      desglose.tarifa_min = tarifaMinuto
      break
    }

    // ── HERRERÍA / CARPINTERÍA / PLASMA (por metro) ────────
    case "por_metro": {
      const tieneMetroPlasma = getTarifa(cfg, "tarifa_metro_delgado") > 0
      let tarifaMt
      if (tieneMetroPlasma) {
        const calibresD = ["Cal 20", "Cal 18", "Cal 16", "Cal 14", "Cal 12"]
        const esD = calibresD.includes(calibre)
        const tarifaBaseM = esD
          ? (getTarifa(cfg, "tarifa_metro_delgado") > 0 ? getTarifa(cfg, "tarifa_metro_delgado") : 80.0)
          : (getTarifa(cfg, "tarifa_metro_medio") > 0 ? getTarifa(cfg, "tarifa_metro_medio") : 150.0)
        const fMat = material === "inox"
          ? (getTarifa(cfg, "factor_inox") > 0 ? getTarifa(cfg, "factor_inox") : 1.4)
          : material === "aluminio"
            ? (getTarifa(cfg, "factor_aluminio") > 0 ? getTarifa(cfg, "factor_aluminio") : 1.3)
            : 1.0
        tarifaMt = tarifaBaseM * fMat
      } else {
        tarifaMt = getTarifa(cfg, "tarifa_metro") > 0 ? getTarifa(cfg, "tarifa_metro") : 100.0
      }
      precioMaquila = metros * tarifaMt * cantidad
      tiempoHoras = metros * 0.1 * cantidad
      desglose.metros = metros
      desglose.tarifa_metro = tarifaMt
      break
    }

    case "por_kg": {
      const tarifaKg = getTarifa(cfg, "tarifa_kg") > 0 ? getTarifa(cfg, "tarifa_kg") : 50
      precioMaquila = peso * tarifaKg * cantidad
      tiempoHoras = peso * 0.05 * cantidad
      break
    }

    // ── LÁSER FIBRA (por pieza, escalonado) ────────────────
    case "por_pieza": {
      const tienePrecioEscalonado = getTarifa(cfg, "precio_1_10") > 0
      let tarifaPza
      if (tienePrecioEscalonado) {
        if (cantidad <= 10) tarifaPza = getTarifa(cfg, "precio_1_10")
        else if (cantidad <= 50) tarifaPza = getTarifa(cfg, "precio_11_50")
        else if (cantidad <= 200) tarifaPza = getTarifa(cfg, "precio_51_200")
        else tarifaPza = getTarifa(cfg, "precio_200_mas")
        tarifaPza *= tipo.factor as number
        desglose.tarifa_por_pieza = tarifaPza
        if (llevaPlantilla) {
          const pPlant = getTarifa(cfg, "setup_plantilla") > 0 ? getTarifa(cfg, "setup_plantilla") : 150
          desglose.plantilla_sujecion = pPlant
          precioMaquila += pPlant
        }
        if (llevaRotativo) {
          const pRot = getTarifa(cfg, "cargo_rotativo") > 0 ? getTarifa(cfg, "cargo_rotativo") : 25
          desglose.eje_rotativo = pRot * cantidad
          precioMaquila += pRot * cantidad
        }
        const minAp = getTarifa(cfg, "minimo_apertura") > 0 ? getTarifa(cfg, "minimo_apertura") : 150
        if (tarifaPza * cantidad < minAp) desglose.minimo_apertura = minAp
      } else {
        tarifaPza = getTarifa(cfg, "tarifa_pieza") > 0 ? getTarifa(cfg, "tarifa_pieza") : 100
      }
      precioMaquila += tarifaPza * cantidad
      if (tienePrecioEscalonado) {
        const minAp2 = getTarifa(cfg, "minimo_apertura") > 0 ? getTarifa(cfg, "minimo_apertura") : 150
        if (precioMaquila < minAp2) precioMaquila = minAp2
      }
      tiempoHoras = ((tipo.factor as number) * cantidad) / 60
      break
    }

    case "precio_fijo": {
      precioMaquila = getTarifa(cfg, "precio_fijo") * cantidad
      tiempoHoras = 1.0
      break
    }

    default:
      tiempoHoras = 1.0
  }

  // Extras Router 2D
  const moLijado = desglose.mano_obra_lijado || 0
  const moBarniz = desglose.mano_obra_barnizado || 0
  const moDis = desglose.diseno_adicional || 0
  const extrasRouter = moLijado + moBarniz + moDis

  // Extras Plasma CNC
  let extrasPlasma = 0
  if (llevaLimpieza) {
    const costoLimp = getTarifa(cfg, "limpieza_pieza") > 0 ? getTarifa(cfg, "limpieza_pieza") : 80
    extrasPlasma += costoLimp * cantidad
    desglose.limpieza_pieza = costoLimp * cantidad
  }
  if (llevaFlete) {
    const areaTotal = (largo / 100) * (ancho / 100) * cantidad
    let costoFlete = 0
    if (areaTotal < 1.0) costoFlete = 0
    else if (areaTotal <= 3.0) costoFlete = getTarifa(cfg, "flete_mediano") > 0 ? getTarifa(cfg, "flete_mediano") : 350
    else costoFlete = getTarifa(cfg, "flete_grande") > 0 ? getTarifa(cfg, "flete_grande") : 800
    if (costoFlete > 0) {
      extrasPlasma += costoFlete
      desglose.flete_maniobra = costoFlete
    }
  }
  if (llevaDisenoPlasma) {
    if (clienteTraeArchivoDXF) {
      const setupDXF = getTarifa(cfg, "setup_archivo") > 0 ? getTarifa(cfg, "setup_archivo") : 75
      extrasPlasma += setupDXF
      desglose.setup_dxf = setupDXF
    } else {
      const tarifaDis = getTarifa(cfg, "tarifa_diseno_hora") > 0 ? getTarifa(cfg, "tarifa_diseno_hora") : 250
      const costoDis = tarifaDis * horasDisenoPlasma
      extrasPlasma += costoDis
      desglose.diseno_plasma = costoDis
    }
  }

  // ── COSTOS DIRECTOS ──────────────────────────────────────
  let materialNombre = null
  if (!clienteTraeMaterial) {
    if (usarInventario && materialInv) {
      cm = (materialInv.costo_unitario || 0) * cantidad
      cm *= 1.15 // merma 15%
      materialNombre = materialInv.nombre || null
    } else if (!usarInventario && materialLibrePrecio > 0) {
      cm = materialLibrePrecio * cantidad * 1.15
      materialNombre = materialLibreNombre || "Material"
    }
  }

  const cmaq = costos.costoHoraMaquina * tiempoHoras
  const cmo = costos.costoHoraOperador * tiempoHoras

  let cc
  const tarifaCons = getTarifa(cfg, "consumibles_hora")
  cc = tarifaCons > 0 ? tarifaCons * tiempoHoras : 25 * tiempoHoras

  const ca = (acabado && acabado.precio ? acabado.precio : 0) * cantidad
  const ci = costos.costoHoraTaller * tiempoHoras

  let extrasTotal = 0
  for (const e of extrasSeleccionados) extrasTotal += (e.precio || 0) * cantidad

  // ── COSTO TOTAL ────────────────────────────────────────
  let costoTotal
  if (precioMaquila > 0) {
    costoTotal = precioMaquila + cm + ca + extrasTotal + extrasRouter + extrasPlasma
  } else {
    costoTotal = cm + cmaq + cmo + cc + ca + ci + extrasTotal
  }

  // ── 3 PRECIOS CON MARGEN ────────────────────────────────
  const mMin = costos.margenMinimo / 100
  const mRec = costos.margenRecomendado / 100
  const mPrem = (costos.margenRecomendado + 15) / 100

  let baseMin, baseRec, basePrem
  if (precioMaquila > 0) {
    baseRec = costoTotal
    baseMin = costoTotal * (1 - (mRec - mMin))
    basePrem = costoTotal * (1 + (mPrem - mRec))
  } else {
    baseMin = costoTotal > 0 ? costoTotal / (1 - mMin) : 0
    baseRec = costoTotal > 0 ? costoTotal / (1 - mRec) : 0
    basePrem = costoTotal > 0 ? costoTotal / (1 - mPrem) : 0
  }

  const iva = aplicarIva ? baseRec * (costos.ivaPct / 100) : 0.0
  const pvConIva = baseRec + iva

  const utilidad = baseRec - costoTotal
  const margenReal = baseRec > 0 ? (utilidad / baseRec) * 100 : 0
  const gananciaHora = tiempoHoras > 0 ? utilidad / tiempoHoras : 0

  return {
    servicio: nombreServicio,
    emoji: emojiServicio,
    descripcion: descripcionEditable,
    total: round2(pvConIva),
    subtotal: round2(baseRec),
    iva: round2(iva),
    costoTotal: round2(costoTotal),
    pvMinimo: round2(baseMin),
    pvRecomendado: round2(baseRec),
    pvPremium: round2(basePrem),
    utilidad: round2(utilidad),
    margenReal: round2(margenReal),
    gananciaHora: round2(gananciaHora),
    tiempoHoras: round2(tiempoHoras),
    cm: round2(cm), cmo: round2(cmo), cmaq: round2(cmaq),
    cc: round2(cc), ca: round2(ca), ci: round2(ci),
    costosDesglose: {
      Material: round2(cm), Maquina: round2(cmaq), Operador: round2(cmo),
      Consumibles: round2(cc), Acabado: round2(ca), "Taller (CI)": round2(ci),
      Extras: round2(extrasTotal),
    },
    detalle: mapRound2(desglose),
    incluyeIva: aplicarIva,
    materialNombre,
  }
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}
function mapRound2(obj: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const k in obj) out[k] = round2(obj[k])
  return out
}
