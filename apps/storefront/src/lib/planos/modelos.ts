// Biblioteca de planos HETNA: muebles de taller diseñados por HETNA.
// Cada plano es una lista de piezas rectangulares (cajas en mm) con material,
// pasos de armado, herrajes y herramientas. De aquí salen solos la lámina
// (3D, vista explotada, lista de corte, acomodo en la hoja) y el DXF.
//
// Ejes: x = ancho (izquierda → derecha), y = fondo (frente = 0 → atrás),
// z = alto (piso = 0 → arriba). Todo en milímetros.

export type MaterialPlano = "triplay-18" | "triplay-12" | "triplay-9" | "triplay-6"

export const MATERIALES_PLANO: Record<MaterialPlano, { nombre: string; grosor: number }> = {
  "triplay-18": { nombre: "Triplay de pino 18 mm", grosor: 18 },
  "triplay-12": { nombre: "Triplay de pino 12 mm", grosor: 12 },
  "triplay-9": { nombre: "Triplay de pino 9 mm", grosor: 9 },
  "triplay-6": { nombre: "Triplay de pino 6 mm", grosor: 6 },
}

export type PiezaPlano = {
  nombre: string
  material: MaterialPlano
  x0: number; x1: number; y0: number; y1: number; z0: number; z1: number
}

export type PasoPlano = { titulo: string; nota: string; piezas: string[] } // nombres (o prefijos) de las piezas que se agregan

export type CategoriaPlano = "Taller" | "Casa"
export const CATEGORIAS_PLANO: CategoriaPlano[] = ["Taller", "Casa"]

export type Plano = {
  slug: string
  categoria: CategoriaPlano
  nombre: string
  resumen: string
  descripcion: string
  nivel: "Fácil" | "Intermedio"
  horas: string
  juego?: { cantidad: number; nombre: string } // p. ej. un par de caballetes: se dibuja uno y se corta ×2
  ruedas?: number // alto de las ruedas (mm): se dibujan, pero no van en la lista de corte
  piezas: PiezaPlano[]
  pasos: PasoPlano[]
  herrajes: string[]
  herramientas: string[]
  notas: string[]
}

const T18: MaterialPlano = "triplay-18"

// atajo para una pieza
const p = (nombre: string, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, material: MaterialPlano = T18): PiezaPlano =>
  ({ nombre, material, x0, x1, y0, y1, z0, z1 })

// ── 1. Banco de trabajo móvil ─────────────────────────────────────────────
function bancoMovil(): PiezaPlano[] {
  const W = 1800, D = 750, ruedas = 100, e = 18
  const zPiso = ruedas, zTecho = 900 - e
  const alto = zTecho - (zPiso + e)
  const divs = [600, 1200]
  const piezas: PiezaPlano[] = [
    p("Piso", 0, W, 0, D, zPiso, zPiso + e),
    p("Costado izquierdo", 0, e, 0, D, zPiso + e, zPiso + e + alto),
    p("Costado derecho", W - e, W, 0, D, zPiso + e, zPiso + e + alto),
    ...divs.map((x, i) => p(`División ${i + 1}`, x - e / 2, x + e / 2, 0, D - e, zPiso + e, zPiso + e + alto)),
    p("Travesaño trasero", e, W - e, D - e, D, zTecho - 100, zTecho),
  ]
  const huecos: [number, number][] = [[e, divs[0] - e / 2], [divs[0] + e / 2, divs[1] - e / 2], [divs[1] + e / 2, W - e]]
  huecos.forEach(([a, b], i) => piezas.push(p(`Repisa ${i + 1}`, a, b, 0, D - e, 470, 470 + e)))
  piezas.push(p("Cubierta", 0, W, 0, D, zTecho, zTecho + e))
  return piezas
}

// ── 2. Carro para tableros y retazos ──────────────────────────────────────
function carroTableros(): PiezaPlano[] {
  const W = 1200, D = 620, e = 18, ruedas = 100, H = 1000
  const z0 = ruedas + e
  const yc = D / 2
  return [
    p("Base", 0, W, 0, D, ruedas, z0),
    p("Cabecera izquierda", 0, e, 0, D, z0, H),
    p("Cabecera derecha", W - e, W, 0, D, z0, H),
    p("Panel central", e, W - e, yc - e / 2, yc + e / 2, z0, H - 20),
    p("Divisor delantero", W / 2 - e / 2, W / 2 + e / 2, e, yc - e / 2, z0, z0 + 520),
    p("Divisor trasero", W / 2 - e / 2, W / 2 + e / 2, yc + e / 2, D - e, z0, z0 + 520),
    p("Tope delantero", e, W - e, 0, e, z0, z0 + 110),
    p("Tope trasero", e, W - e, D - e, D, z0, z0 + 110),
  ]
}

// ── 3. Panel de herramientas con listón francés ───────────────────────────
function panelHerramientas(): PiezaPlano[] {
  const W = 1200, H = 900, e = 18
  const piezas: PiezaPlano[] = [p("Tablero", 0, W, e, 2 * e, 0, H)]
  ;[120, 320, 520, 720].forEach((z, i) => piezas.push(p(`Listón francés ${i + 1}`, 0, W, 0, e, z, z + 90)))
  piezas.push(p("Listón de pared", 0, W, 2 * e, 3 * e, H - 140, H - 50))
  return piezas
}

// ── 4. Cajonera para herrajes (12 cajones) ────────────────────────────────
function cajonera(): PiezaPlano[] {
  const W = 600, D = 350, H = 500, e = 18, cols = 3, filas = 4
  const piezas: PiezaPlano[] = [
    p("Costado izquierdo", 0, e, 0, D, 0, H),
    p("Costado derecho", W - e, W, 0, D, 0, H),
    p("Piso", e, W - e, 0, D, 0, e),
    p("Techo", e, W - e, 0, D, H - e, H),
    p("Respaldo", e, W - e, D - 6, D, e, H - e, "triplay-6"),
  ]
  const anchoIn = W - 2 * e, altoIn = H - 2 * e
  const hueco = (anchoIn - (cols - 1) * e) / cols
  const altoHueco = (altoIn - (filas - 1) * e) / filas
  // entrepaños de lado a lado y divisiones verticales entre entrepaños
  for (let f = 1; f < filas; f++) {
    const z = e + f * altoHueco + (f - 1) * e
    piezas.push(p(`Entrepaño ${f}`, e, W - e, 0, D - 6, z, z + e))
  }
  for (let f = 0; f < filas; f++) {
    const z = e + f * (altoHueco + e)
    for (let c = 1; c < cols; c++) {
      const x = e + c * hueco + (c - 1) * e
      piezas.push(p(`División vertical ${f * (cols - 1) + c}`, x, x + e, 0, D - 6, z, z + altoHueco))
    }
  }
  // cajones: frente 12 mm, costados y trasera 9 mm, fondo 6 mm
  let n = 0
  for (let f = 0; f < filas; f++) for (let c = 0; c < cols; c++) {
    n++
    const x0 = e + c * (hueco + e) + 2, x1 = x0 + hueco - 4
    const z0 = e + f * (altoHueco + e) + 2, z1 = z0 + altoHueco - 4
    const fondo = D - 6 - 20
    const hCaja = z1 - z0 - 12
    piezas.push(
      p(`Cajón ${n} · frente`, x0, x1, 0, 12, z0, z1, "triplay-12"),
      p(`Cajón ${n} · costado izq.`, x0, x0 + 9, 12, 12 + fondo - 12, z0 + 6, z0 + 6 + hCaja, "triplay-9"),
      p(`Cajón ${n} · costado der.`, x1 - 9, x1, 12, 12 + fondo - 12, z0 + 6, z0 + 6 + hCaja, "triplay-9"),
      p(`Cajón ${n} · trasera`, x0 + 9, x1 - 9, fondo - 9, fondo, z0 + 6, z0 + 6 + hCaja, "triplay-9"),
      p(`Cajón ${n} · fondo`, x0, x1, 12, fondo, z0, z0 + 6, "triplay-6"),
    )
  }
  return piezas
}

// ── 5. Organizador para discos de lija ────────────────────────────────────
function organizadorLijas(): PiezaPlano[] {
  const W = 450, D = 160, H = 340, e = 18
  const altoIn = H - 2 * e
  const medio = e + (altoIn - e) / 2
  const piezas: PiezaPlano[] = [
    p("Costado izquierdo", 0, e, 0, D, 0, H),
    p("Costado derecho", W - e, W, 0, D, 0, H),
    p("Piso", e, W - e, 0, D, 0, e),
    p("Techo", e, W - e, 0, D, H - e, H),
    p("Repisa", e, W - e, 0, D - 6, medio, medio + e),
    p("Respaldo", 0, W, D, D + 6, 0, H, "triplay-6"),
  ]
  const hueco = (W - 2 * e - 2 * e) / 3
  ;[0, 1].forEach((nivel) => {
    const z0 = nivel === 0 ? e : medio + e
    const z1 = nivel === 0 ? medio : H - e
    ;[1, 2].forEach((c) => {
      const x = e + c * hueco + (c - 1) * e
      piezas.push(p(`Divisor ${nivel * 2 + c}`, x, x + e, 0, D - 6, z0, z1))
    })
  })
  return piezas
}

// ── 6. Caballete de triplay (se cortan dos) ───────────────────────────────
function caballete(): PiezaPlano[] {
  const L = 900, e = 18, H = 720
  const yc = 250
  return [
    p("Pata izquierda", 0, e, 0, 500, 0, H - e),
    p("Pata derecha", L - e, L, 0, 500, 0, H - e),
    p("Alma", e, L - e, yc - e / 2, yc + e / 2, 120 + e, H - e),
    p("Viga superior", 0, L, yc - 60, yc + 60, H - e, H),
    p("Refuerzo inferior", e, L - e, yc - 60, yc + 60, 120, 120 + e),
  ]
}


// ── Casa ─────────────────────────────────────────────────────────────────
// caja abierta con repisas: costados, piso sobre zoclo, techo, repisas y respaldo de 6 mm
function caja(W: number, D: number, H: number, repisas: number, zoclo: number): PiezaPlano[] {
  const e = 18
  const piezas: PiezaPlano[] = [
    p("Costado izquierdo", 0, e, 0, D, 0, H),
    p("Costado derecho", W - e, W, 0, D, 0, H),
    p("Piso", e, W - e, 0, D - 6, zoclo, zoclo + e),
    p("Techo", e, W - e, 0, D - 6, H - e, H),
    p("Respaldo", e, W - e, D - 6, D, zoclo, H - e, "triplay-6"),
  ]
  if (zoclo > 0) piezas.push(p("Zoclo", e, W - e, 20, 20 + e, 0, zoclo))
  const z0 = zoclo + e, z1 = H - e
  for (let i = 1; i <= repisas; i++) {
    const z = z0 + ((z1 - z0) * i) / (repisas + 1) - e / 2
    piezas.push(p(`Repisa ${i}`, e, W - e, 0, D - 6, z, z + e))
  }
  return piezas
}

function libreroAlto(): PiezaPlano[] { return caja(800, 300, 1800, 4, 70) }
function zapatera(): PiezaPlano[] { return caja(800, 330, 600, 2, 0) }

function buro(): PiezaPlano[] {
  const W = 450, D = 400, H = 550, e = 18
  const piezas = caja(W, D, H, 0, 0)
  const zEntre = H - e - 160
  piezas.push(p("Entrepaño", e, W - e, 0, D - 6, zEntre, zEntre + e))
  // cajón en el hueco de arriba: frente 18, costados y trasera 12, fondo 6
  const x0 = e + 2, x1 = W - e - 2, z0 = zEntre + e + 2, z1 = H - e - 2
  const fondo = D - 6 - 30, hCaja = z1 - z0 - 20
  piezas.push(
    p("Cajón · frente", x0, x1, 0, e, z0, z1),
    p("Cajón · costado izq.", x0, x0 + 12, e, fondo, z0 + 8, z0 + 8 + hCaja, "triplay-12"),
    p("Cajón · costado der.", x1 - 12, x1, e, fondo, z0 + 8, z0 + 8 + hCaja, "triplay-12"),
    p("Cajón · trasera", x0 + 12, x1 - 12, fondo - 12, fondo, z0 + 8, z0 + 8 + hCaja, "triplay-12"),
    p("Cajón · fondo", x0, x1, e, fondo, z0 + 2, z0 + 8, "triplay-6"),
  )
  return piezas
}

function escritorio(): PiezaPlano[] {
  const W = 1200, D = 600, H = 750, e = 18
  return [
    p("Costado izquierdo", 0, e, 0, D, 0, H - e),
    p("Costado derecho", W - e, W, 0, D, 0, H - e),
    p("Faldón trasero", e, W - e, D - 80 - e, D - 80, H - e - 350, H - e),
    p("Repisa baja", e, W - e, D - 80 - e - 250, D - 80 - e, 150, 150 + e),
    p("Cubierta", 0, W, 0, D, H - e, H),
  ]
}

function mesaCentro(): PiezaPlano[] {
  const W = 1000, D = 550, H = 450, e = 18
  return [
    p("Costado izquierdo", 0, e, 0, D, 0, H - e),
    p("Costado derecho", W - e, W, 0, D, 0, H - e),
    p("Repisa", e, W - e, 40, D - 40, 120, 120 + e),
    p("Travesaño", e, W - e, D / 2 - e / 2, D / 2 + e / 2, H - e - 100, H - e),
    p("Cubierta", 0, W, 0, D, H - e, H),
  ]
}

