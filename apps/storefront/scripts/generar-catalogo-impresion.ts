// Genera docs/impresion-bajo-pedido/catalogo.json desde
// src/lib/impresion/catalogo-disenos.ts: corre el mismo Texturizador de la
// página para cada diseño y guarda el volumen (cm³) y las medidas (mm) de la
// pieza, de donde salen los gramos y el precio recomendado de cada material.
//
// Uso (en apps/storefront):
//   FUENTES_DIR=/ruta/con/@fontsource OPENTYPE_JS=/ruta/opentype.js/dist/opentype.js MESHOPT_JS=/ruta/node_modules/meshoptimizer npx tsx scripts/generar-catalogo-impresion.ts
// FUENTES_DIR tiene una carpeta por tipografía con sus archivos .woff, como en
// el paquete de npm (montserrat/files/montserrat-latin-800-normal.woff).
// Este script también dibuja la foto de cada pieza (vista isométrica, fondo
// blanco) en docs/impresion-bajo-pedido/fotos y guarda su STL simplificado
// (la vista 3D de la ficha) en docs/impresion-bajo-pedido/modelos.
//
// SOLO_MODELOS=1: rehace sólo las piezas de Modelos 3D y deja como están en
// catalogo.json los rodillos y placas (no hacen falta las tipografías).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs"
import { join, resolve } from "path"
import sharp from "sharp"

import { FUENTES } from "@/lib/generador/fuentes"
import { indexar, mallaSTL, separarPiezas } from "@/lib/generador/vectores"
import { hacerCortador } from "@/lib/generador/cortadores"
import { OPCIONES_LLAVERO_FABRICA, hacerLlavero } from "@/lib/generador/llaveros"
import { OPCIONES_IMPRESION_FABRICA, hacerLetrasImpresion, pararMalla } from "@/lib/generador/letras3dImpresion"
import { hacerRodillo, hacerSoporte, hacerTexturizador } from "@/lib/generador/texturizador"
import { CATALOGO_IMPRESION, urlHerramienta, type DisenoCatalogo } from "@/lib/impresion/catalogo-disenos"
import { construirMalla, limpiarValores, modeloPorId, valoresIniciales } from "@/lib/generador/modelos3d"

// La página baja opentype.js del CDN; aquí se usa una copia local (OPENTYPE_JS=ruta a dist/opentype.js)
// Se carga hasta que hace falta: con SOLO_MODELOS no se necesita
let opentypeCargado: any = null
const opentype = {
  parse: (b: ArrayBuffer) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    opentypeCargado ??= require(process.env.OPENTYPE_JS || "opentype.js")
    return opentypeCargado.parse(b)
  },
}

const DIR = process.env.FUENTES_DIR || ""
const SALIDA = resolve(__dirname, "../../../docs/impresion-bajo-pedido/catalogo.json")
const FOTOS = resolve(__dirname, "../../../docs/impresion-bajo-pedido/fotos")
const MODELOS = resolve(__dirname, "../../../docs/impresion-bajo-pedido/modelos")
const SOLO_MODELOS = process.env.SOLO_MODELOS === "1"

/**
 * Foto de una pieza: vista isométrica con sombreado plano y
 * búfer de profundidad, dibujada al doble y reducida (bordes suaves).
 */
