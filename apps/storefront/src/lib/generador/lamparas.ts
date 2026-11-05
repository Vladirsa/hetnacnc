// Lámparas por capas (2D Studio): costillas verticales que se encastran en
// anillos horizontales, a media madera. La base es un disco con el hueco del
// socket (E27); los demás niveles son anillos. La forma sale de un perfil
// (cilindro, esfera, gota o jarrón).
//
//   costilla (de lado)        anillo (desde arriba)
//      ┌─╮                       ╭───╮
//      │  ╲  ← perfil r(z)      ╱ ┌─┐ ╲   ranuras desde la orilla
//   ═══╡   │ ← ranura          │  │ │  │
//      │   │   desde adentro    ╲ └─┘ ╱
//      └───┘                     ╰───╯
import { type P, type Trazo, acomodarEnHojas, arco, circulo, dibujo, trazo } from "@/lib/generador/geo2d"

export type FormaLampara = "cilindro" | "esfera" | "gota" | "jarron"

export type OpcionesLampara = {
  forma: FormaLampara
  alto: number
  diametro: number
  costillas: number
  niveles: number // anillos, contando la base
  espesor: number
  holgura: number
  socket: number // mm del hueco del socket
  anchoAnillo: number
  ventanas: boolean // calado en las costillas
  hoja: { ancho: number; alto: number }
}

/** Radio del perfil a la altura z (0 = base). */
export function perfil(forma: FormaLampara, z: number, H: number, R: number, rMin: number) {
  const u = Math.max(0, Math.min(1, z / H))
  let k = 1
  if (forma === "esfera") k = Math.sin(0.1 * Math.PI + 0.8 * Math.PI * u)
  else if (forma === "gota") k = Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.15)), 0.7) * (1 - 0.55 * u) + 0.12
  else if (forma === "jarron") k = 0.75 + 0.25 * Math.sin(Math.PI * (u * 1.6 - 0.25)) - 0.15 * u
  return Math.max(rMin, R * Math.min(1, k))
}

export function hacerLampara(o: OpcionesLampara) {
  const avisos: string[] = []
  const t = Math.max(1, o.espesor)
  const ranura = t + Math.max(0, o.holgura)
  const H = Math.max(80, o.alto)
  const R = Math.max(40, o.diametro / 2)
  const n = Math.round(Math.max(3, Math.min(36, o.costillas)))
  const niveles = Math.round(Math.max(2, Math.min(12, o.niveles)))
  const rSocket = Math.max(10, o.socket / 2)
  // Las costillas empiezan un poco afuera del socket
  const rc = rSocket + 6
  const rMin = rc + Math.max(14, t * 3)
  const r = (z: number) => perfil(o.forma, z, H, R, rMin)

  // Niveles: base pegada abajo, el último cerca de arriba, los demás repartidos
  const zs: number[] = []
  for (let i = 0; i < niveles; i++) zs.push(t * 2 + ((H - t * 4) * i) / (niveles - 1))

  // Costilla: polígono en (x = radio, y = altura), del borde de adentro (rc) al perfil
  const N = 60
  const exterior: P[] = []
  for (let i = 0; i <= N; i++) {
    const z = (H * i) / N
    exterior.push([r(z), z])
  }
  // borde de adentro, de arriba hacia abajo, con las ranuras de cada nivel
  const adentro: P[] = []
  const zsBajando = [...zs].sort((a, b) => b - a)
  adentro.push([rc, H])
  for (const z of zsBajando) {
    const mitad = rc + (r(z) - rc) / 2
    adentro.push([rc, z + ranura / 2], [mitad, z + ranura / 2], [mitad, z - ranura / 2], [rc, z - ranura / 2])
  }
  adentro.push([rc, 0])
  const costilla: Trazo[] = [trazo([...exterior, ...adentro])]
  // Ventanas: entre niveles, si la costilla es ancha
  if (o.ventanas) {
    const orden = [...zs].sort((a, b) => a - b)
    for (let i = 0; i < orden.length - 1; i++) {
      const z0 = orden[i] + ranura / 2 + 8
      const z1 = orden[i + 1] - ranura / 2 - 8
      if (z1 - z0 < 20) continue
      const pts: P[] = []
      const M = 16
      const marg = Math.max(6, t * 1.5)
      let ok = true
      for (let j = 0; j <= M; j++) {
        const z = z0 + ((z1 - z0) * j) / M
        const x = r(z) - marg
        if (x - (rc + (r(z) - rc) / 2 + 2) < 6) ok = false
        pts.push([x, z])
      }
      if (!ok) continue
      for (let j = M; j >= 0; j--) {
        const z = z0 + ((z1 - z0) * j) / M
        pts.push([rc + (r(z) - rc) / 2 + 3, z])
      }
      costilla.push(trazo(pts))
    }
  }
  const grupos: Trazo[][] = []
  for (let i = 0; i < n; i++) grupos.push(costilla)

  // Anillos (y la base): ranuras desde la orilla hasta la mitad de la costilla
  zs.forEach((z, i) => {
    const Ro = r(z)
    const fondo = rc + (Ro - rc) / 2 // radio hasta donde llega la ranura
    const base = i === 0
    const rIn = base ? rSocket : Math.max(rc - 4, fondo - Math.max(o.anchoAnillo, 8))
    const pts: P[] = []
    const paso = (Math.PI * 2) / n
    const dA = Math.asin(Math.min(0.9, ranura / 2 / Ro))
    for (let k = 0; k < n; k++) {
      const c = k * paso
      // ranura centrada en c
      const yr = ranura / 2
      const xe = Math.sqrt(Math.max(0, Ro * Ro - yr * yr))
      const g = (x: number, y: number): P => [x * Math.cos(c) - y * Math.sin(c), x * Math.sin(c) + y * Math.cos(c)]
      pts.push(g(xe, -yr), g(fondo, -yr), g(fondo, yr), g(xe, yr))
      for (const p of arco(0, 0, Ro, c + dA, c + paso - dA).slice(1, -1)) pts.push(p)
    }
    const pieza: Trazo[] = [trazo(pts), circulo(0, 0, rIn)]
    if (!base && fondo - rIn < 4) avisos.push(`El anillo ${i + 1} queda muy delgado: baja el número de costillas o haz la lámpara más ancha.`)
    grupos.push(pieza)
  })

  const res = acomodarEnHojas(grupos, o.hoja, 5)
  if (res.noCaben) avisos.push(`${res.noCaben} piezas no caben en la hoja: usa una hoja más grande o una lámpara más chica.`)
  const separacion = (2 * Math.PI * r(H / 2)) / n
  if (separacion < t * 4) avisos.push("Las costillas quedan muy juntas: baja su número.")
  avisos.push(`Hueco del socket: ${Math.round(rSocket * 2)} mm. Mide tu socket con aro (los E27 comunes van de 28 a 40 mm).`)
  avisos.push("Usa focos LED (no calientan). Con focos incandescentes la madera se puede quemar.")
  return {
    dibujo: dibujo(res.trazos, avisos),
    avisos,
    piezas: grupos.length,
    hojas: res.hojas,
    perfilPts: exterior,
  }
}