function banca(): PiezaPlano[] {
  const W = 1000, D = 350, H = 450, e = 18
  return [
    p("Costado izquierdo", 0, e, 0, D, 0, H - e),
    p("Costado derecho", W - e, W, 0, D, 0, H - e),
    p("Faldón trasero", e, W - e, D - e, D, H - e - 120, H - e),
    p("Repisa para zapatos", e, W - e, 0, D - e, 100, 100 + e),
    p("Asiento", 0, W, 0, D, H - e, H),
  ]
}


// ── Tanda 3 ──────────────────────────────────────────────────────────────
function estacionIngletadora(): PiezaPlano[] {
  const e = 18, D = 600, Hm = 900, Wm = 700, Wc = 600, zPlat = 800
  const piezas: PiezaPlano[] = []
  const modulo = (x: number, lado: string) => {
    piezas.push(
      p(`Costado exterior ${lado}`, lado === "izq." ? x : x + Wm - e, lado === "izq." ? x + e : x + Wm, 0, D, 0, Hm - e),
      p(`Costado interior ${lado}`, lado === "izq." ? x + Wm - e : x, lado === "izq." ? x + Wm : x + e, 0, D, 0, Hm - e),
      p(`Piso ${lado}`, x + e, x + Wm - e, 0, D - e, 80, 80 + e),
      p(`Repisa ${lado}`, x + e, x + Wm - e, 0, D - e, 460, 460 + e),
      p(`Respaldo ${lado}`, x + e, x + Wm - e, D - e, D, 80, Hm - e),
      p(`Cubierta ${lado}`, x, x + Wm, 0, D, Hm - e, Hm),
    )
  }
  modulo(0, "izq.")
  modulo(Wm + Wc, "der.")
  piezas.push(
    p("Plataforma de la ingletadora", Wm, Wm + Wc, 0, D, zPlat - e, zPlat),
    p("Travesaño de la plataforma", Wm, Wm + Wc, D - 100, D - 100 + e, zPlat - e - 120, zPlat - e),
  )
  return piezas
}

function portaSargentos(): PiezaPlano[] {
  const W = 1000, e = 18, H = 300
  const piezas: PiezaPlano[] = [p("Respaldo", 0, W, 220, 220 + e, 0, H)]
  for (let i = 0; i < 6; i++) {
    const x = 60 + i * ((W - 120 - e) / 5)
    piezas.push(p(`Brazo ${i + 1}`, x, x + e, 0, 220, H - 110, H - 30))
  }
  piezas.push(p("Listón de pared", 0, W, 220 + e, 220 + 2 * e, H - 90, H - 10))
  return piezas
}

function cajaHerramientas(): PiezaPlano[] {
  const W = 500, D = 250, e = 18, Hl = 160, Hc = 280
  return [
    p("Fondo", 0, W, 0, D, 0, e),
    p("Cabecera izquierda", 0, e, 0, D, e, Hc),
    p("Cabecera derecha", W - e, W, 0, D, e, Hc),
    p("Costado delantero", e, W - e, 0, e, e, Hl),
    p("Costado trasero", e, W - e, D - e, D, e, Hl),
    p("Agarradera", e, W - e, D / 2 - e / 2, D / 2 + e / 2, Hc - 50, Hc - 10),
  ]
}

function carroHerramientas(): PiezaPlano[] {
  const W = 600, D = 450, e = 18, ruedas = 100, H = 900
  const z0 = ruedas
  return [
    p("Costado izquierdo", 0, e, 0, D, z0, H),
    p("Costado derecho", W - e, W, 0, D, z0, H),
    p("Repisa baja", e, W - e, 0, D, z0, z0 + e),
    p("Repisa media", e, W - e, 0, D, z0 + 360, z0 + 360 + e),
    p("Cubierta", e, W - e, 0, D, H - e, H),
    p("Tope trasero de la cubierta", e, W - e, D - e, D, H, H + 60),
    p("Agarradera", -60, 0, D / 2 - e / 2, D / 2 + e / 2, H - 140, H - 60),
  ]
}

function repisaPared(): PiezaPlano[] {
  const W = 900, D = 200, e = 18, H = 600
  return [
    p("Costado izquierdo", 0, e, 0, D, 0, H),
    p("Costado derecho", W - e, W, 0, D, 0, H),
    p("Repisa baja", e, W - e, 0, D, 0, e),
    p("Repisa media", e, W - e, 0, D, H / 2 - e / 2, H / 2 + e / 2),
    p("Repisa alta", e, W - e, 0, D, H - e, H),
    p("Travesaño colgador", e, W - e, D - e, D, H - e - 80, H - e),
  ]
}

function bancoEscalera(): PiezaPlano[] {
  const W = 420, D = 450, e = 18, H = 450
  return [
    p("Costado izquierdo", 0, e, 0, D, 0, H),
    p("Costado derecho", W - e, W, 0, D, 0, H),
    p("Peldaño bajo", e, W - e, 0, D / 2, H / 2 - e, H / 2),
    p("Peldaño alto", e, W - e, D / 2, D, H - e, H),
    p("Contrahuella baja", e, W - e, 0, e, 0, H / 2 - e),
    p("Contrahuella alta", e, W - e, D / 2, D / 2 + e, H / 2, H - e),
    p("Travesaño trasero", e, W - e, D - e, D, 60, 160),
  ]
}

function cubos3x3(): PiezaPlano[] {
  const W = 1000, D = 350, H = 1000, e = 18, n = 3
  const piezas: PiezaPlano[] = [
    p("Costado izquierdo", 0, e, 0, D, 0, H),
    p("Costado derecho", W - e, W, 0, D, 0, H),
    p("Piso", e, W - e, 0, D - 6, 0, e),
    p("Techo", e, W - e, 0, D - 6, H - e, H),
    p("Respaldo", e, W - e, D - 6, D, e, H - e, "triplay-6"),
  ]
  const hueco = (W - 2 * e - (n - 1) * e) / n, alto = (H - 2 * e - (n - 1) * e) / n
  for (let f = 1; f < n; f++) { const z = e + f * alto + (f - 1) * e; piezas.push(p(`Entrepaño ${f}`, e, W - e, 0, D - 6, z, z + e)) }
  for (let f = 0; f < n; f++) {
    const z = e + f * (alto + e)
    for (let c = 1; c < n; c++) { const x = e + c * hueco + (c - 1) * e; piezas.push(p(`División ${f * (n - 1) + c}`, x, x + e, 0, D - 6, z, z + alto)) }
  }
  return piezas
}

function jardinera(): PiezaPlano[] {
  const W = 800, D = 400, H = 400, e = 18
  return [
    p("Fondo", e, W - e, e, D - e, 60, 60 + e),
    p("Frente", 0, W, 0, e, 0, H),
    p("Trasera", 0, W, D - e, D, 0, H),
    p("Cabecera izquierda", 0, e, e, D - e, 0, H),
    p("Cabecera derecha", W - e, W, e, D - e, 0, H),
  ]
}


// ── Tanda 4 ──────────────────────────────────────────────────────────────
function estanteRetazos(): PiezaPlano[] {
  const W = 1000, e = 18, H = 1200, D = 300
  const piezas: PiezaPlano[] = [
    p("Respaldo", 0, W, D - e, D, 0, H),
    p("Base", 0, W, 0, D - e, 0, e),
    p("Tope frontal", 0, W, 0, e, e, e + 100),
  ]
  for (let i = 0; i < 5; i++) {
    const x = i * ((W - e) / 4)
    piezas.push(p(`Divisor ${i + 1}`, x, x + e, e, D - e, e, i % 2 === 0 ? 900 : 700))
  }
  return piezas
}

function mesaRouter(): PiezaPlano[] {
  const W = 800, D = 600, H = 900, e = 18, vuelo = 60
  return [
    p("Costado izquierdo", vuelo, vuelo + e, vuelo, D - vuelo, 0, H - 2 * e),
    p("Costado derecho", W - vuelo - e, W - vuelo, vuelo, D - vuelo, 0, H - 2 * e),
    p("Piso", vuelo + e, W - vuelo - e, vuelo, D - vuelo - e, 80, 80 + e),
    p("Repisa", vuelo + e, W - vuelo - e, vuelo, D - vuelo - e, 420, 420 + e),
    p("Respaldo", vuelo + e, W - vuelo - e, D - vuelo - e, D - vuelo, 80, H - 2 * e),
    p("Base de la cubierta", 0, W, 0, D, H - 2 * e, H - e),
    p("Cubierta", 0, W, 0, D, H - e, H),
    p("Guía (fence)", 100, W - 100, D - 200, D - 200 + e, H, H + 80),
  ]
}

function gabinetePared(): PiezaPlano[] {
  const W = 800, D = 300, H = 700, e = 18
  const piezas: PiezaPlano[] = [
    p("Costado izquierdo", 0, e, 0, D, 0, H),
    p("Costado derecho", W - e, W, 0, D, 0, H),
    p("Piso", e, W - e, 0, D - 6, 0, e),
    p("Techo", e, W - e, 0, D - 6, H - e, H),
    p("Repisa", e, W - e, 20, D - 6, H / 2 - e / 2, H / 2 + e / 2),
    p("Respaldo", e, W - e, D - 6, D, e, H - e, "triplay-6"),
  ]
  piezas.push(p("Puerta izquierda", 2, W / 2 - 1, -e, 0, 2, H - 2), p("Puerta derecha", W / 2 + 1, W - 2, -e, 0, 2, H - 2))
  return piezas
}

function mesaCompacta(): PiezaPlano[] {
  const W = 1200, D = 600, H = 900, e = 18
  return [
    p("Costado izquierdo", 0, e, 0, D, 0, H - 2 * e),
    p("Costado derecho", W - e, W, 0, D, 0, H - 2 * e),
    p("Faldón trasero", e, W - e, D - e, D, H - 2 * e - 150, H - 2 * e),
    p("Faldón delantero", e, W - e, 0, e, H - 2 * e - 100, H - 2 * e),
    p("Repisa baja", e, W - e, 0, D, 150, 150 + e),
    p("Cubierta inferior", 0, W, 0, D, H - 2 * e, H - e),
    p("Cubierta superior", 0, W, 0, D, H - e, H),
  ]
}

function mesaComedor(): PiezaPlano[] {
  const W = 1600, D = 900, H = 750, e = 18, vuelo = 150
  return [
    p("Costado izquierdo", vuelo, vuelo + e, 100, D - 100, 0, H - 2 * e),
    p("Costado derecho", W - vuelo - e, W - vuelo, 100, D - 100, 0, H - 2 * e),
    p("Viga central", vuelo + e, W - vuelo - e, D / 2 - e / 2, D / 2 + e / 2, H - 2 * e - 150, H - 2 * e),
    p("Pie central", vuelo + e, W - vuelo - e, D / 2 - 80, D / 2 + 80, 60, 60 + e),
    p("Base de la cubierta", 0, W, 0, D, H - 2 * e, H - e),
    p("Cubierta", 0, W, 0, D, H - e, H),
  ]
}

function consola(): PiezaPlano[] {
  const W = 1000, D = 300, H = 800, e = 18
  return [
    p("Costado izquierdo", 0, e, 0, D, 0, H - e),
    p("Costado derecho", W - e, W, 0, D, 0, H - e),
    p("Faldón trasero", e, W - e, D - e, D, H - e - 120, H - e),
    p("Repisa baja", e, W - e, 0, D, 120, 120 + e),
    p("Cubierta", 0, W, 0, D, H - e, H),
  ]
}

function muebleTV(): PiezaPlano[] {
  const W = 1500, D = 400, H = 500, e = 18, zoclo = 60
  const piezas: PiezaPlano[] = [
    p("Costado izquierdo", 0, e, 0, D, 0, H),
    p("Costado derecho", W - e, W, 0, D, 0, H),
    p("Piso", e, W - e, 0, D - 6, zoclo, zoclo + e),
    p("Cubierta", e, W - e, 0, D, H - e, H),
    p("Respaldo", e, W - e, D - 6, D, zoclo, H - e, "triplay-6"),
    p("Zoclo", e, W - e, 20, 20 + e, 0, zoclo),
  ]
  const x1 = e + (W - 2 * e - 2 * e) / 3, x2 = x1 + e + (W - 2 * e - 2 * e) / 3
  piezas.push(
    p("División 1", x1, x1 + e, 0, D - 6, zoclo + e, H - e),
    p("División 2", x2, x2 + e, 0, D - 6, zoclo + e, H - e),
    p("Repisa central", x1 + e, x2, 0, D - 6, zoclo + e + 180, zoclo + e + 180 + e),
    p("Puerta izquierda", 2, x1 + e / 2 - 1, -e, 0, zoclo + 2, H - 2),
    p("Puerta derecha", x2 + e / 2 + 1, W - 2, -e, 0, zoclo + 2, H - 2),
  )
  return piezas
}

function baseCama(): PiezaPlano[] {
  const W = 1000, L = 1950, e = 18, H = 350, alto = 250
  const piezas: PiezaPlano[] = [
    p("Larguero izquierdo", 0, e, 0, L, 100, 100 + alto),
    p("Larguero derecho", W - e, W, 0, L, 100, 100 + alto),
    p("Cabecera", 0, W, L, L + e, 0, 900),
    p("Piecera", 0, W, -e, 0, 0, H),
    p("Travesaño central", W / 2 - e / 2, W / 2 + e / 2, 0, L, 100, 100 + alto),
  ]
  for (let i = 0; i < 12; i++) {
    const y = 40 + i * ((L - 120) / 11)
    piezas.push(p(`Tablilla ${i + 1}`, e, W - e, y, y + 80, 100 + alto, 100 + alto + e))
  }
  // patas: una tabla de 80 × 100 mm en cada esquina, por dentro de los largueros
  ;[[e, 0], [W - e - 80, 0], [e, L - e], [W - e - 80, L - e]].forEach(([x, y], i) => piezas.push(p(`Pata ${i + 1}`, x, x + 80, y, y + e, 0, 100)))
  return piezas
}