async function fotoPieza(t: number[], tramos: Tramo[], lado = 1000) {
  // color de cada triángulo según su tramo (guardarVista ya revisó que cuadren)
  const colorTri: number[][] = []
  for (const tr of tramos) for (let j = 0; j < tr.triangulos; j++) colorTri.push(tr.rgb)
  const S = lado * 2
  const a = Math.PI / 4, b = Math.atan(1 / Math.SQRT2)
  const giro = (x: number, y: number, z: number): [number, number, number] => {
    const x1 = x * Math.cos(a) - y * Math.sin(a), y1 = x * Math.sin(a) + y * Math.cos(a)
    return [x1, y1 * Math.sin(b) + z * Math.cos(b), y1 * Math.cos(b) - z * Math.sin(b)]
  }
  const pts: [number, number, number][] = []
  for (let i = 0; i < t.length; i += 3) pts.push(giro(t[i], t[i + 1], t[i + 2]))
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]) }
  const k = (S * 0.8) / Math.max(x1 - x0, y1 - y0)
  const ox = (S - (x1 - x0) * k) / 2, oy = (S - (y1 - y0) * k) / 2
  const px = (p: [number, number, number]) => [ox + (p[0] - x0) * k, S - oy - (p[1] - y0) * k, p[2]]
  const img = Buffer.alloc(S * S * 3)
  img.fill(255) // fondo blanco, como piden las fotos de la tienda (utils/fondo-blanco.ts en el API)
  const prof = new Float32Array(S * S).fill(Infinity)
  const luz = [-0.4, 0.5, 0.75], nl = Math.hypot(...luz)
  for (let i = 0; i < t.length; i += 9) {
    const ux = t[i + 3] - t[i], uy = t[i + 4] - t[i + 1], uz = t[i + 5] - t[i + 2]
    const vx = t[i + 6] - t[i], vy = t[i + 7] - t[i + 1], vz = t[i + 8] - t[i + 2]
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
    const ln = Math.hypot(nx, ny, nz) || 1
    nx /= ln; ny /= ln; nz /= ln
    const c = 0.42 + 0.58 * Math.max(0, (nx * luz[0] + ny * luz[1] + nz * luz[2]) / nl)
    const rgb = colorTri[i / 9].map((v) => Math.round(Math.min(255, v * c + 25 * c)))
    const [A, B, C] = [px(pts[i / 3]), px(pts[i / 3 + 1]), px(pts[i / 3 + 2])]
    const d = (B[1] - C[1]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[1] - C[1])
    if (Math.abs(d) < 1e-9) continue
    const xa = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0]))), xb = Math.min(S - 1, Math.ceil(Math.max(A[0], B[0], C[0])))
    const ya = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1]))), yb = Math.min(S - 1, Math.ceil(Math.max(A[1], B[1], C[1])))
    for (let y = ya; y <= yb; y++)
      for (let x = xa; x <= xb; x++) {
        const l1 = ((B[1] - C[1]) * (x + 0.5 - C[0]) + (C[0] - B[0]) * (y + 0.5 - C[1])) / d
        const l2 = ((C[1] - A[1]) * (x + 0.5 - C[0]) + (A[0] - C[0]) * (y + 0.5 - C[1])) / d
        if (l1 < -1e-6 || l2 < -1e-6 || 1 - l1 - l2 < -1e-6) continue
        const z = l1 * A[2] + l2 * B[2] + (1 - l1 - l2) * C[2]
        const o = y * S + x
        if (z >= prof[o]) continue
        prof[o] = z
        img.set(rgb, o * 3)
      }
  }
  return sharp(img, { raw: { width: S, height: S, channels: 3 } }).resize(lado, lado).png({ compressionLevel: 9 }).toBuffer()
}

/** Recorre `t` para que quede a la derecha de `ref`, con 10 mm de espacio. */
function aLaDerecha(t: number[], ref: number[]) {
  let maxRef = -Infinity, minT = Infinity
  for (let i = 0; i < ref.length; i += 3) maxRef = Math.max(maxRef, ref[i])
  for (let i = 0; i < t.length; i += 3) minT = Math.min(minT, t[i])
  const dx = maxRef + 10 - minT
  return t.map((v, i) => (i % 3 === 0 ? v + dx : v))
}

