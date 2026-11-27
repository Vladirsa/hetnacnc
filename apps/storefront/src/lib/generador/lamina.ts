// Desarrollo de lámina (2D Studio · Archivos · Lámina): la plantilla plana para
// cortar en plasma, láser o a mano y rolar o doblar.
//  · Cono y cono truncado (reducción): sector de corona con el diámetro medio.
//  · Transición de cuadrado (o rectángulo) a redondo, por triangulación.
//  · Boca de pescado: la plantilla que se enrolla en un tubo para cortarlo y que
//    asiente sobre otro tubo, a cualquier ángulo.
// Todo en mm, con el espesor de la lámina (se traza la fibra media).
import type { Dibujo, P, Trazo } from "@/lib/generador/vectores"

export type ResultadoLamina = { dibujo: Dibujo; ancho: number; alto: number; avisos: string[]; errores: string[]; datos: [string, string][] }

/** Tope de medidas (mm): una cifra absurda congelaría la pestaña. */
const MAX_MM = 10000
const fuera = (...v: number[]) => v.some((x) => !(Math.abs(x) <= MAX_MM))
const vacio = (e: string): ResultadoLamina => ({ dibujo: { trazos: [], avisos: [], unidades: "mm" }, ancho: 0, alto: 0, avisos: [], errores: [e], datos: [] })
const r1 = (x: number) => (Math.round(x * 10) / 10).toLocaleString("es-MX")
function encuadrar(t: Trazo[], datos: [string, string][], avisos: string[] = []): ResultadoLamina {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const x of t) for (const [a, b] of x.pts) (x0 = Math.min(x0, a)), (y0 = Math.min(y0, b)), (x1 = Math.max(x1, a)), (y1 = Math.max(y1, b))
  return { dibujo: { trazos: t.map((x) => ({ ...x, pts: x.pts.map(([a, b]) => [a - x0, b - y0] as P) })), avisos: [], unidades: "mm" }, ancho: x1 - x0, alto: y1 - y0, avisos, errores: [], datos }
}

// ── Cono / reducción ───────────────────────────────────────────────────────
export type OpcionesCono = { mayor: number; menor: number; alto: number; espesor: number; partes: number }

export function desarrolloCono(o: OpcionesCono): ResultadoLamina {
  if (fuera(o.mayor, o.menor, o.alto, o.espesor)) return vacio("Las medidas pasan de 10 m: revísalas.")
  const e = Math.max(0, o.espesor || 0)
  const D = o.mayor - e, d = Math.max(0, o.menor - e) // diámetros a la fibra media
  if (!(D > 0) || !(o.alto > 0)) return vacio("Pon el diámetro mayor y el alto.")
  if (d >= D) return vacio("El diámetro menor tiene que ser más chico que el mayor.")
  const generatriz = Math.hypot((D - d) / 2, o.alto)
  const Rg = (generatriz * D) / (D - d) // radio exterior del sector
  const Rc = Rg - generatriz // radio interior (0 si es cono completo)
  const angulo = (Math.PI * D) / Rg // en radianes
  const n = Math.max(1, Math.min(12, Math.round(o.partes || 1)))
  const t: Trazo[] = []
  const paso = angulo / n
  for (let k = 0; k < n; k++) {
    // cada parte se dibuja aparte, desplazada para que no se encimen
    const a0 = -paso / 2, pts: P[] = []
    const seg = Math.min(2000, Math.max(16, Math.ceil((paso * Rg) / 3)))
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (paso * i) / seg
      pts.push([Rg * Math.cos(a), Rg * Math.sin(a)])
    }
    if (Rc > 0.01) for (let i = seg; i >= 0; i--) {
      const a = a0 + (paso * i) / seg
      pts.push([Rc * Math.cos(a), Rc * Math.sin(a)])
    }
    else pts.push([0, 0])
    const dy = k * (2 * Rg * Math.sin(Math.min(Math.PI / 2, paso / 2)) + 10)
    t.push({ pts: pts.map(([x, y]) => [x, y + dy] as P), cerrado: true, capa: "corte" })
  }
  const avisos = angulo > 2 * Math.PI * 0.95 ? ["La pieza casi da la vuelta completa: es un cono muy plano."] : []
  if (n === 1 && 2 * Rg > 2400) avisos.push("La plantilla mide más de 2.4 m: pártela en 2 o más partes.")
  return encuadrar(t, [["Radio mayor", `${r1(Rg)} mm`], ["Radio menor", `${r1(Rc)} mm`], ["Ángulo", `${r1((angulo * 180) / Math.PI)}°`], ["Generatriz", `${r1(generatriz)} mm`]], avisos)
}