function casitaPerro(): PiezaPlano[] {
  const W = 700, D = 900, H = 650, e = 18
  return [
    p("Piso", 0, W, 0, D, 60, 60 + e),
    p("Pared izquierda", 0, e, 0, D, 60 + e, H),
    p("Pared derecha", W - e, W, 0, D, 60 + e, H),
    p("Pared trasera", e, W - e, D - e, D, 60 + e, H),
    p("Frente izquierdo", e, 200, 0, e, 60 + e, H),
    p("Frente derecho", W - 200, W - e, 0, e, 60 + e, H),
    p("Dintel", 200, W - 200, 0, e, H - 120, H),
    p("Techo", -40, W + 40, -60, D + 40, H, H + e),
    p("Patín izquierdo", 40, 40 + e, 40, D - 40, 0, 60),
    p("Patín derecho", W - 40 - e, W - 40, 40, D - 40, 0, 60),
  ]
}

function baulJuguetes(): PiezaPlano[] {
  const W = 800, D = 420, H = 450, e = 18
  return [
    p("Fondo", e, W - e, e, D - e, 40, 40 + e),
    p("Frente", 0, W, 0, e, 0, H - e),
    p("Trasera", 0, W, D - e, D, 0, H - e),
    p("Costado izquierdo", 0, e, e, D - e, 0, H - e),
    p("Costado derecho", W - e, W, e, D - e, 0, H - e),
    p("Tapa", 0, W, 0, D, H - e, H),
  ]
}

// ── Tanda 5 ──────────────────────────────────────────────────────────────
function estantePinturas(): PiezaPlano[] {
  const W = 900, D = 300, H = 1500, e = 18
  const niveles = [80, 420, 760, 1100]
  return [
    p("Costado izquierdo", 0, e, 0, D, 0, H),
    p("Costado derecho", W - e, W, 0, D, 0, H),
    ...niveles.map((z, i) => p(`Repisa ${i + 1}`, e, W - e, 0, D - e, z, z + e)),
    p("Techo", e, W - e, 0, D - e, H - e, H),
    p("Zoclo", e, W - e, 0, e, 0, 80),
    ...niveles.slice(1).map((z, i) => p(`Tope ${i + 1}`, e, W - e, 0, 9, z + e, z + e + 50, "triplay-9")),
    p("Travesaño trasero alto", e, W - e, D - e, D, H - 120, H - e),
    p("Travesaño trasero bajo", e, W - e, D - e, D, 300, 400),
  ]
}

function cajaDivisiones(): PiezaPlano[] {
  const W = 420, D = 300, H = 110, e = 12
  const T12: MaterialPlano = "triplay-12"
  const cols = [W / 3, (2 * W) / 3]
  return [
    p("Fondo", 0, W, 0, D, 0, 6, "triplay-6"),
    p("Frente", 0, W, 0, e, 6, H, T12),
    p("Trasera", 0, W, D - e, D, 6, H, T12),
    p("Costado izquierdo", 0, e, e, D - e, 6, H, T12),
    p("Costado derecho", W - e, W, e, D - e, 6, H, T12),
    p("Separador largo", e, W - e, D / 2 - 3, D / 2 + 3, 6, H - 20, "triplay-6"),
    ...cols.flatMap((x, i) => [
      p(`Separador corto ${i + 1}`, x - 3, x + 3, e, D / 2 - 3, 6, H - 20, "triplay-6"),
      p(`Separador corto ${i + 3}`, x - 3, x + 3, D / 2 + 3, D - e, 6, H - 20, "triplay-6"),
    ]),
  ]
}

function bancoAlto(): PiezaPlano[] {
  const W = 420, D = 320, H = 650, e = 18
  return [
    p("Pata izquierda", 30, 30 + e, 0, D, 0, H - e),
    p("Pata derecha", W - 30 - e, W - 30, 0, D, 0, H - e),
    p("Travesaño bajo", 30 + e, W - 30 - e, D / 2 - 40, D / 2 + 40, 180, 180 + e),
    p("Faldón frontal", 30 + e, W - 30 - e, 20, 20 + e, H - e - 80, H - e),
    p("Faldón trasero", 30 + e, W - 30 - e, D - 20 - e, D - 20, H - e - 80, H - e),
    p("Asiento", 0, W, 0, D, H - e, H),
  ]
}

function carroAspiradora(): PiezaPlano[] {
  const W = 600, D = 500, e = 18, ruedas = 80, H = 900
  const z0 = ruedas
  return [
    p("Base", 0, W, 0, D, z0, z0 + e),
    p("Costado izquierdo", 0, e, 0, D, z0 + e, H),
    p("Costado derecho", W - e, W, 0, D, z0 + e, H),
    p("Respaldo", e, W - e, D - e, D, z0 + e, H),
    p("Repisa media", e, W - e, 0, D - e, 560, 560 + e),
    p("Cubierta", 0, W, 0, D, H, H + e),
    p("Tope frontal", e, W - e, 0, e, z0 + e, z0 + e + 60),
    p("Agarradera", e, W - e, D, D + e, H - 120, H - 40),
  ]
}

function estanteCargadores(): PiezaPlano[] {
  const W = 800, D = 250, H = 500, e = 18
  return [
    p("Respaldo", e, W - e, D - 9, D, e, H - e, "triplay-9"),
    p("Costado izquierdo", 0, e, 0, D, 0, H),
    p("Costado derecho", W - e, W, 0, D, 0, H),
    p("Piso", e, W - e, 0, D - 9, 0, e),
    p("Repisa", e, W - e, 0, D - 9, 240, 240 + e),
    p("Techo", e, W - e, 0, D - 9, H - e, H),
    p("Tope", e, W - e, 0, 9, e, e + 40, "triplay-9"),
    p("Listón francés", e, W - e, D, D + e, H - 140, H - 40),
  ]
}

function cajonBajoCama(): PiezaPlano[] {
  const W = 900, D = 600, H = 180, e = 12, ruedas = 40
  const T12: MaterialPlano = "triplay-12"
  const z0 = ruedas, zf = z0 + e
  return [
    p("Fondo", 0, W, 0, D, z0, zf, T12),
    p("Frente", 0, W, 0, e, zf, z0 + H, T12),
    p("Trasera", 0, W, D - e, D, zf, z0 + H - 20, T12),
    p("Costado izquierdo", 0, e, e, D - e, zf, z0 + H - 20, T12),
    p("Costado derecho", W - e, W, e, D - e, zf, z0 + H - 20, T12),
    p("Divisor", W / 2 - 6, W / 2 + 6, e, D - e, zf, z0 + H - 40, T12),
  ]
}

function libreroBajo(): PiezaPlano[] {
  const W = 1000, D = 300, H = 800, e = 18
  return [
    p("Costado izquierdo", 0, e, 0, D, 0, H),
    p("Costado derecho", W - e, W, 0, D, 0, H),
    p("Piso", e, W - e, 0, D - 6, 60, 60 + e),
    p("Repisa", e, W - e, 0, D - 6, 420, 420 + e),
    p("Cubierta", 0, W, 0, D, H, H + e),
    p("Zoclo", e, W - e, 20, 20 + e, 0, 60),
    p("Respaldo", e, W - e, D - 6, D, 60, H, "triplay-6"),
  ]
}

function maceteroEscalonado(): PiezaPlano[] {
  const W = 800, e = 18
  const escalones = [ // [y0, y1, z]
    [0, 260, 260],
    [240, 500, 520],
    [480, 740, 780],
  ]
  return [
    p("Costado izquierdo", 0, e, 0, 740, 0, 780),
    p("Costado derecho", W - e, W, 0, 740, 0, 780),
    ...escalones.map(([y0, y1, z], i) => p(`Escalón ${i + 1}`, e, W - e, y0, y1, z - e, z)),
    ...escalones.map(([, y1, z], i) => p(`Contrahuella ${i + 1}`, e, W - e, y1 - e - 20, y1 - 20, z - e - 120, z - e)),
  ]
}

function especiero(): PiezaPlano[] {
  const W = 500, D = 110, H = 600, e = 12
  const T12: MaterialPlano = "triplay-12"
  const niveles = [0, 200, 400]
  return [
    p("Respaldo", e, W - e, D - 6, D, 0, H, "triplay-6"),
    p("Costado izquierdo", 0, e, 0, D, 0, H, T12),
    p("Costado derecho", W - e, W, 0, D, 0, H, T12),
    ...niveles.map((z, i) => p(`Repisa ${i + 1}`, e, W - e, 0, D - 6, z, z + e, T12)),
    ...niveles.map((z, i) => p(`Barandal ${i + 1}`, e, W - e, 0, 6, z + 50, z + 80, "triplay-6")),
  ]
}

function comederoElevado(): PiezaPlano[] {
  const W = 560, D = 300, H = 300, e = 18
  return [
    p("Frente", 0, W, 0, e, 0, H - e),
    p("Trasera", 0, W, D - e, D, 0, H - e),
    p("Costado izquierdo", 0, e, e, D - e, 0, H - e),
    p("Costado derecho", W - e, W, e, D - e, 0, H - e),
    p("Cubierta", 0, W, 0, D, H - e, H),
  ]
}

// ── Tanda 6 ──────────────────────────────────────────────────────────────
function gabineteTaladro(): PiezaPlano[] {
  const W = 600, D = 500, H = 750, e = 18
  return [
    p("Costado izquierdo", 0, e, 0, D, 0, H - e),
    p("Costado derecho", W - e, W, 0, D, 0, H - e),
    p("Zoclo", e, W - e, 20, 20 + e, 0, 80),
    p("Piso", e, W - e, 0, D - 9, 80, 80 + e),
    p("Repisa", e, W - e, 0, D - 9, 400, 400 + e),
    p("Respaldo", e, W - e, D - 9, D, 80, H - e, "triplay-9"),
    p("Cubierta", 0, W, 0, D, H - e, H),
    p("Puerta", 2, W - 2, -e, 0, 82, H - e - 2),
  ]
}

function mesaApoyoSierra(): PiezaPlano[] {
  const W = 1200, D = 600, H = 860, e = 18
  return [
    p("Pata izquierda", 60, 60 + e, 40, D - 40, 0, H - e),
    p("Pata derecha", W - 60 - e, W - 60, 40, D - 40, 0, H - e),
    p("Travesaño bajo", 60 + e, W - 60 - e, D / 2 - 50, D / 2 + 50, 150, 150 + e),
    p("Faldón frontal", 60 + e, W - 60 - e, 40, 40 + e, H - e - 100, H - e),
    p("Faldón trasero", 60 + e, W - 60 - e, D - 40 - e, D - 40, H - e - 100, H - e),
    p("Cubierta", 0, W, 0, D, H - e, H),
  ]
}

function repisaRollos(): PiezaPlano[] {
  const W = 900, D = 220, e = 18
  return [
    p("Riel de pared", 0, W, D - e, D, 0, 150),
    p("Ménsula izquierda", 40, 40 + e, 0, D - e, 0, 150),
    p("Ménsula derecha", W - 40 - e, W - 40, 0, D - e, 0, 150),
    p("Repisa", 0, W, 0, D, 150, 150 + e),
  ]
}

function mesaEnsamble(): PiezaPlano[] {
  const W = 1200, D = 800, H = 600, e = 18
  return [
    p("Costado izquierdo", 0, e, 0, D, 0, H - e),
    p("Costado derecho", W - e, W, 0, D, 0, H - e),
    p("Repisa", e, W - e, 0, D, 150, 150 + e),
    p("Travesaño trasero", e, W - e, D - e, D, H - e - 120, H - e),
    p("Cubierta", 0, W, 0, D, H - e, H),
  ]
}

function cajaConTapa(): PiezaPlano[] {
  const W = 500, D = 300, H = 250, e = 12, t = 60
  const T12: MaterialPlano = "triplay-12"
  return [
    p("Fondo", 0, W, 0, D, 0, e, T12),
    p("Frente", 0, W, 0, e, e, H - t, T12),
    p("Trasera", 0, W, D - e, D, e, H - t, T12),
    p("Costado izquierdo", 0, e, e, D - e, e, H - t, T12),
    p("Costado derecho", W - e, W, e, D - e, e, H - t, T12),
    p("Tapa · frente", 0, W, 0, e, H - t, H - e, T12),
    p("Tapa · trasera", 0, W, D - e, D, H - t, H - e, T12),
    p("Tapa · costado izq.", 0, e, e, D - e, H - t, H - e, T12),
    p("Tapa · costado der.", W - e, W, e, D - e, H - t, H - e, T12),
    p("Tapa · cubierta", 0, W, 0, D, H - e, H, T12),
  ]
}

function mesaLateral(): PiezaPlano[] {
  const W = 450, D = 450, H = 550, e = 18
  return [
    p("Costado izquierdo", 0, e, 0, D, 0, H - e),
    p("Costado derecho", W - e, W, 0, D, 0, H - e),
    p("Repisa", e, W - e, 0, D, 120, 120 + e),
    p("Travesaño", e, W - e, D - e, D, H - e - 80, H - e),
    p("Cubierta", 0, W, 0, D, H - e, H),
  ]
}

function percheroPared(): PiezaPlano[] {
  const W = 800, D = 220, e = 18
  return [
    p("Tablero de ganchos", 0, W, D - e, D, 0, 300),
    p("Ménsula izquierda", 60, 60 + e, 0, D - e, 150, 300),
    p("Ménsula derecha", W - 60 - e, W - 60, 0, D - e, 150, 300),
    p("Repisa", 0, W, 0, D, 300, 300 + e),
  ]
}

