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

  /** Volumen quitado en cm³. */
  volumenQuitado() {
    let s = 0
    for (let i = 0; i < this.n; i++) s += Math.PI * (this.radio0 ** 2 - this.r[i] ** 2) * this.paso
    return s / 1000
  }
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

  const mover = (linea: number, tipo: MovimientoT["tipo"], puntos: PuntoT[]) => {
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
    const fMin = tipo === "rapido" ? RAPIDO_TORNO : porVuelta ? f * Math.max(rpm, 1) : f
    tiempo += largo / Math.max(fMin, 1)
    movimientos.push({ linea, tipo, puntos, fMin, rpm, husillo, herramienta })
    // Choques y cortes indebidos contra el material que queda en este momento
    let toca = false
    for (let i = 1; i < puntos.length && !toca; i++) {
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
    if (tipo === "corte" || toca) for (let i = 1; i < puntos.length; i++) perfil.cortar(puntos[i - 1], puntos[i], inserto)
    // Refrentar a X-1 o X-2 (pasar un poco del centro) es normal; más allá es error de programa
    if (Math.min(...puntos.map((p) => p.x)) < -1.5) aviso(linea, "centro", "La herramienta pasa más de 3 mm del centro de la pieza (X muy negativo): revisa el diámetro.")
  }

  const faltaF = (n: number) => {
    if (f > 0) return false
    error(n, "Falta el avance: escribe F antes de cortar (en G99 es mm por vuelta, por ejemplo F0.2).")
    errores++
    return true
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

    for (const w of ws) {
      if (w.letra === "G") {
        const g = w.valor
        if ([0, 1, 2, 3, 90, 94].includes(g)) movAhora = g
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
        else if (g === 70 || g === 71 || g === 72 || g === 73) aviso(n, `g${g}`, `G${g} (ciclo de desbaste o acabado) todavía no se simula en esta versión: se ignora.`)
        else if (g === 32 || g === 76 || g === 92) aviso(n, `g${g}`, `G${g} (roscado) todavía no se simula en esta versión: se ignora.`)
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
    if (movAhora !== null) {
      if ((movAhora === 90 || movAhora === 94) && !(ciclo && modo === movAhora)) ciclo = { inicio: { ...pos }, ultimo: null }
      if (movAhora !== 90 && movAhora !== 94) ciclo = null // otro G cancela el ciclo; sin G sigue el ciclo
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
      } else if ((modo === 90 || modo === 94) && ciclo) {
        // Ciclos simples de Fanuc. El punto de inicio es donde estaba la herramienta.
        faltaF(n)
        const o = ciclo.inicio
        // El ciclo recuerda la X y la Z de su línea anterior (por eso basta escribir "X34")
        if (ciclo.ultimo) {
          if (!tiene("X") && !tiene("U")) b.x = ciclo.ultimo.x
          if (!tiene("Z") && !tiene("W")) b.z = ciclo.ultimo.z
        }
        ciclo.ultimo = { ...b }
        if (modo === 90) {
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
