// Costillas desde imagen (Muebles): la imagen se vuelve un campo de alturas y
// el mueble se arma con tablas paralelas ("costillas") cuyo canto sigue esas
// alturas. Dos tipos:
//   - pared: panel de pared, cabecera o frente de barra. La imagen se ve de
//     frente; cada costilla es vertical y su canto delantero sale más o menos
//     según la imagen. Atrás, travesaños ranurados (media madera) la amarran y
//     sirven para atornillar a la pared.
//   - banca: banca o mesa de centro. La imagen se ve desde arriba sobre el
//     asiento; el canto de arriba de cada costilla sigue la imagen. Abajo, dos
//     patas por costilla con un arco entre ellas, y varillas roscadas con
//     separadores que pasan por todas.
// Todo en milímetros. Las alturas llegan normalizadas (0 = bajo, 1 = alto),
// renglón 0 = arriba de la imagen. Lo que tiene que coincidir entre costillas
// (ranuras, arco, huecos de varilla) se decide con el peor caso de todas.
import { type TipoAlivio, conAlivios } from "@/lib/generador/ensamble"
import { type P, type Trazo, acomodarEnHojas, acotar, arco, cajaDibujo, circulo, dibujo, girar, trazo } from "@/lib/generador/geo2d"
import { numeroGrabado } from "@/lib/generador/rebanado"

export type ModoCostillas = "pared" | "banca"
export type Alturas = { datos: Float32Array; ancho: number; alto: number }

export type OpcionesCostillas = {
  modo: ModoCostillas
  largo: number // mm a lo largo del cual se reparten las costillas
  alto: number // pared: alto del panel; banca: altura del asiento (lo más alto)
  fondo: number // pared: fondo fijo atrás (sin relieve); banca: fondo del asiento
  relieve: number // mm que sube o sale lo más alto de la imagen sobre lo más bajo
  espesor: number // mm del material
  separacion: number // mm de aire entre costillas
  fresa: number // mm del diámetro de la fresa; 0 = láser
  holgura: number // mm extra en las ranuras
  // pared
  travesanos: number
  anchoTravesano: number
  // banca
  grosorAsiento: number // mm de material sobre el arco, debajo de lo más bajo del asiento
  pata: number // mm de ancho de cada pata
  varilla: number // mm del diámetro de la varilla roscada (0 = sin varillas)
  hoja: { ancho: number; alto: number }
  numerar: boolean
}

/** Medidas de inicio de cada tipo (la interfaz las pone al cambiar de tipo). */
export const INICIO_COSTILLAS: Record<ModoCostillas, { largo: number; alto: number; fondo: number; relieve: number }> = {
  pared: { largo: 1200, alto: 900, fondo: 40, relieve: 100 },
  banca: { largo: 1200, alto: 450, fondo: 400, relieve: 60 },
}

/** Pieza para la vista 3D: contorno (y huecos) en su plano y cómo se coloca. */
export type Pieza3D = {
  contorno: P[]
  huecos: P[][]
  /** costilla: plano (u = fondo, v = alto) en x; travesaño: plano (x, u) a la altura z */
  tipo: "costilla" | "travesano"
  pos: number
}

export const MAX_COSTILLAS = 200
const PASO = 3 // mm entre puntos del perfil
const MARGEN = 8 // mm de material mínimo alrededor de ranuras y huecos
const ARCO_MIN = 60 // mm de alto mínimo para hacer el arco entre patas

/** Altura (0–1) en (fx, fy) ∈ [0,1]², bilineal; fy = 0 arriba de la imagen. */
function muestra(a: Alturas, fx: number, fy: number) {
  const x = Math.min(a.ancho - 1, Math.max(0, fx * a.ancho - 0.5))
  const y = Math.min(a.alto - 1, Math.max(0, fy * a.alto - 0.5))
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = Math.min(a.ancho - 1, x0 + 1)
  const y1 = Math.min(a.alto - 1, y0 + 1)
  const tx = x - x0
  const ty = y - y0
  const d = a.datos
  const arriba = d[y0 * a.ancho + x0] * (1 - tx) + d[y0 * a.ancho + x1] * tx
  const abajo = d[y1 * a.ancho + x0] * (1 - tx) + d[y1 * a.ancho + x1] * tx
  return arriba * (1 - ty) + abajo * ty
}

/**
 * Perfil (0–1) de la costilla centrada en fx, de abajo (k = 0) hacia arriba
 * de la imagen: promedia la franja que le toca (ancho = paso entre costillas)
 * para que costillas vecinas no brinquen, y suaviza a lo largo con una
 * ventana de `suave` muestras.
 */