function organizadorEscritorio(): PiezaPlano[] {
  const W = 400, D = 200, H = 150, e = 12
  const T12: MaterialPlano = "triplay-12"
  return [
    p("Base", 0, W, 0, D, 0, e, T12),
    p("Costado izquierdo", 0, e, 0, D, e, H, T12),
    p("Costado derecho", W - e, W, 0, D, e, H, T12),
    p("Trasera", e, W - e, D - e, D, e, H, T12),
    p("Frente bajo", e, W - e, 0, e, e, 60, T12),
    p("División 1", 130 - 6, 130 + 6, e, D - e, e, H - 30, T12),
    p("División 2", 270 - 6, 270 + 6, e, D - e, e, H - 30, T12),
  ]
}

function cavaVino(): PiezaPlano[] {
  const c = 120, e = 18, D = 300
  const W = 3 * c + 4 * e, H = W
  const filas = [e, e + c + e, e + 2 * (c + e)] // piso de cada fila
  const piezas: PiezaPlano[] = [
    p("Costado izquierdo", 0, e, 0, D, 0, H),
    p("Costado derecho", W - e, W, 0, D, 0, H),
    p("Piso", e, W - e, 0, D, 0, e),
    p("Techo", e, W - e, 0, D, H - e, H),
    p("Repisa 1", e, W - e, 0, D - 6, e + c, e + c + e),
    p("Repisa 2", e, W - e, 0, D - 6, e + 2 * c + e, e + 2 * c + 2 * e),
  ]
  let k = 1
  for (const z of filas) for (const x of [e + c, e + 2 * c + e]) piezas.push(p(`División ${k++}`, x, x + e, 0, D - 6, z, z + c))
  piezas.push(p("Respaldo", e, W - e, D - 6, D, e, H - e, "triplay-6"))
  return piezas
}

function mesaNinos(): PiezaPlano[] {
  const W = 600, D = 600, H = 500, e = 18
  return [
    p("Pata izquierda", 40, 40 + e, 40, D - 40, 0, H - e),
    p("Pata derecha", W - 40 - e, W - 40, 40, D - 40, 0, H - e),
    p("Travesaño", 40 + e, W - 40 - e, D / 2 - 40, D / 2 + 40, 120, 120 + e),
    p("Faldón frontal", 40 + e, W - 40 - e, 40, 40 + e, H - e - 80, H - e),
    p("Faldón trasero", 40 + e, W - 40 - e, D - 40 - e, D - 40, H - e - 80, H - e),
    p("Cubierta", 0, W, 0, D, H - e, H),
  ]
}

