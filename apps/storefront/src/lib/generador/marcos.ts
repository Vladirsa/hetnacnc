// Marcos y portarretratos por capas (2D Studio):
//
//   1 Frente   ventana un poco más chica que la foto (la solapa la detiene)
//   2 Ranura   hueco del tamaño de la foto + holgura: ahí van vidrio y foto
//   3 Espalda  tapa lisa con el soporte (pata para mesa) o el colgador
//   4 Pata     (sólo para mesa) entra en la ranura de la espalda
//
// Se pegan 1 + 2 y la espalda se atornilla o se pega al final. Con material de
// 3 mm la ranura sobra para vidrio de 2 mm + foto.
import { type P, type Trazo, dibujo, mover, rect, trazo } from "@/lib/generador/geo2d"

export type Borde = "recto" | "redondo" | "feston" | "ochavado"
export type Soporte = "mesa" | "colgador" | "ninguno"

export type OpcionesMarco = {
  fotoAncho: number
  fotoAlto: number
  ancho: number // ancho del marco (de la orilla a la foto)
  solapa: number // mm que el frente tapa la foto
  holgura: number
  borde: Borde
  soporte: Soporte
  texto: ((t: string, alto: number, capa: string) => Trazo[]) | null
  leyenda: string
}

/** Contorno exterior según el estilo del borde. */
function exterior(W: number, H: number, borde: Borde, ancho: number): Trazo {
  if (borde === "recto") return rect(0, 0, W, H)
  if (borde === "redondo") return rect(0, 0, W, H, Math.min(ancho * 0.8, 20))
  if (borde === "ochavado") {
    const c = Math.min(ancho * 0.7, 18)
    return trazo([[c, 0], [W - c, 0], [W, c], [W, H - c], [W - c, H], [c, H], [0, H - c], [0, c]])
  }
  // festón: medios círculos a lo largo de cada lado
  const r = Math.max(4, Math.min(ancho * 0.25, 10))
  const pts: P[] = []
  const lado = (a: P, b: P) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1])
    const n = Math.max(2, Math.round(L / (r * 2.4)))
    const ux = (b[0] - a[0]) / L
    const uy = (b[1] - a[1]) / L
    // normal hacia afuera (el contorno va en sentido antihorario)
    const nx = uy
    const ny = -ux
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < 12; j++) {
        const u = (i + j / 12) / n
        const bulto = Math.sin(Math.PI * ((u * n) % 1)) * r * 0.6
        pts.push([a[0] + ux * L * u + nx * bulto, a[1] + uy * L * u + ny * bulto])
      }
    }
  }
  const m = r * 0.6
  lado([m, m], [W - m, m])
  lado([W - m, m], [W - m, H - m])
  lado([W - m, H - m], [m, H - m])
  lado([m, H - m], [m, m])
  return trazo(pts)
}

export function hacerMarco(o: OpcionesMarco) {
  const avisos: string[] = []
  const fw = Math.max(30, o.fotoAncho)
  const fh = Math.max(30, o.fotoAlto)
  const a = Math.max(10, o.ancho)
  const W = fw + 2 * a
  const H = fh + 2 * a
  const sep = 15
  const piezas: { nombre: string; trazos: Trazo[] }[] = []
  // 1 Frente
  const s = Math.max(2, Math.min(o.solapa, Math.min(fw, fh) / 4))
  const frente: Trazo[] = [exterior(W, H, o.borde, a), rect(a + s, a + s, W - a - s, H - a - s, 0)]
  if (o.leyenda.trim() && o.texto) {
    const alto = Math.min(a * 0.45, 12)
    const t = o.texto(o.leyenda, alto, "grabado")
    for (const tr of t) frente.push({ ...tr, pts: mover(tr.pts, W / 2, a / 2) })
    if (alto < 4) avisos.push("El marco es angosto para el texto: haz el marco más ancho o el texto más corto.")
  }
  piezas.push({ nombre: "Frente", trazos: frente })
  // 2 Ranura (foto + vidrio)
  const h = Math.max(0, o.holgura)
  piezas.push({ nombre: "Ranura", trazos: [exterior(W, H, o.borde, a), rect(a - h, a - h, W - a + h, H - a + h, 0)] })
  // 3 Espalda
  const espalda: Trazo[] = [exterior(W, H, o.borde, a)]
  const ranuraPata = { w: Math.min(30, W * 0.25), t: 3.4 }
  if (o.soporte === "mesa") {
    // ranura para la pata, a 1/3 de la altura desde arriba
    const y = H * 0.62
    espalda.push(rect(W / 2 - ranuraPata.w / 2, y, W / 2 + ranuraPata.w / 2, y + ranuraPata.t))
  } else if (o.soporte === "colgador") {
    // ojo de cerradura: círculo de 8 mm con canal de 4 mm hacia arriba
    const cx = W / 2
    const cy = H - a * 0.9 - 10
    const ojo: P[] = []
    const r1 = 4
    const r2 = 2
    const b = Math.asin(r2 / r1)
    for (let i = 0; i <= 24; i++) {
      const ang = Math.PI / 2 + b + ((Math.PI * 2 - 2 * b) * i) / 24
      ojo.push([cx + r1 * Math.cos(ang), cy + r1 * Math.sin(ang)])
    }
    const yTope = cy + 10
    ojo.push([cx + r2, cy + r1 * Math.cos(b)])
    for (let i = 0; i <= 12; i++) {
      const ang = (Math.PI * i) / 12
      ojo.push([cx + r2 * Math.cos(ang), yTope + r2 * Math.sin(ang)])
    }
    ojo.push([cx - r2, cy + r1 * Math.cos(b)])
    espalda.push(trazo(ojo))
  }
  piezas.push({ nombre: "Espalda", trazos: espalda })
  // 4 Pata para mesa: cuña larga con una lengüeta en la punta que entra en la
  // ranura de la espalda (la pata es más ancha que la ranura, así se detiene)
  if (o.soporte === "mesa") {
    const L = H * 0.6
    const lw = ranuraPata.w - 0.4
    const Wb = lw + 8
    const pts: P[] = [
      [0, 0], [L, (Wb - 20) / 2], [L, (Wb + 20) / 2], [0, Wb],
      [0, (Wb + lw) / 2], [-6, (Wb + lw) / 2], [-6, (Wb - lw) / 2], [0, (Wb - lw) / 2],
    ]
    piezas.push({ nombre: "Pata", trazos: [trazo(pts)] })
  }
  // Acomodo en una fila
  const trazos: Trazo[] = []
  let x = 0
  for (const p of piezas) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity
    for (const t of p.trazos) for (const [px, py] of t.pts) {
      if (px < x0) x0 = px
      if (px > x1) x1 = px
      if (py < y0) y0 = py
    }
    for (const t of p.trazos) trazos.push({ ...t, pts: mover(t.pts, x - x0, -y0) })
    x += x1 - x0 + sep
  }
  avisos.push(`Frente y ranura se pegan juntos; la ranura deja ${h} mm de juego para meter vidrio y foto.`)
  if (o.soporte === "mesa") avisos.push("La pata entra en la ranura de la espalda; corta todo en material de 3 mm para que ajuste.")
  return { dibujo: dibujo(trazos, avisos), avisos, piezas: piezas.length, exterior: [W, H] as [number, number] }
}