function perfil(a: Alturas, fx: number, franja: number, n: number, suave: number): number[] {
  const sub = Math.max(1, Math.min(9, Math.ceil(franja * a.ancho)))
  const crudo: number[] = []
  for (let k = 0; k < n; k++) {
    const fy = 1 - k / (n - 1)
    let s = 0
    for (let j = 0; j < sub; j++) s += muestra(a, fx + franja * ((j + 0.5) / sub - 0.5), fy)
    crudo.push(s / sub)
  }
  if (suave < 1) return crudo
  // promedio móvil (dos pasadas ≈ campana)
  const pasada = (v: number[]) => v.map((_, k) => {
    let s = 0
    let c = 0
    for (let j = Math.max(0, k - suave); j <= Math.min(v.length - 1, k + suave); j++) { s += v[j]; c++ }
    return s / c
  })
  return pasada(pasada(crudo))
}

/** Gira la pieza 90° si así su lado largo queda a lo largo del lado largo de la hoja. */
function orientar(g: Trazo[], hoja: { ancho: number; alto: number }): Trazo[] {
  const b = cajaDibujo(g)
  if (b.x1 - b.x0 >= b.y1 - b.y0 === hoja.ancho >= hoja.alto) return g
  return g.map((t) => ({ ...t, pts: girar(t.pts, Math.PI / 2, 0, 0) }))
}

/** Agrega una ranura (muesca rectangular) al contorno y marca sus 2 esquinas de adentro. */
function muesca(pts: P[], esquinas: Set<number>, ...cuatro: [P, P, P, P]) {
  pts.push(cuatro[0])
  esquinas.add(pts.length)
  pts.push(cuatro[1])
  esquinas.add(pts.length)
  pts.push(cuatro[2], cuatro[3])
}

type Comun = {
  a: Alturas
  t: number
  ranura: number
  rFresa: number
  alivio: TipoAlivio
  xs: number[]
  paso: number
  franja: number
  suave: number
  avisos: string[]
  numerar: boolean
  hoja: { ancho: number; alto: number }
}
type Parcial = { grupos: Trazo[][]; piezas3D: Pieza3D[]; extremos: [number, number]; extras: { travesanos: number; varillas: number; separadores: number; largoVarilla: number; fondo: number } }

const numero = (c: Comun, n: number, x: number, y: number, alto: number): Trazo[] => (c.numerar && alto >= 3 ? numeroGrabado(n, x, y, alto) : [])

