// Más herramientas de "Letreros y placas" (2D Studio):
//  · Placa redonda: texto en arco arriba y abajo (los dos se leen al derecho),
//    monograma o iniciales al centro, aro de borde y adornos a los lados.
//  · Incrustaciones (inlay): de un texto o un dibujo salen el bolsillo (hembra)
//    y la pieza que entra (macho), compensados por el radio de la fresa y con
//    la holgura del pegamento, para router o láser.
import { type Fuente, textoACurvas } from "@/lib/generador/letreros"
import { aplanar } from "@/lib/generador/llaveros"
import { desplazar } from "@/lib/generador/cortadores"
import { figura, type IconoTextura } from "@/lib/generador/texturizador"
import { unirContornos } from "@/lib/generador/unirContornos"
import type { Dibujo, P, Trazo } from "@/lib/generador/vectores"

const MM = 10 // limpieza de clipper en milímetros (0.01 mm)
const caja = (a: P[][]) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const p of a) for (const [x, y] of p) (x0 = Math.min(x0, x)), (y0 = Math.min(y0, y)), (x1 = Math.max(x1, x)), (y1 = Math.max(y1, y))
  return { x0, y0, x1, y1 }
}
const circ = (cx: number, cy: number, r: number, n = 144): P[] => Array.from({ length: n }, (_, i) => [cx + r * Math.cos((i / n) * 2 * Math.PI), cy + r * Math.sin((i / n) * 2 * Math.PI)] as P)
const mover = (c: P[][], dx: number, dy: number, k = 1): P[][] => c.map((p) => p.map(([x, y]) => [x * k + dx, y * k + dy] as P))
const trazos = (c: P[][], capa: string): Trazo[] => c.map((pts) => ({ pts, cerrado: true, capa }))

/** Alto de la H en unidades de la fuente (para pasar de mm a tamaño). */
function tamDe(fuente: Fuente, alto: number) {
  const h = fuente.charToGlyph("H").getPath(0, 0, fuente.unitsPerEm).commands
  const ys = h.map((c) => c.y).filter((y): y is number => typeof y === "number")
  const capH = ys.length ? Math.max(...ys) - Math.min(...ys) : fuente.unitsPerEm * 0.7
  return (alto * fuente.unitsPerEm) / capH
}

/**
 * Texto en arco alrededor del centro. arriba: se lee por fuera, de izquierda a
 * derecha por la parte de arriba; abajo: por dentro, también al derecho.
 * rBase: radio de la línea base (arriba) o del pie de las letras (abajo).
 */
/** Largo del texto a lo largo de su línea (mm). */
export function largoTexto(fuente: Fuente, texto: string, alto: number, espaciado = 0) {
  const k = tamDe(fuente, alto) / fuente.unitsPerEm
  const glifos = fuente.stringToGlyphs(texto)
  return glifos.reduce((s, g, i) => s + (g.advanceWidth ?? 0) * k + espaciado + (i < glifos.length - 1 ? fuente.getKerningValue(g, glifos[i + 1]) * k : 0), 0) - (glifos.length ? espaciado : 0)
}

export function textoEnArco(fuente: Fuente, texto: string, alto: number, rBase: number, arriba: boolean, espaciado = 0): P[][] {
  const tam = tamDe(fuente, alto)
  const k = tam / fuente.unitsPerEm
  const glifos = fuente.stringToGlyphs(texto)
  const avances = glifos.map((g, i) => (g.advanceWidth ?? 0) * k + espaciado + (i < glifos.length - 1 ? fuente.getKerningValue(g, glifos[i + 1]) * k : 0))
  const total = avances.reduce((s, a) => s + a, 0) - espaciado
  const salida: P[][] = []
  let s = 0
  glifos.forEach((g, i) => {
    const centro = s + ((g.advanceWidth ?? 0) * k) / 2
    // (la fuente de opentype tiene sus funciones en el prototipo: no se puede copiar con {...})
    const una: Fuente = { unitsPerEm: fuente.unitsPerEm, charToGlyph: (c) => fuente.charToGlyph(c), stringToGlyphs: () => [g], getKerningValue: () => 0 }
    const curvas = textoACurvas(una, { texto: "x", alto, espaciado: 0, interlineado: 1, alineacion: "izquierda" }).curvas
    const ancho = (g.advanceWidth ?? 0) * k
    for (const c of curvas) {
      const pts = aplanar(c, 0.2)
      if (pts.length < 3) continue
      salida.push(
        pts.map(([gx, gy]) => {
          const dx = gx - ancho / 2
          if (arriba) {
            const r = rBase + gy
            const fi = Math.PI / 2 - (centro - total / 2) / rBase - dx / rBase
            return [r * Math.cos(fi), r * Math.sin(fi)] as P
          }
          const r = rBase - gy
          const fi = -Math.PI / 2 + (centro - total / 2) / rBase + dx / rBase
          return [r * Math.cos(fi), r * Math.sin(fi)] as P
        }),
      )
    }
    s += avances[i]
  })
  return salida
}

