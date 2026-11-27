// Pruebas: `FUENTES_DIR=… OPENTYPE_JS=… npx tsx --tsconfig tsconfig.json --test src/lib/generador/letreros2d.test.ts`
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"

import { hacerIncrustacion, hacerPlacaRedonda, OPCIONES_INCRUSTACION, OPCIONES_PLACA_REDONDA, textoAForma } from "./letreros2d"

const DIR = process.env.FUENTES_DIR || ""
const ruta = join(DIR, "montserrat", "files", "montserrat-latin-800-normal.woff")
const hay = !!DIR && existsSync(ruta) && !!process.env.OPENTYPE_JS
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fuente = () => { const b = readFileSync(ruta); return require(process.env.OPENTYPE_JS!).parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)) }

const dentroDe = (trazos: { pts: number[][] }[], w: number, h: number) => trazos.every((t) => t.pts.every(([x, y]) => x >= -1e-6 && y >= -1e-6 && x <= w + 1e-6 && y <= h + 1e-6))

test("placa redonda: todo dentro del círculo y sin avisos con textos cortos", { skip: !hay && "faltan FUENTES_DIR/OPENTYPE_JS" }, () => {
  const r = hacerPlacaRedonda(fuente(), OPCIONES_PLACA_REDONDA)
  assert.deepEqual(r.errores, [])
  assert.ok(r.avisos.every((a) => /Achicamos/.test(a)))
  assert.ok(dentroDe(r.dibujo.trazos, 300, 300))
  const R = 150
  for (const t of r.dibujo.trazos) for (const [x, y] of t.pts) assert.ok(Math.hypot(x - R, y - R) <= R + 1e-6)
  assert.equal(r.dibujo.trazos.filter((t) => t.capa === "corte").length, 1)
  const larga = hacerPlacaRedonda(fuente(), { ...OPCIONES_PLACA_REDONDA, arriba: "TALLER DE CARPINTERÍA Y HERRERÍA FINA" })
  assert.match(larga.avisos.join(" "), /media vuelta|Achicamos/)
})

test("incrustación: el macho cabe en la hembra con la holgura", { skip: !hay && "faltan FUENTES_DIR/OPENTYPE_JS" }, () => {
  const forma = textoAForma(fuente(), "HETNA", 40)
  const r = hacerIncrustacion(forma, OPCIONES_INCRUSTACION)
  assert.deepEqual(r.errores, [])
  const hembra = r.dibujo.trazos.filter((t) => t.capa === "grabado"), macho = r.dibujo.trazos.filter((t) => t.capa === "corte")
  assert.ok(hembra.length && macho.length)
  const ancho = (ts: typeof hembra) => Math.max(...ts.flatMap((t) => t.pts.map((p) => p[0]))) - Math.min(...ts.flatMap((t) => t.pts.map((p) => p[0])))
  // el macho mide la holgura menos que la hembra
  assert.ok(Math.abs(ancho(hembra) - ancho(macho) - 2 * OPCIONES_INCRUSTACION.holgura) < 0.05, "hueco de la holgura en cada lado")
  assert.match(hacerIncrustacion([], OPCIONES_INCRUSTACION).errores[0], /contornos cerrados/)
})