// ── Pared ─────────────────────────────────────────────────────────────────
function costillasPared(c: Comun, o: { largo: number; alto: number; fondo: number; relieve: number; travesanos: number; anchoTravesano: number; separacion: number; holgura: number; fresa: number }): Parcial {
  const { ranura, xs, paso, avisos } = c
  const H = o.alto
  // Travesaños: la ranura no debe comerse el fondo fijo
  let cw = o.anchoTravesano
  if (o.travesanos > 0 && cw / 2 > o.fondo - MARGEN) {
    cw = Math.max(20, 2 * (o.fondo - MARGEN))
    avisos.push(`El travesaño se angostó a ${Math.round(cw)} mm: su ranura no debe comerse más de lo que mide el fondo fijo (${o.fondo} mm).`)
  }
  let nT = o.travesanos > 0 && o.fondo - cw / 2 >= MARGEN ? o.travesanos : 0
  if (o.travesanos > 0 && !nT) avisos.push("El fondo fijo es muy delgado para los travesaños: súbelo a 25 mm o más.")
  // Entre ranuras vecinas del travesaño queda (aire − holgura) de material
  if (nT && o.separacion - o.holgura < Math.max(3, o.fresa)) {
    nT = 0
    avisos.push(`Sin travesaños: con ${o.separacion} mm de aire no queda material entre sus ranuras. Deja al menos ${Math.ceil(Math.max(3, o.fresa) + o.holgura)} mm de aire.`)
  }
  // Alturas: repartidas, sin que la ranura llegue a la orilla ni se enciman
  const margen = Math.max(ranura / 2 + MARGEN + 2, Math.min(H * 0.12, 150))
  const pedidos = nT
  while (nT > 1 && (H - 2 * margen) / (nT - 1) < ranura + 2 * MARGEN) nT--
  if (nT === 1 && H < ranura + 2 * MARGEN + 4) nT = 0
  if (pedidos > nT) avisos.push(nT ? `Sólo caben ${nT} travesaño(s) en ${H} mm de alto.` : "El panel es muy bajo para los travesaños.")
  const alturasT = Array.from({ length: nT }, (_, k) => (nT === 1 ? H / 2 : margen + ((H - 2 * margen) * k) / (nT - 1)))
  // El número va en el claro más grande entre ranuras, sin tocarlas
  const cortes = [0, ...alturasT.flatMap((h) => [h - ranura / 2, h + ranura / 2]), H]
  let yNum = H / 2
  let claro = 0
  for (let k = 0; k + 1 < cortes.length; k += 2) if (cortes[k + 1] - cortes[k] > claro) { claro = cortes[k + 1] - cortes[k]; yNum = (cortes[k] + cortes[k + 1]) / 2 }
  const altoNum = Math.min(14, o.fondo * 0.35, claro - 4)

  const grupos: Trazo[][] = []
  const piezas3D: Pieza3D[] = []
  let lo = Infinity
  let hi = -Infinity
  const m = Math.max(2, Math.round(H / PASO) + 1)
  xs.forEach((x, i) => {
    const prof = perfil(c.a, x / o.largo, c.franja, m, c.suave)
    const frente: P[] = prof.map((h, k) => [o.fondo + o.relieve * h, (H * k) / (m - 1)])
    for (const [u] of frente) { lo = Math.min(lo, u); hi = Math.max(hi, u) }
    // Antihorario: abajo → frente hacia arriba → arriba → atrás hacia abajo con ranuras
    const pts: P[] = [[0, 0], ...frente, [0, H]]
    const esquinas = new Set<number>()
    for (const hv of [...alturasT].reverse()) muesca(pts, esquinas, [0, hv + ranura / 2], [cw / 2, hv + ranura / 2], [cw / 2, hv - ranura / 2], [0, hv - ranura / 2])
    const contorno = conAlivios(pts, c.rFresa, (j) => esquinas.has(j), c.alivio)
    grupos.push([trazo(contorno), ...numero(c, i + 1, o.fondo / 2, yNum, altoNum)])
    piezas3D.push({ contorno, huecos: [], tipo: "costilla", pos: x })
  })

  // Travesaños: de la primera a la última costilla con un sobrante en cada
  // punta; si no caben en la hoja, en tramos cortados a la mitad del aire
  const ini0 = xs[0] - ranura / 2 - 15
  const fin0 = xs[xs.length - 1] + ranura / 2 + 15
  const largoMax = Math.max(c.hoja.ancho, c.hoja.alto) - 20
  const tramos: [number, number][] = []
  if (nT) {
    let ini = ini0
    while (ini < fin0 - 1e-6) {
      let fin = Math.min(fin0, ini + largoMax)
      if (fin < fin0) {
        const opciones = xs.slice(0, -1).map((x) => x + paso / 2).filter((k) => k > ini + ranura && k <= fin)
        if (!opciones.length) {
          avisos.push("El travesaño no se puede partir entre costillas para que quepa en la hoja: usa una hoja más grande o menos aire entre costillas.")
          fin = fin0
        } else fin = opciones[opciones.length - 1]
      }
      tramos.push([ini, fin])
      ini = fin
    }
    if (tramos.length > 1) avisos.push(`Cada travesaño sale en ${tramos.length} tramos para que quepa en la hoja: únelos por atrás con una placa o atorníllalos a la pared.`)
  }
  let numT = xs.length
  for (const hv of alturasT)
    for (const [ini, fin] of tramos) {
      const L = fin - ini
      const pts: P[] = [[0, 0], [L, 0], [L, cw]]
      const esquinas = new Set<number>()
      for (const x of [...xs].filter((x) => x > ini && x < fin).reverse()) {
        const d = x - ini
        muesca(pts, esquinas, [d + ranura / 2, cw], [d + ranura / 2, cw / 2], [d - ranura / 2, cw / 2], [d - ranura / 2, cw])
      }
      pts.push([0, cw])
      const contorno = conAlivios(pts, c.rFresa, (j) => esquinas.has(j), c.alivio)
      numT++
      // El número va en la mitad de abajo, que no tiene ranuras
      grupos.push([trazo(contorno), ...numero(c, numT, Math.min(60, L / 2), cw / 4, Math.min(12, cw / 2 - 4))])
      piezas3D.push({ contorno: contorno.map(([x, u]) => [x + ini, u] as P), huecos: [], tipo: "travesano", pos: hv })
    }
  return { grupos, piezas3D, extremos: [lo, hi], extras: { travesanos: nT, varillas: 0, separadores: 0, largoVarilla: 0, fondo: o.fondo + o.relieve } }
}

