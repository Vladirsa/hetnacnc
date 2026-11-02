// Todas las herramientas CNC de HETNA en un solo lugar.
// Las usan la página /herramientas-cnc y el menú "Herramientas CNC" (barra y
// celular). Para agregar una herramienta, agrégala aquí y aparece en los tres.
//
// Antes estaban repartidas en dos lados que se llamaban casi igual: el menú
// "Herramientas CNC" llevaba a páginas de servicio y "Laboratorio CAM" (/cam) a
// otra lista distinta. Ahora "Laboratorio CAM" es solo el grupo de programación.
// Los generadores y el escaneo comparten un espacio de trabajo: lib/hetna/disenar.ts.

import { HERRAMIENTAS_DISENO } from "./disenar"

export type Herramienta = {
  nombre: string
  texto: string
  href: string
  icono: string
  // "gratis" = sin cuenta ni pago; "cuenta" = gratis con cuenta;
  // "creditos" = se paga con créditos; "plan" = con plan para talleres;
  // "taller" = para talleres (gratis, con su cuenta de taller)
  acceso: "gratis" | "cuenta" | "creditos" | "plan" | "taller"
}

export type GrupoHerramientas = {
  id: string
  titulo: string
  pregunta: string
  texto: string
  icono: string
  // Página propia del grupo (si no, el enlace baja a su sección de /herramientas-cnc)
  href?: string
  // Texto del botón hacia href en /herramientas-cnc (por omisión "Abrir el espacio de trabajo")
  boton?: string
  // Botón principal de la sección cuando no es href (p. ej. entrar directo a la herramienta)
  accion?: { texto: string; href: string }
  // Lo que se puede hacer, en pocas palabras (chips bajo el texto)
  puntos?: string[]
  herramientas: Herramienta[]
}

export const GRUPOS_HERRAMIENTAS: GrupoHerramientas[] = [
  {
    id: "disenar",
    titulo: "Diseñar y escanear",
    pregunta: "No tengo archivo todavía",
    texto: "Generadores y plantillas, o fotos de una pieza que ya existe: sale el archivo listo para cortar, grabar o imprimir. Todo en un solo espacio de trabajo.",
    icono: "generador",
    href: "/disenar",
    herramientas: [
      { nombre: "Cajas para láser y router: 170+ diseños", texto: "Bisagras, cajones, tapas corredizas, organizadores, estantes y mecanismos a tu medida.", href: "/disenar/cajas", icono: "caja", acceso: "gratis" as const },
      ...HERRAMIENTAS_DISENO.map((h) => ({
        nombre: h.nombre,
        texto: h.texto,
        href: `/disenar/${h.slug}`,
        icono: h.icono,
        acceso: h.acceso,
      })),
    ],
  },
  {
    id: "laboratorio-cam",
    titulo: "Laboratorio CAM",
    pregunta: "Ya tengo el dibujo o el modelo",
    texto:
      "Un simulador CAM en línea: le das tu pieza, eliges material, herramienta y máquina, y te enseña por dónde pasa la fresa, cuánto tarda y si algo choca. Cuando te convence, descargas el G-code. Gratis y sin cuenta.",
    icono: "cam",
    href: "/laboratorio-cam",
    boton: "Qué es y cómo funciona",
    accion: { texto: "Entrar al laboratorio", href: "/cam/lab" },
    puntos: ["Simular trayectorias", "Detectar colisiones", "Estimar tiempos", "Probar estrategias", "G-code para tu controlador"],
    herramientas: [
      { nombre: "DXF a G-code", texto: "Sube un DXF, elige material y fresa, y descarga el G-code con las pasadas calculadas.", href: "/cam/subir", icono: "gcode", acceso: "gratis" },
      { nombre: "CAM en 3, 4 y 5 ejes", texto: "STL, OBJ, STEP o IGES: simula la trayectoria con anticolisión, remoción de material y programa para tu controlador.", href: "/cam/lab", icono: "ejes", acceso: "gratis" },
      { nombre: "Torno con eje rotativo", texto: "Balaustres, patas y columnas por tramos, con G-code para Mach3 o Mach4.", href: "/cam/torno", icono: "torno", acceso: "gratis" },
    ],
  },
  {
    id: "cotizar",
    titulo: "Cotizar y calcular",
    pregunta: "Quiero saber cuánto cuesta",
    texto: "Precios al momento para tu pieza, y el cotizador profesional para tu taller.",
    icono: "cotizador",
    herramientas: [
      { nombre: "Calculadoras de precio", texto: "Router CNC, corte láser, plasma e impresión 3D: el precio de tu pieza al momento.", href: "/cotizar", icono: "calculadora", acceso: "gratis" },
      { nombre: "App HETNA CNC para talleres", texto: "Cotiza con tus costos, cobra en línea y controla tu taller desde el celular. Se instala desde el navegador.", href: "/servicios/cotizador-cnc", icono: "cotizador", acceso: "plan" },
      { nombre: "Calculadora CNC profesional", texto: "RPM, avance y pasadas para router; potencia y velocidad para láser CO₂, fibra, UV, plasma e impresión 3D, según tu máquina.", href: "/calculadora-cnc", icono: "calculadora", acceso: "gratis" },
    ],
  },
  {
    id: "aprender",
    titulo: "Academia CNC",
    pregunta: "Quiero aprender",
    texto: "Cursos en video impartidos por talleres de México, muchos gratis, más guías paso a paso y un foro para preguntar.",
    icono: "aprender",
    // El menú "Herramientas CNC" lleva directo a la Academia
    href: "/servicios/aprendizaje-cnc",
    boton: "Ver los cursos",
    puntos: ["Cursos gratis y de pago", "Router, láser, plasma, torno y Fusion 360", "A tu ritmo, en el celular o la computadora"],
    herramientas: [
      { nombre: "Academia CNC", texto: "Cursos en video de router, láser, plasma, torno, Fusion 360 y G-code, con guías paso a paso.", href: "/servicios/aprendizaje-cnc", icono: "aprender", acceso: "gratis" },
      { nombre: "Enseña en HETNA y gana", texto: "¿Tienes un taller? Publica tus cursos gratis, gana alumnos y clientes, y cobra cada venta en tu saldo.", href: "/servicios/aprendizaje-cnc#ensena", icono: "cotizador", acceso: "taller" },
      { nombre: "Foro CNC México", texto: "Pregunta y comparte con otros talleres y operadores.", href: "/foro-cnc", icono: "ia", acceso: "gratis" },
    ],
  },
]

export const ACCESO: Record<Herramienta["acceso"], string> = {
  gratis: "Gratis, sin cuenta",
  cuenta: "Gratis (más con tu cuenta)",
  creditos: "Con créditos",
  plan: "Plan para talleres",
  taller: "Para talleres",
}

// Servicios en los que lo hacemos nosotros (diseño a la medida)
export const DISENO_A_LA_MEDIDA = [
  { nombre: "Diseño desde cero", href: "/servicios/generador-2d-3d/diseno-desde-cero" },
  { nombre: "Modificación de archivos", href: "/servicios/generador-2d-3d/modificacion-de-archivos" },
  { nombre: "Vectorización", href: "/servicios/generador-2d-3d/vectorizacion" },
  { nombre: "Conversión de formatos", href: "/servicios/generador-2d-3d/conversion-de-formatos" },
  { nombre: "Preparación para CAM", href: "/servicios/generador-2d-3d/preparacion-para-cam" },
]

export const TOTAL_HERRAMIENTAS = GRUPOS_HERRAMIENTAS.reduce((n, g) => n + g.herramientas.length, 0)
