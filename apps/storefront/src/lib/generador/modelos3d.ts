// Modelos 3D paramétricos para impresión 3D (catálogo propio de HETNA, 24 nov 2026):
// cada modelo tiene sus medidas ajustables y se arma en el navegador con
// manifold-3d (la misma librería de «Partir modelo 3D»), que garantiza un sólido
// cerrado: el STL entra al programa de impresión sin errores de malla.
// Sale una malla de triángulos (Z hacia arriba, en mm) que se ve en Malla3D y se
// descarga como STL con mallaSTL (lib/generador/vectores).
//
// Para agregar un modelo: un objeto en MODELOS con sus parámetros y `construir`,
// que arma la pieza con el «kit» (bloque, cil, barreno, unir, restar…).
// Todo en milímetros; las piezas quedan apoyadas en Z = 0, listas para la cama.

import { cargarManifold } from "./partir3d"

type Wasm = any
type S = any // un sólido de manifold

export type ParamModelo = { k: string; nombre: string; def: number; min: number; max: number; paso?: number; unidad?: string }
export type CategoriaModelo = "taller" | "organizar" | "casa"

/** Herramientas para armar las piezas (todas en mm, ángulos en grados). */
export type Kit = {
  /** Caja desde la esquina (x0, y0, z0). Con `r` redondea las aristas verticales. */
  bloque: (x: number, y: number, z: number, x0?: number, y0?: number, z0?: number, r?: number) => S
  /** Cilindro vertical apoyado en z0 (lados: 0 = redondo). */
  cil: (d: number, h: number, x?: number, y?: number, z0?: number, lados?: number) => S
  /** Cono vertical: diámetro abajo, diámetro arriba. */
  cono: (dAbajo: number, dArriba: number, h: number, x?: number, y?: number, z0?: number) => S
  /** Barreno pasado en Z (un poco más largo para cortar limpio). */
  barreno: (d: number, h: number, x?: number, y?: number, z0?: number) => S
  /** Barreno avellanado (cabeza plana a 90°) que entra desde arriba de una placa de espesor h. */
  avellanado: (d: number, cabeza: number, h: number, x: number, y: number) => S
  unir: (...s: S[]) => S
  restar: (a: S, ...s: S[]) => S
  /** Envolvente convexa (como estirar una liga alrededor de las piezas): cuñas, refuerzos. */
  envolver: (...s: S[]) => S
  mover: (s: S, x: number, y: number, z: number) => S
  girar: (s: S, rx: number, ry: number, rz: number) => S
  /** Perfil (puntos en XY, sentido contrario a las manecillas) extruido en Z, con giro (grados) y escala arriba. */
  extruir: (puntos: [number, number][], h: number, giro?: number, escalaArriba?: number, z0?: number) => S
}

export type Modelo3D = {
  id: string
  nombre: string
  texto: string
  categoria: CategoriaModelo
  claves?: string
  params: ParamModelo[]
  construir: (p: Record<string, number>, k: Kit) => S
}

export const CATEGORIAS: { id: CategoriaModelo; nombre: string }[] = [
  { id: "taller", nombre: "Para el taller" },
  { id: "organizar", nombre: "Organizar" },
  { id: "casa", nombre: "Casa y oficina" },
]

const SEG = 48 // segmentos de los cilindros: suave sin hacer el STL pesado
const lim = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

