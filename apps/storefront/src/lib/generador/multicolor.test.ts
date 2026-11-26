// Pruebas: `FUENTES_DIR=… OPENTYPE_JS=… npx tsx --tsconfig tsconfig.json --test src/lib/generador/multicolor.test.ts`
// (sin las variables se saltan las que usan tipografía)
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"

import { strFromU8, unzipSync } from "fflate"

import { hacerCortador } from "./cortadores"
import { OPCIONES_IMPRESION_FABRICA, hacerLetrasImpresion } from "./letras3dImpresion"
import { OPCIONES_LLAVERO_FABRICA, hacerLlavero } from "./llaveros"
import { archivo3MF, coloresIniciales, coloresPorVertice, partesConColor, zipPorColor } from "./multicolor"
import { hacerRodillo, hacerTexturizador, type OpcionesTexturizador } from "./texturizador"
import { type Malla, conPartes, separarPiezas, volumenMalla } from "./vectores"

const DIR = process.env.FUENTES_DIR || ""
const ruta = join(DIR, "montserrat", "files", "montserrat-latin-800-normal.woff")
const hay = !!DIR && existsSync(ruta) && !!process.env.OPENTYPE_JS
const sinFuente = !hay && "faltan FUENTES_DIR/OPENTYPE_JS"
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fuente = () => { const b = readFileSync(ruta); return require(process.env.OPENTYPE_JS!).parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)) }

type Objeto = { nombre: string; pindex: number; v: number[]; t: number[] }

/** Lee el 3MF de vuelta: objetos con malla, el ensamble y los colores. */
function leer3MF(z: Uint8Array) {
  const f = unzipSync(z)
  for (const k of ["[Content_Types].xml", "_rels/.rels", "3D/3dmodel.model"]) assert.ok(f[k], `falta ${k}`)
  const x = strFromU8(f["3D/3dmodel.model"])
  assert.match(x, /unit="millimeter"/)
  const colores = [...x.matchAll(/<base name="([^"]+)" displaycolor="(#[0-9A-F]{8})"/g)].map((m) => m[2])
  const objetos: Objeto[] = []
  for (const m of x.matchAll(/<object id="\d+" type="model" name="([^"]*)" pid="1" pindex="(\d+)"><mesh>(.*?)<\/mesh><\/object>/g)) {
    const v = [...m[3].matchAll(/<vertex x="([^"]+)" y="([^"]+)" z="([^"]+)"\/>/g)].flatMap((q) => [+q[1], +q[2], +q[3]])
    const t = [...m[3].matchAll(/<triangle v1="(\d+)" v2="(\d+)" v3="(\d+)"\/>/g)].flatMap((q) => [+q[1], +q[2], +q[3]])
    objetos.push({ nombre: m[1], pindex: +m[2], v, t })
  }
  const componentes = (x.match(/<component objectid=/g) || []).length
  const items = (x.match(/<item objectid=/g) || []).length
  return { objetos, colores, componentes, items }
}

const caja = (v: number[]) => {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < v.length; i += 3) for (let j = 0; j < 3; j++) (min[j] = Math.min(min[j], v[i + j])), (max[j] = Math.max(max[j], v[i + j]))
  return { min, max }
}

/** Revisa que el 3MF de la malla sea correcto: cada parte cerrada, con volumen y en su lugar. */
function revisar(m: Malla, partesEsperadas: string[]) {
  assert.deepEqual(m.partes?.map((p) => p.nombre), partesEsperadas)
  assert.equal(m.partes!.reduce((s, p) => s + p.triangulos, 0) * 9, m.tris.length, "las partes cubren toda la malla")
  const pc = partesConColor(m, coloresIniciales(partesEsperadas.length))
  const r = leer3MF(archivo3MF(pc, "prueba"))
  assert.equal(r.objetos.length, partesEsperadas.length)
  assert.equal(r.componentes, partesEsperadas.length)
  assert.equal(r.items, 1, "un solo ensamble en la cama")
  assert.equal(r.colores.length, new Set(pc.map((p) => p.color)).size)
  const todos: number[] = []
  for (const o of r.objetos) {
    const nv = o.v.length / 3
    assert.ok(o.t.every((i) => i >= 0 && i < nv), `${o.nombre}: índices fuera de rango`)
    // cerrada: cada orilla se recorre tantas veces de ida como de vuelta (sin
    // hoyos ni caras volteadas; dos sólidos que se tocan, como el cuerpo y la
    // parte de atrás de una letra para colgar, comparten orillas y también cuentan)
    const orillas = new Map<string, number>()
    for (let i = 0; i < o.t.length; i += 3)
      for (let k = 0; k < 3; k++) {
        const a = o.t[i + k], b = o.t[i + ((k + 1) % 3)]
        assert.notEqual(a, b, `${o.nombre}: triángulo degenerado`)
        const clave = a < b ? `${a},${b}` : `${b},${a}`
        orillas.set(clave, (orillas.get(clave) || 0) + (a < b ? 1 : -1))
      }
    const malas = [...orillas.values()].filter((n) => n !== 0).length
    assert.equal(malas, 0, `${o.nombre}: ${malas} orillas abiertas`)
    const tris = o.t.flatMap((i) => [o.v[i * 3], o.v[i * 3 + 1], o.v[i * 3 + 2]])
    assert.ok(volumenMalla(tris) > 0, `${o.nombre}: volumen positivo`)
    todos.push(...o.v)
  }
  // el ensamble ocupa lo mismo que el STL de una pieza
  const a = caja(todos), b = caja(m.tris)
  for (let j = 0; j < 3; j++) {
    assert.ok(Math.abs(a.min[j] - b.min[j]) < 0.001 && Math.abs(a.max[j] - b.max[j]) < 0.001, "misma caja que el STL")
  }
  // y el ZIP trae un STL por color con todos los triángulos
  const zip = unzipSync(zipPorColor(pc, "prueba"))
  const stls = Object.keys(zip).filter((k) => k.endsWith(".stl"))
  assert.equal(stls.length, new Set(pc.map((p) => p.color)).size)
  assert.equal(stls.reduce((s, k) => s + new DataView(zip[k].buffer, zip[k].byteOffset).getUint32(80, true), 0) * 9, m.tris.length)
  assert.ok(zip["LEEME.txt"])
}

