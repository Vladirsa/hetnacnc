// COPIA de apps/storefront/src/lib/simulador/torno.ts (el servidor califica con el mismo motor).
// No editar aquí: edita el original y copia. Una prueba revisa que sean iguales.
// Simulador CNC de la Academia HETNA: torno CNC de 2 ejes (X y Z), estilo Fanuc.
//
// Reglas del torno (distintas a la fresadora):
//   - La pieza gira; la herramienta se mueve en X (diámetro) y Z (a lo largo).
//   - X se programa en DIÁMETRO. U y W son X y Z relativos (incrementales).
//   - Z = 0 es la cara de la pieza (el extremo libre); el material va hacia Z negativo.
//   - G99 (por omisión): avance en mm por vuelta. G98: mm por minuto.
//   - G96: velocidad de corte constante (S en m/min), con tope G50 S…; G97: S en RPM.
//   - G90 es el ciclo de cilindrado y G94 el de refrentado (en torno NO son
//     absoluto/incremental como en la fresadora).
//
// El perfil de la pieza (radio en cada Z) se va recortando mientras se lee el
// programa, así un rápido que pasa por donde ya se cortó no cuenta como choque.
// Lo que no simula (G71/G70, roscas, compensación de radio) lo avisa.

import { LARGO_TOTAL_MAX, LINEAS_MAX, palabras, RECORRIDO_MAX, type Alarma } from "./gcode"

export type PuntoT = { x: number; z: number } // x = RADIO (mm), z (mm)

export type MovimientoT = {
  linea: number
  tipo: "rapido" | "corte"
  puntos: PuntoT[]
  fMin: number // avance en mm/min (para animar)
  rpm: number
  husillo: boolean
  herramienta: number
  // Pase de roscado: avance = paso por vuelta; los surcos caen cada `paso` mm desde `fase`
  rosca?: { paso: number; fase: number }
}

export type Barra = { diametro: number; largo: number } // material en bruto
export type Inserto = { radioPunta: number }

export type ResultadoT = {
  movimientos: MovimientoT[]
  alarmas: Alarma[]
  lineas: string[]
  tiempoMin: number
}

export const RAPIDO_TORNO = 6000 // mm/min
export const INICIO_TORNO: PuntoT = { x: 60, z: 50 } // posición de cambio de herramienta (radio 60 = X120)

/** Perfil de la pieza: radio que queda en cada Z (de 0 hacia -largo). */
export class Perfil {
  readonly paso: number
  readonly n: number
  readonly largo: number
  readonly radio0: number
  readonly r: Float32Array

  constructor(b: Barra, paso = 0.1) {
    this.paso = paso
    this.largo = b.largo
    this.radio0 = b.diametro / 2
    this.n = Math.max(2, Math.round(b.largo / paso) + 1)
    this.r = new Float32Array(this.n).fill(this.radio0)
  }

  reiniciar() {
    this.r.fill(this.radio0)
  }

  /** Índice de la celda en esa Z, o -1 si está fuera de la barra. */
  indice(z: number) {
    if (z > 0 || z < -this.largo) return -1
    return Math.min(this.n - 1, Math.max(0, Math.round(-z / this.paso)))
  }

  radioEn(z: number) {
    const i = this.indice(z)
    return i < 0 ? 0 : this.r[i]
  }

  /** ¿El punto queda dentro del material que todavía no se corta? */
  dentro(p: PuntoT, holgura = 0.02) {
    const i = this.indice(p.z)
    return i >= 0 && Math.max(0, p.x) < this.r[i] - holgura
  }

