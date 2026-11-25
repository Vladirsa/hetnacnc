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
    ...divs.map((x, i) => p(`División ${i + 1}`, x - e / 2, x + e / 2, 0, D, zPiso + e, zPiso + e + alto)),
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
    p("Divisor delantero", W / 2 - e / 2, W / 2 + e / 2, 0, yc - e / 2, z0, z0 + 520),
    p("Divisor trasero", W / 2 - e / 2, W / 2 + e / 2, yc + e / 2, D, z0, z0 + 520),
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
    p("Alma", e, L - e, yc - e / 2, yc + e / 2, 120, H - e),
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
]

export const planoPorSlug = (slug: string) => PLANOS.find((x) => x.slug === slug)