// ── Placa redonda ──────────────────────────────────────────────────────────
export type OpcionesPlacaRedonda = {
  arriba: string
  abajo: string
  centro: string // monograma o iniciales (hasta 3 letras) o un texto corto
  diametro: number
  borde: boolean // aro grabado cerca de la orilla
  adorno: IconoTextura | "" // a los lados, entre los dos textos
}
export const OPCIONES_PLACA_REDONDA: OpcionesPlacaRedonda = { arriba: "TALLER HERNÁNDEZ", abajo: "DESDE 1998", centro: "TH", diametro: 300, borde: true, adorno: "estrella" }

export type ResultadoLetrero2D = { dibujo: Dibujo; ancho: number; alto: number; avisos: string[]; errores: string[] }

export function hacerPlacaRedonda(fuente: Fuente | null, o: OpcionesPlacaRedonda): ResultadoLetrero2D {
  const avisos: string[] = []
  const D = Math.max(60, Math.min(1200, o.diametro || 300)), R = D / 2
  const vacio = (e: string): ResultadoLetrero2D => ({ dibujo: { trazos: [], avisos: [], unidades: "mm" }, ancho: 0, alto: 0, avisos: [], errores: [e] })
  if (!fuente) return vacio("Cargando la letra…")
  const t: Trazo[] = [{ pts: circ(0, 0, R, 288), cerrado: true, capa: "corte" }]
  const m = D * 0.04, anchoAro = Math.max(1.5, D * 0.012)
  if (o.borde) t.push(...trazos([circ(0, 0, R - m, 288), circ(0, 0, R - m - anchoAro, 288).reverse()], "grabado"))
  // franja de los textos en arco; cada texto se achica (hasta la mitad) para no pasar de 140° de vuelta
  const altoArco = D * 0.075, MAX_VUELTA = (140 * Math.PI) / 180
  const rTexto = R - m - anchoAro - D * 0.035
  const arriba = o.arriba.trim().slice(0, 40), abajo = o.abajo.trim().slice(0, 40)
  const altoQueCabe = (txt: string, rr: number) => {
    if (!txt) return altoArco
    const v = largoTexto(fuente, txt, altoArco, altoArco * 0.12) / rr
    return v <= MAX_VUELTA ? altoArco : Math.max(altoArco * 0.5, (altoArco * MAX_VUELTA) / v)
  }
  const altoArriba = altoQueCabe(arriba, rTexto - altoArco), altoAbajo = altoQueCabe(abajo, rTexto)
  if (arriba) t.push(...trazos(unirContornos(textoEnArco(fuente, arriba, altoArriba, rTexto - altoArco, true, altoArriba * 0.12)), "grabado"))
  if (abajo) t.push(...trazos(unirContornos(textoEnArco(fuente, abajo, altoAbajo, rTexto - (altoArco - altoAbajo), false, altoAbajo * 0.12)), "grabado"))
  const pasa = (txt: string, alto: number, rr: number) => !!txt && largoTexto(fuente, txt, alto, alto * 0.12) / rr > MAX_VUELTA + 1e-6
  const largo = pasa(arriba, altoArriba, rTexto - altoArco) || pasa(abajo, altoAbajo, rTexto)
  if (largo) avisos.push("Un texto da casi media vuelta aun achicado: usa menos letras o una placa más grande.")
  else if (altoArriba < altoArco || altoAbajo < altoArco) avisos.push("Achicamos un texto para que quepa en su arco.")
  // centro: monograma al tamaño que quepa en el círculo de adentro
  const rInterior = rTexto - altoArco - D * 0.04
  const centro = o.centro.trim().slice(0, 12)
  if (centro) {
    const c = textoACurvas(fuente, { texto: centro, alto: 10, espaciado: 0, interlineado: 1.2, alineacion: "centro" }).curvas.map((x) => aplanar(x, 0.2)).filter((p) => p.length >= 3)
    if (c.length) {
      const b = caja(c)
      const ancho = b.x1 - b.x0, alto = b.y1 - b.y0
      const k = Math.min((rInterior * 1.5) / ancho, (rInterior * 1.1) / alto)
      t.push(...trazos(unirContornos(mover(c, -((b.x0 + b.x1) / 2) * k, -((b.y0 + b.y1) / 2) * k, k)), "grabado"))
    }
  }
  // adornos a los lados (izquierda y derecha, a la altura del centro)
  if (o.adorno && (arriba || abajo) && !largo) {
    const f = unirContornos(figura(o.adorno))
    const b = caja(f)
    const k = (altoArco * 0.8) / Math.max(b.x1 - b.x0, b.y1 - b.y0)
    const rAd = rTexto - altoArco / 2
    for (const sx of [-1, 1]) t.push(...trazos(mover(f, sx * rAd - ((b.x0 + b.x1) / 2) * k, -((b.y0 + b.y1) / 2) * k, k), "grabado"))
  }
  return { dibujo: { trazos: t.map((x) => ({ ...x, pts: x.pts.map(([px, py]) => [px + R, py + R] as P) })), avisos: [], unidades: "mm" }, ancho: D, alto: D, avisos, errores: [] }
}