test("conPartes: tramos en orden y sin partes vacías", () => {
  const cubo = (x: number) => {
    const t: number[] = []
    const v = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]].map(([a, b, c]) => [a + x, b, c])
    for (const [p, q, r] of [[0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7]]) t.push(...v[p], ...v[q], ...v[r])
    return t
  }
  const m = conPartes(["A", cubo(0)], ["Vacía", []], ["B", cubo(3)])
  revisar(m, ["A", "B"])
  assert.equal(separarPiezas(m.tris).length, 2)
})

test("coloresPorVertice: un color por triángulo y null si no cuadra", () => {
  const c = coloresPorVertice([{ triangulos: 1, hex: "#ffffff" }, { triangulos: 2, hex: "#000000" }], 3)!
  assert.equal(c.length, 27)
  assert.deepEqual([...c.slice(0, 9)], Array(9).fill(1))
  assert.deepEqual([...c.slice(9)], Array(18).fill(0))
  assert.equal(coloresPorVertice([{ triangulos: 2, hex: "#ffffff" }], 3), null)
  assert.equal(coloresPorVertice(undefined, 3), null)
})

test("llavero: placa, letras e ícono", { skip: sinFuente }, () => {
  const r = hacerLlavero(fuente(), { ...OPCIONES_LLAVERO_FABRICA, texto: "Max", alto: 12, forma: "rect", icono: "corazon" } as any)
  assert.deepEqual(r.errores, [])
  revisar(r.malla, r.malla.partes!.map((p) => p.nombre))
  assert.deepEqual(r.malla.partes!.map((p) => p.nombre).slice(0, 2), ["Placa", "Letras"])
})

test("letras 3D: de pie, para colgar y para LED", { skip: sinFuente }, () => {
  const f = fuente()
  const base = { ...OPCIONES_IMPRESION_FABRICA, texto: "HOLA", alto: 50, profundidad: 15 }
  const nombres = { pie: ["Letras", "Base"], pared: ["Frente", "Cuerpo"], luz: ["Frente", "Paredes"] } as const
  for (const estilo of ["pie", "pared", "luz"] as const) {
    const r = hacerLetrasImpresion(f, { ...base, estilo, alto: estilo === "luz" ? 80 : 50 })
    assert.deepEqual(r.errores, [])
    revisar(r.malla, [...nombres[estilo]])
    // la vista de frente conserva el orden: los mismos tramos sirven para pintar
    assert.equal(r.trisVista.length, r.tris.length)
  }
})

const textura: OpcionesTexturizador = {
  palabras: [], iconos: ["corazon"] as any, ancho: 60, alto: 40, radio: 4, tamano: 10, espacioX: 4, espacioY: 4,
  acomodo: "cuadricula", orilla: 3, grosor: 3, relieve: 1.5, modo: "alto", espejo: false,
}

test("texturizador: placa y rodillo con su relieve aparte", () => {
  const p = hacerTexturizador(null, textura)
  assert.deepEqual(p.errores, [])
  revisar(p.malla, ["Base", "Relieve"])
  const bajo = hacerTexturizador(null, { ...textura, modo: "bajo" })
  assert.deepEqual(bajo.malla.partes!.map((x) => x.nombre)[0], "Base")
  const r = hacerRodillo(null, { ...textura, diametro: 40, largo: 50, eje: 8 })
  assert.deepEqual(r.errores, [])
  revisar(r.malla, ["Rodillo", "Relieve"])
  // con este diámetro el círculo deja triángulos que al juntar vértices quedan sin área
  const c = hacerRodillo(null, { ...textura, iconos: ["circulo"] as any, diametro: 37.3, largo: 50, eje: 8 })
  revisar(c.malla, ["Rodillo", "Relieve"])
})

test("3MF: el título con caracteres de control sigue siendo XML válido", () => {
  const m = conPartes(["A", [0, 0, 0, 1, 0, 0, 0, 1, 0]], ["B", [0, 0, 1, 1, 0, 1, 0, 1, 1]])
  const x = strFromU8(unzipSync(archivo3MF(partesConColor(m, ["negro", "rojo"]), "Hola\u0001 <&> \"x\""))["3D/3dmodel.model"])
  assert.ok(!/[\u0000-\u0008]/.test(x))
  assert.match(x, /Hola &lt;&amp;&gt; &quot;x&quot;/)
})

test("cortador: el sello sale en placa y dibujo", () => {
  const r = hacerCortador({ tipo: "clasica", forma: "redondo" }, null, {
    tamano: 60, altura: 14, pared: 1.2, ceja: 4, grosorCeja: 2, sello: { tipo: "icono", icono: "corazon" as any }, relieveSello: 1.5,
  })
  assert.deepEqual(r.errores, [])
  revisar(r.sello!, ["Placa del sello", "Dibujo del sello"])
})