  /** Corta con la punta redonda del inserto a lo largo de a → b. Regresa true si quitó algo. */
  cortar(a: PuntoT, b: PuntoT, ins: Inserto): boolean {
    const rn = Math.max(0, ins.radioPunta)
    const largo = Math.hypot(b.x - a.x, b.z - a.z)
    const pasos = Math.max(1, Math.ceil(largo / (this.paso * 0.5)))
    const k = Math.ceil(rn / this.paso)
    let quito = false
    for (let s = 0; s <= pasos; s++) {
      const t = s / pasos
      const x = a.x + (b.x - a.x) * t
      const z = a.z + (b.z - a.z) * t
      const c = Math.round(-z / this.paso)
      for (let i = Math.max(0, c - k); i <= Math.min(this.n - 1, c + k); i++) {
        if (i < 0) continue
        const dz = Math.abs(-i * this.paso - z)
        if (dz > rn + 1e-9 && rn > 0) continue
        if (rn === 0 && i !== c) continue
        const rr = Math.max(0, x + (rn - Math.sqrt(Math.max(0, rn * rn - dz * dz))))
        if (rr < this.r[i]) {
          this.r[i] = rr
          quito = true
        }
      }
    }
    return quito
  }

  /**
   * Pase de roscado con inserto de 60°: el surco se repite cada `paso` mm a
   * partir de `fase` (el husillo sincroniza todas las pasadas en el mismo hilo).
   * En este modelo la rosca se ve como surcos anulares, que es lo que importa
   * para medir: diámetro de fondo, de cresta y paso.
   */
  cortarRosca(a: PuntoT, b: PuntoT, paso: number, fase: number): boolean {
    if (!(paso > 0)) return false
    const zMin = Math.min(a.z, b.z), zMax = Math.max(a.z, b.z)
    const flanco = Math.sqrt(3) // tan(60°): el radio del inserto sube 1.732 mm por cada mm de lado
    const i0 = Math.max(0, Math.floor(-(zMax + paso / 2) / this.paso))
    const i1 = Math.min(this.n - 1, Math.ceil(-(zMin - paso / 2) / this.paso))
    let quito = false
    for (let i = i0; i <= i1; i++) {
      const z = -i * this.paso
      const zc = fase - Math.round((fase - z) / paso) * paso // centro del surco más cercano
      if (zc < zMin - 1e-9 || zc > zMax + 1e-9) continue
      const t = zMax - zMin < 1e-9 ? 0 : (zc - a.z) / (b.z - a.z)
      const xt = a.x + (b.x - a.x) * t
      const rr = Math.max(0, xt + flanco * Math.abs(z - zc))
      if (rr < this.r[i]) {
        this.r[i] = rr
        quito = true
      }
    }
    return quito
  }

  /** Volumen quitado en cm³. */
  volumenQuitado() {
    let s = 0
    for (let i = 0; i < this.n; i++) s += Math.PI * (this.radio0 ** 2 - this.r[i] ** 2) * this.paso
    return s / 1000
  }
}

/** Aplica un movimiento de corte (normal o de rosca) al perfil entre a y b. */
export function cortarMovimiento(perfil: Perfil, m: Pick<MovimientoT, "rosca">, a: PuntoT, b: PuntoT, ins: Inserto) {
  return m.rosca ? perfil.cortarRosca(a, b, m.rosca.paso, m.rosca.fase) : perfil.cortar(a, b, ins)
}

/** Puntos de un arco en el plano XZ (x = radio). horario = G2 (vista con X hacia arriba y Z a la derecha). */
function arcoXZ(a: PuntoT, b: PuntoT, c: { x: number; z: number }, horario: boolean): PuntoT[] {
  // ángulos en el plano (z, x)
  const r = Math.hypot(a.z - c.z, a.x - c.x)
  const a0 = Math.atan2(a.x - c.x, a.z - c.z)
  const a1 = Math.atan2(b.x - c.x, b.z - c.z)
  let barrido = a1 - a0
  if (horario) {
    if (barrido >= 0) barrido -= 2 * Math.PI
  } else if (barrido <= 0) barrido += 2 * Math.PI
  const n = Math.min(360, Math.max(6, Math.ceil((Math.abs(barrido) * r) / 0.3)))
  const pts: PuntoT[] = []
  for (let i = 0; i <= n; i++) {
    const ang = a0 + (barrido * i) / n
    pts.push({ z: c.z + r * Math.cos(ang), x: c.x + r * Math.sin(ang) })
  }
  pts[pts.length - 1] = { ...b }
  return pts
}

