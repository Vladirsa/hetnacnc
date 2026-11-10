// Lee los movimientos X/Y de un G-code (G0, G1, G2 y G3; modal) para dibujar
// la trayectoria. Corre en el servidor: al navegador le llega este dibujo, no
// el programa, que sólo se entrega al descargar.
export type Movimiento = { corte: boolean; pts: [number, number][]; z: number }

export function leerGcode(texto: string): Movimiento[] {
  const movs: Movimiento[] = []
  let x = 0, y = 0, z = 5
  let g = 0
  for (const crudo of texto.split(/\r?\n/)) {
    const l = crudo.replace(/\(.*?\)|;.*$/g, "").toUpperCase()
    if (!l.trim()) continue
    const val = (c: string) => {
      const m = new RegExp(`${c}\\s*(-?\\d*\\.?\\d+)`).exec(l)
      return m ? parseFloat(m[1]) : null
    }
    const gm = /G0?([0-3])(?!\d)/.exec(l)
    if (gm) g = parseInt(gm[1], 10)
    const nx = val("X") ?? x
    const ny = val("Y") ?? y
    const nz = val("Z") ?? z
    if (nx === x && ny === y) {
      z = nz
      continue
    }
    if (g === 2 || g === 3) {
      const cx = x + (val("I") ?? 0)
      const cy = y + (val("J") ?? 0)
      const r = Math.hypot(x - cx, y - cy)
      const a0 = Math.atan2(y - cy, x - cx)
      let a1 = Math.atan2(ny - cy, nx - cx)
      if (g === 2 && a1 >= a0) a1 -= Math.PI * 2
      if (g === 3 && a1 <= a0) a1 += Math.PI * 2
      const n = Math.max(4, Math.ceil((Math.abs(a1 - a0) * r) / 1.5))
      const pts: [number, number][] = []
      for (let i = 0; i <= n; i++) {
        const a = a0 + ((a1 - a0) * i) / n
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
      }
      movs.push({ corte: true, pts, z: nz })
    } else movs.push({ corte: g !== 0 && nz <= 0.01, pts: [[x, y], [nx, ny]], z: nz })
    x = nx
    y = ny
    z = nz
  }
  return movs
}