// ── Banca ─────────────────────────────────────────────────────────────────
function costillasBanca(c: Comun, o: { largo: number; alto: number; fondo: number; relieve: number; grosorAsiento: number; pata: number; varilla: number }): Parcial {
  const { xs, avisos } = c
  const D = o.fondo
  const tope = o.alto
  const base = Math.max(30, tope - o.relieve)
  if (o.relieve > tope - 30) avisos.push("El relieve se limitó: lo más bajo del asiento debe quedar a 30 mm o más del piso.")
  const pata = Math.min(o.pata, D / 3)
  if (pata < o.pata) avisos.push(`Las patas se angostaron a ${Math.round(pata)} mm para que quepa el arco.`)
  const m = Math.max(2, Math.round(D / PASO) + 1)

  // 1. Todos los perfiles del asiento (u = 0 al frente = abajo de la imagen)
  const arribas: P[][] = xs.map((x) => perfil(c.a, x / o.largo, c.franja, m, c.suave).map((h, k) => [(D * k) / (m - 1), base + (tope - base) * h] as P))
  // lo más bajo del asiento entre u0 y u1, en todas las costillas
  const minEn = (u0: number, u1: number) => {
    let v = Infinity
    for (const ar of arribas) for (const [u, h] of ar) if (u >= u0 - PASO && u <= u1 + PASO && h < v) v = h
    return v
  }
  // 2. Lo que comparten todas: el arco y la altura de los huecos
  const vArco = minEn(pata, D - pata) - o.grosorAsiento
  const hayArco = vArco >= ARCO_MIN
  if (!hayArco) avisos.push("No queda altura para el arco entre las patas: las costillas salen macizas. Sube la altura o baja el relieve o el grosor del asiento.")
  const rr = hayArco ? Math.min(40, (D - 2 * pata) / 3, vArco / 2) : 0
  if (hayArco && c.rFresa > rr) avisos.push("La fresa es más gruesa que la curva del arco: la esquina sale con el radio de la fresa.")
  const r = o.varilla / 2
  const sobrePata = Math.min(minEn(0, pata), minEn(D - pata, D))
  const centros: P[] = []
  if (o.varilla > 0) {
    // Patas: a la misma altura en todas, con material arriba hasta el asiento
    const vPata = Math.min(120, (hayArco ? vArco : sobrePata) * 0.45, sobrePata - r - MARGEN)
    if (pata >= o.varilla + 2 * MARGEN && vPata >= r + MARGEN) centros.push([pata / 2, vPata], [D - pata / 2, vPata])
    else avisos.push(`Las patas no tienen lugar para la varilla de ${o.varilla} mm: deja la pata de al menos ${Math.ceil(o.varilla + 2 * MARGEN)} mm.`)
    // Centro: entre el arco y lo más bajo del asiento al centro, en todas las costillas
    const piso = hayArco ? vArco : 0
    const techo = minEn(D / 2 - r - MARGEN, D / 2 + r + MARGEN)
    if (techo - piso >= o.varilla + 2 * MARGEN) centros.push([D / 2, (piso + techo) / 2])
  }
  // Número: en la pata, arriba del hueco de varilla y debajo del asiento
  const yNum0 = centros.length && centros[0][0] === pata / 2 ? centros[0][1] + r + MARGEN : MARGEN
  const altoNum = Math.min(14, pata * 0.3, sobrePata - yNum0 - MARGEN)

  const grupos: Trazo[][] = []
  const piezas3D: Pieza3D[] = []
  let lo = Infinity
  let hi = -Infinity
  arribas.forEach((arriba, i) => {
    for (const [, v] of arriba) { lo = Math.min(lo, v); hi = Math.max(hi, v) }
    const pts: P[] = [[0, 0]]
    if (hayArco) {
      pts.push([pata, 0])
      // esquinas del arco redondeadas (cuarto de círculo)
      pts.push(...arco(pata + rr, vArco - rr, rr, Math.PI, Math.PI / 2))
      pts.push(...arco(D - pata - rr, vArco - rr, rr, Math.PI / 2, 0))
      pts.push([D - pata, 0])
    }
    pts.push([D, 0], ...[...arriba].reverse())
    const huecos = centros.map(([u, v]) => circulo(u, v, r).pts)
    grupos.push([trazo(pts), ...huecos.map((h) => trazo(h)), ...numero(c, i + 1, pata / 2, yNum0 + altoNum / 2, altoNum)])
    piezas3D.push({ contorno: pts, huecos, tipo: "costilla", pos: xs[i] })
  })
  const ocupado = xs[xs.length - 1] - xs[0] + c.t
  return {
    grupos,
    piezas3D,
    extremos: [lo, hi],
    extras: {
      travesanos: 0,
      varillas: centros.length,
      separadores: centros.length * (xs.length - 1),
      // tuerca y rondana en cada punta
      largoVarilla: centros.length ? Math.ceil(ocupado + 2 * (o.varilla * 0.8 + 15)) : 0,
      fondo: D,
    },
  }
}