// ── Colores de las fotos ─────────────────────────────────────────────────
// Cada pieza sale a dos colores (base y detalle) para que el catálogo se vea
// vivo; las de una sola pieza, de un color que cambia de una a otra. Son colores
// de ejemplo pensados para este dibujo (sombreado plano sobre fondo blanco): el
// negro va gris oscuro y el blanco un poco crema para que no se pierdan.
type Tramo = { triangulos: number; rgb: number[] }
const NARANJA = [235, 100, 20], ROJO = [212, 42, 42], AZUL = [31, 95, 209], VERDE = [31, 150, 76], AMARILLO = [245, 190, 0]
const MORADO = [122, 63, 196], ROSA = [236, 110, 165], TURQUESA = [16, 150, 160], BLANCO = [228, 225, 216], NEGRO = [58, 62, 72]
const PAREJAS: [number[], number[]][] = [
  [AZUL, BLANCO], [ROJO, BLANCO], [NEGRO, AMARILLO], [MORADO, BLANCO], [VERDE, BLANCO],
  [NEGRO, NARANJA], [ROSA, BLANCO], [TURQUESA, BLANCO], [BLANCO, ROJO], [AMARILLO, NEGRO],
]
const SOLOS = [NARANJA, AZUL, ROJO, VERDE, MORADO, TURQUESA, AMARILLO, ROSA]
/** Número fijo de cada pieza, sacado de su handle: agregar o mover diseños no le cambia el color a las demás. */
const numeroDe = (handle: string) => [...handle].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
const hex = (rgb: number[]) => `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`
/** Tramos de color: la primera parte de un color y las demás de otro (o una sola parte, de un color). */
function tramosDe(handle: string, partes: { triangulos: number }[]): Tramo[] {
  const n = numeroDe(handle)
  if (partes.length < 2) return [{ triangulos: partes[0]?.triangulos || 0, rgb: SOLOS[n % SOLOS.length] }]
  const [base, detalle] = PAREJAS[n % PAREJAS.length]
  return partes.map((p, i) => ({ triangulos: p.triangulos, rgb: i === 0 ? base : detalle }))
}
const unaParte = (tris: number[]) => [{ triangulos: tris.length / 9 }]

// Las dos partes que el cliente puede pedir de distinto color (venta "2 colores",
// metadata.grupos_color del producto); van en el orden de los colores de la foto.
// El ícono del llavero va con las letras.
const GRUPOS_LETRAS: Record<string, [string, string]> = { pie: ["Letras", "Base"], pared: ["Frente", "Cuerpo"], luz: ["Frente", "Paredes"] }

// El STL de la vista 3D va simplificado (máx. TRIS_VISTA triángulos, ~1 MB)
// para que cargue rápido en celular; la foto usa la malla completa. Simplifica
// con meshoptimizer de npm: MESHOPT_JS=/ruta/node_modules/meshoptimizer.
const TRIS_VISTA = 20000
let simplificador: any = null
async function simplificar(t: number[], meta = TRIS_VISTA): Promise<number[]> {
  if (t.length / 9 <= meta) return t
  if (!process.env.MESHOPT_JS) throw new Error("Falta MESHOPT_JS (ruta a node_modules/meshoptimizer) para simplificar las vistas 3D")
  if (!simplificador) {
    const { pathToFileURL } = await import("url")
    simplificador = (await import(pathToFileURL(join(process.env.MESHOPT_JS, "meshopt_simplifier.js")).href)).MeshoptSimplifier
    await simplificador.ready
  }
  const { pos, ind } = indexar(t)
  const [salida] = simplificador.simplify(ind, new Float32Array(pos), 3, meta * 3, 0.01, [])
  const r: number[] = []
  for (const j of salida) r.push(pos[j * 3], pos[j * 3 + 1], pos[j * 3 + 2])
  return r
}

/**
 * Escribe la foto (fondo blanco, a colores) y el STL de la pieza; regresa la
 * ruta del STL y sus tramos de color (vista_colores) para el JSON. Cada tramo
 * se simplifica por su lado para que los colores sigan cuadrando con el STL.
 */
async function guardarVista(handle: string, tris: number[], tramos: Tramo[]) {
  // los tramos tienen que cubrir la malla exacta: si no, la foto y la vista 3D no coincidirían
  const suma = tramos.reduce((s, tr) => s + tr.triangulos, 0)
  if (suma * 9 !== tris.length) throw new Error(`${handle}: los colores cubren ${suma} triángulos y la pieza tiene ${tris.length / 9}`)
  writeFileSync(join(FOTOS, `${handle}.png`), await fotoPieza(tris, tramos))
  const total = tris.length / 9
  const vista: number[][] = []
  let desde = 0
  for (const tr of tramos) {
    const parte = tris.slice(desde * 9, (desde + tr.triangulos) * 9)
    desde += tr.triangulos
    // el presupuesto de triángulos se reparte según el tamaño de cada parte
    vista.push(total <= TRIS_VISTA ? parte : await simplificar(parte, Math.max(200, Math.round((TRIS_VISTA * tr.triangulos) / total))))
  }
  const final = ([] as number[]).concat(...vista)
  writeFileSync(join(MODELOS, `${handle}.stl`), Buffer.from(mallaSTL({ tris: final, avisos: [] })))
  return { modelo_3d: `modelos/${handle}.stl`, vista_colores: tramos.map((tr, i) => ({ triangulos: vista[i].length / 9, hex: hex(tr.rgb) })) }
}

