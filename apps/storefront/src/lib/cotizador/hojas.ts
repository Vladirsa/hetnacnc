// Cuántas piezas caben en una hoja y cuántas hojas lleva el pedido
// (estrategia 3.2). Es el mismo cálculo que la app del Cotizador
// (lib/services/aprovechamiento.dart): filas × columnas probando la pieza
// derecha y girada 90°, más una franja con lo que sobra en el otro sentido.
// Las hojas se compran completas.
//
// Acomodo rectangular (por la caja de la pieza): con figuras irregulares un
// taller con nesting real puede acomodar más; nunca menos.

export type ResultadoHojas = {
  porHoja: number
  hojas: number
  piezas: number
  sobranEnUltima: number
  aprovechamientoPct: number
  girada: boolean
  cabe: boolean
}

// Hoja estándar de MDF, triplay, acrílico y lámina en México: 4 × 8 pies
export const HOJA_ESTANDAR = { largo: 2440, ancho: 1220 }

// Separación entre piezas y orilla (mm). Es LA MISMA que usa el precio
// (estimador.ts y, en el backend, estimador-referencia.ts): antes el texto
// "caben X por hoja" usaba 10/15 mm y el precio 6/10 mm, y no cuadraban.
export const SEPARACION_HOJA = { sep: 6, orilla: 10 }
export const SEPARACION: Record<string, { sep: number; orilla: number }> = {
  laser_co2: SEPARACION_HOJA,
  router: SEPARACION_HOJA,
  plasma: SEPARACION_HOJA,
}

const cuantas = (disponible: number, pieza: number, sep: number) => (pieza <= 0 || disponible < pieza ? 0 : Math.floor((disponible + sep) / (pieza + sep)))

export function calcularHojas(o: { pzL: number; pzA: number; piezas: number; matL?: number; matA?: number; sep?: number; orilla?: number }): ResultadoHojas {
  const matL = o.matL ?? HOJA_ESTANDAR.largo
  const matA = o.matA ?? HOJA_ESTANDAR.ancho
  const sep = o.sep ?? 0
  const orilla = o.orilla ?? 0
  const uL = matL - 2 * orilla
  const uA = matA - 2 * orilla
  const acomodo = (l: number, a: number, girada: boolean) => {
    const cols = cuantas(uL, l, sep)
    const filas = cuantas(uA, a, sep)
    let total = cols * filas
    if (total > 0) {
      const f1 = cuantas(uL - cols * (l + sep), a, sep) * cuantas(uA, l, sep)
      const f2 = cuantas(uL, a, sep) * cuantas(uA - filas * (a + sep), l, sep)
      total += Math.max(f1, f2)
    }
    return { total, girada }
  }
  const a = acomodo(o.pzL, o.pzA, false)
  const b = acomodo(o.pzA, o.pzL, true)
  const mejor = b.total > a.total ? b : a
  const n = Math.max(0, Math.round(o.piezas))
  const hojas = mejor.total > 0 ? Math.ceil(n / mejor.total) : 0
  const area = hojas * matL * matA
  return {
    porHoja: mejor.total,
    hojas,
    piezas: n,
    sobranEnUltima: mejor.total > 0 && hojas > 0 ? hojas * mejor.total - n : 0,
    aprovechamientoPct: area > 0 ? Math.round(((n * o.pzL * o.pzA) / area) * 1000) / 10 : 0,
    girada: mejor.girada,
    cabe: mejor.total > 0,
  }
}

/** Texto corto para mostrar al cliente. */
export function textoHojas(r: ResultadoHojas): string {
  if (!r.cabe) return "La pieza no cabe en una hoja de 1.22 × 2.44 m: se hace en partes o con un taller de mesa grande"
  const h = r.hojas === 1 ? "1 hoja" : `${r.hojas} hojas`
  return `Caben ${r.porHoja} por hoja de 1.22 × 2.44 m · tu pedido usa ${h} (${r.aprovechamientoPct}% aprovechado${r.sobranEnUltima ? `, ${r.sobranEnUltima === 1 ? "queda 1 lugar libre" : `quedan ${r.sobranEnUltima} lugares libres`} en la última` : ""})`
}
