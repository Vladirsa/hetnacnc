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

export type Plano = {
  slug: string
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

export const PLANOS: Plano[] = [
  {
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
]

export const planoPorSlug = (slug: string) => PLANOS.find((x) => x.slug === slug)