// ── catálogo ────────────────────────────────────────────────────────────────
export const MODELOS: Modelo3D[] = [
  {
    id: "organizador-fresas",
    nombre: "Organizador de fresas y brocas",
    texto: "Bloque con agujeros en cuadrícula para zancos de 1/8\", 6 mm, 1/4\" o el que uses.",
    categoria: "taller",
    claves: "broca fresa end mill porta zanco router cnc",
    params: [
      { k: "diametro", nombre: "Diámetro del zanco", def: 6.35, min: 1, max: 20, paso: 0.05 },
      { k: "holgura", nombre: "Holgura", def: 0.3, min: 0, max: 1, paso: 0.05 },
      { k: "columnas", nombre: "Columnas", def: 6, min: 1, max: 20, unidad: "" },
      { k: "filas", nombre: "Filas", def: 3, min: 1, max: 12, unidad: "" },
      { k: "separacion", nombre: "Separación entre centros", def: 16, min: 6, max: 50 },
      { k: "alto", nombre: "Alto del bloque", def: 25, min: 8, max: 60 },
      { k: "profundidad", nombre: "Profundidad del agujero", def: 20, min: 4, max: 58 },
    ],
    construir: (p, k) => {
      const sep = Math.max(p.separacion, p.diametro + 3)
      const c = Math.round(p.columnas), f = Math.round(p.filas)
      const prof = Math.min(p.profundidad, p.alto - 2)
      const huecos = []
      for (let i = 0; i < c; i++) for (let j = 0; j < f; j++) huecos.push(k.cil(p.diametro + p.holgura, prof + 1, sep / 2 + i * sep, sep / 2 + j * sep, p.alto - prof))
      return k.restar(k.bloque(c * sep, f * sep, p.alto, 0, 0, 0, 3), ...huecos)
    },
  },
  {
    id: "soporte-nema",
    nombre: "Soporte de motor NEMA 17 / 23",
    texto: "Escuadra en L con la cara del motor, refuerzos y barrenos para fijarla a tu máquina.",
    categoria: "taller",
    claves: "motor paso a paso stepper nema17 nema23 escuadra bracket",
    params: [
      { k: "nema", nombre: "NEMA (17 o 23)", def: 17, min: 17, max: 23, paso: 6, unidad: "" },
      { k: "espesor", nombre: "Espesor de la placa", def: 5, min: 3, max: 12 },
      { k: "base", nombre: "Largo de la base", def: 50, min: 30, max: 120 },
      { k: "tornillo", nombre: "Barreno de la base", def: 5.5, min: 3, max: 9, paso: 0.1 },
    ],
    construir: (p, k) => {
      const n23 = p.nema >= 20
      const cara = n23 ? 60 : 46 // un poco mayor que el motor (56.4 / 42.3 mm)
      const entre = n23 ? 47.14 : 31 // distancia entre barrenos del motor
      const resalte = n23 ? 39 : 23
      const torn = n23 ? 5.2 : 3.4
      const e = p.espesor
      const L = Math.max(p.base, e + 15)
      const pared = k.bloque(e, cara, cara)
      const base = k.bloque(L, cara, e)
      // refuerzos triangulares a los lados (cuña: caja girada 45° recortada)
      const tri = Math.min(L - e, cara - e) * 0.7
      const cuna = (y0: number) => k.restar(k.bloque(tri, e, tri, e, y0, e), k.mover(k.girar(k.bloque(tri * 2, e + 2, tri * 2, 0, -1, 0), 0, -45, 0), e + tri, y0, e))
      const motor = [k.girar(k.cil(resalte, e + 2, cara / 2, cara / 2, -1), 0, 90, 0)]
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) motor.push(k.girar(k.cil(torn, e + 2, cara / 2 + (a * entre) / 2, cara / 2 + (b * entre) / 2, -1), 0, 90, 0))
      // girar 90° en Y manda (x, y, z) a (z, y, -x): se corrige moviendo en Z
      const huecosMotor = motor.map((m) => k.mover(m, 0, 0, cara))
      const huecosBase = [cara * 0.25, cara * 0.75].map((y) => k.barreno(p.tornillo, e, e + (L - e) * 0.62, y))
      return k.restar(k.unir(pared, base, cuna(0), cuna(cara - e)), ...huecosMotor, ...huecosBase)
    },
  },
  {
    id: "abrazadera-tubo",
    nombre: "Abrazadera para tubo o manguera",
    texto: "Medio anillo con orejas atornillables. Tubo conduit, PVC, aspiradora o perfil redondo.",
    categoria: "taller",
    claves: "clip tubo pvc conduit manguera aspiradora sujetador",
    params: [
      { k: "diametro", nombre: "Diámetro del tubo", def: 25, min: 5, max: 120 },
      { k: "pared", nombre: "Grosor de la pared", def: 3, min: 1.6, max: 10 },
      { k: "ancho", nombre: "Ancho", def: 15, min: 6, max: 60 },
      { k: "tornillo", nombre: "Barreno", def: 4.5, min: 2.5, max: 9, paso: 0.1 },
    ],
    construir: (p, k) => {
      const R = p.diametro / 2 + p.pared
      const oreja = p.tornillo * 2.6
      // anillo acostado (eje en Y) y se queda la mitad de arriba
      const anillo = k.restar(k.girar(k.cil(2 * R, p.ancho, 0, 0, -p.ancho / 2), 90, 0, 0), k.girar(k.cil(p.diametro, p.ancho + 2, 0, 0, -p.ancho / 2 - 1), 90, 0, 0))
      const medio = k.restar(anillo, k.bloque(4 * R, p.ancho + 4, 2 * R, -2 * R, -p.ancho / 2 - 2, -2 * R))
      const orejas = k.unir(k.bloque(oreja, p.ancho, p.pared, R - p.pared, -p.ancho / 2), k.bloque(oreja, p.ancho, p.pared, -R - oreja + p.pared, -p.ancho / 2))
      return k.restar(k.unir(medio, orejas), k.barreno(p.tornillo, p.pared, R - p.pared + oreja / 2, 0), k.barreno(p.tornillo, p.pared, -R + p.pared - oreja / 2, 0))
    },
  },
  {
    id: "espaciador",
    nombre: "Espaciador / separador",
    texto: "Cilindro o hexágono con barreno: separa placas, poleas, tarjetas o ejes.",
    categoria: "taller",
    claves: "separador buje rondana arandela standoff",
    params: [
      { k: "exterior", nombre: "Diámetro exterior", def: 12, min: 3, max: 80 },
      { k: "interior", nombre: "Barreno", def: 5.3, min: 0, max: 70, paso: 0.1 },
      { k: "largo", nombre: "Largo", def: 10, min: 0.6, max: 150 },
      { k: "lados", nombre: "Lados (0 = redondo, 6 = hexagonal)", def: 0, min: 0, max: 12, unidad: "" },
    ],
    construir: (p, k) => {
      const ext = k.cil(p.exterior, p.largo, 0, 0, 0, p.lados >= 3 ? Math.round(p.lados) : 0)
      return p.interior > 0 ? k.restar(ext, k.barreno(Math.min(p.interior, p.exterior - 1.2), p.largo)) : ext
    },
  },
  {
    id: "brida",
    nombre: "Brida / placa con barrenos en círculo",
    texto: "Disco con barreno central y barrenos en círculo: bridas, acoples y tapas.",
    categoria: "taller",
    claves: "flange tapa acople disco rueda",
    params: [
      { k: "diametro", nombre: "Diámetro", def: 60, min: 15, max: 200 },
      { k: "espesor", nombre: "Espesor", def: 5, min: 1, max: 30 },
      { k: "central", nombre: "Barreno central", def: 20, min: 0, max: 180 },
      { k: "barrenos", nombre: "Barrenos en círculo", def: 4, min: 0, max: 24, unidad: "" },
      { k: "circulo", nombre: "Diámetro del círculo", def: 45, min: 8, max: 190 },
      { k: "tornillo", nombre: "Barreno", def: 5.5, min: 2, max: 20, paso: 0.1 },
    ],
    construir: (p, k) => {
      const huecos = []
      if (p.central > 0) huecos.push(k.barreno(Math.min(p.central, p.diametro - 4), p.espesor))
      const n = Math.round(p.barrenos)
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 2 * Math.PI
        huecos.push(k.barreno(p.tornillo, p.espesor, (Math.cos(a) * p.circulo) / 2, (Math.sin(a) * p.circulo) / 2))
      }
      return k.restar(k.cil(p.diametro, p.espesor), ...huecos)
    },
  },
  {
    id: "pata-mueble",
    nombre: "Pata o tope para mueble",
    texto: "Tope cilíndrico con chaflán y barreno avellanado: patas de mesa CNC, cajas y muebles.",
    categoria: "taller",
    claves: "pata pie tope mueble mesa nivelador goma",
    params: [
      { k: "diametro", nombre: "Diámetro", def: 40, min: 10, max: 120 },
      { k: "alto", nombre: "Alto", def: 20, min: 4, max: 120 },
      { k: "tornillo", nombre: "Barreno (0 = sin)", def: 5, min: 0, max: 12, paso: 0.1 },
    ],
    construir: (p, k) => {
      const ch = Math.min(3, p.alto / 4, p.diametro / 6)
      const cuerpo = k.unir(k.cono(p.diametro - 2 * ch, p.diametro, ch), k.cil(p.diametro, p.alto - ch, 0, 0, ch))
      if (p.tornillo <= 0) return cuerpo
      // cabeza del tornillo hundida por abajo (lado que va al piso) y paso arriba
      return k.restar(cuerpo, k.barreno(p.tornillo, p.alto), k.cil(Math.min(p.tornillo * 2, p.diametro - 4), p.alto * 0.4, 0, 0, -1))
    },
  },
  {
    id: "escuadra-esquina",
    nombre: "Escuadra de esquina",
    texto: "Ángulo de refuerzo para unir tableros o perfiles a 90°, con barrenos avellanados.",
    categoria: "taller",
    claves: "angulo esquinero refuerzo union 90 perfil aluminio tablero",
    params: [
      { k: "lado", nombre: "Largo de cada lado", def: 40, min: 15, max: 120 },
      { k: "ancho", nombre: "Ancho", def: 20, min: 8, max: 80 },
      { k: "espesor", nombre: "Espesor", def: 4, min: 2, max: 12 },
      { k: "tornillo", nombre: "Barreno", def: 4, min: 2.5, max: 8, paso: 0.1 },
    ],
    construir: (p, k) => {
      const e = p.espesor
      const tri = (p.lado - e) * 0.5
      const cuna = k.restar(k.bloque(tri, e, tri, e, (p.ancho - e) / 2, e), k.mover(k.girar(k.bloque(tri * 2, e + 2, tri * 2, 0, -1, 0), 0, -45, 0), e + tri, (p.ancho - e) / 2, e))
      const pos = e + (p.lado - e) * 0.62
      const hueco1 = k.avellanado(p.tornillo, p.tornillo * 2, e, pos, p.ancho * 0.25)
      const hueco2 = k.avellanado(p.tornillo, p.tornillo * 2, e, pos, p.ancho * 0.75)
      // en la cara vertical el barreno va en X
      const lateral = [p.ancho * 0.25, p.ancho * 0.75].map((y) => k.mover(k.girar(k.cil(p.tornillo, e + 2, 0, 0, 0), 0, 90, 0), -1, y, pos))
      const piezas = p.ancho >= 4 * p.tornillo ? [hueco1, hueco2, ...lateral] : [k.avellanado(p.tornillo, p.tornillo * 2, e, pos, p.ancho / 2), k.mover(k.girar(k.cil(p.tornillo, e + 2, 0, 0, 0), 0, 90, 0), -1, p.ancho / 2, pos)]
      return k.restar(k.unir(k.bloque(p.lado, p.ancho, e), k.bloque(e, p.ancho, p.lado), cuna), ...piezas)
    },
  },
  {
    id: "portaherramientas",
    nombre: "Portaherramientas de pared",
    texto: "Repisa con agujeros para desarmadores, llaves Allen y pinzas, con barrenos para atornillarla.",
    categoria: "organizar",
    claves: "desarmador destornillador pinzas allen pared colgar rack",
    params: [
      { k: "largo", nombre: "Largo", def: 200, min: 60, max: 400 },
      { k: "agujeros", nombre: "Agujeros", def: 8, min: 1, max: 30, unidad: "" },
      { k: "diametro", nombre: "Diámetro de agujero", def: 10, min: 3, max: 30 },
      { k: "fondo", nombre: "Fondo (salida de la pared)", def: 30, min: 15, max: 80 },
      { k: "espesor", nombre: "Espesor", def: 6, min: 3, max: 15 },
    ],
    construir: (p, k) => {
      const alto = 35, e = p.espesor
      const n = Math.round(p.agujeros), paso = p.largo / n
      const dMax = Math.min(p.diametro, paso - 3, p.fondo - e - 3)
      const huecos = Array.from({ length: n }, (_, i) => k.barreno(dMax, e, paso / 2 + i * paso, e + (p.fondo - e) / 2, alto - e))
      const tornillos = [p.largo * 0.1, p.largo * 0.9].map((x) => k.mover(k.girar(k.cil(4.5, e + 2, 0, 0, 0), -90, 0, 0), x, -1, alto * 0.4))
      return k.restar(k.unir(k.bloque(p.largo, p.fondo, e, 0, 0, alto - e), k.bloque(p.largo, e, alto)), ...huecos, ...tornillos)
    },
  },
  {
    id: "charola-divisiones",
    nombre: "Charola con divisiones",
    texto: "Bandeja a tu medida con compartimentos: tornillos, tuercas, puntas y piezas pequeñas.",
    categoria: "organizar",
    claves: "bandeja cajon tornillos tuercas compartimentos organizador",
    params: [
      { k: "ancho", nombre: "Ancho", def: 120, min: 30, max: 300 },
      { k: "fondo", nombre: "Fondo", def: 80, min: 30, max: 300 },
      { k: "alto", nombre: "Alto", def: 30, min: 8, max: 120 },
      { k: "columnas", nombre: "Columnas", def: 3, min: 1, max: 12, unidad: "" },
      { k: "filas", nombre: "Filas", def: 2, min: 1, max: 12, unidad: "" },
      { k: "pared", nombre: "Pared", def: 1.6, min: 0.8, max: 5, paso: 0.1 },
    ],
    construir: (p, k) => {
      const c = Math.round(p.columnas), f = Math.round(p.filas), w = p.pared
      const ci = (p.ancho - w * (c + 1)) / c, fi = (p.fondo - w * (f + 1)) / f
      const huecos = []
      for (let i = 0; i < c; i++) for (let j = 0; j < f; j++) huecos.push(k.bloque(ci, fi, p.alto, w + i * (ci + w), w + j * (fi + w), w, Math.min(3, ci / 4, fi / 4)))
      return k.restar(k.bloque(p.ancho, p.fondo, p.alto, 0, 0, 0, Math.min(4, w * 2.5)), ...huecos)
    },
  },
  {
    id: "caja-tapa",
    nombre: "Caja con tapa a presión",
    texto: "Caja hueca y tapa que entra a presión. Las dos piezas salen acomodadas para imprimir.",
    categoria: "organizar",
    claves: "contenedor estuche tapa encastre electronica",
    params: [
      { k: "ancho", nombre: "Ancho interior", def: 60, min: 15, max: 250 },
      { k: "fondo", nombre: "Fondo interior", def: 40, min: 15, max: 250 },
      { k: "alto", nombre: "Alto interior", def: 30, min: 8, max: 200 },
      { k: "pared", nombre: "Pared", def: 2, min: 1, max: 6, paso: 0.1 },
      { k: "holgura", nombre: "Holgura de la tapa", def: 0.25, min: 0, max: 1, paso: 0.05 },
    ],
    construir: (p, k) => {
      const w = p.pared, W = p.ancho + 2 * w, F = p.fondo + 2 * w, H = p.alto + w, r = Math.min(4, w * 2)
      const caja = k.restar(k.bloque(W, F, H, 0, 0, 0, r), k.bloque(p.ancho, p.fondo, p.alto + 1, w, w, w, Math.max(0, r - w)))
      const labio = Math.min(5, p.alto / 2), h = p.holgura
      const aro = k.restar(k.bloque(p.ancho - 2 * h, p.fondo - 2 * h, labio, w + h, w + h, w), k.bloque(p.ancho - 2 * h - 2 * w, p.fondo - 2 * h - 2 * w, labio + 2, 2 * w + h, 2 * w + h, w - 1))
      const tapa = k.unir(k.bloque(W, F, w, 0, 0, 0, r), aro)
      return k.unir(caja, k.mover(tapa, W + 8, 0, 0))
    },
  },
  {
    id: "clip-cables",
    nombre: "Clip para cables",
    texto: "Sujetador en C para pegar o atornillar: ordena cables de máquina, escritorio o tablero.",
    categoria: "organizar",
    claves: "cable organizador sujetador escritorio tablero electrico",
    params: [
      { k: "diametro", nombre: "Diámetro del manojo", def: 8, min: 3, max: 40 },
      { k: "ancho", nombre: "Ancho", def: 10, min: 5, max: 40 },
      { k: "pared", nombre: "Pared", def: 1.8, min: 1, max: 4, paso: 0.1 },
      { k: "tornillo", nombre: "Barreno (0 = para pegar)", def: 3.5, min: 0, max: 6, paso: 0.1 },
    ],
    construir: (p, k) => {
      const R = p.diametro / 2 + p.pared
      const extra = p.tornillo > 0 ? p.tornillo * 3 : 0
      const base = k.bloque(2 * R + extra, p.ancho, p.pared, -R, -p.ancho / 2)
      const anillo = k.mover(k.restar(k.girar(k.cil(2 * R, p.ancho, 0, 0, -p.ancho / 2), 90, 0, 0), k.girar(k.cil(p.diametro, p.ancho + 2, 0, 0, -p.ancho / 2 - 1), 90, 0, 0)), 0, 0, R)
      const abertura = k.bloque(p.diametro * 0.6, p.ancho + 2, R, -p.diametro * 0.3, -p.ancho / 2 - 1, R + p.diametro * 0.25)
      const g = k.restar(k.unir(base, anillo), abertura)
      return p.tornillo > 0 ? k.restar(g, k.barreno(p.tornillo, p.pared, R + extra / 2, 0)) : g
    },
  },
  {
    id: "perilla-tuerca",
    nombre: "Perilla con tuerca embebida",
    texto: "Perilla moleteada con alojamiento hexagonal para tuerca M5, M6 u M8: prensas, guías y topes.",
    categoria: "taller",
    claves: "perilla knob mariposa tuerca m6 m8 prensa guia tope apriete",
    params: [
      { k: "diametro", nombre: "Diámetro de la perilla", def: 35, min: 15, max: 80 },
      { k: "alto", nombre: "Alto", def: 14, min: 6, max: 40 },
      { k: "metrica", nombre: "Tornillo (M)", def: 6, min: 3, max: 12, unidad: "" },
      { k: "lobulos", nombre: "Muescas de agarre", def: 8, min: 0, max: 16, unidad: "" },
    ],
    construir: (p, k) => {
      // tuerca métrica: entre caras ≈ 1.6 × M (M6 = 10 mm) y alto ≈ 0.8 × M, con holgura
      const M = Math.round(p.metrica)
      const entreCaras = { 3: 5.5, 4: 7, 5: 8, 6: 10, 8: 13, 10: 16, 12: 18 }[M] || M * 1.6
      const hTuerca = Math.min(p.alto - 2, M * 0.8 + 0.4)
      const dHex = (entreCaras + 0.3) / Math.cos(Math.PI / 6)
      let g = k.cil(p.diametro, p.alto)
      const n = Math.round(p.lobulos)
      const huecos = []
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 2 * Math.PI
        huecos.push(k.cil(p.diametro * 0.22, p.alto + 2, (Math.cos(a) * p.diametro) / 2, (Math.sin(a) * p.diametro) / 2, -1))
      }
      huecos.push(k.barreno(M + 0.4, p.alto), k.girar(k.cil(dHex, hTuerca + 1, 0, 0, -1, 6), 0, 0, 30))
      return k.restar(g, ...huecos)
    },
  },
  {
    id: "tapon-ptr",
    nombre: "Tapón para PTR / tubo cuadrado",
    texto: "Tapa con aletas que entra a presión en el PTR: patas de mesa, bancos y estructuras.",
    categoria: "taller",
    claves: "tapon ptr tubo cuadrado rectangular regaton pata mesa estructura herreria",
    params: [
      { k: "ancho", nombre: "Ancho exterior del PTR", def: 25.4, min: 10, max: 100, paso: 0.1 },
      { k: "alto", nombre: "Alto exterior del PTR (cuadrado = igual)", def: 25.4, min: 10, max: 150, paso: 0.1 },
      { k: "calibre", nombre: "Espesor de pared del PTR", def: 1.5, min: 0.8, max: 6, paso: 0.1 },
      { k: "inserto", nombre: "Largo del inserto", def: 12, min: 5, max: 30 },
    ],
    construir: (p, k) => {
      const tapa = 3, iw = p.ancho - 2 * p.calibre, ih = p.alto - 2 * p.calibre
      const cabeza = k.bloque(p.ancho, p.alto, tapa, 0, 0, 0, Math.min(2, p.ancho / 8))
      // inserto hueco con 3 costillas por lado que muerden la pared
      const pared = 1.6
      const cuerpo = k.restar(k.bloque(iw - 0.6, ih - 0.6, p.inserto, p.calibre + 0.3, p.calibre + 0.3, tapa), k.bloque(iw - 0.6 - 2 * pared, ih - 0.6 - 2 * pared, p.inserto + 1, p.calibre + 0.3 + pared, p.calibre + 0.3 + pared, tapa))
      const costillas = []
      for (const z of [0.35, 0.65, 0.92]) {
        const zz = tapa + p.inserto * z
        costillas.push(k.restar(k.bloque(iw + 0.4, ih + 0.4, 0.8, p.calibre - 0.2, p.calibre - 0.2, zz), k.bloque(iw - 2 * pared, ih - 2 * pared, 2, p.calibre + pared, p.calibre + pared, zz - 0.5)))
      }
      return k.unir(cabeza, cuerpo, ...costillas)
    },
  },
  {
    id: "tapon-tubo-redondo",
    nombre: "Tapón para tubo redondo",
    texto: "Regatón redondo a presión para tubo de herrería, mueble o barandal.",
    categoria: "taller",
    claves: "tapon regaton tubo redondo pata silla mueble barandal herreria",
    params: [
      { k: "diametro", nombre: "Diámetro exterior del tubo", def: 25.4, min: 8, max: 120, paso: 0.1 },
      { k: "calibre", nombre: "Espesor de pared del tubo", def: 1.5, min: 0.8, max: 6, paso: 0.1 },
      { k: "inserto", nombre: "Largo del inserto", def: 12, min: 5, max: 30 },
    ],
    construir: (p, k) => {
      const tapa = 3, di = p.diametro - 2 * p.calibre, pared = 1.6
      const cabeza = k.unir(k.cono(p.diametro - 1.5, p.diametro, 1.5), k.cil(p.diametro, tapa - 1.5, 0, 0, 1.5))
      const cuerpo = k.restar(k.cil(di - 0.6, p.inserto, 0, 0, tapa), k.cil(di - 0.6 - 2 * pared, p.inserto + 1, 0, 0, tapa))
      const aros = [0.35, 0.65, 0.92].map((z) => k.restar(k.cil(di + 0.4, 0.8, 0, 0, tapa + p.inserto * z), k.cil(di - 2 * pared, 2, 0, 0, tapa + p.inserto * z - 0.5)))
      return k.unir(cabeza, cuerpo, ...aros)
    },
  },
  {
    id: "soporte-husillo",
    nombre: "Soporte de husillo / spindle",
    texto: "Abrazadera para spindle de 52, 65, 80 mm o el que tengas, con tornillo de apriete y barrenos de montaje.",
    categoria: "taller",
    claves: "spindle husillo router cnc abrazadera 52 65 80 mm montaje fresadora",
    params: [
      { k: "diametro", nombre: "Diámetro del spindle", def: 52, min: 20, max: 110, paso: 0.5 },
      { k: "alto", nombre: "Alto de la abrazadera", def: 30, min: 12, max: 80 },
      { k: "pared", nombre: "Pared", def: 8, min: 4, max: 20 },
      { k: "tornillo", nombre: "Barreno de montaje", def: 5.5, min: 3, max: 9, paso: 0.1 },
    ],
    construir: (p, k) => {
      const R = p.diametro / 2, e = p.pared, W = p.diametro + 2 * e
      const placa = 10 // placa trasera de montaje
      const anillo = k.cil(W, p.alto, 0, 0, 0)
      const respaldo = k.bloque(W + 20, placa, p.alto, -W / 2 - 10, -R - e - placa + 2, 0)
      const oreja = k.bloque(16, e + 12, p.alto, -8, R - 2, 0) // lengüeta de apriete al frente
      let g = k.unir(anillo, respaldo, oreja)
      const corte = k.bloque(2, e + 16, p.alto + 2, -1, R - 4, -1) // ranura para que cierre
      const apriete = k.mover(k.girar(k.cil(p.tornillo * 0.8, 20, 0, 0, 0), 0, 90, 0), -10, R + e / 2 + 4, p.alto / 2)
      const montaje = [-1, 1].flatMap((sx) => [0.3, 0.7].map((zf) => k.mover(k.girar(k.cil(p.tornillo, placa + 4, 0, 0, 0), -90, 0, 0), sx * (W / 2 + 4), -R - e - placa, p.alto * zf)))
      g = k.restar(g, k.barreno(p.diametro + 0.3, p.alto), corte, apriete, ...montaje)
      return g
    },
  },
  {
    id: "soporte-rodamiento",
    nombre: "Soporte para rodamiento (chumacera)",
    texto: "Chumacera de piso para rodamiento 608, 6000, 6200 o el que uses, con dos barrenos.",
    categoria: "taller",
    claves: "chumacera rodamiento balero 608 6200 6000 eje soporte pillow block",
    params: [
      { k: "exterior", nombre: "Diámetro exterior del rodamiento", def: 22, min: 8, max: 80, paso: 0.1 },
      { k: "ancho", nombre: "Ancho del rodamiento", def: 7, min: 3, max: 30, paso: 0.1 },
      { k: "eje", nombre: "Paso del eje", def: 10, min: 3, max: 60, paso: 0.1 },
      { k: "tornillo", nombre: "Barreno de la base", def: 5.5, min: 3, max: 10, paso: 0.1 },
    ],
    construir: (p, k) => {
      const e = 5, D = p.exterior + 2 * e, alto = D / 2 + e + 2, L = D + 4 * p.tornillo + 8, prof = p.ancho + 4
      const cuerpo = k.unir(k.bloque(L, prof, e, -L / 2, -prof / 2, 0), k.bloque(D, prof, alto, -D / 2, -prof / 2, 0), k.mover(k.girar(k.cil(D, prof, 0, 0, -prof / 2), 90, 0, 0), 0, 0, alto))
      const asiento = k.mover(k.girar(k.cil(p.exterior + 0.15, p.ancho, 0, 0, -p.ancho / 2), 90, 0, 0), 0, 0, alto)
      const paso = k.mover(k.girar(k.cil(Math.min(p.eje + 1, p.exterior - 2), prof + 2, 0, 0, -prof / 2 - 1), 90, 0, 0), 0, 0, alto)
      const base = [-1, 1].map((sx) => k.barreno(p.tornillo, e, sx * (L / 2 - p.tornillo * 1.5 - 2), 0))
      return k.restar(cuerpo, asiento, paso, ...base)
    },
  },
  {
    id: "porta-puntas",
    nombre: "Porta puntas hexagonales 1/4\"",
    texto: "Bloque con alojamientos hexagonales para puntas de desarmador y brocas de 1/4\".",
    categoria: "organizar",
    claves: "puntas desarmador bits hexagonal 1/4 atornillador organizador",
    params: [
      { k: "columnas", nombre: "Columnas", def: 8, min: 1, max: 20, unidad: "" },
      { k: "filas", nombre: "Filas", def: 2, min: 1, max: 8, unidad: "" },
      { k: "holgura", nombre: "Holgura", def: 0.3, min: 0, max: 1, paso: 0.05 },
      { k: "alto", nombre: "Alto del bloque", def: 18, min: 10, max: 40 },
    ],
    construir: (p, k) => {
      const entreCaras = 6.35 + p.holgura, dHex = entreCaras / Math.cos(Math.PI / 6), sep = 11
      const c = Math.round(p.columnas), f = Math.round(p.filas), prof = Math.min(12, p.alto - 3)
      const huecos = []
      for (let i = 0; i < c; i++) for (let j = 0; j < f; j++) huecos.push(k.cil(dHex, prof + 1, sep / 2 + 2 + i * sep, sep / 2 + 2 + j * sep, p.alto - prof, 6))
      return k.restar(k.bloque(c * sep + 4, f * sep + 4, p.alto, 0, 0, 0, 2), ...huecos)
    },
  },
  {
    id: "canaleta",
    nombre: "Canaleta para cables",
    texto: "Canal en U con barrenos para atornillar bajo la mesa o en la máquina, y tapa a presión.",
    categoria: "organizar",
    claves: "canaleta cables ducto escritorio maquina cnc orden",
    params: [
      { k: "largo", nombre: "Largo", def: 150, min: 40, max: 300 },
      { k: "ancho", nombre: "Ancho interior", def: 20, min: 8, max: 60 },
      { k: "alto", nombre: "Alto interior", def: 15, min: 6, max: 50 },
      { k: "pared", nombre: "Pared", def: 1.6, min: 1, max: 4, paso: 0.1 },
    ],
    construir: (p, k) => {
      const w = p.pared, W = p.ancho + 2 * w
      const canal = k.restar(k.bloque(p.largo, W, p.alto + w), k.bloque(p.largo + 2, p.ancho, p.alto + 1, -1, w, w))
      const tornillos = [0.15, 0.5, 0.85].map((f) => k.barreno(3.5, w, p.largo * f, W / 2))
      const tapa = k.unir(k.bloque(p.largo, W, w, 0, 0, 0), k.bloque(p.largo, 1.2, 3, 0, w + 0.15, w), k.bloque(p.largo, 1.2, 3, 0, W - w - 1.35, w))
      return k.unir(k.restar(canal, ...tornillos), k.mover(tapa, 0, W + 6, 0))
    },
  },
  {
    id: "porta-pilas",
    nombre: "Organizador de pilas",
    texto: "Bloque para pilas AA, AAA, 18650 o del diámetro que quieras.",
    categoria: "organizar",
    claves: "pilas baterias aa aaa 18650 organizador",
    params: [
      { k: "diametro", nombre: "Diámetro de la pila (AA 14.5, AAA 10.5, 18650 18.5)", def: 14.5, min: 8, max: 35, paso: 0.1 },
      { k: "columnas", nombre: "Columnas", def: 6, min: 1, max: 15, unidad: "" },
      { k: "filas", nombre: "Filas", def: 2, min: 1, max: 10, unidad: "" },
      { k: "profundidad", nombre: "Profundidad", def: 25, min: 8, max: 60 },
    ],
    construir: (p, k) => {
      const d = p.diametro + 0.6, sep = d + 2.4, c = Math.round(p.columnas), f = Math.round(p.filas)
      const alto = p.profundidad + 3
      const huecos = []
      for (let i = 0; i < c; i++) for (let j = 0; j < f; j++) huecos.push(k.cil(d, p.profundidad + 1, sep / 2 + 1.5 + i * sep, sep / 2 + 1.5 + j * sep, 3))
      return k.restar(k.bloque(c * sep + 3, f * sep + 3, alto, 0, 0, 0, 3), ...huecos)
    },
  },
  {
    id: "repisa-escuadra",
    nombre: "Ménsula para repisa",
    texto: "Escuadra triangular con refuerzo para repisas de madera o melamina, con barrenos avellanados.",
    categoria: "casa",
    claves: "mensula escuadra repisa estante soporte pared melamina madera",
    params: [
      { k: "lado", nombre: "Largo de cada lado", def: 120, min: 50, max: 250 },
      { k: "ancho", nombre: "Ancho", def: 25, min: 12, max: 60 },
      { k: "espesor", nombre: "Espesor", def: 6, min: 3, max: 15 },
      { k: "tornillo", nombre: "Barreno", def: 4.5, min: 3, max: 7, paso: 0.1 },
    ],
    construir: (p, k) => {
      // impresa acostada: dos brazos en L y un refuerzo diagonal (envolvente de dos cuadros)
      const L = p.lado, e = p.espesor, a = p.ancho, r = a * 0.8
      const brazos = k.unir(k.bloque(L, a, e), k.bloque(a, L, e))
      const diagonal = k.envolver(k.bloque(r, r, e, L * 0.78 - r / 2, a / 2 - r / 2 + a * 0.1, 0), k.bloque(r, r, e, a / 2 - r / 2 + a * 0.1, L * 0.78 - r / 2, 0))
      const g = k.restar(k.unir(brazos, diagonal), k.bloque(L, L, e + 2, -L, -1, -1), k.bloque(L, L, e + 2, -1, -L, -1))
      const huecos = [0.35, 0.8].flatMap((f) => [k.avellanado(p.tornillo, p.tornillo * 2, e, L * f, a / 2), k.avellanado(p.tornillo, p.tornillo * 2, e, a / 2, L * f)])
      return k.restar(g, ...huecos)
    },
  },
  {
    id: "tope-puerta",
    nombre: "Tope de puerta",
    texto: "Cuña antiderrapante para detener puertas, con canales en la base.",
    categoria: "casa",
    claves: "tope puerta cuña detener casa oficina",
    params: [
      { k: "largo", nombre: "Largo", def: 110, min: 50, max: 200 },
      { k: "ancho", nombre: "Ancho", def: 35, min: 15, max: 80 },
      { k: "alto", nombre: "Alto", def: 22, min: 8, max: 60 },
    ],
    construir: (p, k) => {
      // cuña: envolvente entre el lado alto y una orilla delgada; canales abajo para que agarre
      const cuna = k.envolver(k.bloque(1, p.ancho, p.alto), k.bloque(1, p.ancho, 1.2, p.largo - 1, 0, 0))
      const canales = Array.from({ length: Math.floor((p.largo - 12) / 12) }, (_, i) => k.bloque(2, p.ancho + 2, 0.8, 6 + i * 12, -1, -0.01))
      return k.restar(cuna, ...canales)
    },
  },
  {
    id: "mordaza-cnc",
    nombre: "Sujetador de mesa CNC (clamp)",
    texto: "Barra con ranura y escalón para sujetar piezas en la mesa del router con tornillo y tuerca T.",
    categoria: "taller",
    claves: "clamp sujetador mordaza mesa router cnc hold down tuerca t ranura",
    params: [
      { k: "largo", nombre: "Largo", def: 80, min: 40, max: 200 },
      { k: "ancho", nombre: "Ancho", def: 25, min: 12, max: 60 },
      { k: "alto", nombre: "Alto", def: 12, min: 6, max: 30 },
      { k: "ranura", nombre: "Ancho de la ranura (tornillo)", def: 8.5, min: 4, max: 14, paso: 0.1 },
      { k: "escalon", nombre: "Alto del escalón de apoyo", def: 8, min: 0, max: 40 },
    ],
    construir: (p, k) => {
      const barra = k.bloque(p.largo, p.ancho, p.alto, 0, 0, 0, Math.min(3, p.ancho / 6))
      const pie = p.escalon > 0 ? k.bloque(12, p.ancho, p.escalon, p.largo - 12, 0, -p.escalon) : null
      // ranura alargada: envolvente de dos barrenos
      const r1 = p.largo * 0.15, r2 = p.largo * 0.68
      const ranura = k.envolver(k.barreno(p.ranura, p.alto, r1, p.ancho / 2), k.barreno(p.ranura, p.alto, r2, p.ancho / 2))
      const g = pie ? k.unir(barra, pie) : barra
      return k.restar(g, ranura)
    },
  },
  {
    id: "guia-espiga",
    nombre: "Guía para barrenos de espiga",
    texto: "Plantilla con tope para barrenar espigas (dowels) centradas en el canto del tablero.",
    categoria: "taller",
    claves: "guia espiga dowel jig barrenar canto tablero carpinteria melamina",
    params: [
      { k: "tablero", nombre: "Espesor del tablero", def: 18, min: 9, max: 40 },
      { k: "broca", nombre: "Diámetro de la broca", def: 8, min: 4, max: 12, paso: 0.1 },
      { k: "barrenos", nombre: "Barrenos", def: 3, min: 1, max: 6, unidad: "" },
      { k: "separacion", nombre: "Separación entre barrenos", def: 32, min: 16, max: 64 },
    ],
    construir: (p, k) => {
      const n = Math.round(p.barrenos), largo = (n - 1) * p.separacion + 30, alto = 20, tope = 6
      const placa = k.bloque(largo, p.tablero + 2 * tope, alto)
      // la placa se apoya sobre el canto; los topes abrazan las dos caras del tablero
      const hueco = k.bloque(largo + 2, p.tablero + 0.3, 8, -1, tope - 0.15, -1)
      const barrenos = Array.from({ length: n }, (_, i) => k.barreno(p.broca + 0.2, alto, 15 + i * p.separacion, tope + p.tablero / 2))
      return k.restar(placa, hueco, ...barrenos)
    },
  },
  {
    id: "polea-v",
    nombre: "Polea en V",
    texto: "Polea con canal en V para banda o cordón, con barreno y opriesor.",
    categoria: "taller",
    claves: "polea v banda cordon eje rueda transmision",
    params: [
      { k: "diametro", nombre: "Diámetro exterior", def: 50, min: 15, max: 150 },
      { k: "ancho", nombre: "Ancho", def: 12, min: 5, max: 40 },
      { k: "profundidad", nombre: "Profundidad del canal", def: 4, min: 1, max: 15, paso: 0.5 },
      { k: "eje", nombre: "Barreno del eje", def: 8, min: 2, max: 40, paso: 0.1 },
    ],
    construir: (p, k) => {
      const D = p.diametro, h = p.ancho, c = Math.min(p.profundidad, D / 2 - p.eje / 2 - 3)
      const mitad = h / 2
      // canal en V: dos conos encontrados restados a un cilindro
      const v1 = k.cono(D + 0.01, D - 2 * c, mitad)
      const v2 = k.cono(D - 2 * c, D + 0.01, mitad, 0, 0, mitad)
      const canal = k.restar(k.cil(D + 2, h, 0, 0, 0), k.unir(v1, v2))
      return k.restar(k.cil(D, h), canal, k.barreno(p.eje + 0.2, h))
    },
  },
  {
    id: "rodaja",
    nombre: "Rueda / rodaja",
    texto: "Rueda con barreno para eje y caja para rodamiento opcional: carritos, juguetes y plantillas.",
    categoria: "taller",
    claves: "rueda rodaja carrito eje rodamiento juguete",
    params: [
      { k: "diametro", nombre: "Diámetro", def: 40, min: 10, max: 150 },
      { k: "ancho", nombre: "Ancho", def: 14, min: 4, max: 50 },
      { k: "eje", nombre: "Barreno del eje", def: 6, min: 2, max: 30, paso: 0.1 },
      { k: "rodamiento", nombre: "Caja para rodamiento (0 = sin; 608 = 22)", def: 0, min: 0, max: 60, paso: 0.1 },
    ],
    construir: (p, k) => {
      const ch = Math.min(1.5, p.ancho / 6)
      const llanta = k.unir(k.cono(p.diametro - 2 * ch, p.diametro, ch), k.cil(p.diametro, p.ancho - 2 * ch, 0, 0, ch), k.cono(p.diametro, p.diametro - 2 * ch, ch, 0, 0, p.ancho - ch))
      const huecos = [k.barreno(p.eje + 0.2, p.ancho)]
      if (p.rodamiento > p.eje + 2 && p.rodamiento < p.diametro - 4) huecos.push(k.cil(p.rodamiento + 0.15, Math.min(7, p.ancho / 2), 0, 0, -0.01))
      return k.restar(llanta, ...huecos)
    },
  },
  {
    id: "prueba-holgura",
    nombre: "Prueba de holguras para tu impresora",
    texto: "Placa con barrenos y pernos de 0.1 en 0.1 mm para saber qué holgura usar en tus piezas.",
    categoria: "taller",
    claves: "holgura tolerancia calibracion impresora 3d prueba ajuste",
    params: [
      { k: "diametro", nombre: "Diámetro del perno", def: 8, min: 3, max: 20, paso: 0.5 },
      { k: "inicio", nombre: "Holgura inicial", def: 0.1, min: 0, max: 0.5, paso: 0.05 },
      { k: "paso", nombre: "Aumento por barreno", def: 0.1, min: 0.05, max: 0.3, paso: 0.05 },
      { k: "pruebas", nombre: "Número de barrenos", def: 6, min: 3, max: 10, unidad: "" },
    ],
    construir: (p, k) => {
      const n = Math.round(p.pruebas), sep = p.diametro + 8, e = 4
      const placa = k.bloque(n * sep + 6, sep + 6, e, 0, 0, 0, 2)
      const huecos = Array.from({ length: n }, (_, i) => k.barreno(p.diametro + 2 * (p.inicio + i * p.paso), e, 3 + sep / 2 + i * sep, 3 + sep / 2))
      // marca de cuál es el primero (el más justo): una muesca en la orilla
      huecos.push(k.bloque(3, 3, e + 2, 3 + sep / 2 - 1.5, -1.5, -1))
      // el perno de prueba, al lado de la placa
      const perno = k.unir(k.cil(p.diametro + 6, 2, n * sep + 20, sep / 2 + 3), k.cil(p.diametro, 10, n * sep + 20, sep / 2 + 3, 2))
      return k.unir(k.restar(placa, ...huecos), perno)
    },
  },
  {
    id: "contenedor-apilable",
    nombre: "Contenedor apilable",
    texto: "Caja abierta al frente que se apila: refacciones, tornillería y consumibles a la vista.",
    categoria: "organizar",
    claves: "contenedor apilable gaveta bin refacciones tornilleria almacen",
    params: [
      { k: "ancho", nombre: "Ancho", def: 100, min: 40, max: 250 },
      { k: "fondo", nombre: "Fondo", def: 150, min: 50, max: 300 },
      { k: "alto", nombre: "Alto", def: 70, min: 30, max: 200 },
      { k: "pared", nombre: "Pared", def: 2, min: 1.2, max: 5, paso: 0.1 },
    ],
    construir: (p, k) => {
      const w = p.pared, W = p.ancho, F = p.fondo, H = p.alto
      const caja = k.restar(k.bloque(W, F, H, 0, 0, 0, 3), k.bloque(W - 2 * w, F - 2 * w, H, w, w, w, Math.max(0, 3 - w)))
      // boca al frente: recorte inclinado para meter la mano
      const boca = k.envolver(k.bloque(W - 2 * w - 8, 1, H * 0.55, w + 4, -1, H * 0.45 + 1), k.bloque(W - 2 * w - 8, 1, 1, w + 4, F * 0.35, H + 1))
      // ceja arriba para apilar: un marco que entra en la base del de arriba
      const ceja = k.restar(k.bloque(W - 2 * w - 0.6, F - 2 * w - 0.6, 3, w + 0.3, w + 0.3, H), k.bloque(W - 4 * w, F - 4 * w, 5, 2 * w, 2 * w, H - 1))
      return k.unir(k.restar(caja, boca), k.restar(ceja, k.envolver(k.bloque(W, 1, 6, 0, -1, H - 1), k.bloque(W, 1, 6, 0, F * 0.35 + 2, H - 1))))
    },
  },
  {
    id: "soporte-escoba",
    nombre: "Soporte para mangos (escoba, herramienta)",
    texto: "Pinza de pared que abraza mangos de escoba, rastrillo o herramienta larga.",
    categoria: "casa",
    claves: "soporte escoba trapeador mango herramienta pared colgar pinza",
    params: [
      { k: "diametro", nombre: "Diámetro del mango", def: 24, min: 10, max: 50 },
      { k: "ancho", nombre: "Ancho", def: 18, min: 10, max: 40 },
      { k: "pared", nombre: "Pared", def: 3.5, min: 2, max: 6, paso: 0.1 },
      { k: "tornillo", nombre: "Barreno", def: 4.5, min: 3, max: 6, paso: 0.1 },
    ],
    construir: (p, k) => {
      const R = p.diametro / 2, e = p.pared, base = 6
      const placa = k.bloque(2 * R + 2 * e + 16, p.ancho, base, -(R + e + 8), -p.ancho / 2, 0)
      const anillo = k.mover(k.restar(k.girar(k.cil(2 * (R + e), p.ancho, 0, 0, -p.ancho / 2), 90, 0, 0), k.girar(k.cil(2 * R, p.ancho + 2, 0, 0, -p.ancho / 2 - 1), 90, 0, 0)), 0, 0, base + R - 1)
      // boca un poco más chica que el mango para que entre a presión
      const boca = k.bloque(p.diametro * 0.82, p.ancho + 2, R + e, -p.diametro * 0.41, -p.ancho / 2 - 1, base + R + R * 0.55)
      const g = k.restar(k.unir(placa, anillo), boca)
      return k.restar(g, k.avellanado(p.tornillo, p.tornillo * 2, base, -(R + e + 4), 0), k.avellanado(p.tornillo, p.tornillo * 2, base, R + e + 4, 0))
    },
  },
  {
    id: "separador-cajon",
    nombre: "Separadores de cajón ajustables",
    texto: "Tiras que se encastran a media altura para armar divisiones dentro de un cajón.",
    categoria: "organizar",
    claves: "separador cajon division organizador encastre tiras",
    params: [
      { k: "largo", nombre: "Largo de cada tira", def: 200, min: 60, max: 300 },
      { k: "alto", nombre: "Alto", def: 50, min: 20, max: 120 },
      { k: "espesor", nombre: "Espesor", def: 2.4, min: 1.6, max: 5, paso: 0.1 },
      { k: "ranuras", nombre: "Ranuras por tira", def: 3, min: 1, max: 8, unidad: "" },
    ],
    construir: (p, k) => {
      // dos tiras acostadas: una con ranuras desde arriba y otra desde abajo (se cruzan a media altura)
      const n = Math.round(p.ranuras), paso = p.largo / (n + 1), r = p.espesor + 0.3
      const tira = (desdeArriba: boolean, y0: number) =>
        k.restar(k.bloque(p.largo, p.alto, p.espesor, 0, y0, 0), ...Array.from({ length: n }, (_, i) => k.bloque(r, p.alto / 2 + 0.5, p.espesor + 2, paso * (i + 1) - r / 2, desdeArriba ? y0 + p.alto / 2 : y0 - 0.5, -1)))
      return k.unir(tira(true, 0), tira(false, p.alto + 6))
    },
  },
  {
    id: "llaves-allen",
    nombre: "Organizador de llaves Allen",
    texto: "Bloque con alojamientos hexagonales escalonados para tu juego de llaves Allen.",
    categoria: "organizar",
    claves: "llaves allen hexagonales juego organizador soporte",
    params: [
      { k: "menor", nombre: "Llave más chica (entre caras)", def: 1.5, min: 1, max: 6, paso: 0.5 },
      { k: "mayor", nombre: "Llave más grande", def: 10, min: 3, max: 14, paso: 0.5 },
      { k: "cantidad", nombre: "Cantidad de llaves", def: 9, min: 3, max: 15, unidad: "" },
      { k: "holgura", nombre: "Holgura", def: 0.3, min: 0, max: 1, paso: 0.05 },
    ],
    construir: (p, k) => {
      const n = Math.round(p.cantidad), mayor = Math.max(p.mayor, p.menor + 1)
      const medidas = Array.from({ length: n }, (_, i) => p.menor + ((mayor - p.menor) * i) / (n - 1))
      const alto = 20
      let x = 6
      const huecos = medidas.map((m) => {
        const d = (m + p.holgura) / Math.cos(Math.PI / 6)
        const h = k.cil(d, alto - 3, x + d / 2, 10, 3, 6)
        x += d + 4
        return h
      })
      return k.restar(k.bloque(x + 2, 20, alto, 0, 0, 0, 3), ...huecos)
    },
  },
  {
    id: "buje-brida",
    nombre: "Buje con brida",
    texto: "Buje con ceja para ejes, bisagras y pivotes; se mete a presión en un barreno.",
    categoria: "taller",
    claves: "buje casquillo bushing brida ceja eje pivote",
    params: [
      { k: "eje", nombre: "Diámetro del eje (interior)", def: 8, min: 2, max: 40, paso: 0.1 },
      { k: "exterior", nombre: "Diámetro exterior", def: 12, min: 4, max: 60, paso: 0.1 },
      { k: "largo", nombre: "Largo", def: 12, min: 3, max: 60 },
      { k: "brida", nombre: "Diámetro de la brida", def: 18, min: 6, max: 80 },
      { k: "ceja", nombre: "Espesor de la brida", def: 2, min: 1, max: 8, paso: 0.5 },
    ],
    construir: (p, k) => {
      const ext = Math.max(p.exterior, p.eje + 1.6), br = Math.max(p.brida, ext + 2)
      return k.restar(k.unir(k.cil(br, p.ceja), k.cil(ext, p.largo, 0, 0, p.ceja)), k.barreno(p.eje + 0.15, p.largo + p.ceja))
    },
  },
  {
    id: "bisagra",
    nombre: "Bisagra de dos hojas",
    texto: "Dos hojas con nudillos y barrenos avellanados; se unen con un clavo, tornillo o varilla como perno.",
    categoria: "taller",
    claves: "bisagra charnela puerta tapa caja hojas perno",
    params: [
      { k: "largo", nombre: "Largo", def: 50, min: 20, max: 150 },
      { k: "ancho", nombre: "Ancho de cada hoja", def: 20, min: 10, max: 60 },
      { k: "espesor", nombre: "Espesor", def: 3, min: 2, max: 6, paso: 0.1 },
      { k: "perno", nombre: "Diámetro del perno", def: 3, min: 1.5, max: 8, paso: 0.1 },
      { k: "nudillos", nombre: "Nudillos", def: 5, min: 3, max: 9, unidad: "" },
    ],
    construir: (p, k) => {
      const n = Math.round(p.nudillos) | 1, dN = p.perno + 2 * 2, h = p.largo / n, e = p.espesor
      const hoja = (par: boolean, y0: number) => {
        const placa = k.bloque(p.largo, p.ancho, e, 0, y0, 0)
        const nud = []
        for (let i = 0; i < n; i++) if ((i % 2 === 0) === par) nud.push(k.mover(k.girar(k.cil(dN, h - 0.4, 0, 0, 0), 0, 90, 0), i * h + 0.2, y0 + (par ? 0 : p.ancho), dN / 2))
        const pernoH = k.mover(k.girar(k.cil(p.perno + 0.3, p.largo + 2, 0, 0, 0), 0, 90, 0), -1, y0 + (par ? 0 : p.ancho), dN / 2)
        const tornillos = [0.25, 0.75].map((f) => k.avellanado(3.5, 7, e, p.largo * f, y0 + p.ancho / 2))
        return k.restar(k.unir(placa, ...nud), pernoH, ...tornillos)
      }
      return k.unir(hoja(true, 0), hoja(false, p.ancho + dN + 6))
    },
  },
  {
    id: "porta-filamento",
    nombre: "Eje para carrete de filamento",
    texto: "Eje con tope para montar carretes de filamento en la pared o arriba de la impresora.",
    categoria: "taller",
    claves: "carrete filamento spool holder impresora 3d soporte eje",
    params: [
      { k: "diametro", nombre: "Diámetro del eje (hueco del carrete − 2 mm)", def: 50, min: 20, max: 80 },
      { k: "largo", nombre: "Largo del eje", def: 75, min: 40, max: 120 },
      { k: "tornillo", nombre: "Barreno de montaje", def: 5, min: 3, max: 8, paso: 0.1 },
    ],
    construir: (p, k) => {
      const base = 5, D = p.diametro, tope = D + 30
      const placa = k.cil(tope, base)
      const eje = k.restar(k.cil(D, p.largo, 0, 0, base), k.cil(D - 6, p.largo, 0, 0, base + 3))
      const labio = k.cono(D, D + 6, 4, 0, 0, base + p.largo - 4) // que el carrete no se salga
      const tornillos = [0, 120, 240].map((a) => k.avellanado(p.tornillo, p.tornillo * 2, base, (Math.cos((a * Math.PI) / 180) * (D + 15)) / 2, (Math.sin((a * Math.PI) / 180) * (D + 15)) / 2))
      return k.restar(k.unir(placa, eje, labio), ...tornillos)
    },
  },
  {
    id: "caja-electronica",
    nombre: "Caja para tarjeta electrónica",
    texto: "Caja con postes para atornillar Arduino, ESP32, Raspberry o tu tarjeta, con ventilación y salida de cables.",
    categoria: "taller",
    claves: "caja electronica arduino esp32 raspberry tarjeta pcb gabinete postes",
    params: [
      { k: "largo", nombre: "Largo de la tarjeta", def: 69, min: 20, max: 200 },
      { k: "ancho", nombre: "Ancho de la tarjeta", def: 54, min: 15, max: 150 },
      { k: "altoInt", nombre: "Alto libre", def: 25, min: 10, max: 80 },
      { k: "margen", nombre: "Distancia del barreno a la orilla", def: 3.5, min: 2, max: 10, paso: 0.5 },
      { k: "pared", nombre: "Pared", def: 2, min: 1.2, max: 4, paso: 0.1 },
    ],
    construir: (p, k) => {
      const w = p.pared, hueco = 3, poste = 6, alturaPoste = 5
      const L = p.largo + 2 * hueco + 2 * w, A = p.ancho + 2 * hueco + 2 * w, H = p.altoInt + alturaPoste + w
      let caja = k.restar(k.bloque(L, A, H, 0, 0, 0, 3), k.bloque(L - 2 * w, A - 2 * w, H, w, w, w))
      const pos = [[p.margen, p.margen], [p.largo - p.margen, p.margen], [p.margen, p.ancho - p.margen], [p.largo - p.margen, p.ancho - p.margen]].map(([x, y]) => [w + hueco + x, w + hueco + y])
      caja = k.unir(caja, ...pos.map(([x, y]) => k.restar(k.cil(poste, alturaPoste, x, y, w), k.cil(2.5, alturaPoste, x, y, w + 1))))
      const rejilla = Array.from({ length: Math.max(1, Math.floor((L - 20) / 6)) }, (_, i) => k.bloque(2.5, w + 2, H * 0.4, 10 + i * 6, A - w - 1, H * 0.45))
      const cable = k.bloque(12, w + 2, 8, L * 0.15, -1, w + alturaPoste)
      return k.restar(caja, ...rejilla, cable)
    },
  },
  {
    id: "pasacables",
    nombre: "Pasacables de escritorio",
    texto: "Arillo con tapa ranurada para el barreno del escritorio por donde pasan los cables.",
    categoria: "casa",
    claves: "pasacables escritorio grommet cables oficina tapa barreno",
    params: [
      { k: "barreno", nombre: "Diámetro del barreno", def: 60, min: 20, max: 100 },
      { k: "tablero", nombre: "Espesor del tablero", def: 18, min: 10, max: 40 },
    ],
    construir: (p, k) => {
      const D = p.barreno, ceja = 2.5, labio = D + 10
      const aro = k.restar(k.unir(k.cil(labio, ceja), k.cil(D - 0.4, p.tablero, 0, 0, ceja)), k.cil(D - 4, p.tablero + ceja + 2, 0, 0, -1))
      // tapa con ranura para los cables, al lado
      const tapa = k.restar(k.unir(k.cil(labio, 2), k.cil(D - 4.4, 5, 0, 0, 2)), k.bloque(D * 0.18, labio / 2 + 2, 10, -D * 0.09, D * 0.15, -1))
      return k.unir(aro, k.mover(tapa, labio + 8, 0, 0))
    },
  },
  {
    id: "posavasos",
    nombre: "Posavasos",
    texto: "Posavasos redondo, cuadrado o hexagonal con ceja para que no escurra.",
    categoria: "casa",
    claves: "posavasos portavasos coaster cocina mesa regalo",
    params: [
      { k: "diametro", nombre: "Diámetro", def: 95, min: 60, max: 140 },
      { k: "lados", nombre: "Lados (0 = redondo, 4, 6, 8)", def: 6, min: 0, max: 12, unidad: "" },
      { k: "alto", nombre: "Alto", def: 5, min: 3, max: 10, paso: 0.5 },
    ],
    construir: (p, k) => {
      const l = p.lados >= 3 ? Math.round(p.lados) : 0
      const base = k.cil(p.diametro, p.alto, 0, 0, 0, l)
      return k.restar(base, k.cil(p.diametro - 6, p.alto, 0, 0, 1.6, l))
    },
  },
  {
    id: "cunas-nivelacion",
    nombre: "Cuñas de nivelación (juego)",
    texto: "Juego de cuñas escalonadas para nivelar muebles, máquinas o calzar piezas en la mesa.",
    categoria: "taller",
    claves: "cuñas calzas nivelar shims mueble maquina mesa",
    params: [
      { k: "largo", nombre: "Largo", def: 80, min: 30, max: 150 },
      { k: "ancho", nombre: "Ancho", def: 25, min: 10, max: 60 },
      { k: "alto", nombre: "Alto máximo", def: 10, min: 3, max: 30 },
      { k: "piezas", nombre: "Piezas", def: 4, min: 1, max: 8, unidad: "" },
    ],
    construir: (p, k) => {
      const n = Math.round(p.piezas)
      const cunas = Array.from({ length: n }, (_, i) => {
        const h = (p.alto * (i + 1)) / n
        return k.envolver(k.bloque(1, p.ancho, h, 0, i * (p.ancho + 5), 0), k.bloque(1, p.ancho, 0.8, p.largo - 1, i * (p.ancho + 5), 0))
      })
      return k.unir(...cunas)
    },
  },
  {
    id: "soporte-taladro",
    nombre: "Soporte de pared para taladro",
    texto: "Funda de pared para colgar el taladro o atornillador por la boca del mandril.",
    categoria: "organizar",
    claves: "soporte taladro atornillador pared colgar herramienta electrica",
    params: [
      { k: "mandril", nombre: "Diámetro del mandril", def: 40, min: 20, max: 70 },
      { k: "salida", nombre: "Salida de la pared", def: 60, min: 40, max: 100 },
      { k: "tornillo", nombre: "Barreno", def: 4.5, min: 3, max: 6, paso: 0.1 },
    ],
    construir: (p, k) => {
      const e = 5, D = p.mandril, ancho = D + 24
      const placa = k.bloque(ancho, 70, e, -ancho / 2, 0, 0)
      // impreso acostado: la placa va a la pared y la repisa (placa vertical aquí) lleva una ranura
      // en U abierta al frente por donde entra el mandril
      const ranura = k.unir(k.mover(k.girar(k.cil(D + 1, e + 4, 0, 0, 0), -90, 0, 0), 0, -2, p.salida - D / 2 - 6), k.bloque(D * 0.7, e + 4, D, -D * 0.35, -2, p.salida - D / 2))
      const g = k.restar(k.unir(placa, k.bloque(ancho, e, p.salida, -ancho / 2, 0, 0)), ranura)
      return k.restar(g, k.avellanado(p.tornillo, p.tornillo * 2, e, -ancho / 2 + 7, 50), k.avellanado(p.tornillo, p.tornillo * 2, e, ancho / 2 - 7, 50))
    },
  },
  {
    id: "clip-bolsa",
    nombre: "Clip para bolsas",
    texto: "Pinza a presión para cerrar bolsas de café, botanas o tornillería.",
    categoria: "casa",
    claves: "clip bolsa cerrar pinza cocina cafe botana",
    params: [
      { k: "largo", nombre: "Largo", def: 90, min: 40, max: 160 },
      { k: "alto", nombre: "Alto", def: 10, min: 6, max: 20 },
    ],
    construir: (p, k) => {
      // C de una pieza: dos brazos unidos por un aro elástico; la bolsa entra entre los brazos
      const e = 2.6, g = 0.6
      const brazoA = k.bloque(p.largo, e, p.alto, 0, 0, 0)
      const brazoB = k.bloque(p.largo, e, p.alto, 0, e + g, 0)
      const aro = k.restar(k.cil(2 * e + g + 4, p.alto, 0, e + g / 2, 0), k.cil(g + 2, p.alto + 2, 0, e + g / 2, -1), k.bloque(10, 20, p.alto + 2, 0, -5, -1))
      return k.unir(brazoA, brazoB, aro)
    },
  },
  {
    id: "gancho-pared",
    nombre: "Gancho de pared",
    texto: "Gancho en L con dos barrenos avellanados. Para cables, mangueras, mandiles o herramienta.",
    categoria: "casa",
    claves: "colgador perchero cable manguera mandil",
    params: [
      { k: "ancho", nombre: "Ancho", def: 20, min: 8, max: 60 },
      { k: "alto", nombre: "Alto de la placa", def: 60, min: 30, max: 150 },
      { k: "salida", nombre: "Salida del gancho", def: 40, min: 15, max: 120 },
      { k: "espesor", nombre: "Espesor", def: 5, min: 3, max: 12 },
      { k: "tornillo", nombre: "Barreno", def: 4, min: 2.5, max: 6, paso: 0.1 },
    ],
    construir: (p, k) => {
      // impreso acostado: la placa es la base, el brazo sube y la punta se dobla
      const e = p.espesor
      const g = k.unir(k.bloque(p.ancho, p.alto, e), k.bloque(p.ancho, e, p.salida), k.bloque(p.ancho, 15, e, 0, 0, p.salida - e))
      return k.restar(g, k.avellanado(p.tornillo, p.tornillo * 2, e, p.ancho / 2, p.alto * 0.45), k.avellanado(p.tornillo, p.tornillo * 2, e, p.ancho / 2, p.alto * 0.85))
    },
  },
  {
    id: "porta-lapices",
    nombre: "Lapicero de varios lados",
    texto: "Vaso hexagonal (o del número de lados que quieras) para plumas, marcadores o brochas.",
    categoria: "casa",
    claves: "lapicero plumero vaso escritorio brochas hexagonal",
    params: [
      { k: "diametro", nombre: "Diámetro", def: 80, min: 30, max: 160 },
      { k: "alto", nombre: "Alto", def: 100, min: 30, max: 200 },
      { k: "pared", nombre: "Pared", def: 2, min: 1, max: 6, paso: 0.1 },
      { k: "lados", nombre: "Lados", def: 6, min: 3, max: 12, unidad: "" },
    ],
    construir: (p, k) => {
      const l = Math.round(p.lados)
      const dInt = p.diametro - (2 * p.pared) / Math.cos(Math.PI / l)
      return k.restar(k.cil(p.diametro, p.alto, 0, 0, 0, l), k.cil(dInt, p.alto, 0, 0, p.pared, l))
    },
  },
  {
    id: "maceta",
    nombre: "Maceta con drenaje",
    texto: "Maceta cónica con barreno de drenaje y plato opcional.",
    categoria: "casa",
    claves: "planta suculenta cactus jardin plato",
    params: [
      { k: "arriba", nombre: "Diámetro arriba", def: 100, min: 30, max: 220 },
      { k: "abajo", nombre: "Diámetro abajo", def: 75, min: 20, max: 220 },
      { k: "alto", nombre: "Alto", def: 90, min: 20, max: 220 },
      { k: "pared", nombre: "Pared", def: 2, min: 1, max: 6, paso: 0.1 },
      { k: "drenaje", nombre: "Barreno de drenaje", def: 10, min: 0, max: 40 },
      { k: "plato", nombre: "Plato (1 = sí, 0 = no)", def: 1, min: 0, max: 1, unidad: "" },
    ],
    construir: (p, k) => {
      const w = p.pared
      let m = k.restar(k.cono(p.abajo, p.arriba, p.alto), k.cono(p.abajo - 2 * w, p.arriba - 2 * w, p.alto, 0, 0, w))
      if (p.drenaje > 0) m = k.restar(m, k.barreno(Math.min(p.drenaje, p.abajo - 2 * w - 2), w))
      if (p.plato >= 0.5) {
        const D = p.abajo + 20
        m = k.unir(m, k.restar(k.cil(D, 12, p.arriba / 2 + D / 2 + 10), k.cil(D - 2 * w, 12, p.arriba / 2 + D / 2 + 10, 0, w)))
      }
      return m
    },
  },
  {
    id: "soporte-celular",
    nombre: "Soporte para celular o tableta",
    texto: "Base inclinada con tope al frente y paso para el cable de carga.",
    categoria: "casa",
    claves: "base atril telefono tablet escritorio",
    params: [
      { k: "ancho", nombre: "Ancho", def: 80, min: 40, max: 250 },
      { k: "angulo", nombre: "Inclinación", def: 65, min: 45, max: 80, unidad: "°" },
      { k: "grosor", nombre: "Grosor del equipo (con funda)", def: 12, min: 6, max: 30 },
      { k: "cable", nombre: "Paso del cable (0 = sin)", def: 14, min: 0, max: 30 },
    ],
    construir: (p, k) => {
      const a = lim(p.angulo, 45, 80)
      const fondo = 90, y0 = 30
      const base = k.bloque(p.ancho, fondo, 6, 0, 0, 0, 3)
      // respaldo: placa que se recarga hacia atrás desde y0
      const respaldo = k.mover(k.girar(k.bloque(p.ancho, 6, 100, 0, 0, 0), -(90 - a), 0, 0), 0, y0, 2)
      const tope = k.bloque(p.ancho, 6, 14, 0, y0 - p.grosor - 6, 0)
      let g = k.unir(base, respaldo, tope)
      if (p.cable > 0) g = k.restar(g, k.bloque(Math.min(p.cable, p.ancho - 10), p.grosor + 12, 30, p.ancho / 2 - Math.min(p.cable, p.ancho - 10) / 2, y0 - p.grosor - 9, -1))
      // que nada quede abajo de la cama ni fuera de la base
      return k.restar(g, k.bloque(p.ancho + 10, 400, 100, -5, -200, -100), k.bloque(p.ancho + 10, 200, 300, -5, fondo, -50))
    },
  },
  // ── Gridfinity (sistema modular de organización: rejilla de 42 mm, alturas de 7 mm) ──
  {
    id: "gridfinity-caja",
    nombre: "Caja Gridfinity",
    texto: "Cajita del sistema Gridfinity a la medida: casillas de 42 mm, alto en unidades de 7 mm, divisiones e imanes opcionales.",
    categoria: "organizar",
    claves: "gridfinity bin caja organizador modular rejilla 42 mm imanes divisiones cajon",
    params: [
      { k: "x", nombre: "Casillas a lo ancho", def: 2, min: 1, max: 8, unidad: "" },
      { k: "y", nombre: "Casillas a lo fondo", def: 1, min: 1, max: 8, unidad: "" },
      { k: "alto", nombre: "Alto (unidades de 7 mm)", def: 6, min: 2, max: 20, unidad: "" },
      { k: "divisiones", nombre: "Divisiones a lo ancho", def: 1, min: 1, max: 8, unidad: "" },
      { k: "pared", nombre: "Pared", def: 1.2, min: 0.8, max: 3, paso: 0.1 },
      { k: "imanes", nombre: "Huecos para imán 6×2 (0 = no, 1 = sí)", def: 0, min: 0, max: 1, unidad: "" },
    ],
    construir: (p, k) => {
      const nx = Math.round(p.x), ny = Math.round(p.y), G = 42, H = Math.round(p.alto) * 7, w = p.pared
      const W = nx * G - 0.5, F = ny * G - 0.5, PIE = 4.75
      // pie de cada casilla con el perfil escalonado del estándar (chaflán 0.8, recto 1.8, chaflán 2.15)
      const losa = (lado: number, r: number, z: number, cx: number, cy: number) => k.bloque(lado, lado, 0.01, cx - lado / 2, cy - lado / 2, z, r)
      const pies: S[] = []
      for (let i = 0; i < nx; i++)
        for (let j = 0; j < ny; j++) {
          const cx = i * G + G / 2 - 0.25, cy = j * G + G / 2 - 0.25
          pies.push(k.envolver(losa(35.6, 0.8, 0, cx, cy), losa(37.2, 1.6, 0.8, cx, cy)))
          pies.push(k.envolver(losa(37.2, 1.6, 0.8, cx, cy), losa(37.2, 1.6, 2.6, cx, cy)))
          pies.push(k.envolver(losa(37.2, 1.6, 2.6, cx, cy), losa(41.5, 3.75, PIE, cx, cy)))
        }
      const piso = 1.2
      let caja = k.unir(...pies, k.bloque(W, F, H - PIE, 0, 0, PIE, 3.75))
      caja = k.restar(caja, k.bloque(W - 2 * w, F - 2 * w, H, w, w, PIE + piso, Math.max(0.5, 3.75 - w)))
      // divisiones a lo ancho
      const nd = Math.round(p.divisiones)
      const paredes = Array.from({ length: nd - 1 }, (_, i) => k.bloque(w, F - 2 * w, H - PIE - piso - 2, w + ((W - 2 * w) * (i + 1)) / nd - w / 2, w, PIE + piso))
      if (paredes.length) caja = k.unir(caja, ...paredes)
      // imanes: 4 por casilla, a ±13 mm del centro, por abajo
      if (p.imanes >= 0.5) {
        const huecos: S[] = []
        for (let i = 0; i < nx; i++)
          for (let j = 0; j < ny; j++)
            for (const [dx, dy] of [[-13, -13], [13, -13], [-13, 13], [13, 13]]) huecos.push(k.cil(6.5, 2.4, i * G + G / 2 - 0.25 + dx, j * G + G / 2 - 0.25 + dy, -0.01))
        caja = k.restar(caja, ...huecos)
      }
      return caja
    },
  },
  {
    id: "gridfinity-base",
    nombre: "Base Gridfinity",
    texto: "La rejilla donde se encajan las cajas Gridfinity: tantas casillas como quepan en tu cajón o mesa.",
    categoria: "organizar",
    claves: "gridfinity baseplate base rejilla organizador modular cajon 42 mm",
    params: [
      { k: "x", nombre: "Casillas a lo ancho", def: 4, min: 1, max: 10, unidad: "" },
      { k: "y", nombre: "Casillas a lo fondo", def: 3, min: 1, max: 10, unidad: "" },
    ],
    construir: (p, k) => {
      const nx = Math.round(p.x), ny = Math.round(p.y), G = 42, T = 4.65
      const losa = (lado: number, r: number, z: number, cx: number, cy: number) => k.bloque(lado, lado, 0.01, cx - lado / 2, cy - lado / 2, z, r)
      const huecos: S[] = []
      for (let i = 0; i < nx; i++)
        for (let j = 0; j < ny; j++) {
          const cx = i * G + G / 2, cy = j * G + G / 2
          // el negativo del pie de la caja (chaflán 0.7, recto 1.8, chaflán 2.15), pasado hasta abajo
          huecos.push(k.envolver(losa(35.6, 0.8, -1, cx, cy), losa(35.6, 0.8, 0.7, cx, cy)))
          huecos.push(k.envolver(losa(35.6, 0.8, 0.7, cx, cy), losa(37.7, 1.85, 0.7 + 0.01, cx, cy)))
          huecos.push(k.envolver(losa(37.7, 1.85, 0.7, cx, cy), losa(37.7, 1.85, 2.5, cx, cy)))
          huecos.push(k.envolver(losa(37.7, 1.85, 2.5, cx, cy), losa(42, 4, T + 0.01, cx, cy)))
        }
      return k.restar(k.bloque(nx * G, ny * G, T, 0, 0, 0, 4), ...huecos)
    },
  },
  {
    id: "cadena-portacables",
    nombre: "Cadena portacables",
    texto: "Eslabones que se abrochan entre sí para guiar cables y mangueras de tu CNC o impresora. Salen varios por impresión.",
    categoria: "taller",
    claves: "cadena portacables drag chain eslabon cnc impresora cables manguera oruga",
    params: [
      { k: "ancho", nombre: "Ancho por dentro", def: 15, min: 6, max: 60 },
      { k: "alto", nombre: "Alto por dentro", def: 10, min: 6, max: 40 },
      { k: "eslabones", nombre: "Eslabones por impresión", def: 6, min: 1, max: 12, unidad: "" },
    ],
    construir: (p, k) => {
      const w = 1.6, a = p.ancho, h = p.alto, L = Math.max(16, h + 8)
      const A = a + 2 * w, Hh = h + 2 * w, ped = 3.4 // diámetro del perno (el agujero lleva 0.4 de holgura)
      const eslabon = (x0: number) => {
        // paredes laterales y travesaños abajo y arriba (abierto al frente para meter el cable)
        const lados = k.unir(k.bloque(L, w, Hh, x0, 0, 0), k.bloque(L, w, Hh, x0, A - w, 0))
        const piso = k.bloque(L * 0.6, A, w, x0 + L * 0.2, 0, 0)
        const techo = k.bloque(L * 0.3, A, w, x0 + L * 0.35, 0, Hh - w)
        // lengüetas al frente, metidas por dentro, con perno hacia afuera
        const leng = k.unir(k.bloque(L * 0.45, w, Hh * 0.7, x0 + L * 0.8, w + 0.3, Hh * 0.15), k.bloque(L * 0.45, w, Hh * 0.7, x0 + L * 0.8, A - 2 * w - 0.3, Hh * 0.15))
        // pernos hacia afuera (-Y y +Y), que entran en los agujeros de las paredes del eslabón siguiente
        const haciaAfuera = (signo: number) => k.girar(k.cil(ped, w + 0.6, 0, 0, 0), signo * 90, 0, 0)
        const pernos = k.unir(k.mover(haciaAfuera(1), x0 + L * 1.05, w + 0.3 + 0.01, Hh / 2), k.mover(haciaAfuera(-1), x0 + L * 1.05, A - w - 0.3 - 0.01, Hh / 2))
        // agujero que atraviesa las dos paredes
        const agujeros = k.mover(k.girar(k.cil(ped + 0.4, A + 2, 0, 0, 0), -90, 0, 0), x0 + L * 0.2, -1, Hh / 2)
        return k.restar(k.unir(lados, piso, techo, leng, pernos), agujeros)
      }
      const n = Math.round(p.eslabones)
      return k.unir(...Array.from({ length: n }, (_, i) => eslabon(i * (L * 1.35 + 4))))
    },
  },
  {
    id: "florero-espiral",
    nombre: "Florero para modo espiral",
    texto: "Florero con ondas y giro: sale sólido para imprimirlo en modo espiral (vase mode) en una sola pasada, rápido y sin costuras.",
    categoria: "casa",
    claves: "florero jarron vase mode espiral spiralize decoracion maceta ondas giro",
    params: [
      { k: "diametro", nombre: "Diámetro de la base", def: 80, min: 30, max: 200 },
      { k: "alto", nombre: "Alto", def: 150, min: 40, max: 300 },
      { k: "boca", nombre: "Boca (% de la base)", def: 80, min: 30, max: 200, unidad: "%" },
      { k: "ondas", nombre: "Ondas (0 = liso)", def: 8, min: 0, max: 24, unidad: "" },
      { k: "profundidad", nombre: "Profundidad de la onda", def: 6, min: 0, max: 20 },
      { k: "giro", nombre: "Giro", def: 90, min: -360, max: 360, unidad: "°" },
    ],
    construir: (p, k) => {
      const R = p.diametro / 2, n = Math.round(p.ondas), amp = n ? Math.min(p.profundidad, R * 0.4) : 0
      const N = 180
      const perfil = Array.from({ length: N }, (_, i) => {
        const t = (i / N) * 2 * Math.PI
        const r = R - amp / 2 + (amp / 2) * Math.cos(n * t)
        return [r * Math.cos(t), r * Math.sin(t)] as [number, number]
      })
      return k.extruir(perfil, p.alto, p.giro, p.boca / 100)
    },
  },
  {
    id: "pantalla-lampara",
    nombre: "Pantalla de lámpara",
    texto: "Pantalla con ondas y giro para foco LED: hueca, abierta abajo y con el aro arriba para el socket E27 (o el que pongas).",
    categoria: "casa",
    claves: "pantalla lampara lamp shade e27 socket foco led decoracion ondas",
    params: [
      { k: "abajo", nombre: "Diámetro abajo", def: 160, min: 60, max: 250 },
      { k: "arriba", nombre: "Diámetro arriba", def: 110, min: 60, max: 250 },
      { k: "alto", nombre: "Alto", def: 140, min: 40, max: 250 },
      { k: "ondas", nombre: "Ondas", def: 12, min: 0, max: 30, unidad: "" },
      { k: "profundidad", nombre: "Profundidad de la onda", def: 8, min: 0, max: 20 },
      { k: "giro", nombre: "Giro", def: 60, min: -360, max: 360, unidad: "°" },
      { k: "pared", nombre: "Pared", def: 1.6, min: 0.8, max: 4, paso: 0.1 },
      { k: "socket", nombre: "Barreno del socket (E27: 40.5)", def: 40.5, min: 20, max: 60, paso: 0.5 },
    ],
    construir: (p, k) => {
      const R = p.abajo / 2, n = Math.round(p.ondas), amp = n ? Math.min(p.profundidad, R * 0.3) : 0, w = p.pared
      const escala = p.arriba / p.abajo, N = 200
      const perfil = (dr: number) =>
        Array.from({ length: N }, (_, i) => {
          const t = (i / N) * 2 * Math.PI
          const r = R - amp / 2 + (amp / 2) * Math.cos(n * t) - dr
          return [r * Math.cos(t), r * Math.sin(t)] as [number, number]
        })
      // concha: el perfil menos el mismo perfil recorrido hacia adentro (pasado de abajo a arriba)
      const concha = k.restar(k.extruir(perfil(0), p.alto, p.giro, escala), k.extruir(perfil(w), p.alto + 0.02, p.giro, escala, -0.01))
      // aro arriba: disco con el barreno del socket y ventanas para el calor
      const rArriba = (R - amp) * escala
      const aro = k.restar(
        k.cil(2 * rArriba, 2.4, 0, 0, p.alto - 2.4),
        k.barreno(p.socket, 3, 0, 0, p.alto - 2.4),
        ...[0, 1, 2, 3, 4, 5].map((i) => {
          const t = (i / 6) * 2 * Math.PI, rr = (p.socket / 2 + rArriba) / 2
          return k.barreno(Math.max(4, (rArriba - p.socket / 2) * 0.5), 3, rr * Math.cos(t), rr * Math.sin(t), p.alto - 2.4)
        })
      )
      return k.unir(concha, aro)
    },
  },
]

