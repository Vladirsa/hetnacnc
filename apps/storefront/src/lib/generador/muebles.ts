// Despiece de muebles modulares (gabinetes, libreros, closets, cocinas) para maquila CNC.
// Reglas de carpintería estándar en México (melamina / MDF). Todas son puntos de partida:
// cada taller puede ajustar holguras y medidas en OpcionesMueble.
// Todo en milímetros.

export type Frente = "abierto" | "puertas" | "cajones" | "mixto"

export type OpcionesMueble = {
  ancho: number // exterior
  alto: number // exterior (incluye zoclo)
  fondo: number // exterior (incluye el fondo trasero)
  espesor: number // tablero principal: 15, 16, 18...
  zoclo: number // 0 = sin zoclo
  conFondo: boolean // fondo trasero de 3 mm sobrepuesto
  repisas: number
  repisasMoviles: boolean
  frente: Frente
  puertas: 1 | 2
  cajones: number
  altoZonaCajones: number // solo en "mixto": alto de la zona de cajones
  modulos: number // cantidad de módulos iguales
  // reglas del taller
  holguraFrente: number // luz entre frentes y puertas (mm)
  retranqueoRepisa: number // cuánto se meten las repisas desde el frente
  holguraCorredera: number // por lado, correderas telescópicas (12.7 típico)
}

export const OPCIONES_INICIO: OpcionesMueble = {
  ancho: 600,
  alto: 900,
  fondo: 560,
  espesor: 16,
  zoclo: 100,
  conFondo: true,
  repisas: 1,
  repisasMoviles: true,
  frente: "puertas",
  puertas: 2,
  cajones: 3,
  altoZonaCajones: 450,
  modulos: 1,
  holguraFrente: 3,
  retranqueoRepisa: 20,
  holguraCorredera: 12.7,
}

export const ESPESOR_FONDO = 3
const CORREDERAS = [250, 300, 350, 400, 450, 500, 550, 600]

// Canto: qué orillas llevan cubrecanto. l = orilla larga, a = orilla corta
export type Canto = { l: number; a: number } // cuántas orillas largas y cortas (0, 1 o 2)

export type Pieza = {
  nombre: string
  cantidad: number
  largo: number // en dirección de la veta
  ancho: number
  espesor: number
  canto: Canto
  nota?: string
}

export type Herraje = { nombre: string; cantidad: number; nota?: string }

export type Despiece = {
  piezas: Pieza[]
  herrajes: Herraje[]
  errores: string[]
  avisos: string[]
  resumen: { metrosCanto: number; m2Tablero: number; m2Fondo: number }
}

const r1 = (x: number) => Math.round(x * 10) / 10

