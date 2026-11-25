// Revisión de geometría de un plano HETNA, la misma para los 50 planos del
// código (prueba) y para los que propone el agente o se importan a mano
// (POST /mx/planos/validar, packages/api/src/lib/planos-biblioteca.ts).
//
// Errores (el plano no se acepta):
//   - piezas encimadas, piezas que no tocan a ninguna otra, o un mueble que
//     queda en dos o más partes sueltas (los cajones sí van sueltos);
//   - una pieza cuyo grosor no es el de su material;
//   - piezas que no caben en una hoja de 2440 × 1220;
//   - piezas que ningún paso de armado nombra;
//   - medidas generales o número de piezas fuera de rango.
import { acomodoPorMaterial, listaCorte, medidas } from "./calculo"
import { MATERIALES_PLANO, type PiezaPlano, type Plano } from "./modelos"

export type Revision = { ok: boolean; errores: string[]; avisos: string[]; resumen: { piezas: number; ancho: number; fondo: number; alto: number; hojas: number } }

const TOL = 0.6 // mm
const solapa = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0)

/** Se tocan: comparten un pedazo de cara (se solapan en dos ejes y en el tercero se juntan o se solapan). */
function seTocan(a: PiezaPlano, b: PiezaPlano) {
  const s = [solapa(a.x0, a.x1, b.x0, b.x1), solapa(a.y0, a.y1, b.y0, b.y1), solapa(a.z0, a.z1, b.z0, b.z1)]
  const positivos = s.filter((v) => v > TOL).length
  const juntos = s.filter((v) => v >= -TOL).length
  return juntos === 3 && positivos >= 2
}
const encimadas = (a: PiezaPlano, b: PiezaPlano) =>
  solapa(a.x0, a.x1, b.x0, b.x1) > TOL && solapa(a.y0, a.y1, b.y0, b.y1) > TOL && solapa(a.z0, a.z1, b.z0, b.z1) > TOL

export function validarPlano(pl: Plano): Revision {
  const errores: string[] = []
  const avisos: string[] = []
  const P = pl.piezas || []
  const rango = (k: "x" | "y" | "z") => (P.length ? Math.max(...P.map((q) => q[`${k}1`])) - Math.min(...P.map((q) => q[`${k}0`])) : 0)
  const resumen = { piezas: P.length, ancho: Math.round(rango("x")), fondo: Math.round(rango("y")), alto: Math.round(rango("z") + (pl.ruedas ?? 0)), hojas: 0 }

  if (P.length < 2 || P.length > 80) errores.push(`El plano lleva ${P.length} piezas (van de 2 a 80).`)
  for (const [k, v] of Object.entries({ ancho: resumen.ancho, fondo: resumen.fondo, alto: resumen.alto })) {
    if (v < 50 || v > 2500) errores.push(`El ${k} general (${v} mm) está fuera de rango (50 a 2500 mm).`)
  }

  // grosor = el del material
  for (const q of P) {
    const g = MATERIALES_PLANO[q.material]?.grosor
    if (!g) {
      errores.push(`«${q.nombre}»: material desconocido.`)
      continue
    }
    const m = medidas(q)
    if (Math.abs(m.grosor - g) > TOL) errores.push(`«${q.nombre}»: su grosor es ${m.grosor} mm pero el material es de ${g} mm.`)
  }

  // encimadas
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) if (encimadas(P[i], P[j])) errores.push(`«${P[i].nombre}» y «${P[j].nombre}» se enciman.`)

  // conexión: cada pieza toca a otra y todo el mueble es una sola pieza armada
  if (P.length > 1) {
    const vecinos = P.map((a, i) => P.map((b, j) => (i !== j && seTocan(a, b) ? j : -1)).filter((j) => j >= 0))
    vecinos.forEach((v, i) => {
      if (!v.length) errores.push(`«${P[i].nombre}» no toca a ninguna otra pieza.`)
    })
    // partes sueltas: sólo se permiten cajones (se deslizan dentro del casco)
    const cajon = (q: PiezaPlano) => /caj[oó]n/i.test(q.nombre)
    const visto = new Set<number>()
    const partes: number[][] = []
    for (let i = 0; i < P.length; i++) {
      if (visto.has(i)) continue
      const parte = [i]
      visto.add(i)
      for (let k = 0; k < parte.length; k++) for (const j of vecinos[parte[k]]) if (!visto.has(j)) (visto.add(j), parte.push(j))
      partes.push(parte)
    }
    const sueltas = partes.filter((pt) => !pt.every((i) => cajon(P[i])))
    if (sueltas.length > 1 && vecinos.every((v) => v.length)) errores.push("El mueble queda en dos o más partes que no se tocan entre sí.")
  }

  // apoyo: la pieza más baja empieza en el piso (o arriba de las ruedas)
  const piso = Math.min(...P.map((q) => q.z0))
  if (P.length && Math.abs(piso - (pl.ruedas ?? 0)) > TOL && Math.abs(piso) > TOL) avisos.push(`La pieza más baja empieza a ${piso} mm del piso.`)

  // pasos: cada pieza la nombra algún paso
  const sinPaso = P.filter((q) => !(pl.pasos || []).some((s) => s.piezas.some((n) => n && q.nombre.startsWith(n))))
  if (sinPaso.length) errores.push(`Ningún paso de armado nombra: ${sinPaso.map((q) => `«${q.nombre}»`).slice(0, 6).join(", ")}.`)
  const vacios = (pl.pasos || []).filter((s) => !P.some((q) => s.piezas.some((n) => n && q.nombre.startsWith(n))))
  if (vacios.length) avisos.push(`Pasos sin piezas: ${vacios.map((s) => `«${s.titulo}»`).join(", ")}.`)

  // caben en la hoja
  if (!errores.length) {
    const acs = acomodoPorMaterial(listaCorte(pl).filas)
    const noCaben = acs.flatMap((a) => a.acomodo.noCaben)
    if (noCaben.length) errores.push(`No caben en una hoja de 2440 × 1220: ${noCaben.slice(0, 4).join(", ")}.`)
    resumen.hojas = acs.reduce((s, a) => s + a.acomodo.hojas.length, 0)
    if (resumen.hojas > 8) avisos.push(`Usa ${resumen.hojas} hojas: revisa que no sea un error de medidas.`)
  }

  return { ok: errores.length === 0, errores, avisos, resumen }
}