export const modeloPorId = (id: string) => MODELOS.find((m) => m.id === id)
export const valoresIniciales = (m: Modelo3D): Record<string, number> => Object.fromEntries(m.params.map((p) => [p.k, p.def]))

/** Ajusta cada valor a su rango (lo que escriba el cliente puede venir fuera). */
export function limpiarValores(m: Modelo3D, v: Record<string, number>): Record<string, number> {
  return Object.fromEntries(m.params.map((p) => [p.k, lim(Number.isFinite(v[p.k]) ? v[p.k] : p.def, p.min, p.max)]))
}

/** El kit de piezas sobre manifold-3d; guarda todo lo que crea para liberarlo después. */
function hacerKit(w: Wasm, vivos: S[]): Kit {
  const M = w.Manifold
  const v = (s: S) => (vivos.push(s), s)
  const cil = (d: number, h: number, x = 0, y = 0, z0 = 0, lados = 0) => v(v(M.cylinder(h, d / 2, d / 2, lados >= 3 ? lados : SEG, false)).translate([x, y, z0]))
  const bloque = (x: number, y: number, z: number, x0 = 0, y0 = 0, z0 = 0, r = 0) => {
    if (r > 0.3 && r * 2 < Math.min(x, y)) {
      // aristas verticales redondeadas: envolvente de 4 cilindros en las esquinas
      const esquinas = [[r, r], [x - r, r], [r, y - r], [x - r, y - r]].map(([a, b]) => cil(2 * r, z, x0 + a, y0 + b, z0, 24))
      return v(M.hull(esquinas))
    }
    return v(v(M.cube([x, y, z], false)).translate([x0, y0, z0]))
  }
  const cono = (dA: number, dB: number, h: number, x = 0, y = 0, z0 = 0) => v(v(M.cylinder(h, dA / 2, dB / 2, SEG * 2, false)).translate([x, y, z0]))
  const barreno = (d: number, h: number, x = 0, y = 0, z0 = 0) => cil(d, h + 2, x, y, z0 - 1)
  const avellanado = (d: number, cabeza: number, h: number, x: number, y: number) => {
    const fondo = Math.max(0.01, (cabeza - d) / 2)
    return v(barreno(d, h, x, y).add(cono(d, cabeza + 0.2, fondo + 0.1, x, y, h - fondo)))
  }
  const unir = (...s: S[]) => (s.length === 1 ? s[0] : v(M.union(s)))
  const restar = (a: S, ...s: S[]) => (s.length ? v(a.subtract(unir(...s))) : a)
  const mover = (s: S, x: number, y: number, z: number) => v(s.translate([x, y, z]))
  const girar = (s: S, rx: number, ry: number, rz: number) => v(s.rotate([rx, ry, rz]))
  const envolver = (...s: S[]) => v(M.hull(s))
  const extruir = (puntos: [number, number][], h: number, giro = 0, escalaArriba = 1, z0 = 0) =>
    // con giro, copias intermedias cada ~2 mm para que la torsión salga suave
    v(v(M.extrude([puntos], h, giro ? Math.max(8, Math.min(120, Math.round(h / 2))) : 0, giro, [escalaArriba, escalaArriba], false)).translate([0, 0, z0]))
  return { bloque, cil, cono, barreno, avellanado, unir, restar, mover, girar, envolver, extruir }
}