export function despiece(o: OpcionesMueble): Despiece {
  const errores: string[] = []
  const avisos: string[] = []
  const e = o.espesor
  const N = Math.max(1, Math.round(o.modulos))
  const vacio = (): Despiece => ({ piezas: [], herrajes: [], errores, avisos, resumen: { metrosCanto: 0, m2Tablero: 0, m2Fondo: 0 } })

  if (![o.ancho, o.alto, o.fondo, e].every((x) => Number.isFinite(x) && x > 0)) {
    errores.push("Escribe ancho, alto, fondo y espesor mayores que cero.")
    return vacio()
  }
  if (o.ancho < 2 * e + 100) errores.push("El mueble es muy angosto para ese espesor de tablero.")
  if (o.fondo < 150) errores.push("El fondo mínimo es de 150 mm.")
  if (o.zoclo < 0 || o.zoclo > o.alto / 3) errores.push("El zoclo debe estar entre 0 y un tercio del alto.")
  if (o.frente === "mixto" && !(o.altoZonaCajones > 100 && o.altoZonaCajones < o.alto - o.zoclo - 150))
    errores.push("El alto de la zona de cajones debe dejar al menos 150 mm para las puertas.")
  if ((o.frente === "cajones" || o.frente === "mixto") && !(o.cajones >= 1 && o.cajones <= 8)) errores.push("Pon de 1 a 8 cajones.")
  if (errores.length) return vacio()

  const D = o.fondo - (o.conFondo ? ESPESOR_FONDO : 0) // profundidad del cuerpo
  const anchoInterior = o.ancho - 2 * e
  const altoFrente = o.alto - o.zoclo // zona que cubren puertas y cajones
  const hF = o.holguraFrente
  const piezas: Pieza[] = []
  const herrajes: Herraje[] = []
  const add = (p: Pieza) => { if (p.cantidad > 0) piezas.push({ ...p, cantidad: p.cantidad * N, largo: r1(p.largo), ancho: r1(p.ancho) }) }

  // cuerpo
  add({ nombre: "Lateral", cantidad: 2, largo: o.alto, ancho: D, espesor: e, canto: { l: 1, a: 0 } })
  add({ nombre: "Techo", cantidad: 1, largo: anchoInterior, ancho: D, espesor: e, canto: { l: 1, a: 0 } })
  add({ nombre: "Base", cantidad: 1, largo: anchoInterior, ancho: D, espesor: e, canto: { l: 1, a: 0 } })
  if (o.zoclo > 0) add({ nombre: "Zoclo", cantidad: 1, largo: anchoInterior, ancho: o.zoclo, espesor: e, canto: { l: 1, a: 0 }, nota: "Va al frente, debajo de la base" })
  const nRepisas = Math.max(0, Math.round(o.repisas))
  if (nRepisas)
    add({
      nombre: o.repisasMoviles ? "Repisa móvil" : "Repisa fija",
      cantidad: nRepisas,
      largo: anchoInterior - (o.repisasMoviles ? 2 : 0),
      ancho: D - o.retranqueoRepisa,
      espesor: e,
      canto: { l: 1, a: 0 },
    })
  if (o.conFondo) add({ nombre: "Fondo trasero", cantidad: 1, largo: o.alto - 4, ancho: o.ancho - 4, espesor: ESPESOR_FONDO, canto: { l: 0, a: 0 }, nota: "Clavado o grapado por detrás" })

  // frentes
  const conCajones = o.frente === "cajones" || o.frente === "mixto"
  const conPuertas = o.frente === "puertas" || o.frente === "mixto"
  const nCaj = conCajones ? Math.round(o.cajones) : 0
  const zonaCaj = o.frente === "cajones" ? altoFrente : o.frente === "mixto" ? o.altoZonaCajones : 0
  const zonaPuertas = o.frente === "puertas" ? altoFrente : o.frente === "mixto" ? altoFrente - zonaCaj : 0

  if (o.frente === "mixto") add({ nombre: "Entrepaño divisor", cantidad: 1, largo: anchoInterior, ancho: D, espesor: e, canto: { l: 1, a: 0 }, nota: "Separa cajones y puertas" })

  let nPuertas = 0
  if (conPuertas) {
    nPuertas = o.puertas
    const altoP = zonaPuertas - hF
    const anchoP = o.puertas === 1 ? o.ancho - hF : (o.ancho - 2 * hF) / 2
    add({ nombre: "Puerta", cantidad: nPuertas, largo: altoP, ancho: anchoP, espesor: e, canto: { l: 2, a: 2 } })
    const bis = altoP <= 900 ? 2 : altoP <= 1600 ? 3 : altoP <= 2200 ? 4 : 5
    herrajes.push({ nombre: "Bisagra de cazoleta 35 mm", cantidad: bis * nPuertas * N, nota: `${bis} por puerta` })
    if (anchoP > 600) avisos.push(`Las puertas miden ${r1(anchoP)} mm de ancho: arriba de 600 mm tienden a colgarse. Considera 2 puertas o un módulo más angosto.`)
  }

  if (nCaj) {
    const altoFr = (zonaCaj - nCaj * hF) / nCaj
    add({ nombre: "Frente de cajón", cantidad: nCaj, largo: o.ancho - hF, ancho: altoFr, espesor: e, canto: { l: 2, a: 2 } })
    const L = [...CORREDERAS].reverse().find((c) => c <= D - 20)
    if (!L) {
      avisos.push("El fondo es muy corto para correderas estándar (mínimo 250 mm).")
    } else {
      const anchoCaja = anchoInterior - 2 * o.holguraCorredera
      const altoCaja = Math.max(60, altoFr - 40)
      add({ nombre: "Costado de cajón", cantidad: 2 * nCaj, largo: L, ancho: altoCaja, espesor: e, canto: { l: 1, a: 0 } })
      add({ nombre: "Frente y trasera de cajón", cantidad: 2 * nCaj, largo: anchoCaja - 2 * e, ancho: altoCaja, espesor: e, canto: { l: 1, a: 0 } })
      add({ nombre: "Fondo de cajón", cantidad: nCaj, largo: L, ancho: anchoCaja, espesor: ESPESOR_FONDO, canto: { l: 0, a: 0 }, nota: "Clavado por debajo de la caja" })
      herrajes.push({ nombre: `Par de correderas telescópicas de ${L} mm`, cantidad: nCaj * N })
      if (altoFr < 100) avisos.push("Los frentes de cajón quedan de menos de 100 mm de alto: considera menos cajones.")
    }
  }

  const jaladeras = nPuertas + nCaj
  if (jaladeras) herrajes.push({ nombre: "Jaladera", cantidad: jaladeras * N })
  if (nRepisas && o.repisasMoviles) herrajes.push({ nombre: "Soporte de repisa", cantidad: 4 * nRepisas * N })
  const uniones = 2 * (2 + (o.frente === "mixto" ? 1 : 0) + (o.repisasMoviles ? 0 : nRepisas)) + (o.zoclo > 0 ? 2 : 0)
  herrajes.push({ nombre: "Tornillo confirmat 7 × 50", cantidad: uniones * 3 * N, nota: "3 por unión" })
  if (nCaj) herrajes.push({ nombre: "Tornillo 4 × 30 para cajón", cantidad: nCaj * 8 * N })
  if (o.conFondo || nCaj) herrajes.push({ nombre: "Clavo o grapa para fondos", cantidad: Math.ceil(((o.conFondo ? 2 * (o.ancho + o.alto) / 100 : 0) + nCaj * 12)) * N })

  // resumen
  let canto = 0
  let m2T = 0
  let m2F = 0
  for (const p of piezas) {
    const orillas = p.canto.l * p.largo + p.canto.a * p.ancho
    canto += (orillas + 30 * (p.canto.l + p.canto.a)) * p.cantidad // 3 cm extra por tramo para recortar
    const a = (p.largo * p.ancho * p.cantidad) / 1e6
    if (p.espesor === ESPESOR_FONDO) m2F += a
    else m2T += a
  }
  return { piezas, herrajes, errores, avisos, resumen: { metrosCanto: canto / 1000, m2Tablero: m2T, m2Fondo: m2F } }
}

