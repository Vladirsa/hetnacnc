// Todas las herramientas CNC de HETNA en un solo lugar.
// Las usan la página /herramientas-cnc y el menú "Herramientas CNC" (barra y
// celular). Para agregar una herramienta, agrégala aquí y aparece en los tres.
//
// Antes estaban repartidas en dos lados que se llamaban casi igual: el menú
// "Herramientas CNC" llevaba a páginas de servicio y "Laboratorio CAM" (/cam) a
// otra lista distinta. Ahora "Laboratorio CAM" es solo el grupo de programación.

export type Herramienta = {
  nombre: string
  texto: string
  href: string
  icono: string
  // "gratis" = sin cuenta ni pago; "cuenta" = gratis con cuenta;
  // "creditos" = se paga con créditos; "plan" = con plan para talleres
  acceso: "gratis" | "cuenta" | "creditos" | "plan"
}

export type GrupoHerramientas = {
  id: string
  titulo: string
  pregunta: string
  texto: string
  icono: string
  herramientas: Herramienta[]
}

export const GRUPOS_HERRAMIENTAS: GrupoHerramientas[] = [
  {
    id: "disenar",
    titulo: "Diseñar",
    pregunta: "No tengo archivo todavía",
    texto: "Generadores y plantillas: pones las medidas y sale el archivo listo para cortar o grabar.",
    icono: "generador",
    herramientas: [
      { nombre: "Caja con juntas de dedo", texto: "Medidas y espesor, y descargas la caja en DXF, SVG o PDF.", href: "/servicios/generador-2d-3d/caja-con-juntas", icono: "caja", acceso: "gratis" },
      { nombre: "Letreros y nombres", texto: "Escribe el texto, elige la letra y descarga el DXF con las letras unidas.", href: "/servicios/generador-2d-3d/letreros", icono: "letrero", acceso: "gratis" },
      { nombre: "Vectorizador de imágenes", texto: "Un logotipo o dibujo convertido en contornos DXF o SVG.", href: "/servicios/generador-2d-3d/vectorizador", icono: "vector", acceso: "gratis" },
      { nombre: "Despiece de muebles", texto: "Gabinetes, closets y cocinas: piezas, acomodo en hojas, canto y herraje.", href: "/servicios/generador-2d-3d/despiece-muebles", icono: "mueble", acceso: "gratis" },
      { nombre: "Plantillas de empaque", texto: "Cajas, pirámides, conos, sobres y bolsas a tu medida.", href: "/servicios/generador-2d-3d/plantillas-empaque", icono: "empaque", acceso: "gratis" },
      { nombre: "Foto para grabado láser", texto: "Tu foto tramada al tamaño y la resolución de tu láser.", href: "/servicios/generador-2d-3d/grabado-foto", icono: "grabado", acceso: "gratis" },
      { nombre: "Litofanías y relieves 3D", texto: "Tu foto convertida en STL: litofanía o relieve para tallar.", href: "/servicios/generador-2d-3d/litofania-relieve", icono: "relieve", acceso: "gratis" },
      { nombre: "Patrones radiales", texto: "Mandalas y arte de pared en capas, listos para cortar.", href: "/servicios/generador-2d-3d/patrones-radiales", icono: "generador", acceso: "gratis" },
      { nombre: "Convertidor y reescalador", texto: "DXF a SVG y al revés, STL a OBJ, cambio de tamaño y de espesor.", href: "/servicios/generador-2d-3d/convertidor", icono: "convertir", acceso: "gratis" },
    ],
  },
  {
    id: "laboratorio-cam",
    titulo: "Laboratorio CAM",
    pregunta: "Ya tengo el dibujo o el modelo",
    texto: "Del archivo al G-code: trayectorias, avances y revoluciones calculados para tu máquina.",
    icono: "cam",
    herramientas: [
      { nombre: "DXF a G-code", texto: "Sube un DXF, elige material y fresa, y descarga el G-code con las pasadas calculadas.", href: "/cam/subir", icono: "gcode", acceso: "gratis" },
      { nombre: "CAM en 3, 4 y 5 ejes", texto: "STL, OBJ o STEP: trayectoria con anticolisión, remoción de material y programa para tu controlador.", href: "/cam/lab", icono: "ejes", acceso: "gratis" },
      { nombre: "Torno con eje rotativo", texto: "Balaustres, patas y columnas por tramos, con G-code para Mach3 o Mach4.", href: "/cam/torno", icono: "torno", acceso: "gratis" },
    ],
  },
  {
    id: "escanear",
    titulo: "Escanear",
    pregunta: "Tengo la pieza, no el dibujo",
    texto: "Fotos de una pieza que ya existe y te devolvemos su modelo 3D.",
    icono: "escaneo",
    herramientas: [
      { nombre: "Escaneo 3D de piezas", texto: "Vista previa gratis; el escaneo que mide de verdad se paga con créditos.", href: "/taller/escaneos/nuevo", icono: "escaneo", acceso: "creditos" },
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
      { nombre: "Cotizador para talleres", texto: "Cotizaciones profesionales con costos de máquina, material y utilidad.", href: "/servicios/cotizador-cnc", icono: "cotizador", acceso: "plan" },
      { nombre: "Calculadoras CNC", texto: "Velocidad de corte, avance por diente, revoluciones y más.", href: "/servicios/copiloto-ia-cnc?vista=calculadoras", icono: "calculadora", acceso: "gratis" },
    ],
  },
  {
    id: "aprender",
    titulo: "Aprender y preguntar",
    pregunta: "Tengo una duda",
    texto: "Una IA experta en CNC, guías paso a paso y una comunidad de gente que corta todos los días.",
    icono: "aprender",
    herramientas: [
      { nombre: "Copiloto IA CNC", texto: "Parámetros de corte, errores, G-code y costos: pregunta como a un experto.", href: "/servicios/copiloto-ia-cnc", icono: "ia", acceso: "cuenta" },
      { nombre: "Aprendizaje CNC", texto: "Guías para diseñar, programar y operar tu máquina.", href: "/servicios/aprendizaje-cnc", icono: "aprender", acceso: "gratis" },
      { nombre: "Foro CNC México", texto: "Pregunta y comparte con otros talleres y operadores.", href: "/foro-cnc", icono: "ia", acceso: "gratis" },
    ],
  },
]

export const ACCESO: Record<Herramienta["acceso"], string> = {
  gratis: "Gratis, sin cuenta",
  cuenta: "Gratis (más con tu cuenta)",
  creditos: "Con créditos",
  plan: "Plan para talleres",
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