export function hacerCostillas(a: Alturas, o0: OpcionesCostillas) {
  const avisos: string[] = []
  const ini = INICIO_COSTILLAS[o0.modo]
  const t = acotar(o0.espesor, 1, 60, 18)
  const o = {
    largo: acotar(o0.largo, 50, 6000, ini.largo),
    alto: acotar(o0.alto, 50, 3000, ini.alto),
    fondo: acotar(o0.fondo, 10, 1500, ini.fondo),
    relieve: acotar(o0.relieve, 0, 1000, ini.relieve),
    separacion: acotar(o0.separacion, 0, 500, 20),
    fresa: acotar(o0.fresa, 0, 25, 0),
    holgura: acotar(o0.holgura, 0, 3, 0.2),
    travesanos: Math.round(acotar(o0.travesanos, 0, 6, 2)),
    anchoTravesano: acotar(o0.anchoTravesano, 20, 300, 60),
    grosorAsiento: acotar(o0.grosorAsiento, 10, 500, 60),
    pata: acotar(o0.pata, 20, 500, 70),
    varilla: acotar(o0.varilla, 0, 30, 10),
  }
  const hoja = { ancho: acotar(o0.hoja.ancho, 200, 6000, 1220), alto: acotar(o0.hoja.alto, 200, 6000, 2440) }
  const ranura = t + o.holgura
  if (o.fresa > ranura) avisos.push(`La fresa de ${o.fresa} mm no entra en la ranura de ${Math.round(ranura * 10) / 10} mm: usa una fresa más delgada que el material.`)

  // Costillas: paso = espesor + aire; el juego completo queda centrado en el largo
  const paso = t + o.separacion
  let n = Math.max(1, Math.floor((o.largo - t) / paso) + 1)
  if (n > MAX_COSTILLAS) {
    avisos.push(`Salían ${n} costillas; se dejaron ${MAX_COSTILLAS}. Sube la separación o el espesor.`)
    n = MAX_COSTILLAS
  }
  const x0 = (o.largo - ((n - 1) * paso + t)) / 2 + t / 2
  const comun: Comun = {
    a,
    t,
    ranura,
    rFresa: o.fresa / 2,
    alivio: o.fresa > 0 ? "hueso" : "ninguno",
    xs: Array.from({ length: n }, (_, i) => x0 + i * paso),
    paso,
    franja: paso / o.largo,
    // a lo largo del perfil: al menos el diámetro de la fresa y unos 6 mm
    suave: Math.round(Math.max(6, 2 * o.fresa) / PASO),
    avisos,
    numerar: o0.numerar,
    hoja,
  }
  const p = o0.modo === "banca" ? costillasBanca(comun, o) : costillasPared(comun, o)

  // acomodarEnHojas no gira piezas: se orientan antes; las que no caben se avisan
  const r = acomodarEnHojas(p.grupos.map((g) => orientar(g, hoja)), hoja, 6)
  if (r.noCaben) avisos.push(`${r.noCaben} pieza(s) no caben en la hoja de ${hoja.ancho} × ${hoja.alto} mm y no salen en el archivo: haz el mueble más chico o la hoja más grande.`)
  if (o.relieve > 0 && p.extremos[1] - p.extremos[0] < o.relieve * 0.15) avisos.push("La imagen casi no tiene contraste: el relieve sale plano. Prueba otra foto o invierte claro/oscuro.")
  if (o.separacion < 3) avisos.push("Con menos de 3 mm de aire las costillas se ven como un bloque y cuesta armarlas.")

  return {
    dibujo: dibujo(r.trazos, avisos),
    avisos,
    piezas3D: p.piezas3D,
    costillas: n,
    paso,
    separacionReal: paso - t,
    piezas: p.grupos.length - r.noCaben,
    hojas: r.hojas,
    espesor: t,
    ...p.extras,
    medidas: { largo: o.largo, fondo: p.extras.fondo, alto: o.alto },
  }
}

export type ResultadoCostillas = ReturnType<typeof hacerCostillas>
