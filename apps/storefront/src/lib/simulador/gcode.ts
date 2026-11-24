// Simulador CNC de la Academia HETNA: intérprete de G-code (fresadora / router 3 ejes).
//
// Lee el programa línea por línea como lo haría el control de la máquina
// (estado modal: G0/G1/G2/G3, G90/G91, G20/G21, F, S, M3/M5…) y regresa la
// lista de movimientos y las alarmas, cada una con su número de línea.
//
// Convención de la pieza (la más común en router y fresadora):
//   - Z = 0 es la cara de arriba del material; el material baja hasta Z = -alto.
//   - X0 Y0 es la esquina inferior izquierda del material, o su centro (opción).
//
// Soporta (lo que se usa en el 95 % de los programas de taller):
//   G0 G1 G2 G3 (con I J o R, y hélice con Z), G4, G17, G20 G21, G28, G40,
//   G43, G49, G53–G59 (cero en el origen de la pieza), G80 G81 G82 G83 (taladro),
//   G90 G91, G94, G98 G99, M0 M1 M2 M3 M4 M5 M6 M8 M9 M30, F, S, T, N, ( ) y ;
// Lo que no simula lo avisa (G18/G19, G41/G42, macros), no lo inventa.

export type Punto = { x: number; y: number; z: number }

export type Movimiento = {
  linea: number // 1 = primera línea del texto
  tipo: "rapido" | "corte"
  puntos: Punto[] // desde el inicio hasta el final (los arcos ya vienen en segmentos)
  f: number // avance en mm/min (rápidos: 0)
  s: number
  husillo: boolean
  herramienta: number
}

export type Alarma = { linea: number; nivel: "error" | "aviso"; mensaje: string }

export type Material = { ancho: number; largo: number; alto: number; cero: "esquina" | "centro" }

export type Resultado = {
  movimientos: Movimiento[]
  alarmas: Alarma[]
  lineas: string[]
  fin: number // línea donde termina (M2/M30) o la última
  tiempoMin: number // tiempo estimado del programa
}

export const VELOCIDAD_RAPIDO = 5000 // mm/min (para estimar tiempo y animar)
export const Z_SEGURA = 10 // a dónde sube G28 y donde arranca la máquina

const r3 = (n: number) => Math.round(n * 1000) / 1000
const dist = (a: Punto, b: Punto) => Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)

/** Límites XY del material según dónde está el cero. */
export function cajaMaterial(m: Material) {
  const x0 = m.cero === "centro" ? -m.ancho / 2 : 0
  const y0 = m.cero === "centro" ? -m.largo / 2 : 0
  return { x0, y0, x1: x0 + m.ancho, y1: y0 + m.largo, z0: -m.alto, z1: 0 }
}

/** Quita comentarios ( … ) y ; … y regresa las palabras (letra + número) de una línea. */
export function palabras(linea: string): { letra: string; valor: number; texto: string }[] {
  const limpia = linea.replace(/\([^)]*\)/g, " ").replace(/;.*$/, "").trim()
  const out: { letra: string; valor: number; texto: string }[] = []
  const re = /([A-Za-z])\s*([-+]?(?:\d+\.?\d*|\.\d+))/g
  let m: RegExpExecArray | null
  while ((m = re.exec(limpia))) out.push({ letra: m[1].toUpperCase(), valor: Number(m[2]), texto: m[0] })
  return out
}

/** Puntos de un arco en el plano XY (con Z lineal: hélice). horario = G2. */
export function puntosArco(desde: Punto, hasta: Punto, centro: { x: number; y: number }, horario: boolean): Punto[] {
  const r = Math.hypot(desde.x - centro.x, desde.y - centro.y)
  const a0 = Math.atan2(desde.y - centro.y, desde.x - centro.x)
  let a1 = Math.atan2(hasta.y - centro.y, hasta.x - centro.x)
  let barrido = a1 - a0
  const mismoPunto = Math.hypot(hasta.x - desde.x, hasta.y - desde.y) < 1e-6
  if (horario) {
    if (barrido >= 0 || mismoPunto) barrido -= 2 * Math.PI
    if (barrido < -2 * Math.PI - 1e-9) barrido += 2 * Math.PI
  } else {
    if (barrido <= 0 || mismoPunto) barrido += 2 * Math.PI
    if (barrido > 2 * Math.PI + 1e-9) barrido -= 2 * Math.PI
  }
  a1 = a0 + barrido
  // segmentos de ~0.5 mm (o 5°), entre 8 y 720
  const n = Math.min(720, Math.max(8, Math.ceil(Math.max((Math.abs(barrido) * r) / 0.5, Math.abs(barrido) / (Math.PI / 36)))))
  const pts: Punto[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const a = a0 + barrido * t
    pts.push({ x: centro.x + r * Math.cos(a), y: centro.y + r * Math.sin(a), z: desde.z + (hasta.z - desde.z) * t })
  }
  pts[pts.length - 1] = { ...hasta }
  return pts
}