// ── Incrustaciones (inlay) ─────────────────────────────────────────────────
export type OpcionesIncrustacion = {
  fresa: number // diámetro de la fresa recta (0 = láser: esquinas vivas)
  holgura: number // hueco entre macho y hembra en cada lado (para el pegamento), mm
  profundidad: number // del bolsillo (sólo para la nota)
}
export const OPCIONES_INCRUSTACION: OpcionesIncrustacion = { fresa: 3.175, holgura: 0.1, profundidad: 4 }

/**
 * La forma (contornos cerrados, con huecos) → hembra (bolsillo) y macho.
 * Con fresa de radio r el bolsillo sale con las esquinas convexas de la forma
 * redondeadas (r) y la pieza macho con sus esquinas cóncavas redondeadas: las
 * dos se dibujan ya así, para que encajen. La holgura se reparte mitad y mitad.
 */
export function hacerIncrustacion(forma: P[][], o: OpcionesIncrustacion): ResultadoLetrero2D {
  const vacio = (e: string): ResultadoLetrero2D => ({ dibujo: { trazos: [], avisos: [], unidades: "mm" }, ancho: 0, alto: 0, avisos: [], errores: [e] })
  const base = forma.filter((p) => p.length >= 3)
  if (!base.length) return vacio("Escribe un texto o sube un dibujo con contornos cerrados.")
  const avisos: string[] = []
  const r = Math.max(0, o.fresa / 2)
  const h = Math.max(0, Math.min(1, o.holgura)) / 2
  // abrir por r: lo que de verdad puede cortar la fresa (esquinas convexas redondas, rendijas perdidas)
  const abierta = r > 0.01 ? desplazar(desplazar(base, -r, MM), r, MM) : desplazar(base, 0, MM)
  if (!abierta.length) return vacio("La fresa es más gruesa que las partes del dibujo: usa una fresa más delgada o un dibujo más grande.")
  const perdida = Math.abs(area(base) - area(abierta)) / Math.max(1e-6, area(base))
  if (perdida > 0.05) avisos.push(`La fresa de ${o.fresa} mm se come el ${Math.round(perdida * 100)} % del dibujo (detalles delgados): usa una fresa más delgada o un dibujo más grande.`)
  const hembra = desplazar(abierta, h, MM)
  // el macho se corta por fuera: sus esquinas cóncavas también quedan redondas (cerrar por r)
  const macho = r > 0.01 ? desplazar(desplazar(desplazar(abierta, -h, MM), r, MM), -r, MM) : desplazar(abierta, -h, MM)
  const b = caja(hembra)
  const ancho = b.x1 - b.x0, alto = b.y1 - b.y0, sep = Math.max(10, ancho * 0.1)
  const t: Trazo[] = [
    // hembra a la izquierda: bolsillo (capa grabado = vaciado a la profundidad)
    ...trazos(mover(hembra, -b.x0, -b.y0), "grabado"),
    // macho a la derecha: se recorta por fuera
    ...trazos(mover(macho, -b.x0 + ancho + sep, -b.y0), "corte"),
  ]
  return { dibujo: { trazos: t, avisos: [], unidades: "mm" }, ancho: 2 * ancho + sep, alto, avisos, errores: [] }
}

/** Área total con huecos (los huecos restan por ir al revés). */
function area(a: P[][]) {
  let s = 0
  for (const p of a)
    for (let i = 0; i < p.length; i++) {
      const [x1, y1] = p[i], [x2, y2] = p[(i + 1) % p.length]
      s += x1 * y2 - x2 * y1
    }
  return Math.abs(s / 2)
}

/** Texto → contornos (para la incrustación). */
export function textoAForma(fuente: Fuente, texto: string, alto: number): P[][] {
  const c = textoACurvas(fuente, { texto, alto, espaciado: 0, interlineado: 1.25, alineacion: "centro" }).curvas.map((x) => aplanar(x, 0.15)).filter((p) => p.length >= 3)
  return c.length ? unirContornos(c) : []
}