// ======================================================================
// Acomodo en hojas (MaxRects, mejor lado corto)
// ======================================================================
export type Hoja = { ancho: number; alto: number }
export type Colocada = { nombre: string; x: number; y: number; w: number; h: number; girada: boolean; n: number }
export type Acomodo = { hojas: Colocada[][]; hoja: Hoja; aprovechamiento: number; noCaben: string[] }

type R = { x: number; y: number; w: number; h: number }

export function acomodar(piezas: Pieza[], hoja: Hoja, opciones: { separacion: number; margen: number; respetarVeta: boolean }): Acomodo {
  const { separacion: s, margen: m, respetarVeta } = opciones
  // una entrada por pieza física, numeradas para etiquetarlas
  const lista: { nombre: string; w: number; h: number; n: number }[] = []
  let n = 0
  for (const p of piezas) for (let i = 0; i < p.cantidad; i++) lista.push({ nombre: p.nombre, w: p.ancho, h: p.largo, n: ++n })
  lista.sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || b.w * b.h - a.w * a.h)

  const W = hoja.ancho - 2 * m + s
  const H = hoja.alto - 2 * m + s
  const hojas: Colocada[][] = []
  const libresPorHoja: R[][] = []
  const noCaben: string[] = []

  const colocarEn = (libres: R[], w: number, h: number): { r: R; girada: boolean } | null => {
    let mejor: { r: R; girada: boolean; puntaje: number; otro: number } | null = null
    const probar = (ww: number, hh: number, girada: boolean) => {
      for (const f of libres) {
        if (ww <= f.w + 1e-9 && hh <= f.h + 1e-9) {
          const corto = Math.min(f.w - ww, f.h - hh)
          const largo = Math.max(f.w - ww, f.h - hh)
          if (!mejor || corto < mejor.puntaje || (corto === mejor.puntaje && largo < mejor.otro))
            mejor = { r: { x: f.x, y: f.y, w: ww, h: hh }, girada, puntaje: corto, otro: largo }
        }
      }
    }
    probar(w + s, h + s, false)
    if (!respetarVeta) probar(h + s, w + s, true)
    return mejor
  }

  const partir = (libres: R[], u: R) => {
    const nuevos: R[] = []
    for (const f of libres) {
      if (u.x >= f.x + f.w || u.x + u.w <= f.x || u.y >= f.y + f.h || u.y + u.h <= f.y) { nuevos.push(f); continue }
      if (u.x > f.x) nuevos.push({ x: f.x, y: f.y, w: u.x - f.x, h: f.h })
      if (u.x + u.w < f.x + f.w) nuevos.push({ x: u.x + u.w, y: f.y, w: f.x + f.w - u.x - u.w, h: f.h })
      if (u.y > f.y) nuevos.push({ x: f.x, y: f.y, w: f.w, h: u.y - f.y })
      if (u.y + u.h < f.y + f.h) nuevos.push({ x: f.x, y: u.y + u.h, w: f.w, h: f.y + f.h - u.y - u.h })
    }
    // quitar rectángulos contenidos en otros
    return nuevos.filter((a, i) => !nuevos.some((b, j) => j !== i && a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h && (j < i || a.w !== b.w || a.h !== b.h || a.x !== b.x || a.y !== b.y)))
  }

  for (const p of lista) {
    const cabe = (p.w + s <= W && p.h + s <= H) || (!respetarVeta && p.h + s <= W && p.w + s <= H)
    if (!cabe) { noCaben.push(`${p.nombre} ${r1(p.h)} × ${r1(p.w)} mm`); continue }
    let puesto = false
    for (let k = 0; k < hojas.length && !puesto; k++) {
      const c = colocarEn(libresPorHoja[k], p.w, p.h)
      if (c) {
        hojas[k].push({ nombre: p.nombre, x: c.r.x + m, y: c.r.y + m, w: c.r.w - s, h: c.r.h - s, girada: c.girada, n: p.n })
        libresPorHoja[k] = partir(libresPorHoja[k], c.r)
        puesto = true
      }
    }
    if (!puesto) {
      const libres = [{ x: 0, y: 0, w: W, h: H }]
      const c = colocarEn(libres, p.w, p.h)!
      hojas.push([{ nombre: p.nombre, x: c.r.x + m, y: c.r.y + m, w: c.r.w - s, h: c.r.h - s, girada: c.girada, n: p.n }])
      libresPorHoja.push(partir(libres, c.r))
    }
  }
  const usado = hojas.flat().reduce((t, c) => t + c.w * c.h, 0)
  const total = hojas.length * hoja.ancho * hoja.alto
  return { hojas, hoja, aprovechamiento: total ? usado / total : 0, noCaben }
}

