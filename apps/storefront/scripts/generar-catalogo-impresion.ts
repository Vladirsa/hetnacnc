// Genera docs/impresion-bajo-pedido/catalogo.json desde
// src/lib/impresion/catalogo-disenos.ts: corre el mismo Texturizador de la
// página para cada diseño y guarda el volumen (cm³) y las medidas (mm) de la
// pieza, de donde salen los gramos y el precio recomendado de cada material.
//
// Uso (en apps/storefront):
//   FUENTES_DIR=/ruta/con/@fontsource OPENTYPE_JS=/ruta/opentype.js/dist/opentype.js npx tsx scripts/generar-catalogo-impresion.ts
// FUENTES_DIR tiene una carpeta por tipografía con sus archivos .woff, como en
// el paquete de npm (montserrat/files/montserrat-latin-800-normal.woff).
// Las fotos se toman aparte con el navegador (ver docs/impresion-bajo-pedido/README.md).
import { existsSync, readFileSync, writeFileSync } from "fs"
import { join, resolve } from "path"

import { FUENTES } from "@/lib/generador/fuentes"
import { hacerCortador } from "@/lib/generador/cortadores"
import { hacerRodillo, hacerSoporte, hacerTexturizador } from "@/lib/generador/texturizador"
import { CATALOGO_IMPRESION, urlHerramienta } from "@/lib/impresion/catalogo-disenos"

// La página baja opentype.js del CDN; aquí se usa una copia local (OPENTYPE_JS=ruta a dist/opentype.js)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const opentype = require(process.env.OPENTYPE_JS || "opentype.js")

const DIR = process.env.FUENTES_DIR || ""
const SALIDA = resolve(__dirname, "../../../docs/impresion-bajo-pedido/catalogo.json")

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

const salida = CATALOGO_IMPRESION.map((d) => {
  const o = d.diseno as any
  const f = o.palabras?.length ? fuente(o.fuente || "montserrat") : null
  const comun = { palabras: o.palabras || [], iconos: o.iconos || [], tamano: o.tamano, espacioX: o.espacioX, espacioY: o.espacioY, acomodo: o.acomodo, orilla: o.orilla, relieve: o.relieve, modo: o.modo || "alto", espejo: o.espejo }
  let tris: number[]
  let avisos: string[] = []
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
    return { handle: d.handle, titulo: d.titulo, resumen: d.resumen, pieza: d.pieza, etiquetas: d.etiquetas, herramienta_url: urlHerramienta(d), foto: `fotos/${d.handle}.png`, diseno: d.cortador, volumen_cm3: m.volumen_cm3, medidas_mm: mc.medidas_mm, relleno: 100, con_sello: !!r.sello }
  }
  if (d.pieza === "soporte") {
    const r = hacerRodillo(f, { ...comun, modo: "alto", diametro: o.diametro, largo: o.largo, eje: o.eje })
    tris = hacerSoporte(o.eje, o.largo, Math.ceil(r.diametroTotal + 10)).tris
  } else if (o.forma === "rodillo") {
    const r = hacerRodillo(f, { ...comun, modo: "alto", diametro: o.diametro, largo: o.largo, eje: o.eje })
    if (r.errores.length) throw new Error(`${d.handle}: ${r.errores.join(" ")}`)
    tris = r.malla.tris
    avisos = r.avisos
  } else {
    const r = hacerTexturizador(f, { ...comun, ancho: o.ancho, alto: o.alto, radio: o.radio, grosor: o.grosor })
    if (r.errores.length) throw new Error(`${d.handle}: ${r.errores.join(" ")}`)
    tris = r.malla.tris
    avisos = r.avisos
  }
  const m = medir(tris)
  console.log(`${d.handle}: ${m.volumen_cm3} cm³, ${m.medidas_mm.join(" × ")} mm${avisos.length ? ` — ${avisos.join(" ")}` : ""}`)
  return {
    handle: d.handle,
    titulo: d.titulo,
    resumen: d.resumen,
    pieza: d.pieza,
    etiquetas: d.etiquetas,
    herramienta_url: urlHerramienta(d),
    foto: `fotos/${d.handle}.png`,
    diseno: d.diseno,
    ...m,
  }
})

writeFileSync(SALIDA, JSON.stringify(salida, null, 2) + "\n")
console.log(`\n${salida.length} diseños → ${SALIDA}`)