export const PLANOS: Plano[] = [
  {
    categoria: "Taller",
    slug: "banco-de-trabajo-movil",
    nombre: "Banco de trabajo móvil",
    resumen: "Mesa de 1.80 m con ruedas, tres compartimentos y repisas para guardar herramienta.",
    descripcion: "Un banco firme para armar, lijar y montar la ingletadora o la sierra de banco. Se mueve con ruedas con freno y guarda todo abajo.",
    nivel: "Intermedio",
    horas: "6 a 8 h",
    ruedas: 100,
    piezas: bancoMovil(),
    pasos: [
      { titulo: "Base", nota: "Atornilla las ruedas al piso, a 5 cm de cada esquina.", piezas: ["Piso"] },
      { titulo: "Costados y divisiones", nota: "Pega y atornilla desde abajo; revisa la escuadra.", piezas: ["Costado", "División"] },
      { titulo: "Travesaño trasero", nota: "Le da rigidez al casco: no lo omitas.", piezas: ["Travesaño"] },
      { titulo: "Repisas", nota: "Sobre listones o soportes de repisa a la altura que te sirva.", piezas: ["Repisa"] },
      { titulo: "Cubierta", nota: "Atornilla desde arriba con tornillos avellanados.", piezas: ["Cubierta"] },
    ],
    herrajes: ["4 ruedas giratorias de 3\" a 4\" (2 con freno)", "Tornillos para madera 1 1/2\" (aprox. 80)", "Tornillos para las ruedas", "Pegamento blanco para madera"],
    herramientas: ["Sierra circular o router CNC", "Taladro atornillador", "Escuadra y flexómetro", "Prensas"],
    notas: ["Si vas a montar sierra de banco, deja la cubierta al ras de la mesa de la sierra."],
  },
  {
    categoria: "Taller",
    slug: "carro-para-tableros",
    nombre: "Carro para tableros y retazos",
    resumen: "Carro con ruedas para guardar hojas de triplay, MDF y retazos de pie.",
    descripcion: "Guarda las hojas de pie y los retazos separados por tamaño. Libera el piso del taller y se lleva a la sierra.",
    nivel: "Fácil",
    horas: "3 a 4 h",
    ruedas: 100,
    piezas: carroTableros(),
    pasos: [
      { titulo: "Base", nota: "Atornilla las 4 ruedas antes de seguir.", piezas: ["Base"] },
      { titulo: "Cabeceras", nota: "Pega y atornilla desde abajo.", piezas: ["Cabecera"] },
      { titulo: "Panel central", nota: "Une las cabeceras y divide el carro en dos lados.", piezas: ["Panel central"] },
      { titulo: "Divisores", nota: "Separan hojas grandes de retazos.", piezas: ["Divisor"] },
      { titulo: "Topes", nota: "Evitan que las hojas resbalen.", piezas: ["Tope"] },
    ],
    herrajes: ["4 ruedas giratorias de 3\" (2 con freno)", "Tornillos para madera 1 1/2\" (aprox. 50)", "Pegamento blanco para madera"],
    herramientas: ["Sierra circular o router CNC", "Taladro atornillador", "Escuadra"],
    notas: ["Carga pareja de los dos lados para que no se ladee."],
  },
  {
    categoria: "Taller",
    slug: "panel-de-herramientas-liston-frances",
    nombre: "Panel de herramientas con listón francés",
    resumen: "Panel de pared de 1.20 × 0.90 m con listones a 45° para colgar y mover soportes.",
    descripcion: "El listón francés deja colgar soportes, repisas y cajas donde quieras y moverlos sin taladrar de nuevo.",
    nivel: "Fácil",
    horas: "2 a 3 h",
    piezas: panelHerramientas(),
    pasos: [
      { titulo: "Tablero", nota: "Corta el tablero a medida.", piezas: ["Tablero"] },
      { titulo: "Listones franceses", nota: "Corta los listones con un canto a 45° y atorníllalos con el bisel hacia arriba y hacia la pared.", piezas: ["Listón francés"] },
      { titulo: "Listón de pared", nota: "Va atornillado a la pared, a taquete, con el bisel hacia arriba.", piezas: ["Listón de pared"] },
    ],
    herrajes: ["Tornillos para madera 1 1/4\" (aprox. 40)", "Taquetes y pijas para muro", "Pegamento blanco para madera"],
    herramientas: ["Sierra de banco o circular con inclinación a 45°", "Taladro", "Nivel"],
    notas: ["Los listones se dibujan rectos en el plano: el corte a 45° se hace a lo largo, en la sierra."],
  },
  {
    categoria: "Taller",
    slug: "cajonera-para-herrajes",
    nombre: "Cajonera para herrajes",
    resumen: "Mueble de 60 × 50 cm con 12 cajones para tornillos, brocas y herrajes.",
    descripcion: "Doce cajones iguales para tener todo clasificado. Se puede poner sobre el banco o colgar de un listón francés.",
    nivel: "Intermedio",
    horas: "6 a 8 h",
    piezas: cajonera(),
    pasos: [
      { titulo: "Casco", nota: "Costados, piso y techo, pegados y atornillados.", piezas: ["Costado", "Piso", "Techo"] },
      { titulo: "Entrepaños", nota: "Usa un taco espaciador para que queden parejos.", piezas: ["Entrepaño"] },
      { titulo: "Divisiones", nota: "Entre cada entrepaño, con pegamento y clavo.", piezas: ["División"] },
      { titulo: "Respaldo", nota: "Cuadra el mueble antes de clavarlo.", piezas: ["Respaldo"] },
      { titulo: "Cajones", nota: "Arma cada cajón con pegamento y clavo; el fondo va debajo.", piezas: ["Cajón"] },
    ],
    herrajes: ["12 jaladeras pequeñas o barrenos de 25 mm como jaladera", "Clavo sin cabeza 1\" o grapas", "Tornillos para madera 1 1/4\"", "Pegamento blanco para madera"],
    herramientas: ["Router CNC o sierra de banco", "Clavadora o martillo", "Prensas", "Escuadra"],
    notas: ["Los cajones llevan 2 mm de holgura por lado; ajusta si tu triplay viene más grueso."],
  },
  {
    categoria: "Taller",
    slug: "organizador-de-discos-de-lija",
    nombre: "Organizador para discos de lija",
    resumen: "Casillero de 45 × 34 cm con 6 espacios para discos de lija de 5\" y 6\".",
    descripcion: "Cada grano en su casilla: encuentras la lija sin revolver. Va sobre el banco o colgado en la pared.",
    nivel: "Fácil",
    horas: "2 h",
    piezas: organizadorLijas(),
    pasos: [
      { titulo: "Casco", nota: "Costados, piso y techo.", piezas: ["Costado", "Piso", "Techo"] },
      { titulo: "Repisa", nota: "A la mitad del alto.", piezas: ["Repisa"] },
      { titulo: "Divisores", nota: "Dos arriba y dos abajo.", piezas: ["Divisor"] },
      { titulo: "Respaldo", nota: "Clávalo con el mueble a escuadra.", piezas: ["Respaldo"] },
    ],
    herrajes: ["Clavo sin cabeza 1\" o tornillos 1 1/4\"", "Pegamento blanco para madera"],
    herramientas: ["Sierra o router CNC", "Clavadora o martillo", "Escuadra"],
    notas: ["Para discos de 6\" (150 mm) deja el fondo de 160 mm como está."],
  },
  {
    categoria: "Taller",
    slug: "caballetes-de-triplay",
    nombre: "Caballetes de triplay (par)",
    resumen: "Dos caballetes de 72 cm de alto para cortar hojas y armar sobre ellos.",
    descripcion: "Caballetes firmes hechos con triplay: aguantan una hoja completa para cortarla con sierra circular.",
    nivel: "Fácil",
    horas: "2 a 3 h",
    juego: { cantidad: 2, nombre: "caballetes" },
    piezas: caballete(),
    pasos: [
      { titulo: "Alma", nota: "Es la pieza central que da la fuerza.", piezas: ["Alma"] },
      { titulo: "Patas", nota: "Atornilla las patas a los extremos del alma.", piezas: ["Pata"] },
      { titulo: "Refuerzo inferior", nota: "Amarra las patas abajo.", piezas: ["Refuerzo"] },
      { titulo: "Viga superior", nota: "Atornilla desde arriba; es la que recibe los cortes.", piezas: ["Viga"] },
    ],
    herrajes: ["Tornillos para madera 1 1/2\" (aprox. 30 por caballete)", "Pegamento blanco para madera"],
    herramientas: ["Sierra circular o router CNC", "Taladro atornillador", "Escuadra"],
    notas: ["La viga superior se va gastando con los cortes: se cambia sola, sin desarmar."],
  },
  {
    categoria: "Casa",
    slug: "librero-alto",
    nombre: "Librero alto de 5 niveles",
    resumen: "Librero de 80 × 30 × 180 cm con cuatro repisas, zoclo y respaldo.",
    descripcion: "Un librero sencillo y firme para libros, carpetas o decoración. El respaldo lo hace rígido y el zoclo lo separa del piso.",
    nivel: "Fácil",
    horas: "3 a 4 h",
    piezas: libreroAlto(),
    pasos: [
      { titulo: "Costados y zoclo", nota: "Une el zoclo entre los costados, al frente y abajo.", piezas: ["Costado", "Zoclo"] },
      { titulo: "Piso y techo", nota: "Pega y atornilla; revisa la escuadra.", piezas: ["Piso", "Techo"] },
      { titulo: "Repisas", nota: "Fijas con tornillo o sobre soportes de repisa para moverlas.", piezas: ["Repisa"] },
      { titulo: "Respaldo", nota: "Cuadra el mueble midiendo las diagonales y clava el respaldo.", piezas: ["Respaldo"] },
    ],
    herrajes: ["Tornillos para madera 1 1/2\" (aprox. 40)", "Clavo sin cabeza 1\" para el respaldo", "Soportes de repisa (opcional)", "Pegamento blanco para madera"],
    herramientas: ["Sierra circular o router CNC", "Taladro atornillador", "Escuadra y flexómetro"],
    notas: ["Si es más alto de 1.50 m, fíjalo a la pared con una escuadra para que no se vuelque."],
  },
  {
    categoria: "Casa",
    slug: "buro-con-cajon",
    nombre: "Buró con cajón",
    resumen: "Buró de 45 × 40 × 55 cm con un cajón arriba y un espacio abierto abajo.",
    descripcion: "Buró de recámara con cajón para lo de diario y un hueco abajo para libros o una canasta.",
    nivel: "Intermedio",
    horas: "4 a 5 h",
    piezas: buro(),
    pasos: [
      { titulo: "Casco", nota: "Costados, piso y techo.", piezas: ["Costado", "Piso", "Techo"] },
      { titulo: "Entrepaño", nota: "Separa el hueco del cajón.", piezas: ["Entrepaño"] },
      { titulo: "Respaldo", nota: "Cuadra el mueble antes de clavarlo.", piezas: ["Respaldo"] },
      { titulo: "Cajón", nota: "Arma la caja y atornilla el frente desde adentro.", piezas: ["Cajón"] },
    ],
    herrajes: ["Correderas de 30 o 35 cm (opcional; sin ellas el cajón corre sobre el entrepaño)", "1 jaladera", "Tornillos para madera 1 1/4\" y 1 1/2\"", "Pegamento blanco para madera"],
    herramientas: ["Sierra circular o router CNC", "Taladro atornillador", "Prensas", "Escuadra"],
    notas: ["Con correderas, resta su grosor (normalmente 12.7 mm por lado) al ancho del cajón."],
  },
  {
    categoria: "Casa",
    slug: "zapatera-3-niveles",
    nombre: "Zapatera de 3 niveles",
    resumen: "Zapatera de 80 × 33 × 60 cm para unos 9 a 12 pares.",
    descripcion: "Mueble bajo para la entrada o el clóset, con dos repisas. Arriba sirve para dejar llaves y bolsas.",
    nivel: "Fácil",
    horas: "2 a 3 h",
    piezas: zapatera(),
    pasos: [
      { titulo: "Casco", nota: "Costados, piso y techo.", piezas: ["Costado", "Piso", "Techo"] },
      { titulo: "Repisas", nota: "A la misma distancia entre sí.", piezas: ["Repisa"] },
      { titulo: "Respaldo", nota: "Clávalo con el mueble a escuadra.", piezas: ["Respaldo"] },
    ],
    herrajes: ["Tornillos para madera 1 1/2\" (aprox. 24)", "Clavo sin cabeza 1\"", "Pegamento blanco para madera"],
    herramientas: ["Sierra circular o router CNC", "Taladro atornillador", "Escuadra"],
    notas: ["Para botas, quita una repisa."],
  },
  {
    categoria: "Casa",
    slug: "escritorio-sencillo",
    nombre: "Escritorio sencillo",
    resumen: "Escritorio de 120 × 60 × 75 cm con faldón trasero y repisa baja.",
    descripcion: "Escritorio firme para estudiar o trabajar en casa. El faldón trasero evita que se mueva y la repisa baja guarda papeles o la CPU.",
    nivel: "Fácil",
    horas: "3 h",
    piezas: escritorio(),
    pasos: [
      { titulo: "Costados", nota: "Párelos a 1.20 m de distancia.", piezas: ["Costado"] },
      { titulo: "Faldón trasero", nota: "Es lo que le da rigidez: atorníllalo bien.", piezas: ["Faldón"] },
      { titulo: "Repisa baja", nota: "Pegada al faldón.", piezas: ["Repisa"] },
      { titulo: "Cubierta", nota: "Atornilla desde abajo con escuadras para que no se vean los tornillos.", piezas: ["Cubierta"] },
    ],
    herrajes: ["Tornillos para madera 1 1/2\" (aprox. 30)", "4 a 6 escuadras metálicas pequeñas", "Pegamento blanco para madera"],
    herramientas: ["Sierra circular o router CNC", "Taladro atornillador", "Escuadra"],
    notas: ["La altura de 75 cm es la normal para escritorio; ajústala a tu silla."],
  },
  {
    categoria: "Casa",
    slug: "mesa-de-centro",
    nombre: "Mesa de centro con repisa",
    resumen: "Mesa de centro de 100 × 55 × 45 cm con costados de tablero y repisa abajo.",
    descripcion: "Mesa de sala de líneas rectas: los costados llegan al piso y la repisa de abajo guarda revistas o controles.",
    nivel: "Fácil",
    horas: "2 a 3 h",
    piezas: mesaCentro(),
    pasos: [
      { titulo: "Costados", nota: "Las dos piezas que llegan al piso.", piezas: ["Costado"] },
      { titulo: "Repisa y travesaño", nota: "Amarran los costados.", piezas: ["Repisa", "Travesaño"] },
      { titulo: "Cubierta", nota: "Atornilla desde abajo, a través del travesaño.", piezas: ["Cubierta"] },
    ],
    herrajes: ["Tornillos para madera 1 1/2\" (aprox. 20)", "Pegamento blanco para madera", "Barniz o aceite para madera"],
    herramientas: ["Sierra circular o router CNC", "Taladro atornillador", "Lijadora"],
    notas: ["Lija y barniza antes de armar: es más fácil llegar a todas las caras."],
  },
  {
    categoria: "Casa",
    slug: "banca-de-entrada",
    nombre: "Banca de entrada con zapatero",
    resumen: "Banca de 100 × 35 × 45 cm para sentarse a ponerse los zapatos, con repisa abajo.",
    descripcion: "Banca para la entrada o el pie de la cama, con repisa para zapatos o canastas.",
    nivel: "Fácil",
    horas: "2 a 3 h",
    piezas: banca(),
    pasos: [
      { titulo: "Costados", nota: "Las patas de la banca.", piezas: ["Costado"] },
      { titulo: "Faldón y repisa", nota: "Amarran los costados y le dan fuerza.", piezas: ["Faldón", "Repisa"] },
      { titulo: "Asiento", nota: "Atornilla desde arriba y tapa los tornillos con pasta.", piezas: ["Asiento"] },
    ],
    herrajes: ["Tornillos para madera 1 1/2\" (aprox. 20)", "Pasta para madera", "Pegamento blanco para madera"],
    herramientas: ["Sierra circular o router CNC", "Taladro atornillador", "Lijadora"],
    notas: ["Para más de 1.20 m de largo, agrega un costado al centro."],
  },
  {
    categoria: "Taller",
    slug: "estacion-para-ingletadora",
    nombre: "Estación para ingletadora",
    resumen: "Mesa de 2 m con dos módulos de guardado y la ingletadora al centro, al ras de las alas.",
    descripcion: "Las alas sostienen tablas largas al cortar y quedan a la altura de la mesa de la ingletadora. Abajo, dos módulos con repisa para guardar.",
    nivel: "Intermedio",
    horas: "6 a 8 h",
    piezas: estacionIngletadora(),
    pasos: [
      { titulo: "Módulo izquierdo", nota: "Costados, piso, repisa y respaldo.", piezas: ["Costado exterior izq.", "Costado interior izq.", "Piso izq.", "Repisa izq.", "Respaldo izq."] },
      { titulo: "Módulo derecho", nota: "Igual que el izquierdo.", piezas: ["Costado exterior der.", "Costado interior der.", "Piso der.", "Repisa der.", "Respaldo der."] },
      { titulo: "Plataforma", nota: "Entre los dos módulos, a la altura que deje la mesa de tu ingletadora al ras de las alas.", piezas: ["Plataforma", "Travesaño"] },
      { titulo: "Cubiertas", nota: "Atornilla desde abajo.", piezas: ["Cubierta"] },
    ],
    herrajes: ["Tornillos para madera 1 1/2\" (aprox. 80)", "Pegamento blanco para madera", "Niveladores o ruedas (opcional)"],
    herramientas: ["Sierra circular o router CNC", "Taladro atornillador", "Nivel y escuadra"],
    notas: ["Mide la altura de la mesa de tu ingletadora y ajusta la altura de la plataforma (aquí, 10 cm abajo de las alas)."],
  },
  {
    categoria: "Taller",
    slug: "porta-sargentos-de-pared",
    nombre: "Porta sargentos de pared",
    resumen: "Soporte de 1 m con seis brazos para colgar sargentos y prensas.",
    descripcion: "Libera la mesa: los sargentos quedan colgados y a la mano. Se cuelga con listón francés o directo a la pared.",
    nivel: "Fácil",
    horas: "1 a 2 h",
    piezas: portaSargentos(),
    pasos: [
      { titulo: "Respaldo", nota: "Corta el respaldo a medida.", piezas: ["Respaldo"] },
      { titulo: "Brazos", nota: "Pega y atornilla cada brazo desde atrás del respaldo.", piezas: ["Brazo"] },
      { titulo: "Listón de pared", nota: "Atornillado a la pared, a taquete.", piezas: ["Listón"] },
    ],
    herrajes: ["Tornillos para madera 1 1/2\" (aprox. 20)", "Taquetes y pijas para muro", "Pegamento blanco para madera"],
    herramientas: ["Sierra o router CNC", "Taladro", "Nivel"],
    notas: ["Para sargentos pesados, atornilla el respaldo a dos montantes o con cuatro taquetes."],
  },
  {
    categoria: "Taller",
    slug: "caja-de-herramientas",
    nombre: "Caja de herramientas portátil",
    resumen: "Caja abierta de 50 × 25 cm con agarradera para llevar herramienta de mano.",
    descripcion: "La caja de carpintero de siempre: ligera, firme y con todo a la vista.",
    nivel: "Fácil",
    horas: "1 a 2 h",
    piezas: cajaHerramientas(),
    pasos: [
      { titulo: "Fondo y cabeceras", nota: "Las cabeceras van sobre el fondo.", piezas: ["Fondo", "Cabecera"] },
      { titulo: "Costados", nota: "Entre las cabeceras.", piezas: ["Costado"] },
      { titulo: "Agarradera", nota: "Atornilla desde fuera de las cabeceras.", piezas: ["Agarradera"] },
    ],
    herrajes: ["Tornillos para madera 1 1/4\" (aprox. 16)", "Pegamento blanco para madera"],
    herramientas: ["Sierra o router CNC", "Taladro", "Lija"],
    notas: ["Redondea la agarradera con lija o con una fresa de media caña para que no lastime la mano."],
  },
  {
    categoria: "Taller",
    slug: "carro-de-herramientas",
    nombre: "Carro de herramientas",
    resumen: "Carrito de 60 × 45 × 90 cm con tres niveles y ruedas para mover herramienta.",
    descripcion: "Lleva las herramientas del trabajo de hoy a donde estés trabajando. La cubierta tiene tope para que nada se caiga.",
    nivel: "Fácil",
    horas: "2 a 3 h",
    ruedas: 100,
    piezas: carroHerramientas(),
    pasos: [
      { titulo: "Costados y repisa baja", nota: "Atornilla las ruedas a la repisa baja primero.", piezas: ["Costado", "Repisa baja"] },
      { titulo: "Repisa media", nota: "A la altura que te sirva.", piezas: ["Repisa media"] },
      { titulo: "Cubierta y tope", nota: "El tope evita que rueden las herramientas.", piezas: ["Cubierta", "Tope"] },
      { titulo: "Agarradera", nota: "En un costado, para empujarlo.", piezas: ["Agarradera"] },
    ],
    herrajes: ["4 ruedas giratorias de 2\" a 3\" (2 con freno)", "Tornillos para madera 1 1/2\" (aprox. 30)", "Pegamento blanco para madera"],
    herramientas: ["Sierra o router CNC", "Taladro atornillador", "Escuadra"],
    notas: ["La agarradera se dibuja como bloque; puede ser un tubo o una jaladera grande."],
  },
  {
    categoria: "Casa",
    slug: "repisa-de-pared",
    nombre: "Repisa de pared de 3 niveles",
    resumen: "Repisa de 90 × 20 × 60 cm para cocina, baño o recámara.",
    descripcion: "Repisa abierta para especias, libros o plantas. Se cuelga del travesaño trasero.",
    nivel: "Fácil",
    horas: "1 a 2 h",
    piezas: repisaPared(),
    pasos: [
      { titulo: "Costados", nota: "Marca la altura de cada repisa.", piezas: ["Costado"] },
      { titulo: "Repisas", nota: "Pega y atornilla desde los costados.", piezas: ["Repisa"] },
      { titulo: "Travesaño colgador", nota: "Por aquí se atornilla a la pared.", piezas: ["Travesaño"] },
    ],
    herrajes: ["Tornillos para madera 1 1/2\" (aprox. 16)", "Taquetes y pijas para muro", "Pasta para madera", "Barniz o pintura"],
    herramientas: ["Sierra o router CNC", "Taladro", "Nivel"],
    notas: ["Atorníllala a la pared por el travesaño, con taquetes adecuados para tu muro."],
  },
  {
    categoria: "Casa",
    slug: "banco-escalera",
    nombre: "Banco escalera de 2 peldaños",
    resumen: "Escalón de 42 × 45 × 45 cm para alcanzar la alacena o para los niños en el baño.",
    descripcion: "Dos peldaños firmes, cerrados al frente. También sirve como banquito.",
    nivel: "Fácil",
    horas: "2 h",
    piezas: bancoEscalera(),
    pasos: [
      { titulo: "Costados", nota: "Las dos piezas laterales.", piezas: ["Costado"] },
      { titulo: "Contrahuellas", nota: "Cierran el frente de cada escalón.", piezas: ["Contrahuella"] },
      { titulo: "Peldaños", nota: "Pega y atornilla; avellana los tornillos.", piezas: ["Peldaño"] },
      { titulo: "Travesaño trasero", nota: "Le quita el bamboleo.", piezas: ["Travesaño"] },
    ],
    herrajes: ["Tornillos para madera 1 1/2\" (aprox. 24)", "Pegamento blanco para madera", "Antiderrapante para los peldaños (opcional)"],
    herramientas: ["Sierra o router CNC", "Taladro atornillador", "Lijadora"],
    notas: ["Los costados se dibujan rectos; si quieres, córtalos en escalón siguiendo los peldaños."],
  },
  {
    categoria: "Casa",
    slug: "cubos-organizadores-3x3",
    nombre: "Cubos organizadores 3 × 3",
    resumen: "Mueble de 1 × 1 m con nueve cubos para canastas, libros o juguetes.",
    descripcion: "El clásico organizador de cubos: va en recámara, sala o cuarto de juegos, de pie o acostado.",
    nivel: "Intermedio",
    horas: "4 a 5 h",
    piezas: cubos3x3(),
    pasos: [
      { titulo: "Casco", nota: "Costados, piso y techo.", piezas: ["Costado", "Piso", "Techo"] },
      { titulo: "Entrepaños", nota: "Usa un taco espaciador para que queden parejos.", piezas: ["Entrepaño"] },
      { titulo: "Divisiones", nota: "Entre cada entrepaño.", piezas: ["División"] },
      { titulo: "Respaldo", nota: "Cuadra el mueble antes de clavarlo.", piezas: ["Respaldo"] },
    ],
    herrajes: ["Tornillos para madera 1 1/2\" (aprox. 40)", "Clavo sin cabeza 1\"", "Pegamento blanco para madera"],
    herramientas: ["Sierra o router CNC", "Taladro atornillador", "Prensas", "Escuadra"],
    notas: ["Los cubos de 30 cm aceptan las canastas de tela más comunes."],
  },
  {
    categoria: "Casa",
    slug: "jardinera",
    nombre: "Jardinera de 80 × 40 cm",
    resumen: "Macetero rectangular para plantas, hierbas o un huerto pequeño.",
    descripcion: "Jardinera para patio o terraza, con el fondo levantado para que escurra el agua.",
    nivel: "Fácil",
    horas: "2 h",
    piezas: jardinera(),
    pasos: [
      { titulo: "Frente y trasera", nota: "Las dos piezas largas.", piezas: ["Frente", "Trasera"] },
      { titulo: "Cabeceras", nota: "Entre el frente y la trasera.", piezas: ["Cabecera"] },
      { titulo: "Fondo", nota: "Haz barrenos de 10 mm cada 10 cm para el drenaje.", piezas: ["Fondo"] },
    ],
    herrajes: ["Tornillos para exterior 1 1/2\" (aprox. 24)", "Pegamento para exterior", "Plástico o geotextil para el interior", "Sellador o barniz marino"],
    herramientas: ["Sierra o router CNC", "Taladro", "Brocha"],
    notas: ["Usa triplay marino o para exterior y séllalo por todos lados: el triplay común se deshace con la humedad."],
  },
  {
    categoria: "Taller",
    slug: "estante-para-retazos",
    nombre: "Estante de pared para retazos",
    resumen: "Estante de 1 × 1.2 m con divisores para guardar retazos y listones de pie.",
    descripcion: "Ordena los retazos por tamaño y libera el piso. Se atornilla a la pared por el respaldo.",
    nivel: "Fácil",
    horas: "2 a 3 h",
    piezas: estanteRetazos(),
    pasos: [
      { titulo: "Base y respaldo", nota: "El respaldo va atornillado a la pared, a taquete.", piezas: ["Base", "Respaldo"] },
      { titulo: "Divisores", nota: "Alternan alto y bajo para meter piezas largas y cortas.", piezas: ["Divisor"] },
      { titulo: "Tope frontal", nota: "Evita que los retazos resbalen.", piezas: ["Tope"] },
    ],
    herrajes: ["Tornillos para madera 1 1/2\" (aprox. 30)", "Taquetes y pijas para muro", "Pegamento blanco para madera"],
    herramientas: ["Sierra o router CNC", "Taladro", "Nivel"],
    notas: ["Atorníllalo a la pared en al menos cuatro puntos: carga mucho peso."],
  },
  {
    categoria: "Taller",
    slug: "mesa-para-router",
    nombre: "Mesa para router de mano",
    resumen: "Gabinete de 80 × 60 × 90 cm con cubierta doble y guía para montar el router abajo.",
    descripcion: "Convierte tu router de mano en una mesa: cubierta doble para que no se flexione, guía y gabinete para fresas y accesorios.",
    nivel: "Intermedio",
    horas: "5 a 6 h",
    piezas: mesaRouter(),
    pasos: [
      { titulo: "Gabinete", nota: "Costados, piso, repisa y respaldo.", piezas: ["Costado", "Piso", "Repisa", "Respaldo"] },
      { titulo: "Cubierta doble", nota: "Pega las dos capas y préndelas mientras seca.", piezas: ["Base de la cubierta", "Cubierta"] },
      { titulo: "Guía", nota: "Va sujeta con prensas o perillas para moverla.", piezas: ["Guía"] },
    ],
    herrajes: ["Tornillos para madera 1 1/2\" (aprox. 40)", "Placa base para router (de acrílico o aluminio)", "2 perillas y tornillos para la guía", "Pegamento blanco para madera"],
    herramientas: ["Router CNC o sierra de banco", "Taladro", "Prensas", "Escuadra"],
    notas: ["El hueco del router y la placa se cortan según tu modelo de router: no vienen en el plano."],
  },
  {
    categoria: "Taller",
    slug: "gabinete-de-pared",
    nombre: "Gabinete de pared con puertas",
    resumen: "Gabinete de 80 × 30 × 70 cm con dos puertas y repisa, para colgar en el taller.",
    descripcion: "Guarda la herramienta lejos del polvo. Se cuelga con listón francés o atornillado a la pared.",
    nivel: "Intermedio",
    horas: "4 a 5 h",
    piezas: gabinetePared(),
    pasos: [
      { titulo: "Casco", nota: "Costados, piso y techo.", piezas: ["Costado", "Piso", "Techo"] },
      { titulo: "Repisa y respaldo", nota: "Cuadra el mueble antes de clavar el respaldo.", piezas: ["Repisa", "Respaldo"] },
      { titulo: "Puertas", nota: "Con bisagras de cazoleta de 35 mm.", piezas: ["Puerta"] },
    ],
    herrajes: ["Tornillos para madera 1 1/2\" (aprox. 30)", "4 bisagras de cazoleta de 35 mm", "2 jaladeras", "Pegamento blanco para madera"],
    herramientas: ["Router CNC o sierra", "Taladro con broca de cazoleta 35 mm", "Escuadra"],
    notas: ["Deja 2 mm de holgura alrededor de las puertas."],
  },
  {
    categoria: "Taller",
    slug: "mesa-de-trabajo-compacta",
    nombre: "Mesa de trabajo compacta",
    resumen: "Mesa de 1.20 × 0.60 m con cubierta doble y repisa baja, para talleres chicos.",
    descripcion: "Una mesa firme que cabe en cualquier rincón. La cubierta doble aguanta martillazos y prensas.",
    nivel: "Fácil",
    horas: "3 a 4 h",
    piezas: mesaCompacta(),
    pasos: [
      { titulo: "Costados", nota: "Párelos a 1.20 m.", piezas: ["Costado"] },
      { titulo: "Faldones", nota: "Uno atrás y otro adelante: le quitan el bamboleo.", piezas: ["Faldón"] },
      { titulo: "Repisa baja", nota: "A 15 cm del piso.", piezas: ["Repisa"] },
      { titulo: "Cubierta doble", nota: "Pega y atornilla las dos capas.", piezas: ["Cubierta inferior", "Cubierta superior"] },
    ],
    herrajes: ["Tornillos para madera 1 1/2\" (aprox. 40)", "Pegamento blanco para madera"],
    herramientas: ["Sierra circular o router CNC", "Taladro atornillador", "Prensas"],
    notas: ["Para una prensa de banco, refuerza la esquina con un taco debajo de la cubierta."],
  },
  {
    categoria: "Casa",
    slug: "mesa-de-comedor",
    nombre: "Mesa de comedor de 1.60 m",
    resumen: "Mesa de 160 × 90 × 75 cm para 6 personas, con costados de tablero y cubierta doble.",
    descripcion: "Mesa de líneas rectas: dos costados de tablero, viga central y cubierta doble de 36 mm.",
    nivel: "Intermedio",
    horas: "5 a 6 h",
    piezas: mesaComedor(),
    pasos: [
      { titulo: "Costados y pie central", nota: "El pie central amarra los costados abajo.", piezas: ["Costado", "Pie central"] },
      { titulo: "Viga central", nota: "Va arriba, de costado a costado.", piezas: ["Viga"] },
      { titulo: "Cubierta doble", nota: "Pega las dos capas con prensas y atorníllala desde abajo.", piezas: ["Base de la cubierta", "Cubierta"] },
    ],
    herrajes: ["Tornillos para madera 1 1/2\" (aprox. 40)", "Pegamento blanco para madera", "Barniz o laca para mesa"],
    herramientas: ["Sierra circular o router CNC", "Taladro atornillador", "Prensas", "Lijadora"],
    notas: ["Lija y barniza la cubierta con tres manos: es la pieza que más se usa."],
  },
  {
    categoria: "Casa",
    slug: "consola-de-entrada",
    nombre: "Consola de entrada",
    resumen: "Mueble de 100 × 30 × 80 cm para la entrada: cubierta para llaves y repisa baja.",
    descripcion: "Mueble angosto para el recibidor o detrás del sillón.",
    nivel: "Fácil",
    horas: "2 h",
    piezas: consola(),
    pasos: [
      { titulo: "Costados", nota: "Las patas de la consola.", piezas: ["Costado"] },
      { titulo: "Faldón y repisa", nota: "Amarran los costados.", piezas: ["Faldón", "Repisa"] },
      { titulo: "Cubierta", nota: "Atornilla desde abajo.", piezas: ["Cubierta"] },
    ],
    herrajes: ["Tornillos para madera 1 1/2\" (aprox. 20)", "Pegamento blanco para madera", "Barniz o pintura"],
    herramientas: ["Sierra o router CNC", "Taladro atornillador", "Lijadora"],
    notas: ["Por ser angosta, fíjala a la pared con una escuadra para que no se vuelque."],
  },
  {
    categoria: "Casa",
    slug: "mueble-para-tv",
    nombre: "Mueble para TV",
    resumen: "Mueble bajo de 150 × 40 × 50 cm con dos puertas y un hueco central para el decodificador.",
    descripcion: "Mueble de sala con dos gabinetes con puerta a los lados y un hueco abierto al centro con repisa.",
    nivel: "Intermedio",
    horas: "5 a 6 h",
    piezas: muebleTV(),
    pasos: [
      { titulo: "Casco", nota: "Costados, piso, cubierta y zoclo.", piezas: ["Costado", "Piso", "Cubierta", "Zoclo"] },
      { titulo: "Divisiones y repisa", nota: "Forman los tres huecos.", piezas: ["División", "Repisa"] },
      { titulo: "Respaldo", nota: "Haz un barreno para los cables.", piezas: ["Respaldo"] },
      { titulo: "Puertas", nota: "Con bisagras de cazoleta.", piezas: ["Puerta"] },
    ],
    herrajes: ["Tornillos para madera 1 1/2\" (aprox. 40)", "4 bisagras de cazoleta de 35 mm", "2 jaladeras", "Pegamento blanco para madera"],
    herramientas: ["Router CNC o sierra", "Taladro con broca de cazoleta 35 mm", "Escuadra"],
    notas: ["Para una TV de más de 55\", alarga el mueble a 1.80 m."],
  },
  {
    categoria: "Casa",
    slug: "base-de-cama-individual",
    nombre: "Base de cama individual",
    resumen: "Base para colchón individual (100 × 190 cm) con cabecera, tablillas y travesaño central.",
    descripcion: "Base firme de triplay con tablillas para que el colchón respire.",
    nivel: "Intermedio",
    horas: "5 a 6 h",
    piezas: baseCama(),
    pasos: [
      { titulo: "Largueros y travesaño", nota: "Los tres van de cabecera a piecera.", piezas: ["Larguero", "Travesaño"] },
      { titulo: "Cabecera y piecera", nota: "Atornilla los largueros a cabecera y piecera.", piezas: ["Cabecera", "Piecera"] },
      { titulo: "Patas", nota: "En las cuatro esquinas, por dentro.", piezas: ["Pata"] },
      { titulo: "Tablillas", nota: "A la misma distancia; atorníllalas a los largueros.", piezas: ["Tablilla"] },
    ],
    herrajes: ["Tornillos para madera 1 1/2\" (aprox. 80)", "Pegamento blanco para madera"],
    herramientas: ["Sierra circular o router CNC", "Taladro atornillador", "Escuadra"],
    notas: ["Para matrimonial, ensancha a 140 cm y pon dos travesaños."],
  },
  {
    categoria: "Casa",
    slug: "casita-para-perro",
    nombre: "Casita para perro",
    resumen: "Casita de 70 × 90 × 65 cm, levantada del piso y con techo de una sola pieza.",
    descripcion: "Casita para perro mediano, separada del piso para que no le entre humedad.",
    nivel: "Fácil",
    horas: "3 a 4 h",
    piezas: casitaPerro(),
    pasos: [
      { titulo: "Piso y patines", nota: "Los patines la separan del suelo.", piezas: ["Piso", "Patín"] },
      { titulo: "Paredes", nota: "Laterales y trasera.", piezas: ["Pared"] },
      { titulo: "Frente", nota: "Dos piezas y el dintel dejan la entrada.", piezas: ["Frente", "Dintel"] },
      { titulo: "Techo", nota: "Sobresale para que escurra la lluvia.", piezas: ["Techo"] },
    ],
    herrajes: ["Tornillos para exterior 1 1/2\" (aprox. 40)", "Pegamento para exterior", "Impermeabilizante o lámina para el techo", "Pintura para exterior"],
    herramientas: ["Sierra o router CNC", "Taladro", "Brocha"],
    notas: ["Usa triplay para exterior y pinta todas las caras antes de armar."],
  },
  {
    categoria: "Casa",
    slug: "baul-para-juguetes",
    nombre: "Baúl para juguetes",
    resumen: "Baúl de 80 × 42 × 45 cm con tapa, para guardar juguetes o cobijas.",
    descripcion: "Caja grande con tapa que también sirve de banca.",
    nivel: "Fácil",
    horas: "2 a 3 h",
    piezas: baulJuguetes(),
    pasos: [
      { titulo: "Frente y trasera", nota: "Las piezas largas.", piezas: ["Frente", "Trasera"] },
      { titulo: "Costados", nota: "Entre frente y trasera.", piezas: ["Costado"] },
      { titulo: "Fondo", nota: "Sobre listones o atornillado desde fuera.", piezas: ["Fondo"] },
      { titulo: "Tapa", nota: "Con bisagras de piano y un soporte de tapa.", piezas: ["Tapa"] },
    ],
    herrajes: ["Tornillos para madera 1 1/2\" (aprox. 24)", "Bisagra de piano de 80 cm", "Soporte de tapa de cierre lento (importante si lo usan niños)", "Pegamento blanco para madera"],
    herramientas: ["Sierra o router CNC", "Taladro", "Lijadora"],
    notas: ["Usa un soporte de tapa de cierre lento para que no le caiga a nadie en los dedos."],
  },
  {
    categoria: "Taller",
    slug: "estante-para-pinturas",
    nombre: "Estante para pinturas y químicos",
    resumen: "Estante abierto de 90 × 30 × 150 cm con cuatro repisas y topes para que no se caigan los botes.",
    descripcion: "Para tener a la mano pinturas, selladores, thinner y pegamentos, lejos del área de corte. Los topes al frente detienen los botes.",
    nivel: "Fácil",
    horas: "3 a 4 h",
    piezas: estantePinturas(),
    pasos: [
      { titulo: "Costados y repisa de abajo", nota: "Atornilla la repisa baja y el zoclo entre los costados.", piezas: ["Costado", "Repisa 1", "Zoclo"] },
      { titulo: "Repisas", nota: "Marca las alturas en los dos costados a la vez para que queden parejas.", piezas: ["Repisa"] },
      { titulo: "Techo y travesaños", nota: "Los travesaños de atrás le dan rigidez y sirven para fijarlo a la pared.", piezas: ["Techo", "Travesaño"] },
      { titulo: "Topes", nota: "Pégalos y clávalos al frente de cada repisa.", piezas: ["Tope"] },
    ],
    herrajes: ["Tornillos para madera 1 1/2\" (aprox. 50)", "Clavos o grapas de 1\" para los topes", "2 taquetes y pijas para fijarlo a la pared", "Pegamento blanco para madera"],
    herramientas: ["Sierra circular o router CNC", "Taladro atornillador", "Escuadra", "Flexómetro"],
    notas: ["Fíjalo siempre a la pared: lleno de botes pesa mucho.", "Guarda los solventes lejos de chispas y de la estufa."],
  },
  {
    categoria: "Taller",
    slug: "caja-organizadora-con-divisiones",
    nombre: "Caja organizadora con 6 divisiones",
    resumen: "Charola de 42 × 30 × 11 cm con seis compartimentos para tornillos, taquetes y brocas.",
    descripcion: "Caja baja para tener los tornillos separados por medida sobre el banco. Los separadores entran a media madera, uno dentro del otro.",
    nivel: "Fácil",
    horas: "1 a 2 h",
    piezas: cajaDivisiones(),
    pasos: [
      { titulo: "Frente, trasera y costados", nota: "Pega y clava los costados entre frente y trasera.", piezas: ["Frente", "Trasera", "Costado"] },
      { titulo: "Fondo", nota: "Pégalo y clávalo por debajo; revisa la escuadra antes de que seque.", piezas: ["Fondo"] },
      { titulo: "Separadores", nota: "Haz ranuras a media altura para que el largo y los cortos se crucen.", piezas: ["Separador"] },
    ],
    herrajes: ["Clavos o grapas de 1\" (aprox. 30)", "Pegamento blanco para madera"],
    herramientas: ["Sierra o router CNC", "Martillo o engrapadora", "Lija"],
    notas: ["Con router CNC haz las ranuras de los separadores del ancho real del triplay de 6 mm."],
  },
  {
    categoria: "Taller",
    slug: "banco-alto-de-taller",
    nombre: "Banco alto de taller",
    resumen: "Banco de 65 cm de alto para sentarte en el banco de trabajo, de una sola hoja de triplay.",
    descripcion: "Banco firme de dos patas de tablero, con faldones bajo el asiento y un travesaño abajo que sirve de reposapiés.",
    nivel: "Fácil",
    horas: "2 a 3 h",
    piezas: bancoAlto(),
    pasos: [
      { titulo: "Patas y travesaño", nota: "Atornilla el travesaño bajo entre las patas.", piezas: ["Pata", "Travesaño"] },
      { titulo: "Faldones", nota: "Arriba, al frente y atrás: le quitan el bamboleo.", piezas: ["Faldón"] },
      { titulo: "Asiento", nota: "Atornilla desde abajo a través de los faldones o con escuadras.", piezas: ["Asiento"] },
    ],
    herrajes: ["Tornillos para madera 1 1/2\" (aprox. 24)", "4 escuadras metálicas pequeñas (opcional)", "Pegamento blanco para madera"],
    herramientas: ["Sierra o router CNC", "Taladro atornillador", "Lijadora"],
    notas: ["Redondea las esquinas del asiento y lija bien los cantos."],
  },
  {
    categoria: "Taller",
    slug: "carro-para-aspiradora",
    nombre: "Carro para aspiradora y separador ciclónico",
    resumen: "Carro de 60 × 50 cm con ruedas: la aspiradora abajo y el separador o el bote arriba.",
    descripcion: "Junta la aspiradora de taller y el separador de polvo en un solo carro que llevas a cada máquina. Arriba queda una cubierta para el separador.",
    nivel: "Intermedio",
    horas: "4 a 5 h",
    ruedas: 80,
    piezas: carroAspiradora(),
    pasos: [
      { titulo: "Base", nota: "Atornilla las ruedas a la base antes de armar.", piezas: ["Base"] },
      { titulo: "Costados y respaldo", nota: "Forman el casco; revisa la escuadra.", piezas: ["Costado", "Respaldo"] },
      { titulo: "Repisa media y tope", nota: "Mide tu aspiradora y ajusta la altura de la repisa.", piezas: ["Repisa", "Tope"] },
      { titulo: "Cubierta y agarradera", nota: "Haz en la cubierta el hueco para tu separador o bote.", piezas: ["Cubierta", "Agarradera"] },
    ],
    herrajes: ["4 ruedas giratorias de 3\" (2 con freno)", "Tornillos para madera 1 1/2\" (aprox. 50)", "Tornillos para las ruedas", "Pegamento blanco para madera"],
    herramientas: ["Sierra circular o router CNC", "Taladro atornillador", "Caladora o sierra de copa"],
    notas: ["Las medidas son para una aspiradora de unos 40 L: compruébalas con la tuya antes de cortar."],
  },
  {
    categoria: "Taller",
    slug: "estante-para-cargadores",
    nombre: "Estante de pared para cargadores de baterías",
    resumen: "Gabinete abierto de 80 × 25 × 50 cm que cuelga del listón francés, con dos niveles para cargadores y baterías.",
    descripcion: "Un lugar fijo para cargar las baterías de las herramientas inalámbricas, con los cables por detrás.",
    nivel: "Fácil",
    horas: "2 a 3 h",
    piezas: estanteCargadores(),
    pasos: [
      { titulo: "Casco", nota: "Piso y techo entre los costados.", piezas: ["Costado", "Piso", "Techo"] },
      { titulo: "Repisa y respaldo", nota: "Antes del respaldo, barrena huecos de 35 mm para pasar los cables.", piezas: ["Repisa", "Respaldo"] },
      { titulo: "Tope y listón francés", nota: "El listón va con el corte a 45° hacia abajo, contra la pared.", piezas: ["Tope", "Listón"] },
    ],
    herrajes: ["Tornillos para madera 1 1/4\" (aprox. 40)", "Regleta con supresor de picos", "Pegamento blanco para madera"],
    herramientas: ["Sierra o router CNC", "Taladro", "Broca de copa de 35 mm"],
    notas: ["Deja espacio alrededor de los cargadores para que se ventilen.", "No lo pongas junto a la zona de lijado: el polvo y los cargadores no se llevan."],
  },
  {
    categoria: "Casa",
    slug: "cajon-bajo-cama",
    nombre: "Cajón con ruedas para debajo de la cama",
    resumen: "Cajón de 90 × 60 × 22 cm con ruedas y división al centro para aprovechar el espacio bajo la cama.",
    descripcion: "Guarda ropa de temporada, cobijas o juguetes y sácalo jalando el frente.",
    nivel: "Fácil",
    horas: "2 a 3 h",
    ruedas: 40,
    piezas: cajonBajoCama(),
    pasos: [
      { titulo: "Fondo", nota: "Atornilla las 4 ruedas fijas o de rodaja por debajo.", piezas: ["Fondo"] },
      { titulo: "Costados y trasera", nota: "Pega y atornilla sobre el fondo.", piezas: ["Costado", "Trasera"] },
      { titulo: "Frente y divisor", nota: "El frente es más alto que los costados: ahí va la jaladera o un hueco para la mano.", piezas: ["Frente", "Divisor"] },
    ],
    herrajes: ["4 rodajas de 1 1/2\" de bajo perfil", "Tornillos para madera 1 1/4\" (aprox. 30)", "1 jaladera", "Pegamento blanco para madera"],
    herramientas: ["Sierra o router CNC", "Taladro atornillador"],
    notas: ["Mide el espacio libre bajo tu cama: el cajón con ruedas mide 22 cm de alto."],
  },
  {
    categoria: "Casa",
    slug: "librero-bajo",
    nombre: "Librero bajo de 1 m",
    resumen: "Librero de 100 × 30 × 82 cm con dos niveles y cubierta, para bajo una ventana o junto al sillón.",
    descripcion: "Mueble bajo y sencillo con respaldo de 6 mm y zoclo, que también sirve de mesa lateral.",
    nivel: "Fácil",
    horas: "3 a 4 h",
    piezas: libreroBajo(),
    pasos: [
      { titulo: "Costados, piso y zoclo", nota: "El zoclo va un poco metido para que no se patee.", piezas: ["Costado", "Piso", "Zoclo"] },
      { titulo: "Repisa", nota: "Fija o sobre soportes de repisa.", piezas: ["Repisa"] },
      { titulo: "Respaldo y cubierta", nota: "El respaldo lo escuadra; la cubierta sobresale en los lados.", piezas: ["Respaldo", "Cubierta"] },
    ],
    herrajes: ["Tornillos para madera 1 1/2\" (aprox. 30)", "Clavos de 3/4\" para el respaldo", "Pegamento blanco para madera"],
    herramientas: ["Sierra circular o router CNC", "Taladro atornillador", "Escuadra"],
    notas: ["Cubre los cantos con cubrecanto o lija y barniza para un buen acabado."],
  },
  {
    categoria: "Casa",
    slug: "macetero-escalonado",
    nombre: "Macetero escalonado de 3 niveles",
    resumen: "Escalera para plantas de 80 cm de ancho con tres escalones, para patio, balcón o junto a la ventana.",
    descripcion: "Pone cada maceta a su altura para que a todas les dé el sol.",
    nivel: "Fácil",
    horas: "2 a 3 h",
    piezas: maceteroEscalonado(),
    pasos: [
      { titulo: "Costados", nota: "Si cortas en CNC, recorta el perfil escalonado en los costados.", piezas: ["Costado"] },
      { titulo: "Contrahuellas", nota: "Unen los costados y cargan los escalones.", piezas: ["Contrahuella"] },
      { titulo: "Escalones", nota: "Atornilla desde arriba a costados y contrahuellas.", piezas: ["Escalón"] },
    ],
    herrajes: ["Tornillos para exterior 1 1/2\" (aprox. 30)", "Pegamento para exterior", "Sellador o pintura para exterior"],
    herramientas: ["Sierra o router CNC", "Taladro atornillador", "Brocha"],
    notas: ["Usa triplay para exterior y sella todas las caras: el agua de riego lo hincha.", "Pon platos bajo las macetas."],
  },
  {
    categoria: "Casa",
    slug: "especiero-de-pared",
    nombre: "Especiero de pared",
    resumen: "Repisa de 50 × 60 cm con tres niveles y barandales para frascos de especias.",
    descripcion: "Repisa poco profunda para la cocina: los frascos quedan a la vista y el barandal los detiene.",
    nivel: "Fácil",
    horas: "1 a 2 h",
    piezas: especiero(),
    pasos: [
      { titulo: "Costados y repisas", nota: "Marca las tres alturas en los dos costados a la vez.", piezas: ["Costado", "Repisa"] },
      { titulo: "Respaldo", nota: "Clávalo por detrás; de ahí se cuelga.", piezas: ["Respaldo"] },
      { titulo: "Barandales", nota: "Pégalos al frente de los costados.", piezas: ["Barandal"] },
    ],
    herrajes: ["Clavos o grapas de 1\" (aprox. 30)", "2 colgadores o taquetes con pijas", "Pegamento blanco para madera", "Barniz apto para cocina"],
    herramientas: ["Sierra o router CNC", "Martillo o engrapadora", "Lija"],
    notas: ["Barnízalo para que la grasa de la cocina no lo manche."],
  },
  {
    categoria: "Casa",
    slug: "comedero-elevado",
    nombre: "Comedero elevado para perro",
    resumen: "Base de 56 × 30 × 30 cm para dos platos, a buena altura para perros medianos.",
    descripcion: "Caja firme con dos huecos en la cubierta para platos de acero inoxidable.",
    nivel: "Fácil",
    horas: "1 a 2 h",
    piezas: comederoElevado(),
    pasos: [
      { titulo: "Frente y trasera", nota: "Las piezas largas.", piezas: ["Frente", "Trasera"] },
      { titulo: "Costados", nota: "Entre frente y trasera.", piezas: ["Costado"] },
      { titulo: "Cubierta", nota: "Corta los dos huecos a la medida de tus platos (con CNC o caladora) antes de atornillarla.", piezas: ["Cubierta"] },
    ],
    herrajes: ["Tornillos para madera 1 1/2\" (aprox. 16)", "2 platos de acero inoxidable con ceja", "Pegamento blanco para madera", "Barniz o pintura lavable"],
    herramientas: ["Sierra o router CNC", "Caladora", "Taladro"],
    notas: ["Mide el diámetro de tus platos bajo la ceja: ese es el hueco que hay que cortar.", "Para perros grandes, súbelo a 40 cm."],
  },
  {
    categoria: "Taller",
    slug: "gabinete-para-taladro-de-banco",
    nombre: "Gabinete para taladro de banco",
    resumen: "Gabinete de 60 × 50 × 75 cm con puerta y repisa: el taladro arriba y las brocas guardadas abajo.",
    descripcion: "Una base firme a buena altura para el taladro de banco o el esmeril, con espacio cerrado para brocas, prensas y accesorios.",
    nivel: "Intermedio",
    horas: "4 a 5 h",
    piezas: gabineteTaladro(),
    pasos: [
      { titulo: "Casco", nota: "Costados, zoclo y piso; revisa la escuadra.", piezas: ["Costado", "Zoclo", "Piso"] },
      { titulo: "Repisa", nota: "A la altura de tus cajas de brocas.", piezas: ["Repisa"] },
      { titulo: "Respaldo", nota: "Lo escuadra y le quita el bamboleo.", piezas: ["Respaldo"] },
      { titulo: "Cubierta", nota: "Atornillada desde abajo; el taladro se fija a ella con tornillos pasados.", piezas: ["Cubierta"] },
      { titulo: "Puerta", nota: "Con bisagras de cazoleta o de piano.", piezas: ["Puerta"] },
    ],
    herrajes: ["Tornillos para madera 1 1/2\" (aprox. 40)", "2 bisagras de cazoleta o 1 de piano", "1 jaladera", "4 tornillos pasados para fijar el taladro", "Pegamento blanco para madera"],
    herramientas: ["Sierra circular o router CNC", "Taladro atornillador", "Escuadra"],
    notas: ["Fíjalo a la pared o al piso si tu taladro es alto: así no se vence."],
  },
  {
    categoria: "Taller",
    slug: "mesa-de-apoyo-para-sierra",
    nombre: "Mesa de apoyo para sierra de banco",
    resumen: "Mesa de 1.20 × 0.60 m a 86 cm de alto para recibir los tableros al salir de la sierra.",
    descripcion: "Detrás de la sierra de banco sostiene la pieza al terminar el corte, para que no se caiga ni se levante. Ajusta el alto a tu sierra.",
    nivel: "Fácil",
    horas: "2 a 3 h",
    piezas: mesaApoyoSierra(),
    pasos: [
      { titulo: "Patas y travesaño", nota: "El travesaño bajo une las dos patas.", piezas: ["Pata", "Travesaño"] },
      { titulo: "Faldones", nota: "Arriba, al frente y atrás: le dan rigidez.", piezas: ["Faldón"] },
      { titulo: "Cubierta", nota: "Debe quedar 2 o 3 mm abajo de la mesa de tu sierra.", piezas: ["Cubierta"] },
    ],
    herrajes: ["Tornillos para madera 1 1/2\" (aprox. 30)", "4 niveladores de rosca (opcional)", "Pegamento blanco para madera"],
    herramientas: ["Sierra o router CNC", "Taladro atornillador", "Nivel"],
    notas: ["Mide el alto de tu sierra y cambia el alto en «Modifica las medidas» antes de cortar."],
  },
  {
    categoria: "Taller",
    slug: "repisa-porta-rollos",
    nombre: "Repisa porta rollos de lija y cinta",
    resumen: "Repisa de pared de 90 cm con una varilla abajo para rollos de lija, cinta y papel.",
    descripcion: "Los rollos quedan colgados y se cortan a la medida; arriba, una repisa para lo demás.",
    nivel: "Fácil",
    horas: "1 a 2 h",
    piezas: repisaRollos(),
    pasos: [
      { titulo: "Riel de pared", nota: "Va atornillado a la pared, a nivel.", piezas: ["Riel"] },
      { titulo: "Ménsulas", nota: "Barrénalas antes para la varilla de 1\".", piezas: ["Ménsula"] },
      { titulo: "Repisa", nota: "Encima de riel y ménsulas.", piezas: ["Repisa"] },
    ],
    herrajes: ["Varilla o tubo de 1\" × 90 cm", "Tornillos para madera 1 1/2\" (aprox. 12)", "4 taquetes y pijas para la pared", "Pegamento blanco para madera"],
    herramientas: ["Sierra o router CNC", "Taladro", "Broca de pala de 1\"", "Nivel"],
    notas: ["Pon la varilla a unos 8 cm del frente para que los rollos giren sin tocar la pared."],
  },
  {
    categoria: "Taller",
    slug: "mesa-de-ensamble-baja",
    nombre: "Mesa de ensamble baja",
    resumen: "Mesa de 1.20 × 0.80 m a 60 cm de alto para armar muebles y cajas grandes cómodamente.",
    descripcion: "Más baja que el banco de trabajo: los muebles grandes quedan a la altura de las manos al armarlos, lijarlos o pintarlos.",
    nivel: "Fácil",
    horas: "2 a 3 h",
    piezas: mesaEnsamble(),
    pasos: [
      { titulo: "Costados y repisa", nota: "La repisa baja amarra los costados.", piezas: ["Costado", "Repisa"] },
      { titulo: "Travesaño trasero", nota: "No lo omitas: le quita el bamboleo.", piezas: ["Travesaño"] },
      { titulo: "Cubierta", nota: "Puedes forrarla con alfombra para no rayar los muebles.", piezas: ["Cubierta"] },
    ],
    herrajes: ["Tornillos para madera 1 1/2\" (aprox. 30)", "Pegamento blanco para madera"],
    herramientas: ["Sierra circular o router CNC", "Taladro atornillador", "Escuadra"],
    notas: ["Si la vas a mover seguido, ponle 4 ruedas con freno debajo de los costados."],
  },
  {
    categoria: "Taller",
    slug: "caja-organizadora-con-tapa",
    nombre: "Caja organizadora con tapa",
    resumen: "Caja de 50 × 30 × 25 cm con tapa que se corta del mismo casco: para guardar o llevar herramienta.",
    descripcion: "Se arma como una caja cerrada y luego se separa la tapa; así cierra perfecto. Con bisagras y un cierre queda lista para transportar.",
    nivel: "Intermedio",
    horas: "2 a 3 h",
    piezas: cajaConTapa(),
    pasos: [
      { titulo: "Fondo", nota: "La base de la caja.", piezas: ["Fondo"] },
      { titulo: "Frente y trasera", nota: "Pegadas y clavadas al fondo.", piezas: ["Frente", "Trasera"] },
      { titulo: "Costados", nota: "Entre frente y trasera.", piezas: ["Costado"] },
      { titulo: "Tapa", nota: "Arma la tapa con sus cuatro lados y la cubierta; luego bisagras y cierre.", piezas: ["Tapa"] },
    ],
    herrajes: ["Clavos o grapas de 1 1/4\" (aprox. 40)", "2 bisagras de 1 1/2\"", "1 cierre de palanca", "1 jaladera o asa", "Pegamento blanco para madera"],
    herramientas: ["Sierra o router CNC", "Martillo o engrapadora", "Desarmador"],
    notas: ["Lija las orillas de la tapa para que cierre sin trabarse."],
  },
  {
    categoria: "Casa",
    slug: "mesa-lateral",
    nombre: "Mesa lateral",
    resumen: "Mesa de 45 × 45 × 55 cm con repisa abajo, para junto al sillón o la cama.",
    descripcion: "Mesa auxiliar de líneas rectas: la cubierta para la lámpara o el café y la repisa para revistas.",
    nivel: "Fácil",
    horas: "1 a 2 h",
    piezas: mesaLateral(),
    pasos: [
      { titulo: "Costados y repisa", nota: "La repisa los mantiene a escuadra.", piezas: ["Costado", "Repisa"] },
      { titulo: "Travesaño", nota: "Atrás, arriba.", piezas: ["Travesaño"] },
      { titulo: "Cubierta", nota: "Atornillada desde abajo con escuadras o tornillos ocultos.", piezas: ["Cubierta"] },
    ],
    herrajes: ["Tornillos para madera 1 1/2\" (aprox. 16)", "Pegamento blanco para madera", "Barniz o pintura"],
    herramientas: ["Sierra o router CNC", "Taladro atornillador", "Lijadora"],
    notas: ["Cubre los cantos con cubrecanto de madera para un acabado más fino."],
  },
  {
    categoria: "Casa",
    slug: "perchero-de-pared-con-repisa",
    nombre: "Perchero de pared con repisa",
    resumen: "Perchero de 80 cm con repisa arriba y espacio para 5 ganchos: para la entrada o el cuarto.",
    descripcion: "Chamarras y bolsas en los ganchos; llaves, lentes y gorras en la repisa.",
    nivel: "Fácil",
    horas: "1 a 2 h",
    piezas: percheroPared(),
    pasos: [
      { titulo: "Tablero", nota: "Marca dónde van los ganchos antes de armar.", piezas: ["Tablero"] },
      { titulo: "Ménsulas", nota: "Pegadas y atornilladas por detrás del tablero.", piezas: ["Ménsula"] },
      { titulo: "Repisa", nota: "Encima de tablero y ménsulas.", piezas: ["Repisa"] },
    ],
    herrajes: ["5 ganchos para ropa", "Tornillos para madera 1 1/4\" (aprox. 12)", "4 taquetes y pijas para la pared", "Pegamento blanco para madera"],
    herramientas: ["Sierra o router CNC", "Taladro", "Nivel"],
    notas: ["Atorníllalo a la pared en los montantes o con taquetes para carga pesada."],
  },
  {
    categoria: "Casa",
    slug: "organizador-de-escritorio",
    nombre: "Organizador de escritorio",
    resumen: "Organizador de 40 × 20 × 15 cm con tres compartimentos para plumas, notas y el celular.",
    descripcion: "Pequeño, para ordenar el escritorio de la oficina o de la escuela. Buen proyecto para empezar.",
    nivel: "Fácil",
    horas: "1 h",
    piezas: organizadorEscritorio(),
    pasos: [
      { titulo: "Base y costados", nota: "Pegados y clavados.", piezas: ["Base", "Costado"] },
      { titulo: "Trasera y frente", nota: "El frente es bajo para alcanzar las cosas.", piezas: ["Trasera", "Frente"] },
      { titulo: "Divisiones", nota: "A 13 y 27 cm del lado izquierdo.", piezas: ["División"] },
    ],
    herrajes: ["Clavos o grapas de 1\" (aprox. 20)", "Pegamento blanco para madera", "Barniz"],
    herramientas: ["Sierra o router CNC", "Martillo o engrapadora", "Lija"],
    notas: ["Con router CNC puedes grabar un nombre o un logo en el frente."],
  },
  {
    categoria: "Casa",
    slug: "cava-para-9-botellas",
    nombre: "Cava para 9 botellas",
    resumen: "Cava de 43 × 30 × 43 cm con 9 casilleros: cada botella acostada en su lugar.",
    descripcion: "Para la cocina, el comedor o encima de un mueble. Se puede apilar una sobre otra para más botellas.",
    nivel: "Intermedio",
    horas: "2 a 3 h",
    piezas: cavaVino(),
    pasos: [
      { titulo: "Casco", nota: "Costados, piso y techo.", piezas: ["Costado", "Piso", "Techo"] },
      { titulo: "Repisas", nota: "Dividen las tres filas.", piezas: ["Repisa"] },
      { titulo: "Divisiones", nota: "Dos por fila, a 12 cm entre sí.", piezas: ["División"] },
      { titulo: "Respaldo", nota: "Tope para que las botellas no se salgan por atrás.", piezas: ["Respaldo"] },
    ],
    herrajes: ["Tornillos para madera 1 1/2\" (aprox. 30)", "Clavos de 3/4\" para el respaldo", "Pegamento blanco para madera", "Barniz"],
    herramientas: ["Sierra o router CNC", "Taladro atornillador", "Escuadra"],
    notas: ["Los casilleros de 12 cm reciben botellas de vino estándar; para botellas más gruesas, ensánchala en «Modifica las medidas»."],
  },
  {
    categoria: "Casa",
    slug: "mesa-para-ninos",
    nombre: "Mesa para niños",
    resumen: "Mesa de 60 × 60 cm a 50 cm de alto para dibujar, jugar y hacer la tarea.",
    descripcion: "Mesa firme a la altura de niños de 3 a 7 años, con faldones que la hacen resistente a los golpes.",
    nivel: "Fácil",
    horas: "2 a 3 h",
    piezas: mesaNinos(),
    pasos: [
      { titulo: "Patas y travesaño", nota: "El travesaño bajo sirve para apoyar los pies.", piezas: ["Pata", "Travesaño"] },
      { titulo: "Faldones", nota: "Arriba, al frente y atrás.", piezas: ["Faldón"] },
      { titulo: "Cubierta", nota: "Redondea las esquinas y lija muy bien los cantos.", piezas: ["Cubierta"] },
    ],
    herrajes: ["Tornillos para madera 1 1/2\" (aprox. 24)", "Pegamento blanco para madera", "Pintura o barniz no tóxico"],
    herramientas: ["Sierra o router CNC", "Taladro atornillador", "Lijadora"],
    notas: ["Redondea todas las esquinas (radio de 2 cm o más) y usa acabados no tóxicos."],
  },
]

export const planoPorSlug = (slug: string) => PLANOS.find((x) => x.slug === slug)
