// Relojes de pared (2D Studio): carátula con números (arábigos o romanos) o
// sólo marcas, nombre al centro, marco grabado y el barreno del mecanismo.
// Los números se pueden grabar o calar (atravesar la pieza).
import { type P, type Trazo, cajaDibujo, circulo, dibujo, girar, mover, poligonoRegular, rect, trazo } from "@/lib/generador/geo2d"

export type Forma = "circulo" | "cuadrado" | "hexagono"
export type Numeros = "arabigos" | "romanos" | "cuatro" | "marcas"

export type OpcionesReloj = {
  diametro: number
  forma: Forma
  numeros: Numeros
  calados: boolean // números atravesados en vez de grabados
  minutos: boolean // 60 marcas pequeñas
  marco: boolean
  barreno: number // 7.5, 8 o 10 mm según el mecanismo
  colgador: boolean
  // texto ya convertido: (texto, alto, capa) → trazos centrados en (0,0)
  texto: ((t: string, alto: number, capa: string) => Trazo[]) | null
  nombre: string
}

const ROMANOS = ["XII", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI"]

export function hacerReloj(o: OpcionesReloj) {
  const avisos: string[] = []
  const D = Math.max(80, o.diametro)
  const R = D / 2
  const trazos: Trazo[] = []
  // Contorno de la carátula, con el centro en (R, R)
  if (o.forma === "circulo") trazos.push(circulo(R, R, R))
  else if (o.forma === "cuadrado") trazos.push(rect(0, 0, D, D, D * 0.08))
  else trazos.push(trazo(poligonoRegular(R, R, R, 6, Math.PI / 6)))
  // El anillo útil (donde van números y marcas)
  const util = o.forma === "hexagono" ? R * Math.cos(Math.PI / 6) : R
  const capaNum = o.calados ? "corte" : "grabado"
  const mar = Math.max(4, D * 0.03)
  if (o.marco) {
    trazos.push(circulo(R, R, util - mar, "grabado"))
    trazos.push(circulo(R, R, util - mar - Math.max(1.2, D * 0.006), "grabado"))
  }
  const rMarcas = util - mar * (o.marco ? 2.2 : 1.2)
  // Marcas: 12 de hora (largas) y 60 de minuto (cortas)
  const largoH = D * 0.045
  const largoM = D * 0.018
  const grueso = Math.max(1, D * 0.008)
  const marca = (ang: number, largo: number, ancho: number, capa: string) => {
    const pts: P[] = [[-ancho / 2, rMarcas - largo], [ancho / 2, rMarcas - largo], [ancho / 2, rMarcas], [-ancho / 2, rMarcas]]
    trazos.push(trazo(mover(girar(pts, ang - Math.PI / 2), R, R), true, capa))
  }
  for (let i = 0; i < 60; i++) {
    const ang = Math.PI / 2 - (i / 60) * Math.PI * 2
    const hora = i % 5 === 0
    if (hora && (o.numeros === "marcas" || o.numeros === "cuatro")) {
      if (o.numeros === "cuatro" && i % 15 === 0) continue
      marca(ang, largoH, grueso * 1.8, capaNum)
    } else if (!hora && o.minutos) marca(ang, largoM, grueso * 0.6, "grabado")
  }
  // Números
  const alto = D * (o.numeros === "romanos" ? 0.075 : 0.09)
  const rLibre = rMarcas - (o.minutos ? largoM : largoH) - D * 0.015
  const rNum = rLibre - alto * 0.6
  if (o.numeros !== "marcas") {
    if (!o.texto) avisos.push("Cargando la letra de los números…")
    else
      for (let h = 0; h < 12; h++) {
        if (o.numeros === "cuatro" && h % 3 !== 0) continue
        const etiqueta = o.numeros === "romanos" ? ROMANOS[h] : String(h === 0 ? 12 : h)
        const ang = Math.PI / 2 - (h / 12) * Math.PI * 2
        const t = o.texto(etiqueta, alto, capaNum)
        if (!t.length) continue
        // El centro del número se acerca al eje lo necesario para que su caja
        // no toque las marcas (los romanos anchos, como VIII, van más adentro)
        const bx = cajaDibujo(t)
        const radial = Math.abs(((bx.x1 - bx.x0) / 2) * Math.cos(ang)) + Math.abs(((bx.y1 - bx.y0) / 2) * Math.sin(ang))
        const rr = Math.min(rNum, rLibre - radial)
        for (const tr of t) trazos.push({ ...tr, pts: mover(tr.pts, R + rr * Math.cos(ang), R + rr * Math.sin(ang)) })
      }
  }
  // Nombre o logo al centro (abajo del eje)
  if (o.nombre.trim() && o.texto) {
    const t = o.texto(o.nombre, D * 0.055, "grabado")
    for (const tr of t) trazos.push({ ...tr, pts: mover(tr.pts, R, R - D * 0.2) })
  }
  // Barreno del mecanismo y colgador (ojo de cerradura atrás no hace falta:
  // el mecanismo trae su gancho; éste es para relojes sin él)
  trazos.push(circulo(R, R, Math.max(2, o.barreno / 2)))
  if (o.colgador) {
    const y = D - mar * 2.5
    trazos.push(circulo(R, y, 2.5))
  }
  if (o.calados && (o.numeros === "arabigos" || o.numeros === "cuatro")) avisos.push("Los números calados con huecos (0, 4, 6, 8, 9) sueltan su centro: usa una letra esténcil o grabados.")
  if (o.calados && o.numeros === "romanos") avisos.push("Romanos calados: revisa que la letra no tenga partes sueltas.")
  avisos.push(`Barreno de ${o.barreno} mm: mide el eje roscado de tu mecanismo (los más comunes son de 7.5 y 8 mm).`)
  avisos.push(`Manecillas: la de minutos debe medir menos de ${Math.round(rMarcas - 2)} mm para no tocar las marcas.`)
  return { dibujo: dibujo(trazos, avisos), avisos }
}
