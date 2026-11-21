// Lámina doblada desde un STEP (estrategia 3.1, como OSH Cut, Fractory o meviy).
// Con el sólido de OpenCascade (replicad) sale lo que necesita un taller de
// corte y doblez:
//
//   · espesor: la diferencia entre el radio exterior e interior de un doblez
//     (o, en una placa plana, volumen ÷ cara más grande);
//   · dobleces: pares de caras cilíndricas con el mismo eje (interior/exterior),
//     con su ángulo y su radio interior;
//   · lámina extendida: área = volumen ÷ espesor (exacto con espesor constante)
//     y largo de corte = (área total − 2 × área plana) ÷ espesor (contorno +
//     barrenos);
//   · barrenos: paredes cilíndricas con la altura del espesor.
//
// No dibuja el desarrollo (eso lo hace el CAM del taller); da los números para
// el precio y la revisión. Si la pieza no es lámina de espesor constante, lo dice.

export type BendLamina = { angulo: number; radioInterior: number; largo: number }

export type AnalisisLamina = {
  esLamina: boolean
  espesor: number // mm
  dobleces: BendLamina[]
  radioInteriorMin: number | null // mm
  areaPlana: number // mm² de la lámina extendida
  corte: number // mm de corte (contorno exterior + barrenos)
  barrenos: number
  motivo?: string
}

type Cil = { r: number; ang: number; largo: number; eje: [number, number, number]; pto: [number, number, number] }

const norma = (v: number[]) => Math.hypot(v[0], v[1], v[2])
const punto = (v: number[], w: number[]) => v[0] * w[0] + v[1] * w[1] + v[2] * w[2]
const cruz = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

/** Distancia entre dos ejes paralelos (dirección d unitaria). */
function distanciaEjes(a: Cil, b: Cil) {
  const w = [b.pto[0] - a.pto[0], b.pto[1] - a.pto[1], b.pto[2] - a.pto[2]]
  return norma(cruz(w, a.eje))
}

/**
 * Analiza un sólido de replicad (Shape3D). `medir` son las funciones de replicad
 * (measureArea, measureVolume) para no importar replicad aquí.
 */
export function analizarLamina(forma: any, medir: { area: (s: any) => number; volumen: (s: any) => number }): AnalisisLamina {
  const vacio = (motivo: string): AnalisisLamina => ({ esLamina: false, espesor: 0, dobleces: [], radioInteriorMin: null, areaPlana: 0, corte: 0, barrenos: 0, motivo })
  const caras: any[] = forma.faces || []
  if (!caras.length) return vacio("El archivo no trae caras.")
  const volumen = medir.volumen(forma)
  const areaTotal = medir.area(forma)
  if (!(volumen > 0)) return vacio("No pudimos calcular el volumen del sólido.")

  const cils: Cil[] = []
  let planaMayor = 0
  for (const f of caras) {
    const tipo = f.geomType
    if (tipo === "PLANE") planaMayor = Math.max(planaMayor, medir.area(f))
    if (tipo !== "CYLINDRE") continue
    try {
      const c = f._geomAdaptor().Cylinder()
      const ax = c.Axis()
      const d = ax.Direction()
      const p = ax.Location()
      const uv = f.UVBounds
      cils.push({
        r: c.Radius(),
        ang: Math.abs(uv.uMax - uv.uMin),
        largo: Math.abs(uv.vMax - uv.vMin),
        eje: [d.X(), d.Y(), d.Z()],
        pto: [p.X(), p.Y(), p.Z()],
      })
    } catch {
      // cara cilíndrica que no se pudo leer: se ignora
    }
  }

  // Pares interior/exterior: mismo eje (paralelo y en la misma línea), mismo ángulo
  const usados = new Set<number>()
  const pares: { ri: number; ro: number; ang: number; largo: number }[] = []
  for (let i = 0; i < cils.length; i++) {
    if (usados.has(i)) continue
    for (let j = i + 1; j < cils.length; j++) {
      if (usados.has(j)) continue
      const a = cils[i], b = cils[j]
      if (Math.abs(Math.abs(punto(a.eje, b.eje)) - 1) > 1e-3) continue
      if (distanciaEjes(a, b) > 0.05) continue
      if (Math.abs(a.r - b.r) < 0.05 || Math.abs(a.ang - b.ang) > 0.02) continue
      usados.add(i)
      usados.add(j)
      pares.push({ ri: Math.min(a.r, b.r), ro: Math.max(a.r, b.r), ang: a.ang, largo: Math.max(a.largo, b.largo) })
      break
    }
  }

  // Espesor: el de los dobleces (mediana) o, si es placa plana, volumen ÷ cara mayor
  let espesor = 0
  if (pares.length) {
    const ts = pares.map((p) => p.ro - p.ri).sort((x, y) => x - y)
    espesor = ts[Math.floor(ts.length / 2)]
    if (ts.some((t) => Math.abs(t - espesor) > Math.max(0.05, espesor * 0.05))) return vacio("Los dobleces tienen espesores distintos: no parece una lámina de espesor constante.")
  } else if (planaMayor > 0) {
    espesor = volumen / planaMayor
  }
  if (!(espesor > 0) || espesor > 50) return vacio("No pudimos encontrar un espesor de lámina.")

  const areaPlana = volumen / espesor
  // Si la pieza fuera un bloque (no lámina), el "área plana" no cuadra con su cara mayor
  if (!pares.length && planaMayor > 0 && areaPlana > planaMayor * 1.05) return vacio("No parece lámina: el espesor no es constante.")
  // Una lámina es delgada frente a su tamaño (un bloque de 50 × 50 × 40 no lo es)
  if (espesor > 25 || espesor > Math.sqrt(areaPlana) / 5) return vacio("No parece lámina: es una pieza gruesa (para maquinado, no para corte y doblez).")
  // Barrenos: paredes cilíndricas que no son doblez y miden lo que el espesor
  // (un barreno puede venir en una cara completa o en dos mitades: se cuentan ejes distintos)
  const paredes = cils.filter((c, i) => !usados.has(i) && Math.abs(c.largo - espesor) < Math.max(0.1, espesor * 0.15))
  const ejes: Cil[] = []
  for (const c of paredes) if (!ejes.some((e) => Math.abs(Math.abs(punto(e.eje, c.eje)) - 1) < 1e-3 && distanciaEjes(e, c) < 0.05)) ejes.push(c)
  const barrenos = ejes.length
  const corte = Math.max(0, (areaTotal - 2 * areaPlana) / espesor)
  const dobleces = pares.map((p) => ({ angulo: Math.round((p.ang * 180) / Math.PI), radioInterior: Math.round(p.ri * 100) / 100, largo: Math.round(p.largo) }))
  return {
    esLamina: true,
    espesor: Math.round(espesor * 100) / 100,
    dobleces,
    radioInteriorMin: dobleces.length ? Math.min(...dobleces.map((d) => d.radioInterior)) : null,
    areaPlana: Math.round(areaPlana),
    corte: Math.round(corte),
    barrenos,
  }
}