/** Centro de un arco dado por R (R negativo = arco mayor de 180°). null si no alcanza. */
export function centroPorR(desde: Punto, hasta: Punto, r: number, horario: boolean): { x: number; y: number } | null {
  const dx = hasta.x - desde.x
  const dy = hasta.y - desde.y
  const d = Math.hypot(dx, dy)
  const R = Math.abs(r)
  if (d < 1e-9 || d > 2 * R + 1e-6) return null
  const h = Math.sqrt(Math.max(0, R * R - (d / 2) ** 2))
  const mx = desde.x + dx / 2
  const my = desde.y + dy / 2
  // con R positivo el centro va a la derecha del avance en G2 y a la izquierda en G3
  let lado = horario ? -1 : 1
  if (r < 0) lado = -lado
  return { x: mx - (lado * h * dy) / d, y: my + (lado * h * dx) / d }
}

/** ¿El segmento pasa dentro del material (por debajo de su cara de arriba y dentro de su XY)? */
function entraAlMaterial(a: Punto, b: Punto, caja: ReturnType<typeof cajaMaterial>, holgura = 0.01): boolean {
  const pasos = Math.max(1, Math.ceil(dist(a, b) / 0.5))
  for (let i = 0; i <= pasos; i++) {
    const t = i / pasos
    const x = a.x + (b.x - a.x) * t
    const y = a.y + (b.y - a.y) * t
    const z = a.z + (b.z - a.z) * t
    if (z < caja.z1 - holgura && x > caja.x0 && x < caja.x1 && y > caja.y0 && y < caja.y1) return true
  }
  return false
}