// ── Transición cuadrado → redondo ──────────────────────────────────────────
export type OpcionesTransicion = { ancho: number; fondo: number; diametro: number; alto: number; espesor: number; divisiones: number }

type V3 = [number, number, number]
const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

/**
 * Se triangula la superficie (cada esquina del rectángulo con su cuarto de
 * círculo, y triángulos planos entre esquinas) y se despliega triángulo por
 * triángulo conservando las longitudes reales. La costura va a la mitad del
 * lado de enfrente (lado de "ancho" en y negativa).
 */
export function desarrolloTransicion(o: OpcionesTransicion): ResultadoLamina {
  if (fuera(o.ancho, o.fondo, o.diametro, o.alto, o.espesor)) return vacio("Las medidas pasan de 10 m: revísalas.")
  const e = Math.max(0, o.espesor || 0)
  const A = o.ancho - e, B = o.fondo - e, R = (o.diametro - e) / 2, H = o.alto
  if (!(A > 0 && B > 0 && R > 0 && H > 0)) return vacio("Pon las medidas del rectángulo, el diámetro y el alto.")
  const q = Math.max(2, Math.min(12, Math.round(o.divisiones || 4))) // divisiones por cuarto de círculo
  // puntos del círculo (arriba), empezando a la mitad del lado de enfrente (ángulo -90°) y en sentido antihorario
  const N = 4 * q
  const circ: V3[] = Array.from({ length: N + 1 }, (_, i) => {
    const a = -Math.PI / 2 + (i / N) * 2 * Math.PI
    return [R * Math.cos(a), R * Math.sin(a), H]
  })
  const esquinas: V3[] = [[A / 2, -B / 2, 0], [A / 2, B / 2, 0], [-A / 2, B / 2, 0], [-A / 2, -B / 2, 0]] // en el mismo sentido
  // tira de puntos alternando abajo/arriba: [abajo, arriba] por cada triángulo
  // costura: mitad del lado de enfrente (abajo) con el punto de arriba en -90°
  const tiras: [V3, V3, V3][] = []
  const medioFrente: V3 = [0, -B / 2, 0]
  // de la mitad del frente a la primera esquina (plano)
  tiras.push([medioFrente, circ[0], esquinas[0]])
  for (let c = 0; c < 4; c++) {
    // abanico de la esquina c con su cuarto de círculo (índices c·q a (c+1)·q)
    for (let i = c * q; i < (c + 1) * q; i++) tiras.push([esquinas[c], circ[i], circ[i + 1]])
    // triángulo plano hacia la esquina siguiente
    if (c < 3) tiras.push([esquinas[c], circ[(c + 1) * q], esquinas[c + 1]])
  }
  // del último punto del círculo a la esquina 3 y la mitad del frente (el otro
  // lado de la costura: mismo lugar en 3D, otro punto en la plantilla)
  const medioFrenteFin: V3 = [0, -B / 2, 0]
  tiras.push([esquinas[3], circ[N], medioFrenteFin])

  // despliegue: cada triángulo comparte una arista con el anterior
  // por punto (no por coordenadas): los dos lados de la costura coinciden en 3D
  const plano = new Map<V3, P>()
  const clave = (p: V3) => p
  const tri0 = tiras[0]
  plano.set(clave(tri0[0]), [0, 0])
  plano.set(clave(tri0[1]), [0, dist(tri0[0], tri0[1])])
  const colocar = (conocido1: V3, conocido2: V3, nuevo: V3, lado: number) => {
    const p1 = plano.get(clave(conocido1))!, p2 = plano.get(clave(conocido2))!
    const a = dist(conocido1, nuevo), b = dist(conocido2, nuevo), c = Math.hypot(p2[0] - p1[0], p2[1] - p1[1])
    const x = (a * a - b * b + c * c) / (2 * c), y = Math.sqrt(Math.max(0, a * a - x * x))
    const ux = (p2[0] - p1[0]) / c, uy = (p2[1] - p1[1]) / c
    return [p1[0] + ux * x - lado * uy * y, p1[1] + uy * x + lado * ux * y] as P
  }
  plano.set(clave(tri0[2]), colocar(tri0[0], tri0[1], tri0[2], 1))
  for (let k = 1; k < tiras.length; k++) {
    const t = tiras[k]
    const nuevos = t.filter((p) => !plano.has(clave(p)))
    if (nuevos.length !== 1) continue
    const [c1, c2] = t.filter((p) => plano.has(clave(p)))
    // del lado contrario al triángulo anterior: el que no queda encimado
    const prev = tiras[k - 1].find((p) => p !== c1 && p !== c2 && plano.has(clave(p)))
    const cand = [colocar(c1, c2, nuevos[0], 1), colocar(c1, c2, nuevos[0], -1)]
    // el punto nuevo va del otro lado de la arista compartida que el triángulo anterior
    const pp = prev ? plano.get(clave(prev))! : null
    const p1 = plano.get(clave(c1))!, p2 = plano.get(clave(c2))!
    const lado = (q: P) => Math.sign((p2[0] - p1[0]) * (q[1] - p1[1]) - (p2[1] - p1[1]) * (q[0] - p1[0]))
    const elegido = pp && lado(cand[0]) === lado(pp) ? cand[1] : cand[0]
    plano.set(clave(nuevos[0]), elegido)
  }
  // contorno: base (mitad frente → esquinas → mitad frente) y arriba (círculo), cerrado por la costura
  const abajo: P[] = [medioFrente, ...esquinas, medioFrenteFin].map((p) => plano.get(clave(p))!).filter(Boolean)
  const arriba: P[] = circ.map((p) => plano.get(clave(p))!).filter(Boolean)
  if (abajo.length < 6 || arriba.length < N + 1) return vacio("No se pudo desplegar con esas medidas.")
  // el punto de la costura (mitad del frente) aparece dos veces: al inicio y al final
  const contorno = [...abajo, ...[...arriba].reverse()]
  const lineasDoblez: Trazo[] = esquinas.flatMap((c, i) => {
    const pc = plano.get(clave(c))!
    return [i * q, (i + 1) * q].map((j) => ({ pts: [pc, plano.get(clave(circ[j]))!], cerrado: false, capa: "doblez" }))
  })
  return encuadrar([{ pts: contorno, cerrado: true, capa: "corte" }, ...lineasDoblez], [["Alto inclinado (esquina)", `${r1(dist(esquinas[0], circ[Math.floor(q / 2)]))} mm`], ["Triángulos", String(tiras.length)]], ["Las líneas punteadas marcan dónde doblar (esquinas): el resto se rola suave."])
}