// ======================================================================
// Exportación
// ======================================================================
const f = (x: number) => String(Math.round(x * 100) / 100)
const SEP_HOJAS = 100

export function hojaSVG(colocadas: Colocada[], hoja: Hoja) {
  const piezas = colocadas
    .map((c) => {
      const fs = Math.max(14, Math.min(46, Math.min(c.w, c.h) / 5))
      return (
        `<rect x="${f(c.x)}" y="${f(c.y)}" width="${f(c.w)}" height="${f(c.h)}" fill="#FDEEE1" stroke="#C2560A" stroke-width="1.2" vector-effect="non-scaling-stroke"/>` +
        `<text x="${f(c.x + c.w / 2)}" y="${f(c.y + c.h / 2)}" font-size="${f(fs)}" text-anchor="middle" dominant-baseline="middle" fill="#1B1B18" font-family="sans-serif">${c.n}</text>`
      )
    })
    .join("")
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${hoja.ancho} ${hoja.alto}"><rect x="0" y="0" width="${hoja.ancho}" height="${hoja.alto}" fill="#F4F1EA" stroke="#9A978C" stroke-width="1" vector-effect="non-scaling-stroke"/>${piezas}</svg>`
}

// DXF R12: cada hoja a la derecha de la anterior. Capas: HOJA (contorno), CORTE (piezas), ETIQUETAS (número de pieza)
export function acomodoDXF(a: Acomodo) {
  const l: string[] = []
  const par = (c: number | string, v: number | string) => l.push(String(c), String(v))
  par(0, "SECTION"); par(2, "HEADER"); par(9, "$ACADVER"); par(1, "AC1009"); par(9, "$INSUNITS"); par(70, 4); par(0, "ENDSEC")
  par(0, "SECTION"); par(2, "TABLES"); par(0, "TABLE"); par(2, "LAYER"); par(70, 3)
  for (const [nombre, color] of [["HOJA", 8], ["CORTE", 1], ["ETIQUETAS", 3]] as const) { par(0, "LAYER"); par(2, nombre); par(70, 0); par(62, color); par(6, "CONTINUOUS") }
  par(0, "ENDTAB"); par(0, "ENDSEC")
  par(0, "SECTION"); par(2, "ENTITIES")
  const rect = (capa: string, x: number, y: number, w: number, h: number) => {
    par(0, "POLYLINE"); par(8, capa); par(66, 1); par(10, 0); par(20, 0); par(30, 0); par(70, 1)
    for (const [px, py] of [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]) { par(0, "VERTEX"); par(8, capa); par(10, f(px)); par(20, f(py)); par(30, 0) }
    par(0, "SEQEND"); par(8, capa)
  }
  a.hojas.forEach((cols, k) => {
    const ox = k * (a.hoja.ancho + SEP_HOJAS)
    rect("HOJA", ox, 0, a.hoja.ancho, a.hoja.alto)
    for (const c of cols) {
      // en DXF la Y va hacia arriba: se voltea la hoja
      const y = a.hoja.alto - c.y - c.h
      rect("CORTE", ox + c.x, y, c.w, c.h)
      const alto = Math.max(8, Math.min(30, Math.min(c.w, c.h) / 5))
      par(0, "TEXT"); par(8, "ETIQUETAS"); par(10, f(ox + c.x + 8)); par(20, f(y + 8)); par(30, 0); par(40, f(alto)); par(1, String(c.n))
    }
  })
  par(0, "ENDSEC"); par(0, "EOF")
  return l.join("\n") + "\n"
}

// Lista de corte en CSV (para Excel u optimizadores de corte)
export function despieceCSV(piezas: Pieza[]) {
  const filas = [["Pieza", "Cantidad", "Largo (mm)", "Ancho (mm)", "Espesor (mm)", "Canto largo", "Canto corto", "Nota"]]
  for (const p of piezas) filas.push([p.nombre, String(p.cantidad), f(p.largo), f(p.ancho), f(p.espesor), String(p.canto.l), String(p.canto.a), p.nota || ""])
  return "﻿" + filas.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\n") + "\n"
}
