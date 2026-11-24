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
// renglón 0 = arriba de la imagen.
import { type TipoAlivio, conAlivios } from "@/lib/generador/ensamble"
import { type P, type Trazo, acomodarEnHojas, cajaDibujo, circulo, dibujo, girar, trazo } from "@/lib/generador/geo2d"
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

const acotar = (x: number, min: number, max: number, omision: number) => (Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : omision)

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
 * Perfil (0–1) de la costilla centrada en fx: promedia la franja de la imagen
 * que le toca (ancho = paso entre costillas) para que costillas vecinas no
 * brinquen, y suaviza a lo largo con una ventana de `suave` muestras.
 */
function perfil(a: Alturas, fx: number, franja: number, n: number, fyDe: (k: number) => number, suave: number): number[] {
  const sub = Math.max(1, Math.min(9, Math.ceil(franja * a.ancho)))
  const crudo: number[] = []
  for (let k = 0; k < n; k++) {
    let s = 0
    for (let j = 0; j < sub; j++) s += muestra(a, fx + franja * ((j + 0.5) / sub - 0.5), fyDe(k))
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
  const largaH = b.x1 - b.x0 >= b.y1 - b.y0
  const hojaH = hoja.ancho >= hoja.alto
  if (largaH === hojaH) return g
  return g.map((t) => ({ ...t, pts: girar(t.pts, Math.PI / 2, 0, 0) }))
}

function numero(n: number, x: number, y: number, alto: number, numerar: boolean): Trazo[] {
  return numerar && alto >= 3 ? numeroGrabado(n, x, y, alto) : []
}

export function hacerCostillas(a: Alturas, o0: OpcionesCostillas) {
  const avisos: string[] = []
  const banca = o0.modo === "banca"
  const t = acotar(o0.espesor, 1, 60, 18)
  const o = {
    ...o0,
    largo: acotar(o0.largo, 50, 6000, banca ? 1200 : 1200),
    alto: acotar(o0.alto, 50, 3000, banca ? 450 : 900),
    fondo: acotar(o0.fondo, 10, 1500, banca ? 400 : 40),
    relieve: acotar(o0.relieve, 0, 1000, 80),
    separacion: acotar(o0.separacion, 0, 500, 20),
    fresa: acotar(o0.fresa, 0, 25, 0),
    holgura: acotar(o0.holgura, 0, 3, 0.2),
    travesanos: Math.round(acotar(o0.travesanos, 0, 6, 2)),
    anchoTravesano: acotar(o0.anchoTravesano, 20, 300, 60),
    grosorAsiento: acotar(o0.grosorAsiento, 10, 500, 60),
    pata: acotar(o0.pata, 20, 500, 70),
    varilla: acotar(o0.varilla, 0, 30, 10),
    hoja: { ancho: acotar(o0.hoja.ancho, 200, 6000, 1220), alto: acotar(o0.hoja.alto, 200, 6000, 2440) },
  }
  const ranura = t + o.holgura
  const rFresa = o.fresa / 2
  const alivio: TipoAlivio = o.fresa > 0 ? "hueso" : "ninguno"

  // Costillas: paso = espesor + aire; el juego completo queda centrado en el largo
  const paso = t + o.separacion
  let n = Math.floor((o.largo - t) / paso) + 1
  if (n > MAX_COSTILLAS) {
    avisos.push(`Salían ${n} costillas; se dejaron ${MAX_COSTILLAS}. Sube la separación o el espesor.`)
    n = MAX_COSTILLAS
  }
  n = Math.max(1, n)
  const ocupado = (n - 1) * paso + t
  const x0 = (o.largo - ocupado) / 2 + t / 2
  const xs = Array.from({ length: n }, (_, i) => x0 + i * paso)
  const franja = paso / o.largo

  // Suavizado a lo largo del perfil: al menos el diámetro de la fresa (lo que
  // no alcanza a seguir) y unos 6 mm para que el canto quede liso
  const suave = Math.round(Math.max(6, 2 * o.fresa) / PASO)

  const grupos: Trazo[][] = []
  const piezas3D: Pieza3D[] = []
  let alturaMin = Infinity
  let alturaMax = -Infinity
  let costillaMax = 0
  let separadores = 0
  let varillas = 0
  let largoVarilla = 0
  const alturasTravesanos: number[] = []

  if (!banca) {
    // ── Pared ───────────────────────────────────────────────────────────
    const H = o.alto
    let cw = o.anchoTravesano
    if (o.travesanos > 0 && cw / 2 > o.fondo - 8) {
      cw = Math.max(20, 2 * (o.fondo - 8))
      avisos.push(`El travesaño se angostó a ${Math.round(cw)} mm: su ranura no debe comerse más de lo que mide el fondo fijo (${o.fondo} mm).`)
    }
    const nT = o.travesanos > 0 && o.fondo - cw / 2 >= 8 ? o.travesanos : 0
    if (o.travesanos > 0 && !nT) avisos.push("El fondo fijo es muy delgado para los travesaños: súbelo a 25 mm o más.")
    // Alturas de los travesaños: repartidos, sin pegarse a las orillas
    const margen = Math.min(H * 0.12, 150)
    for (let k = 0; k < nT; k++) alturasTravesanos.push(nT === 1 ? H / 2 : margen + ((H - 2 * margen) * k) / (nT - 1))
    const m = Math.max(2, Math.round(H / PASO) + 1)
    xs.forEach((x, i) => {
      // v = 0 abajo; la imagen tiene renglón 0 arriba
      const prof = perfil(a, x / o.largo, franja, m, (k) => 1 - k / (m - 1), suave)
      const frente: P[] = prof.map((h, k) => [o.fondo + o.relieve * h, (H * k) / (m - 1)])
      for (const [u] of frente) { alturaMin = Math.min(alturaMin, u); alturaMax = Math.max(alturaMax, u) }
      // Contorno antihorario: abajo → frente hacia arriba → arriba → atrás hacia abajo con ranuras
      const pts: P[] = [[0, 0], ...frente, [0, H]]
      const esquinas = new Set<number>()
      for (const hv of [...alturasTravesanos].sort((p, q) => q - p)) {
        const arriba = hv + ranura / 2
        const abajo = hv - ranura / 2
        pts.push([0, arriba])
        esquinas.add(pts.length)
        pts.push([cw / 2, arriba])
        esquinas.add(pts.length)
        pts.push([cw / 2, abajo])
        pts.push([0, abajo])
      }
      const contorno = conAlivios(pts, rFresa, (j) => esquinas.has(j), alivio)
      const g: Trazo[] = [trazo(contorno), ...numero(i + 1, o.fondo / 2, H / 2, Math.min(14, o.fondo * 0.35), o.numerar)]
      grupos.push(g)
      piezas3D.push({ contorno, huecos: [], tipo: "costilla", pos: x })
      costillaMax = Math.max(costillaMax, o.fondo + o.relieve)
    })
    // Travesaños: tira de largo × ancho con ranuras desde su canto delantero
    // en cada costilla; si no cabe en la hoja, en tramos cortados entre costillas
    const largoMax = Math.max(o.hoja.ancho, o.hoja.alto) - 20
    const tramos: [number, number][] = []
    if (nT) {
      let ini = 0
      while (ini < o.largo - 1e-6) {
        let fin = Math.min(o.largo, ini + largoMax)
        if (fin < o.largo) {
          // cortar a la mitad del aire entre dos costillas, antes de pasarse
          const cortes = xs.slice(0, -1).map((x) => x + paso / 2).filter((c) => c > ini + paso && c <= fin)
          if (cortes.length) fin = cortes[cortes.length - 1]
        }
        tramos.push([ini, fin])
        ini = fin
      }
      if (tramos.length > 1) avisos.push(`Cada travesaño sale en ${tramos.length} tramos para que quepa en la hoja: únelos por atrás con una placa o atorníllalos a la pared.`)
    }
    let numT = n
    alturasTravesanos.forEach((hv) => {
      tramos.forEach(([ini, fin]) => {
        const pts: P[] = [[0, 0], [fin - ini, 0], [fin - ini, cw]]
        const esquinas = new Set<number>()
        for (const x of [...xs].filter((x) => x > ini && x < fin).sort((p, q) => q - p)) {
          const d = x - ini
          pts.push([d + ranura / 2, cw])
          pts.push([d + ranura / 2, cw / 2])
          esquinas.add(pts.length - 1)
          pts.push([d - ranura / 2, cw / 2])
          esquinas.add(pts.length - 1)
          pts.push([d - ranura / 2, cw])
        }
        pts.push([0, cw])
        const contorno = conAlivios(pts, rFresa, (j) => esquinas.has(j), alivio)
        numT++
        grupos.push([trazo(contorno), ...numero(numT, Math.min(60, (fin - ini) / 2), cw / 4, Math.min(12, cw * 0.3), o.numerar)])
        piezas3D.push({ contorno: contorno.map(([x, u]) => [x + ini, u] as P), huecos: [], tipo: "travesano", pos: hv })
      })
    })
  } else {
    // ── Banca ───────────────────────────────────────────────────────────
    const D = o.fondo
    const tope = o.alto
    const base = Math.max(30, tope - o.relieve)
    if (o.relieve > tope - 30) avisos.push(`El relieve se limitó: lo más bajo del asiento debe quedar a 30 mm o más del piso.`)
    const pata = Math.min(o.pata, D / 3)
    if (pata < o.pata) avisos.push(`Las patas se angostaron a ${Math.round(pata)} mm para que quepa el arco.`)
    const m = Math.max(2, Math.round(D / PASO) + 1)
    const nVar = o.varilla > 0 ? 3 : 0
    xs.forEach((x, i) => {
      // u = 0 al frente; la imagen se ve desde arriba con el frente abajo
      const prof = perfil(a, x / o.largo, franja, m, (k) => 1 - k / (m - 1), suave)
      const arriba: P[] = prof.map((h, k) => [(D * k) / (m - 1), base + (tope - base) * h])
      for (const [, v] of arriba) { alturaMin = Math.min(alturaMin, v); alturaMax = Math.max(alturaMax, v) }
      // El arco: debajo de lo más bajo del asiento entre las patas, menos el grosor
      const bajoEntre = Math.min(...arriba.filter(([u]) => u >= pata && u <= D - pata).map(([, v]) => v))
      const vArco = bajoEntre - o.grosorAsiento
      const pts: P[] = [[0, 0]]
      if (vArco >= 60) {
        const rr = Math.min(40, (D - 2 * pata) / 3, vArco / 2)
        pts.push([pata, 0])
        // esquinas del arco redondeadas (cuarto de círculo)
        for (let k = 0; k <= 6; k++) {
          const ang = Math.PI - (Math.PI / 2) * (k / 6)
          pts.push([pata + rr + rr * Math.cos(ang), vArco - rr + rr * Math.sin(ang)])
        }
        for (let k = 0; k <= 6; k++) {
          const ang = Math.PI / 2 - (Math.PI / 2) * (k / 6)
          pts.push([D - pata - rr + rr * Math.cos(ang), vArco - rr + rr * Math.sin(ang)])
        }
        pts.push([D - pata, 0])
      } else if (i === 0) avisos.push("No queda altura para el arco entre las patas: las costillas salen macizas. Sube la altura o baja el relieve o el grosor del asiento.")
      pts.push([D, 0], ...[...arriba].reverse())
      // Varillas: en cada pata y una al centro bajo el asiento
      const huecos: P[][] = []
      if (nVar) {
        const r = o.varilla / 2
        const vPata = Math.min(120, (vArco >= 60 ? vArco : bajoEntre) * 0.45)
        const centros: P[] = [[pata / 2, vPata], [D - pata / 2, vPata]]
        const libreCentro = bajoEntre - (vArco >= 60 ? vArco : 0)
        if (vArco >= 60 && libreCentro >= o.varilla + 20) centros.push([D / 2, vArco + libreCentro / 2])
        if (pata < o.varilla + 20 && i === 0) avisos.push("La pata es angosta para la varilla: deja al menos el diámetro más 20 mm.")
        for (const c of centros) huecos.push(circulo(c[0], c[1], r).pts)
      }
      const contorno = pts
      const g: Trazo[] = [trazo(contorno), ...huecos.map((h) => trazo(h)), ...numero(i + 1, pata / 2, Math.max(20, (vArco >= 60 ? vArco : bajoEntre) * 0.75), Math.min(14, pata * 0.3), o.numerar)]
      grupos.push(g)
      piezas3D.push({ contorno, huecos, tipo: "costilla", pos: x })
      costillaMax = Math.max(costillaMax, tope)
      if (i === 0) { varillas = huecos.length; separadores = huecos.length * (n - 1) }
    })
    if (nVar) largoVarilla = Math.ceil(ocupado + 2 * (o.varilla * 0.8 + 10 + 5))
  }

  // acomodarEnHojas no gira piezas: se orientan antes; las que no caben se avisan
  const r = acomodarEnHojas(grupos.map((g) => orientar(g, o.hoja)), o.hoja, 6)
  if (r.noCaben) avisos.push(`${r.noCaben} pieza(s) no caben en la hoja de ${o.hoja.ancho} × ${o.hoja.alto} mm y no salen en el archivo: haz el mueble más chico o la hoja más grande.`)
  if (o.relieve > 0 && alturaMax - alturaMin < o.relieve * 0.15) avisos.push("La imagen casi no tiene contraste: el relieve sale plano. Prueba otra foto o invierte claro/oscuro.")
  if (o.separacion < 3) avisos.push("Con menos de 3 mm de aire las costillas se ven como un bloque y cuesta armarlas.")

  return {
    dibujo: dibujo(r.trazos, avisos),
    avisos,
    piezas3D,
    costillas: n,
    paso,
    separacionReal: paso - t,
    travesanos: alturasTravesanos.length,
    piezas: grupos.length - r.noCaben,
    hojas: r.hojas,
    separadores,
    varillas,
    largoVarilla,
    espesor: t,
    medidas: banca ? { largo: o.largo, fondo: o.fondo, alto: o.alto } : { largo: o.largo, fondo: costillaMax, alto: o.alto },
  }
}

export type ResultadoCostillas = ReturnType<typeof hacerCostillas>
