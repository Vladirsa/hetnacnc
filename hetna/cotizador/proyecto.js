// ===== HetNa Cotizador: proyecto con varias piezas =====
// Cotiza un proyecto (p. ej. un modelo partido en 12 piezas, o un mueble) con
// el motor de UNA pieza (engine.js, que no se toca): cada pieza se calcula con
// su medida y su cantidad, y se suman. Lo que el motor cobra una sola vez por
// trabajo se cobra una sola vez por proyecto:
//   · mínimos (impresión 3D, plasma, láser fibra): se apagan por pieza y se
//     aplican al total, con la misma regla del motor;
//   · cargos únicos (diseño adicional, flete, preparar DXF, plantilla): se
//     calculan aparte, una vez, sobre el área total del proyecto;
//   · láser fibra: el precio escalonado usa las piezas totales del proyecto.
// Así, N piezas iguales cuestan lo mismo que una pieza con cantidad N.
// Las fórmulas "por hora" y "por diseño" no dependen de las piezas: el
// proyecto se cotiza como un solo trabajo (cotizar devuelve null).
const PROYECTO = (() => {
  const UNICOS = ["llevaDiseno", "llevaFlete", "llevaDisenoPlasma", "llevaPlantilla"];
  const POR_TRABAJO = ["por_hora", "por_diseno"];
  const CASI_CERO = 1e-9;
  const SUMAR = ["pvMinimo", "pvRecomendado", "pvPremium", "costoTotal", "utilidad", "tiempoHoras", "cm", "ca", "cmo", "cmaq", "cc", "ci"];
  // lo que el motor suma aparte de la maquila (desglose)
  const EXTRAS_DESGLOSE = ["mano_obra_lijado", "mano_obra_barnizado", "diseno_adicional", "limpieza_pieza", "flete_maniobra", "setup_dxf", "diseno_plasma"];
  const t = (tarifas, k, def) => (tarifas[k] > 0 ? tarifas[k] : def);
  const escalon = (u) => (u <= 10 ? "precio_1_10" : u <= 50 ? "precio_11_50" : u <= 200 ? "precio_51_200" : "precio_200_mas");
  const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

  /** Maquila de una pieza (lo que el motor compara contra el mínimo). */
  const maquila = (r) => r.costoTotal - r.cm - r.ca - EXTRAS_DESGLOSE.reduce((s, k) => s + (r.detalle[k] || 0), 0);

  /**
   * base: parámetros comunes del motor (cfg, costos, tipo, extras del servicio...)
   * lineas: [{ nombre, params: { largo, ancho, alto, metros, perimetroRealMm, volumenRealCm3, materialLibrePrecio, cantidad } }]
   * calc: el motor (calcular de engine.js)
   */
  function cotizar(base, lineas, calc) {
    if (!lineas.length || POR_TRABAJO.includes(base.tipo.formula)) return null;
    const f = base.tipo.formula;
    const orig = base.cfg.tarifas || {};
    const tarifas = { ...orig, minimo: CASI_CERO, minimo_apertura: CASI_CERO };
    const unidades = lineas.reduce((s, l) => s + Math.max(1, l.params.cantidad || 1), 0);
    const fibra = f === "por_pieza" && orig.precio_1_10 > 0;
    if (fibra) {
      const v = orig[escalon(unidades)];
      for (const k of ["precio_1_10", "precio_11_50", "precio_51_200", "precio_200_mas"]) tarifas[k] = v;
    }
    const sinUnicos = Object.fromEntries(UNICOS.map((k) => [k, false]));
    const cfg = { ...base.cfg, tarifas };

    const res = lineas.map((l) => ({ nombre: l.nombre, cantidad: Math.max(1, l.params.cantidad || 1), r: calc({ ...base, ...sinUnicos, cfg, ...l.params }) }));
    const suma = Object.fromEntries(SUMAR.map((k) => [k, res.reduce((s, x) => s + (x.r[k] || 0), 0)]));

    // Mínimo del trabajo, como lo aplica el motor a una pieza
    const kMin = 1 - (base.costos.margenRecomendado - base.costos.margenMinimo) / 100;
    const kPrem = 1 + 0.15;
    const maqTotal = res.reduce((s, x) => s + maquila(x.r), 0);
    let minimo = 0, delta = 0;
    if (f === "por_volumen" && (orig.factor_rapida > 0 || orig.costo_pla > 0)) {
      minimo = t(orig, "minimo", 200);
      if (maqTotal + suma.cm < minimo) delta = minimo - maqTotal;
    } else if (f === "por_area" && orig.tarifa_m2_delgado > 0) {
      minimo = t(orig, "minimo_apertura", 150);
      const umbral = t(orig, "umbral_minimo_m2", 0.09);
      const chica = lineas.some((l) => ((l.params.largo || 0) / 100) * ((l.params.ancho || 0) / 100) < umbral);
      if (chica && maqTotal < minimo) delta = minimo - maqTotal;
    } else if (fibra) {
      minimo = t(orig, "minimo_apertura", 150);
      if (maqTotal < minimo) delta = minimo - maqTotal;
    }
    if (delta > 0) {
      suma.costoTotal += delta;
      suma.pvRecomendado += delta;
      suma.pvMinimo += delta * kMin;
      suma.pvPremium += delta * kPrem;
    }

    // Cargos únicos: una vez, sobre una pieza del área total del proyecto
    let unicos = 0;
    if (UNICOS.some((k) => base[k])) {
      const areaCm2 = lineas.reduce((s, l) => s + (l.params.largo || 0) * (l.params.ancho || 0) * Math.max(1, l.params.cantidad || 1), 0);
      const lado = Math.sqrt(areaCm2);
      const pieza = { largo: lado, ancho: lado, alto: 0, metros: 0, perimetroRealMm: 0, volumenRealCm3: 0, materialLibrePrecio: 0, cantidad: 1 }
      const con = calc({ ...base, cfg, ...pieza })
      const sin = calc({ ...base, ...sinUnicos, cfg, ...pieza })
      for (const k of ["pvMinimo", "pvRecomendado", "pvPremium", "costoTotal", "utilidad"]) suma[k] += con[k] - sin[k];
      unicos = con.pvRecomendado - sin.pvRecomendado;
    }

    const out = Object.fromEntries(Object.entries(suma).map(([k, v]) => [k, r2(v)]));
    return {
      ...out,
      margenReal: out.pvRecomendado > 0 ? r2((out.utilidad / out.pvRecomendado) * 100) : 0,
      detalle: {},
      materialNombre: res.find((x) => x.r.materialNombre)?.r.materialNombre || null,
      lineas: res.map((x) => ({ nombre: x.nombre, cantidad: x.cantidad, pvRecomendado: x.r.pvRecomendado, tiempoHoras: x.r.tiempoHoras })),
      unidades,
      minimo: delta > 0 ? { valor: minimo, agregado: r2(delta) } : null,
      unicos: r2(unicos),
    };
  }

  return { cotizar, UNICOS, POR_TRABAJO };
})();
if (typeof module !== "undefined") module.exports = PROYECTO;