export type MallaModelo = { tris: number[]; medidas: [number, number, number]; cerrado: boolean }

/** Arma el modelo (carga manifold la primera vez) y lo deja apoyado en Z = 0 y centrado en X/Y. */
export async function construirMalla(m: Modelo3D, valores: Record<string, number>, wasm?: Wasm): Promise<MallaModelo> {
  const w = await cargarManifold(wasm)
  const vivos: S[] = []
  try {
    const s = m.construir(limpiarValores(m, valores), hacerKit(w, vivos))
    const caja = s.boundingBox()
    const mesh = s.getMesh()
    const np = mesh.numProp
    const p = mesh.vertProperties as Float32Array
    const t = mesh.triVerts as Uint32Array
    const cx = (caja.min[0] + caja.max[0]) / 2, cy = (caja.min[1] + caja.max[1]) / 2, z0 = caja.min[2]
    const tris: number[] = new Array(t.length * 3)
    for (let i = 0; i < t.length; i++) {
      const o = t[i] * np
      tris[i * 3] = p[o] - cx
      tris[i * 3 + 1] = p[o + 1] - cy
      tris[i * 3 + 2] = p[o + 2] - z0
    }
    return {
      tris,
      medidas: [caja.max[0] - caja.min[0], caja.max[1] - caja.min[1], caja.max[2] - caja.min[2]],
      cerrado: s.status?.() === "NoError" || s.status?.() === undefined || String(s.status?.()?.value ?? s.status?.()) === "0",
    }
  } finally {
    // manifold vive en memoria de WASM: hay que soltar cada sólido
    for (const s of vivos) {
      try {
        s.delete()
      } catch {
        // ya liberado
      }
    }
  }
}