// ── Boca de pescado ────────────────────────────────────────────────────────
export type OpcionesBoca = { tubo: number; principal: number; angulo: number; largo: number; espesor: number }

/**
 * Plantilla para enrollar en el tubo que llega (diámetro exterior `tubo`) y
 * marcar el corte que asienta sobre el tubo principal (diámetro exterior
 * `principal`) con un ángulo entre ejes de `angulo` grados (90 = en T).
 */
export function bocaDePescado(o: OpcionesBoca): ResultadoLamina {
  if (fuera(o.tubo, o.principal, o.largo, o.espesor)) return vacio("Las medidas pasan de 10 m: revísalas.")
  const r = o.tubo / 2, Rr = o.principal / 2, a = (Math.max(15, Math.min(90, o.angulo || 90)) * Math.PI) / 180
  if (!(r > 0 && Rr > 0)) return vacio("Pon los diámetros de los dos tubos.")
  if (r > Rr + 1e-9) return vacio("El tubo que llega no puede ser más grueso que el principal.")
  const e = Math.max(0, o.espesor || 0)
  const ri = r - e // se asienta por dentro del tubo que llega
  const circ = 2 * Math.PI * r // la plantilla se enrolla por fuera
  const N = 144
  const curva: P[] = []
  let ymin = Infinity
  for (let i = 0; i <= N; i++) {
    const fi = (i / N) * 2 * Math.PI
    const x = (i / N) * circ
    const y = Math.sqrt(Math.max(0, Rr * Rr - ri * ri * Math.sin(fi) ** 2)) / Math.sin(a) - (ri * Math.cos(fi)) / Math.tan(a)
    curva.push([x, -y])
    ymin = Math.min(ymin, -y)
  }
  const L = Math.max(20, o.largo || 60)
  const base = ymin - L
  const contorno: P[] = [...curva, [circ, base], [0, base]]
  return encuadrar([{ pts: contorno, cerrado: true, capa: "corte" }], [["Largo de la plantilla (vuelta)", `${r1(circ)} mm`], ["Profundidad del corte", `${r1(Math.max(...curva.map((p) => p[1])) - ymin)} mm`]], [
    "Imprímela al 100 %, enróllala en el tubo que llega con la línea recta pareja y marca el corte. La unión (el 0) va arriba, en la línea del tubo principal.",
  ])
}