function centroPorRXZ(a: PuntoT, b: PuntoT, R: number, horario: boolean) {
  const dz = b.z - a.z
  const dx = b.x - a.x
  const d = Math.hypot(dz, dx)
  const Ra = Math.abs(R)
  if (d < 1e-9 || d > 2 * Ra + 1e-6) return null
  const h = Math.sqrt(Math.max(0, Ra * Ra - (d / 2) ** 2))
  const mz = a.z + dz / 2
  const mx = a.x + dx / 2
  let lado = horario ? -1 : 1
  if (R < 0) lado = -lado
  // misma regla que en XY, con (z, x) en lugar de (x, y)
  return { z: mz - (lado * h * dx) / d, x: mx + (lado * h * dz) / d }
}

export function interpretarTorno(texto: string, barra: Barra, inserto: Inserto): ResultadoT {
  const lineas = String(texto || "").replace(/\r/g, "").split("\n").slice(0, LINEAS_MAX)
  const perfil = new Perfil(barra, 0.1)
  const movimientos: MovimientoT[] = []
  const alarmas: Alarma[] = []
  const avisados = new Set<string>()
  const aviso = (linea: number, clave: string, mensaje: string) => {
    if (avisados.has(clave)) return
    avisados.add(clave)
    alarmas.push({ linea, nivel: "aviso", mensaje })
  }
  const error = (linea: number, mensaje: string) => alarmas.push({ linea, nivel: "error", mensaje })

  let pos: PuntoT = { ...INICIO_TORNO }
  let modo = 0 // 0 1 2 3 90 94
  let factor = 1
  let porVuelta = true // G99
  let css = false // G96
  let f = 0
  let s = 0
  let tope = 0 // G50 S
  let husillo = false
  let herramienta = 0
  let tiempo = 0
  let errores = 0
  let ciclo: { inicio: PuntoT; ultimo: PuntoT | null } | null = null
  let largoTotal = 0
  let detenido = false

  const rpmEn = (radio: number) => {
    if (!css) return s
    const d = Math.max(2 * radio, 1)
    let rpm = (1000 * s) / (Math.PI * d)
    if (tope > 0) rpm = Math.min(rpm, tope)
    return rpm
  }

  // libre = salida del roscado: la herramienta sale del surco, no es choque
  const mover = (linea: number, tipo: MovimientoT["tipo"], puntos: PuntoT[], rosca?: { paso: number; fase: number }, libre = false) => {
    if (puntos.length < 2 || detenido) return
    if (puntos.some((p) => !(Math.abs(p.x) <= RECORRIDO_MAX && Math.abs(p.z) <= RECORRIDO_MAX))) {
      error(linea, `Fuera de recorrido: la máquina no llega a ±${RECORRIDO_MAX} mm. Revisa las coordenadas (¿pulgadas en lugar de milímetros?).`)
      errores++
      detenido = true
      return
    }
    const largo = puntos.slice(1).reduce((acc, p, i) => acc + Math.hypot(p.x - puntos[i].x, p.z - puntos[i].z), 0)
    if (largo < 1e-9) return
    largoTotal += largo
    if (largoTotal > LARGO_TOTAL_MAX) {
      error(linea, `El programa es demasiado largo para el simulador (más de ${LARGO_TOTAL_MAX / 1000} m de recorrido).`)
      errores++
      detenido = true
      return
    }
    const rpm = rpmEn(Math.min(...puntos.map((p) => p.x)))
    const fMin = tipo === "rapido" ? RAPIDO_TORNO : rosca ? rosca.paso * Math.max(rpm, 1) : porVuelta ? f * Math.max(rpm, 1) : f
    tiempo += largo / Math.max(fMin, 1)
    movimientos.push({ linea, tipo, puntos, fMin, rpm, husillo, herramienta, ...(rosca ? { rosca } : {}) })
    // Choques y cortes indebidos contra el material que queda en este momento
    let toca = false
    for (let i = 1; i < puntos.length && !toca && !libre; i++) {
      const a = puntos[i - 1], b = puntos[i]
      const pasos = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.2))
      for (let k = 0; k <= pasos && !toca; k++) {
        const t = k / pasos
        toca = perfil.dentro({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t })
      }
    }
    if (toca && tipo === "rapido") {
      error(linea, "Choque: movimiento rápido (G0) contra el material. Acércate con G0 por fuera de la pieza y entra a cortar con G1.")
      errores++
    } else if (toca && !husillo) {
      error(linea, "La herramienta toca la pieza con el husillo apagado. Enciéndelo con M3 (o M4) y S antes de cortar.")
      errores++
    }
    // Aunque haya error se marca lo que tocó, para no sumar alarmas falsas después
    if (tipo === "corte" || toca)
      for (let i = 1; i < puntos.length; i++) {
        if (rosca && tipo === "corte") perfil.cortarRosca(puntos[i - 1], puntos[i], rosca.paso, rosca.fase)
        else perfil.cortar(puntos[i - 1], puntos[i], inserto)
      }
    // Refrentar a X-1 o X-2 (pasar un poco del centro) es normal; más allá es error de programa
    if (Math.min(...puntos.map((p) => p.x)) < -1.5) aviso(linea, "centro", "La herramienta pasa más de 3 mm del centro de la pieza (X muy negativo): revisa el diámetro.")
  }

  const faltaF = (n: number) => {
    if (f > 0) return false
    error(n, "Falta el avance: escribe F antes de cortar (en G99 es mm por vuelta, por ejemplo F0.2).")
    errores++
    return true
  }

  // Número de bloque (N) → índice de línea, para los ciclos G71/G70 (P y Q)
  const mapaN = new Map<number, number>()
  lineas.forEach((l, i) => {
    const nb = palabras(l).find((w) => w.letra === "N")
    if (nb && !mapaN.has(nb.valor)) mapaN.set(nb.valor, i)
  })
  let g71U = 1 // profundidad por pasada (radio)
  let g76m = 1 // pasadas de acabado al fondo
  let g76min = 0.05 // profundidad mínima por pasada (mm)
  let g76fin = 0.05 // sobrante para la pasada de acabado (mm)
  let g71R = 0.5 // retiro

  /**
   * Trayectoria de los bloques del perfil (de la línea iNs a iNf) desde `desde`:
   * G0/G1/G2/G3 con X/U/Z/W, R o I/K, y su F. No mueve la máquina: la usan G71 y G70.
   */
  const bloquesPerfil = (iNs: number, iNf: number, desde: PuntoT) => {
    const tramos: { linea: number; tipo: MovimientoT["tipo"]; puntos: PuntoT[]; f: number | null }[] = []
    let p = { ...desde }
    let mov = 1
    let fp: number | null = null
    for (let k = iNs; k <= iNf; k++) {
      const w = palabras(lineas[k]).filter((x) => x.letra !== "N")
      const val = (l: string) => w.find((x) => x.letra === l)?.valor
      const hay = (l: string) => w.some((x) => x.letra === l)
      for (const x of w) if (x.letra === "G" && [0, 1, 2, 3].includes(x.valor)) mov = x.valor
      if (hay("F")) fp = val("F")! * factor
      if (!(hay("X") || hay("Z") || hay("U") || hay("W"))) continue
      const b = {
        x: hay("X") ? (val("X")! * factor) / 2 : hay("U") ? p.x + (val("U")! * factor) / 2 : p.x,
        z: hay("Z") ? val("Z")! * factor : hay("W") ? p.z + val("W")! * factor : p.z,
      }
      if (mov === 2 || mov === 3) {
        const c = hay("R") ? centroPorRXZ(p, b, val("R")! * factor, mov === 2) : hay("I") || hay("K") ? { x: p.x + (val("I") || 0) * factor, z: p.z + (val("K") || 0) * factor } : null
        tramos.push({ linea: k + 1, tipo: "corte", puntos: c ? arcoXZ(p, b, c, mov === 2) : [p, b], f: fp })
      } else tramos.push({ linea: k + 1, tipo: mov === 0 ? "rapido" : "corte", puntos: [p, b], f: fp })
      p = b
    }
    return tramos
  }

  for (let i = 0; i < lineas.length; i++) {
    const n = i + 1
    const crudo = lineas[i].trim()
    if (!crudo || crudo === "%") continue
    const ws = palabras(crudo).filter((w) => w.letra !== "N")
    if (!ws.length) continue
    const v = (l: string) => ws.find((w) => w.letra === l)?.valor
    const tiene = (l: string) => ws.some((w) => w.letra === l)
    let movAhora: number | null = null
    let terminar = false
    let g28 = false
    let esG50 = false
    let g7x = 0

    for (const w of ws) {
      if (w.letra === "G") {
        const g = w.valor
        if ([0, 1, 2, 3, 32, 90, 92, 94].includes(g)) movAhora = g
        else if (g === 4 || g === 18 || g === 40 || g === 80) { /* aceptados */ }
        else if (g === 20) factor = 25.4
        else if (g === 21) factor = 1
        else if (g === 28) g28 = true
        else if (g === 50) esG50 = true
        else if (g === 96) css = true
        else if (g === 97) css = false
        else if (g === 98) porVuelta = false
        else if (g === 99) porVuelta = true
        else if (g === 41 || g === 42) aviso(n, "comp", "G41/G42 (compensación de radio de punta): no se simula; el corte se dibuja con la punta programada.")
        else if (g === 70 || g === 71) g7x = g
        else if (g === 72 || g === 73) aviso(n, `g${g}`, `G${g} (desbaste de cara / repetición de perfil) todavía no se simula: se ignora. Usa G71 y G70.`)
        else if (g === 76) g7x = 76
        else if (g === 91) aviso(n, "g91", "En el torno los movimientos relativos se escriben con U (en X) y W (en Z), no con G91.")
        else aviso(n, `g${g}`, `G${g} no se simula; se ignora.`)
      } else if (w.letra === "M") {
        const m = w.valor
        if (m === 3 || m === 4) husillo = true
        else if (m === 5) husillo = false
        else if (m === 30 || m === 2) terminar = true
        else if (![0, 1, 8, 9].includes(m)) aviso(n, `m${m}`, `M${m} no se simula; se ignora.`)
      } else if (w.letra === "F") f = w.valor * factor
      else if (w.letra === "S") {
        if (esG50) tope = w.valor
        else s = w.valor
      } else if (w.letra === "T") herramienta = Math.floor(w.valor / 100) || w.valor
      else if (!"XZUWIKRPQ".includes(w.letra)) aviso(n, `l${w.letra}`, `La letra ${w.letra} no se reconoce en torno; se ignora.`)
    }
    if (esG50) continue // G50 S… sólo pone el tope de RPM

    // ── G71 (desbaste por capas) y G70 (acabado) estilo Fanuc ──────────────
    //   G71 U(prof. por pasada, radio) R(retiro)
    //   G71 P(N inicio) Q(N fin) U(sobrante en X, diámetro) W(sobrante en Z) F…
    //   G70 P(N inicio) Q(N fin)
    // ── G76: ciclo de roscado automático (dos bloques, estilo Fanuc) ────────
    //   G76 P(mm rr aa) Q(prof. mínima, micras) R(sobrante de acabado, mm)
    //   G76 X(diám. de fondo) Z(fin) P(altura del hilo, micras) Q(1.ª pasada, micras) F(paso)
    if (g7x === 76) {
      if (!(tiene("X") || tiene("U") || tiene("Z") || tiene("W"))) {
        if (tiene("P")) g76m = Math.max(1, Math.floor(v("P")! / 10000) || 1)
        if (tiene("Q")) g76min = Math.max(0.005, v("Q")! / 1000)
        if (tiene("R")) g76fin = Math.max(0, v("R")! * factor)
        continue
      }
      const paso = (v("F") ?? 0) * factor
      if (!(paso > 0)) {
        error(n, "G76: falta F, el paso de la rosca en mm (por ejemplo F1.5 para M20×1.5).")
        errores++
        continue
      }
      if (!husillo) {
        error(n, "La herramienta toca la pieza con el husillo apagado. Enciéndelo con M3 y S antes de roscar.")
        errores++
      }
      if (css) aviso(n, "g96-rosca", "Para roscar usa RPM fijas (G97): con G96 las revoluciones cambian y el hilo se puede echar a perder.")
      const o = { ...pos }
      const raiz = tiene("X") ? (v("X")! * factor) / 2 : tiene("U") ? pos.x + (v("U")! * factor) / 2 : pos.x
      const zFin = tiene("Z") ? v("Z")! * factor : tiene("W") ? pos.z + v("W")! * factor : pos.z
      const h = (v("P") ?? 0) / 1000
      const d1 = Math.max(g76min, (v("Q") ?? 0) / 1000)
      if (!(h > 0) || !(d1 > 0)) {
        error(n, "G76: falta la altura del hilo (P, en micras) o la primera pasada (Q, en micras).")
        errores++
        continue
      }
      const cresta = raiz + h
      // Pasadas cada vez más finas (√n) hasta la altura menos el sobrante, luego acabado
      const profundidades: number[] = []
      let prev = 0
      for (let k = 1; k < 200; k++) {
        let d = d1 * Math.sqrt(k)
        if (d - prev < g76min) d = prev + g76min
        if (d >= h - g76fin) break
        profundidades.push(d)
        prev = d
      }
      for (let k = 0; k < g76m; k++) profundidades.push(h)
      if (g76fin > 0) profundidades.splice(profundidades.length - g76m, 0, h - g76fin)
      for (const d of profundidades) {
        const xp = cresta - d
        mover(n, "rapido", [pos, { x: xp, z: o.z }])
        mover(n, "corte", [{ x: xp, z: o.z }, { x: xp, z: zFin }], { paso, fase: o.z })
        mover(n, "rapido", [{ x: xp, z: zFin }, { x: o.x, z: zFin }], undefined, true)
        mover(n, "rapido", [{ x: o.x, z: zFin }, o])
        pos = { ...o }
      }
      continue
    }

    if (g7x === 71 || g7x === 70) {
      if (g7x === 71 && !(tiene("P") && tiene("Q"))) {
        if (tiene("U")) g71U = Math.max(0.05, v("U")! * factor)
        if (tiene("R")) g71R = Math.max(0, v("R")! * factor)
        continue
      }
      const iNs = mapaN.get(v("P") ?? -1)
      const iNf = mapaN.get(v("Q") ?? -1)
      if (iNs === undefined || iNf === undefined || iNf < iNs) {
        error(n, `G${g7x}: no encuentro los bloques N${v("P") ?? "?"} a N${v("Q") ?? "?"} del perfil. Numera el perfil con N y pon esos números en P y Q.`)
        errores++
        continue
      }
      const inicio = { ...pos }
      const tramos = bloquesPerfil(iNs, iNf, inicio)
      if (!tramos.length) {
        error(n, `G${g7x}: el perfil entre N${v("P")} y N${v("Q")} no tiene movimientos.`)
        errores++
        continue
      }
      if (g7x === 70) {
        // Acabado: recorre el perfil con su F (o la actual) y regresa al punto de inicio
        const fAntes = f
        for (const t of tramos) {
          if (t.f) f = t.f
          if (t.tipo === "corte" && faltaF(t.linea)) break
          mover(t.linea, t.tipo, t.puntos)
        }
        const fin = tramos[tramos.length - 1].puntos.slice(-1)[0]
        mover(n, "rapido", [fin, { x: inicio.x, z: fin.z }])
        mover(n, "rapido", [{ x: inicio.x, z: fin.z }, inicio])
        f = fAntes
        pos = inicio
        continue
      }
      // G71: desbaste por capas dejando el sobrante, y una pasada por el perfil con sobrante
      faltaF(n)
      const uS = ((v("U") ?? 0) * factor) / 2
      const wS = (v("W") ?? 0) * factor
      const contorno = tramos.flatMap((t, k) => (k === 0 ? t.puntos.slice(1) : t.puntos.slice(1))).map((p) => ({ x: p.x + uS, z: p.z + wS }))
      const xMin = Math.min(...contorno.map((p) => p.x))
      const zFin = contorno[contorno.length - 1].z
      const finCapa = (xl: number) => {
        // primera Z (desde la cara) donde el perfil llega al nivel xl
        for (let k = 1; k < contorno.length; k++) {
          const a = contorno[k - 1], b = contorno[k]
          if (b.x >= xl - 1e-9 && a.x < xl) return b.x === a.x ? b.z : a.z + ((xl - a.x) / (b.x - a.x)) * (b.z - a.z)
          if (a.x >= xl - 1e-9 && k === 1) return a.z
        }
        return zFin
      }
      let xl = inicio.x - g71U
      let actual = { ...inicio }
      let capas = 0
      while (xl > xMin + 1e-6 && capas < 400 && !detenido) {
        const zc = finCapa(xl)
        if (zc < inicio.z - 1e-6) {
          const a = { x: xl, z: inicio.z }
          const b = { x: xl, z: zc }
          const c = { x: Math.min(xl + g71R, inicio.x), z: Math.min(zc + g71R, inicio.z) }
          mover(n, "rapido", [actual, a])
          mover(n, "corte", [a, b])
          mover(n, "corte", [b, c])
          mover(n, "rapido", [c, { x: c.x, z: inicio.z }])
          actual = { x: c.x, z: inicio.z }
        }
        xl -= g71U
        capas++
      }
      // pasada por el perfil con el sobrante
      mover(n, "rapido", [actual, contorno[0]])
      for (let k = 1; k < contorno.length; k++) mover(n, "corte", [contorno[k - 1], contorno[k]])
      const ultimo = contorno[contorno.length - 1]
      mover(n, "rapido", [ultimo, { x: inicio.x, z: ultimo.z }])
      mover(n, "rapido", [{ x: inicio.x, z: ultimo.z }, inicio])
      pos = inicio
      i = iNf // los bloques del perfil no se ejecutan solos: los usa el ciclo
      continue
    }
    if (movAhora !== null) {
      if ((movAhora === 90 || movAhora === 92 || movAhora === 94) && !(ciclo && modo === movAhora)) ciclo = { inicio: { ...pos }, ultimo: null }
      if (movAhora !== 90 && movAhora !== 92 && movAhora !== 94) ciclo = null // otro G cancela el ciclo; sin G sigue el ciclo
      modo = movAhora
    }

    // Destino: X en diámetro (se guarda como radio), U/W relativos
    const hayEjes = tiene("X") || tiene("Z") || tiene("U") || tiene("W")
    const dest = (): PuntoT => {
      let x = pos.x
      let z = pos.z
      if (tiene("X")) x = (v("X")! * factor) / 2
      else if (tiene("U")) x = pos.x + (v("U")! * factor) / 2
      if (tiene("Z")) z = v("Z")! * factor
      else if (tiene("W")) z = pos.z + v("W")! * factor
      return { x, z }
    }

    if (g28) {
      const casa = { ...INICIO_TORNO }
      mover(n, "rapido", [pos, { x: casa.x, z: pos.z }])
      mover(n, "rapido", [{ x: casa.x, z: pos.z }, casa])
      pos = casa
    } else if (hayEjes) {
      const b = dest()
      if (modo === 0) {
        mover(n, "rapido", [pos, b])
        pos = b
      } else if (modo === 1) {
        faltaF(n)
        mover(n, "corte", [pos, b])
        pos = b
      } else if (modo === 2 || modo === 3) {
        faltaF(n)
        const horario = modo === 2
        let c: { x: number; z: number } | null = null
        if (tiene("R")) {
          c = centroPorRXZ(pos, b, (v("R") || 0) * factor, horario)
          if (!c) {
            error(n, "Arco imposible: el radio R es más chico que la mitad de la distancia entre el inicio y el final.")
            errores++
          }
        } else if (tiene("I") || tiene("K")) {
          // I en radio (Fanuc), K en Z; ambos relativos al inicio
          c = { x: pos.x + (v("I") || 0) * factor, z: pos.z + (v("K") || 0) * factor }
          const r0 = Math.hypot(pos.x - c.x, pos.z - c.z)
          const r1 = Math.hypot(b.x - c.x, b.z - c.z)
          if (Math.abs(r0 - r1) > 0.05) {
            error(n, `Arco mal definido: el radio al inicio (${r0.toFixed(3)}) y al final (${r1.toFixed(3)}) no coinciden. Revisa I, K y el punto final.`)
            errores++
            c = null
          }
        } else {
          error(n, "Arco sin centro: en torno G2/G3 necesita R, o I (en X, radio) y K (en Z).")
          errores++
        }
        mover(n, "corte", c ? arcoXZ(pos, b, c, horario) : [pos, b])
        pos = b
      } else if (modo === 32) {
        // Pase de rosca suelto: F es el paso; la fase sale de la Z donde arranca
        if (!(f > 0)) {
          error(n, "G32: falta F, el paso de la rosca en mm.")
          errores++
        }
        if (css) aviso(n, "g96-rosca", "Para roscar usa RPM fijas (G97): con G96 las revoluciones cambian y el hilo se puede echar a perder.")
        mover(n, "corte", [pos, b], { paso: f, fase: pos.z })
        pos = b
      } else if ((modo === 90 || modo === 92 || modo === 94) && ciclo) {
        // Ciclos simples de Fanuc. El punto de inicio es donde estaba la herramienta.
        faltaF(n)
        const o = ciclo.inicio
        // El ciclo recuerda la X y la Z de su línea anterior (por eso basta escribir "X34")
        if (ciclo.ultimo) {
          if (!tiene("X") && !tiene("U")) b.x = ciclo.ultimo.x
          if (!tiene("Z") && !tiene("W")) b.z = ciclo.ultimo.z
        }
        ciclo.ultimo = { ...b }
        if (modo === 92) {
          // Roscado: rápido a X, pase de rosca hasta Z (F = paso), salida y regreso
          if (css) aviso(n, "g96-rosca", "Para roscar usa RPM fijas (G97): con G96 las revoluciones cambian y el hilo se puede echar a perder.")
          const p1 = { x: b.x, z: o.z }
          const p2 = { x: b.x, z: b.z }
          const p3 = { x: o.x, z: b.z }
          mover(n, "rapido", [pos, p1])
          mover(n, "corte", [p1, p2], { paso: f, fase: o.z })
          mover(n, "rapido", [p2, p3], undefined, true)
          mover(n, "rapido", [p3, o])
        } else if (modo === 90) {
          // Cilindrado: rápido a X, corte hasta Z, salida en X al diámetro de inicio, rápido de regreso en Z
          const p1 = { x: b.x, z: o.z }
          const p2 = { x: b.x, z: b.z }
          const p3 = { x: o.x, z: b.z }
          mover(n, "rapido", [pos, p1])
          mover(n, "corte", [p1, p2])
          mover(n, "corte", [p2, p3])
          mover(n, "rapido", [p3, o])
        } else {
          // Refrentado: rápido a Z, corte hacia el centro hasta X, salida en Z, rápido de regreso en X
          const p1 = { x: o.x, z: b.z }
          const p2 = { x: b.x, z: b.z }
          const p3 = { x: b.x, z: o.z }
          mover(n, "rapido", [pos, p1])
          mover(n, "corte", [p1, p2])
          mover(n, "corte", [p2, p3])
          mover(n, "rapido", [p3, o])
        }
        pos = { ...o }
      }
    }

    if (terminar || detenido) break
    if (errores > 50) {
      error(n, "Demasiados errores: el simulador se detuvo aquí.")
      break
    }
  }
  if (!movimientos.some((m) => m.tipo === "corte")) aviso(1, "sin-corte", "El programa no tiene movimientos de corte (G1, G2, G3, G90 o G94).")
  alarmas.sort((a, b) => a.linea - b.linea)
  return { movimientos, alarmas, lineas, tiempoMin: tiempo }
}
