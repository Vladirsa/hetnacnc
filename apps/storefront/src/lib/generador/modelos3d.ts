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
  mover: (s: S, x: number, y: number, z: number) => S
  girar: (s: S, rx: number, ry: number, rz: number) => S
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
  return { bloque, cil, cono, barreno, avellanado, unir, restar, mover, girar }
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
