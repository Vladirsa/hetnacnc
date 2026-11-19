// STEP en el convertidor de archivos (hetnacnc.com/mx/disenar/convertidor).
//
// · STEP → STL/OBJ: el motor CAD OpenCascade (replicad, WASM ~23 MB, el mismo
//   de la caja con chaflán) lee el sólido y lo triangula. Se carga sólo cuando
//   alguien abre un STEP y se queda en caché.
// · Sólido STEP escalado → STEP: sigue siendo sólido (OpenCascade).
// · STL/OBJ → STEP: una malla no tiene caras curvas que recuperar; se escribe
//   como "faceted brep" (ISO 10303-42, AP214): cada triángulo es una cara plana
//   y los vértices se comparten, así el archivo queda chico. Lo abren
//   SolidWorks, Fusion, FreeCAD, Inventor y los CAM.
import type { Malla } from "./vectores"

/** Número real en formato STEP: siempre con punto decimal, sin notación rara. */
function real(n: number): string {
  const r = Math.round(n * 1e6) / 1e6
  if (r === 0) return "0."
  let s = String(r)
  if (/e/i.test(s)) s = r.toFixed(6).replace(/0+$/, "")
  return s.includes(".") ? s : `${s}.`
}

const textoStep = (t: string) => t.replace(/[^\x20-\x7E]/g, "_").replace(/'/g, "''").slice(0, 80) || "pieza"

/**
 * Malla (triángulos en mm) a STEP AP214 de caras planas. Junta los vértices
 * repetidos (a 0.001 mm) y quita triángulos sin área.
 */
export function stepDesdeMalla(m: Malla, nombre = "pieza"): string {
  const L: string[] = []
  let id = 0
  const nuevo = (entidad: string) => {
    id++
    L.push(`#${id}=${entidad};`)
    return id
  }
  const nom = textoStep(nombre)

  // Contexto y producto (lo que piden los CAD para reconocer una pieza)
  const app = nuevo("APPLICATION_CONTEXT('automotive design')")
  nuevo(`APPLICATION_PROTOCOL_DEFINITION('international standard','automotive_design',2000,#${app})`)
  const pctx = nuevo(`PRODUCT_CONTEXT('',#${app},'mechanical')`)
  const prod = nuevo(`PRODUCT('${nom}','${nom}','',(#${pctx}))`)
  const form = nuevo(`PRODUCT_DEFINITION_FORMATION('','',#${prod})`)
  const dctx = nuevo(`PRODUCT_DEFINITION_CONTEXT('part definition',#${app},'design')`)
  const def = nuevo(`PRODUCT_DEFINITION('design','',#${form},#${dctx})`)
  const pds = nuevo(`PRODUCT_DEFINITION_SHAPE('','',#${def})`)
  const lon = nuevo("(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT(.MILLI.,.METRE.))")
  const ang = nuevo("(NAMED_UNIT(*)PLANE_ANGLE_UNIT()SI_UNIT($,.RADIAN.))")
  const sol = nuevo("(NAMED_UNIT(*)SI_UNIT($,.STERADIAN.)SOLID_ANGLE_UNIT())")
  const inc = nuevo(`UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-03),#${lon},'distance_accuracy_value','')`)
  const ctx = nuevo(`(GEOMETRIC_REPRESENTATION_CONTEXT(3)GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#${inc}))GLOBAL_UNIT_ASSIGNED_CONTEXT((#${lon},#${ang},#${sol}))REPRESENTATION_CONTEXT('',''))`)
  const origen = nuevo("CARTESIAN_POINT('',(0.,0.,0.))")
  const ejes = nuevo(`AXIS2_PLACEMENT_3D('',#${origen},$,$)`)

  // Vértices compartidos
  const t = m.tris
  const indice = new Map<string, number>()
  const punto = (x: number, y: number, z: number) => {
    const k = `${Math.round(x * 1000)},${Math.round(y * 1000)},${Math.round(z * 1000)}`
    let p = indice.get(k)
    if (p === undefined) {
      p = nuevo(`CARTESIAN_POINT('',(${real(x)},${real(y)},${real(z)}))`)
      indice.set(k, p)
    }
    return p
  }
  // Cada cara va sobre su plano (FACE_SURFACE + PLANE), como pide la norma para
  // faceted_brep; las direcciones (normales) repetidas se comparten.
  const dirs = new Map<string, number>()
  const direccion = (x: number, y: number, z: number) => {
    const k = `${real(x)},${real(y)},${real(z)}`
    let d = dirs.get(k)
    if (d === undefined) {
      d = nuevo(`DIRECTION('',(${k}))`)
      dirs.set(k, d)
    }
    return d
  }
  const caras: number[] = []
  for (let i = 0; i + 8 < t.length; i += 9) {
    const a = punto(t[i], t[i + 1], t[i + 2])
    const b = punto(t[i + 3], t[i + 4], t[i + 5])
    const c = punto(t[i + 6], t[i + 7], t[i + 8])
    if (a === b || b === c || a === c) continue // triángulo sin área
    const ux = t[i + 3] - t[i], uy = t[i + 4] - t[i + 1], uz = t[i + 5] - t[i + 2]
    const vx = t[i + 6] - t[i], vy = t[i + 7] - t[i + 1], vz = t[i + 8] - t[i + 2]
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
    const l = Math.hypot(nx, ny, nz)
    if (l < 1e-12) continue
    nx /= l; ny /= l; nz /= l
    const eje = nuevo(`AXIS2_PLACEMENT_3D('',#${a},#${direccion(nx, ny, nz)},$)`)
    const plano = nuevo(`PLANE('',#${eje})`)
    const lazo = nuevo(`POLY_LOOP('',(#${a},#${b},#${c}))`)
    const borde = nuevo(`FACE_OUTER_BOUND('',#${lazo},.T.)`)
    caras.push(nuevo(`FACE_SURFACE('',(#${borde}),#${plano},.T.)`))
  }
  if (!caras.length) throw new Error("La malla no tiene triángulos válidos.")
  const cascaron = nuevo(`CLOSED_SHELL('',(${caras.map((c) => `#${c}`).join(",")}))`)
  const brep = nuevo(`FACETED_BREP('${nom}',#${cascaron})`)
  const rep = nuevo(`FACETED_BREP_SHAPE_REPRESENTATION('${nom}',(#${ejes},#${brep}),#${ctx})`)
  nuevo(`SHAPE_DEFINITION_REPRESENTATION(#${pds},#${rep})`)

  const fecha = new Date().toISOString().slice(0, 19)
  return [
    "ISO-10303-21;",
    "HEADER;",
    "FILE_DESCRIPTION(('Malla convertida por HETNA CNC (hetnacnc.com)'),'2;1');",
    `FILE_NAME('${nom}.step','${fecha}',(''),(''),'HETNA CNC convertidor','HETNA CNC','');`,
    "FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));",
    "ENDSEC;",
    "DATA;",
    ...L,
    "ENDSEC;",
    "END-ISO-10303-21;",
    "",
  ].join("\n")
}

// ── Lectura y escritura de sólidos con OpenCascade ───────────────────────
export type CalidadStep = "normal" | "fina"
const TOLERANCIAS: Record<CalidadStep, { tolerance: number; angularTolerance: number }> = {
  normal: { tolerance: 0.05, angularTolerance: 0.2 },
  fina: { tolerance: 0.01, angularTolerance: 0.08 },
}

/** Lee un STEP como sólido y lo triangula. Devuelve la malla y la forma (para volver a exportar STEP). */
export async function leerSTEP(archivo: Blob, calidad: CalidadStep = "normal"): Promise<{ malla: Malla; forma: unknown }> {
  const { cargarOC } = await import("./cajaReplicad")
  await cargarOC()
  const { importSTEP } = await import("replicad")
  let forma: any
  try {
    forma = await importSTEP(archivo)
  } catch {
    throw new Error("No se pudo leer el STEP. Revisa que sea un archivo .step o .stp válido.")
  }
  return { malla: await triangular(forma, calidad), forma }
}

export async function triangular(forma: unknown, calidad: CalidadStep): Promise<Malla> {
  const { leerSTL } = await import("./vectores")
  const stl = (forma as any).blobSTL({ binary: true, ...TOLERANCIAS[calidad] }) as Blob
  return leerSTL(await stl.arrayBuffer())
}

/** STEP de un sólido leído antes, escalado por k (sigue siendo sólido). */
export async function stepDesdeForma(forma: unknown, k: number): Promise<Blob> {
  const f: any = forma
  const escalada = Math.abs(k - 1) < 1e-9 ? f : f.clone().scale(k, [0, 0, 0])
  return escalada.blobSTEP() as Blob
}