let wasm: any = null
async function mallaModelo(d: DisenoCatalogo) {
  const m = modeloPorId(d.modelo || "")
  if (!m) throw new Error(`${d.handle}: no existe el modelo ${d.modelo}`)
  if (!wasm) {
    const { default: Module } = await import("manifold-3d")
    wasm = await Module({ locateFile: () => resolve(__dirname, "../node_modules/manifold-3d/manifold.wasm") })
    wasm.setup()
  }
  const pedidos = { ...valoresIniciales(m), ...(d.valores || {}) }
  const limpios = limpiarValores(m, pedidos)
  for (const [k, v] of Object.entries(d.valores || {}))
    if (limpios[k] !== v) throw new Error(`${d.handle}: la medida ${k}=${v} no existe en ${m.id} o está fuera de rango`)
  const malla = await construirMalla(m, limpios, wasm)
  if (!malla.cerrado) throw new Error(`${d.handle}: la malla no salió cerrada`)
  return malla.tris
}

const previos: any[] = SOLO_MODELOS && existsSync(SALIDA) ? JSON.parse(readFileSync(SALIDA, "utf8")) : []

function fuente(id: string) {
  const t = FUENTES.find((f) => f.id === id)
  if (!t) throw new Error(`No existe la tipografía ${id}`)
  const ruta = join(DIR, t.id, "files", `${t.id}-latin-${t.peso}-normal.woff`)
  if (!existsSync(ruta)) throw new Error(`Falta ${ruta} (FUENTES_DIR)`)
  const b = readFileSync(ruta)
  return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))
}

/** Volumen (cm³) y caja (mm) de una malla cerrada. */
function medir(t: number[]) {
  let v = 0
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < t.length; i += 9) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = t.slice(i, i + 9)
    v += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6
    for (let k = 0; k < 9; k++) {
      const j = k % 3
      if (t[i + k] < min[j]) min[j] = t[i + k]
      if (t[i + k] > max[j]) max[j] = t[i + k]
    }
  }
  const r1 = (n: number) => Math.round(n * 10) / 10
  return { volumen_cm3: r1(Math.abs(v) / 1000), medidas_mm: [0, 1, 2].map((j) => r1(max[j] - min[j])) as [number, number, number] }
}