export function interpretar(texto: string, material: Material): Resultado {
  const lineas = String(texto || "").replace(/\r/g, "").split("\n")
  const caja = cajaMaterial(material)
  const movimientos: Movimiento[] = []
  const alarmas: Alarma[] = []
  const avisados = new Set<string>()
  const avisoUnaVez = (linea: number, clave: string, mensaje: string) => {
    if (avisados.has(clave)) return
    avisados.add(clave)
    alarmas.push({ linea, nivel: "aviso", mensaje })
  }

  // Estado modal del control
  let pos: Punto = { x: 0, y: 0, z: Z_SEGURA }
  let modo = 0 // 0 1 2 3 81 82 83
  let absoluto = true
  let factor = 1 // 25.4 en pulgadas
  let f = 0
  let s = 0
  let husillo = false
  let herramienta = 0
  let retornoInicial = true // G98
  let fin = lineas.length
  let tiempo = 0
  let errores = 0

  const mover = (linea: number, tipo: Movimiento["tipo"], puntos: Punto[]) => {
    if (puntos.length < 2) return
    const largo = puntos.slice(1).reduce((acc, p, i) => acc + dist(puntos[i], p), 0)
    if (largo < 1e-9) return
    tiempo += largo / (tipo === "rapido" ? VELOCIDAD_RAPIDO : Math.max(f, 1))
    movimientos.push({ linea, tipo, puntos, f: tipo === "rapido" ? 0 : f, s, husillo, herramienta })
    // Revisiones de seguridad (como alarmas de máquina)
    for (let i = 1; i < puntos.length; i++) {
      const a = puntos[i - 1]
      const b = puntos[i]
      // Subir en línea recta (sacar la fresa con G0 Z…) es normal: no es choque
      const soloSube = b.z >= a.z && Math.hypot(b.x - a.x, b.y - a.y) < 1e-6
      if (!soloSube && entraAlMaterial(a, b, caja)) {
        if (tipo === "rapido") {
          alarmas.push({ linea, nivel: "error", mensaje: "Choque: movimiento rápido (G0) dentro del material. Usa G1 con avance para entrar a cortar." })
          errores++
          break
        }
        if (!husillo) {
          alarmas.push({ linea, nivel: "error", mensaje: "La fresa entra al material con el husillo apagado. Enciéndelo con M3 S… antes de cortar." })
          errores++
          break
        }
      }
    }
    const zMin = Math.min(...puntos.map((p) => p.z))
    if (zMin < caja.z0 - 2) avisoUnaVez(linea, "cama", `Bajas a Z${r3(zMin)}: más de 2 mm debajo del material, cortas la cama de sacrificio.`)
  }

  for (let i = 0; i < lineas.length; i++) {
    const n = i + 1
    const crudo = lineas[i].trim()
    if (!crudo || crudo === "%") continue
    let ws = palabras(crudo)
    if (!ws.length) continue
    ws = ws.filter((w) => w.letra !== "N")
    const valor = (l: string) => ws.find((w) => w.letra === l)?.valor
    const tiene = (l: string) => ws.some((w) => w.letra === l)

    let terminar = false
    let g28 = false
    let movAhora: number | null = null

    for (const w of ws) {
      if (w.letra === "G") {
        const g = w.valor
        if ([0, 1, 2, 3].includes(g)) movAhora = g
        else if (g === 4) { /* pausa: no mueve */ }
        else if (g === 17) { /* plano XY */ }
        else if (g === 18 || g === 19) avisoUnaVez(n, "plano", "G18/G19 (planos XZ e YZ): el simulador sólo hace arcos en el plano XY (G17).")
        else if (g === 20) factor = 25.4
        else if (g === 21) factor = 1
        else if (g === 28) g28 = true
        else if (g === 40 || g === 43 || g === 49 || g === 94 || g === 64 || g === 61) { /* aceptados */ }
        else if (g === 41 || g === 42) avisoUnaVez(n, "comp", "G41/G42 (compensación de radio): no se simula; la trayectoria se dibuja por el centro de la fresa.")
        else if (g >= 53 && g <= 59.3) { /* cero de pieza: el del material */ }
        else if (g === 80) modo = movAhora !== null ? movAhora : 1
        else if (g === 81 || g === 82 || g === 83) movAhora = g
        else if (g === 90) absoluto = true
        else if (g === 91) absoluto = false
        else if (g === 98) retornoInicial = true
        else if (g === 99) retornoInicial = false
        else avisoUnaVez(n, `g${g}`, `G${g} no se simula; se ignora.`)
      } else if (w.letra === "M") {
        const m = w.valor
        if (m === 3 || m === 4) husillo = true
        else if (m === 5) husillo = false
        else if (m === 2 || m === 30) terminar = true
        else if ([0, 1, 6, 7, 8, 9].includes(m)) { /* pausa, cambio de herramienta, refrigerante */ }
        else avisoUnaVez(n, `m${m}`, `M${m} no se simula; se ignora.`)
      } else if (w.letra === "F") f = w.valor * factor
      else if (w.letra === "S") s = w.valor
      else if (w.letra === "T") herramienta = w.valor
      else if (!"XYZIJKRPQHDLON".includes(w.letra)) avisoUnaVez(n, `l${w.letra}`, `La letra ${w.letra} no se reconoce; se ignora.`)
    }
    if (movAhora !== null) modo = movAhora

    // Destino con las coordenadas de la línea
    const destino = (): Punto => {
      const c = (eje: "x" | "y" | "z", l: string) => {
        const v = valor(l)
        if (v === undefined) return pos[eje]
        return absoluto ? v * factor : pos[eje] + v * factor
      }
      return { x: c("x", "X"), y: c("y", "Y"), z: c("z", "Z") }
    }
    const hayEjes = tiene("X") || tiene("Y") || tiene("Z")

    if (g28) {
      // G28: sube a Z segura y va al origen
      const arriba = { ...pos, z: Math.max(pos.z, Z_SEGURA) }
      mover(n, "rapido", [pos, arriba])
      const casa = { x: 0, y: 0, z: arriba.z }
      mover(n, "rapido", [arriba, casa])
      pos = casa
    } else if (hayEjes || ((modo === 2 || modo === 3) && (tiene("I") || tiene("J")))) {
      const fin1 = destino()
      if (modo === 0) {
        mover(n, "rapido", [pos, fin1])
        pos = fin1
      } else if (modo === 1) {
        if (f <= 0) {
          alarmas.push({ linea: n, nivel: "error", mensaje: "Falta el avance: escribe F (mm/min) antes o en la primera línea de corte G1/G2/G3." })
          errores++
        }
        mover(n, "corte", [pos, fin1])
        pos = fin1
      } else if (modo === 2 || modo === 3) {
        if (f <= 0) {
          alarmas.push({ linea: n, nivel: "error", mensaje: "Falta el avance: escribe F (mm/min) antes o en la primera línea de corte G1/G2/G3." })
          errores++
        }
        const horario = modo === 2
        let centro: { x: number; y: number } | null = null
        if (tiene("R")) {
          centro = centroPorR(pos, fin1, (valor("R") || 0) * factor, horario)
          if (!centro) {
            alarmas.push({ linea: n, nivel: "error", mensaje: "Arco imposible: el radio R es más chico que la mitad de la distancia entre el inicio y el final." })
            errores++
          }
        } else if (tiene("I") || tiene("J")) {
          centro = { x: pos.x + (valor("I") || 0) * factor, y: pos.y + (valor("J") || 0) * factor }
          const r0 = Math.hypot(pos.x - centro.x, pos.y - centro.y)
          const r1 = Math.hypot(fin1.x - centro.x, fin1.y - centro.y)
          if (Math.abs(r0 - r1) > 0.05) {
            alarmas.push({ linea: n, nivel: "error", mensaje: `Arco mal definido: el radio al inicio (${r3(r0)}) y al final (${r3(r1)}) no coinciden. Revisa I, J y el punto final.` })
            errores++
            centro = null
          }
        } else {
          alarmas.push({ linea: n, nivel: "error", mensaje: "Arco sin centro: G2/G3 necesita I y J (centro) o R (radio)." })
          errores++
        }
        if (centro) mover(n, "corte", puntosArco(pos, fin1, centro, horario))
        else mover(n, "corte", [pos, fin1])
        pos = fin1
      } else if (modo === 81 || modo === 82 || modo === 83) {
        // Ciclo de taladro: rápido a XY, rápido a R, avance a Z, regreso
        const zInicial = pos.z
        const rPlano = valor("R") !== undefined ? (absoluto ? valor("R")! * factor : pos.z + valor("R")! * factor) : pos.z
        const zFondo = valor("Z") !== undefined ? (absoluto ? valor("Z")! * factor : rPlano + valor("Z")! * factor) : pos.z
        const xy = { x: destino().x, y: destino().y }
        if (f <= 0) {
          alarmas.push({ linea: n, nivel: "error", mensaje: "Falta el avance: escribe F (mm/min) para el ciclo de taladro." })
          errores++
        }
        const p1 = { ...xy, z: pos.z }
        mover(n, "rapido", [pos, p1])
        const p2 = { ...xy, z: rPlano }
        mover(n, "rapido", [p1, p2])
        const p3 = { ...xy, z: zFondo }
        mover(n, "corte", [p2, p3])
        const regreso = { ...xy, z: retornoInicial ? Math.max(zInicial, rPlano) : rPlano }
        mover(n, "rapido", [p3, regreso])
        pos = regreso
      }
    }

    if (terminar) {
      fin = n
      break
    }
    if (errores > 50) {
      alarmas.push({ linea: n, nivel: "error", mensaje: "Demasiados errores: el simulador se detuvo aquí." })
      fin = n
      break
    }
  }

  if (!movimientos.some((m) => m.tipo === "corte")) avisoUnaVez(1, "sin-corte", "El programa no tiene movimientos de corte (G1, G2 o G3).")
  alarmas.sort((a, b) => a.linea - b.linea || (a.nivel === b.nivel ? 0 : a.nivel === "error" ? -1 : 1))
  return { movimientos, alarmas, lineas, fin, tiempoMin: tiempo }
}