async function generar() {
// sin meshoptimizer los rodillos fallarían a media corrida, con fotos ya reescritas
if (!SOLO_MODELOS && !process.env.MESHOPT_JS) throw new Error("Falta MESHOPT_JS (ruta a node_modules/meshoptimizer) para simplificar las vistas 3D")
for (const dir of [FOTOS, MODELOS]) mkdirSync(dir, { recursive: true })
const salida: any[] = []
for (const d of CATALOGO_IMPRESION) {
  if (d.pieza === "modelo") {
    const tris = await mallaModelo(d)
    // volumen de todo lo que se imprime; medidas de la pieza más grande (la
    // maceta sin su plato, la caja sin su tapa), no de todo acomodado en la cama
    const m = medir(tris)
    // de la más grande a la más chica (la maceta y luego su plato)
    const partes = separarPiezas(tris)
      .map((t) => ({ t, v: medir(t).volumen_cm3 }))
      .sort((a, b) => b.v - a.v)
      .map((x) => x.t)
    const mayor = medir(partes[0])
    // cada cuerpo suelto (la maceta y su plato) de un color; hasta 8
    const cuerpos = partes.length >= 2 && partes.length <= 8 ? partes : [tris]
    const vista = await guardarVista(d.handle, ([] as number[]).concat(...cuerpos), tramosDe(d.handle, cuerpos.map((c) => ({ triangulos: c.length / 9 }))))
    console.log(`${d.handle}: ${m.volumen_cm3} cm³, ${partes.length} pieza(s), la mayor ${mayor.medidas_mm.join(" × ")} mm (foto lista)`)
    salida.push({ handle: d.handle, titulo: d.titulo, resumen: d.resumen, pieza: d.pieza, etiquetas: d.etiquetas, herramienta_url: urlHerramienta(d), foto: `fotos/${d.handle}.png`, ...vista, modelo: d.modelo, valores: d.valores || {}, volumen_cm3: m.volumen_cm3, medidas_mm: mayor.medidas_mm, piezas: partes.length, ...(partes.length === 2 ? { grupos_color: ["Pieza grande", "Pieza chica"] } : {}) })
    continue
  }
  if (SOLO_MODELOS) {
    const previo = previos.find((x) => x.handle === d.handle)
    if (!previo) throw new Error(`${d.handle} no está en catalogo.json: corre sin SOLO_MODELOS (con FUENTES_DIR)`)
    salida.push(previo)
    continue
  }
  const o = (d.diseno || {}) as any
  const f = o.palabras?.length ? fuente(o.fuente || "montserrat") : null
  const comun = { palabras: o.palabras || [], iconos: o.iconos || [], tamano: o.tamano, espacioX: o.espacioX, espacioY: o.espacioY, acomodo: o.acomodo, orilla: o.orilla, relieve: o.relieve, modo: o.modo || "alto", espejo: o.espejo }
  let tris: number[]
  let partesTex: { triangulos: number }[] | undefined
  let avisos: string[] = []
  if (d.pieza === "letras" && d.letras) {
    const l = d.letras
    const r = hacerLetrasImpresion(fuente(l.fuente), { ...OPCIONES_IMPRESION_FABRICA, texto: l.texto, alto: l.alto, profundidad: l.profundidad, estilo: l.estilo })
    if (r.errores.length) throw new Error(`${d.handle}: ${r.errores.join(" ")}`)
    // Foto y vista 3D paradas y de frente (las de pie ya lo están)
    const t = l.estilo === "pie" ? r.trisVista : pararMalla(r.trisVista) // (conservan el orden de las partes)
    const m = medir(t)
    console.log(`${d.handle}: ${m.volumen_cm3} cm³, ${m.medidas_mm.join(" × ")} mm${r.avisos.length ? ` — ${r.avisos.join(" ")}` : ""}`)
    salida.push({ handle: d.handle, titulo: d.titulo, resumen: d.resumen, pieza: d.pieza, etiquetas: d.etiquetas, herramienta_url: urlHerramienta(d), foto: `fotos/${d.handle}.png`, ...(await guardarVista(d.handle, t, tramosDe(d.handle, r.malla.partes!))), diseno: l, ...m, personalizable: true, max_texto: l.maxTexto, grupos_color: GRUPOS_LETRAS[l.estilo] })
    continue
  }
  if (d.pieza === "llavero" && d.llavero) {
    const l = d.llavero
    const r = hacerLlavero(fuente(l.fuente), { ...OPCIONES_LLAVERO_FABRICA, texto: l.texto, alto: l.alto, forma: l.forma, icono: l.icono, escalaRenglones: l.escala })
    if (r.errores.length) throw new Error(`${d.handle}: ${r.errores.join(" ")}`)
    const m = medir(r.malla.tris)
    console.log(`${d.handle}: ${m.volumen_cm3} cm³, ${m.medidas_mm.join(" × ")} mm`)
    salida.push({ handle: d.handle, titulo: d.titulo, resumen: d.resumen, pieza: d.pieza, etiquetas: d.etiquetas, herramienta_url: urlHerramienta(d), foto: `fotos/${d.handle}.png`, ...(await guardarVista(d.handle, r.malla.tris, tramosDe(d.handle, r.malla.partes!))), diseno: l, ...m, personalizable: true, max_texto: l.maxTexto, grupos_color: ["Placa", "Letras"] })
    continue
  }
  if (d.pieza === "cortador" && d.cortador) {
    const c = d.cortador
    const fs = c.sello?.tipo === "texto" ? fuente(c.sello.fuente) : null
    const r = hacerCortador(c.forma, fs, {
      tamano: c.tamano, altura: 14, pared: 1.2, ceja: 4, grosorCeja: 2,
      sello: c.sello?.tipo === "texto" ? { tipo: "texto", texto: c.sello.texto } : c.sello?.tipo === "icono" ? { tipo: "icono", icono: c.sello.icono } : { tipo: "ninguno" },
      relieveSello: 1.5,
    })
    if (r.errores.length) throw new Error(`${d.handle}: ${r.errores.join(" ")}`)
    // el volumen es de las dos piezas (cortador + sello), la medida es la del cortador
    const m = medir([...r.cortador.tris, ...(r.sello?.tris || [])])
    const mc = medir(r.cortador.tris)
    console.log(`${d.handle}: ${m.volumen_cm3} cm³, cortador ${mc.medidas_mm.join(" × ")} mm${r.sello ? " + sello" : ""}${r.avisos.length ? ` — ${r.avisos.join(" ")}` : ""}`)
    // cortador y sello lado a lado (en el archivo el sello va dentro del cortador)
    // el cortador de un color; el sello con su placa clara y el dibujo del color del cortador
    const [color] = tramosDe(d.handle, unaParte(r.cortador.tris))
    const tramosSello = (r.sello?.partes || []).map((p) => ({ triangulos: p.triangulos, rgb: p.nombre === "Placa del sello" ? BLANCO : color.rgb }))
    const vista = await guardarVista(d.handle, [...r.cortador.tris, ...(r.sello ? aLaDerecha(r.sello.tris, r.cortador.tris) : [])], [color, ...tramosSello])
    salida.push({ handle: d.handle, titulo: d.titulo, resumen: d.resumen, pieza: d.pieza, etiquetas: d.etiquetas, herramienta_url: urlHerramienta(d), foto: `fotos/${d.handle}.png`, ...vista, diseno: d.cortador, volumen_cm3: m.volumen_cm3, medidas_mm: mc.medidas_mm, relleno: 100, con_sello: !!r.sello, ...(r.sello ? { grupos_color: ["Cortador y placa del sello", "Dibujo del sello"] } : {}) })
    continue
  }
  if (d.pieza === "soporte") {
    const r = hacerRodillo(f, { ...comun, modo: "alto", diametro: o.diametro, largo: o.largo, eje: o.eje })
    tris = hacerSoporte(o.eje, o.largo, Math.ceil(r.diametroTotal + 10)).tris
  } else if (o.forma === "rodillo") {
    const r = hacerRodillo(f, { ...comun, modo: "alto", diametro: o.diametro, largo: o.largo, eje: o.eje })
    if (r.errores.length) throw new Error(`${d.handle}: ${r.errores.join(" ")}`)
    tris = r.malla.tris
    partesTex = r.malla.partes
    avisos = r.avisos
  } else {
    const r = hacerTexturizador(f, { ...comun, ancho: o.ancho, alto: o.alto, radio: o.radio, grosor: o.grosor })
    if (r.errores.length) throw new Error(`${d.handle}: ${r.errores.join(" ")}`)
    tris = r.malla.tris
    partesTex = r.malla.partes
    avisos = r.avisos
  }
  const m = medir(tris)
  console.log(`${d.handle}: ${m.volumen_cm3} cm³, ${m.medidas_mm.join(" × ")} mm${avisos.length ? ` — ${avisos.join(" ")}` : ""}`)
  salida.push({
    handle: d.handle,
    titulo: d.titulo,
    resumen: d.resumen,
    pieza: d.pieza,
    etiquetas: d.etiquetas,
    herramienta_url: urlHerramienta(d),
    foto: `fotos/${d.handle}.png`,
    ...(await guardarVista(d.handle, tris, tramosDe(d.handle, partesTex || unaParte(tris)))),
    diseno: d.diseno,
    ...m,
    ...(partesTex && partesTex.length >= 2 ? { grupos_color: [o.forma === "rodillo" ? "Rodillo" : "Base", "Relieve"] } : {}),
  })
}
writeFileSync(SALIDA, JSON.stringify(salida, null, 2) + "\n")
console.log(`\n${salida.length} diseños → ${SALIDA}`)
}

generar().catch((e) => {
  console.error(e)
  process.exit(1)
})
