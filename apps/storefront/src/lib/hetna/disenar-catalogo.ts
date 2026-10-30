// Catálogo visual del inicio de "Diseñar y escanear": secciones con tarjetas
// de color, filtrables por máquina. Cada tarjeta lleva a una herramienta o a
// un modelo concreto (una caja de Boxes.py, una plantilla de empaque).

export type Proceso = "laser" | "router" | "3d" | "papel"

export const PROCESOS: { id: Proceso; nombre: string; color: string }[] = [
  { id: "laser", nombre: "Láser", color: "#FF6A1A" },
  { id: "router", nombre: "Router", color: "#19B374" },
  { id: "3d", nombre: "Impresión 3D", color: "#0EA5E9" },
  { id: "papel", nombre: "Papel", color: "#7C3AED" },
]

export type TarjetaDiseno = {
  nombre: string
  texto: string
  href: string
  icono: string
  color: string
  acceso: "gratis" | "creditos"
  para: Proceso[]
  // palabras extra para el buscador
  claves?: string
}

export type SeccionDiseno = {
  id: string
  titulo: string
  subtitulo: string
  ver?: { texto: string; href: string }
  tarjetas: TarjetaDiseno[]
}

const NARANJA = "#FF6A1A"
const NARANJA2 = "#FF8A4C"
const VERDE = "#19B374"
const MORADO = "#6D28D9"
const AZUL = "#0EA5E9"
const AZUL2 = "#0284C7"
const AMARILLO = "#FFC53D"
const MARINO = "#142033"
const ROSA = "#DB2777"
const GRIS = "#64748B"

export const SECCIONES: SeccionDiseno[] = [
  {
    id: "cajas",
    titulo: "Cajas de madera y acrílico",
    subtitulo: "Para láser y router · juntas de dedo, bisagras, cajones, tapas",
    ver: { texto: "Ver las 170+", href: "/disenar/cajas" },
    tarjetas: [
      { nombre: "Caja con juntas de dedo", texto: "Medidas, espesor y kerf. DXF, SVG, PDF.", href: "/disenar/caja-con-juntas", icono: "caja", color: NARANJA, acceso: "gratis", para: ["laser", "router"], claves: "finger joint" },
      { nombre: "Caja con tapa y bisagra", texto: "Bisagra viva de madera, cierre opcional.", href: "/disenar/cajas/HingeBox", icono: "empaque", color: NARANJA, acceso: "gratis", para: ["laser"] },
      { nombre: "Organizador con divisores", texto: "Cuadrícula o divisiones a tu medida.", href: "/disenar/cajas/DividerTray", icono: "anidado", color: NARANJA2, acceso: "gratis", para: ["laser", "router"], claves: "charola bandeja" },
      { nombre: "Caja redonda y curva", texto: "Pared flexible con cortes vivos.", href: "/disenar/cajas/RoundedBox", icono: "torno", color: NARANJA, acceso: "gratis", para: ["laser"], claves: "flex" },
      { nombre: "Cajonera y tapa corrediza", texto: "Cajones con jaladera y rieles.", href: "/disenar/cajas/SlidingDrawer", icono: "mueble", color: NARANJA2, acceso: "gratis", para: ["laser", "router"], claves: "cajón" },
    ],
  },
  {
    id: "papel",
    titulo: "Plantillas de papel y cartón",
    subtitulo: "Regalo, repostería, cosmética · líneas de corte y doblez separadas",
    ver: { texto: "Ver las 35", href: "/disenar/plantillas-empaque" },
    tarjetas: [
      { nombre: "Caja de regalo con tapa", texto: "Base y tapa, pestañas de pegado.", href: "/disenar/plantillas-empaque?modelo=tapa-fondo", icono: "empaque", color: VERDE, acceso: "gratis", para: ["papel", "laser"] },
      { nombre: "Caja almohada", texto: "Para detalles y recuerdos.", href: "/disenar/plantillas-empaque?modelo=pillow", icono: "empaque", color: VERDE, acceso: "gratis", para: ["papel", "laser"], claves: "pillow" },
      { nombre: "Caja para pizza o pastel", texto: "Tapa unida, con solapas que entran.", href: "/disenar/plantillas-empaque?modelo=pizza", icono: "empaque", color: VERDE, acceso: "gratis", para: ["papel"], claves: "repostería" },
      { nombre: "Bolsa con asas", texto: "Fuelle, refuerzo y ojales para listón.", href: "/disenar/plantillas-empaque?modelo=bolsa-asa", icono: "tienda", color: VERDE, acceso: "gratis", para: ["papel", "laser"] },
      { nombre: "Pirámides, conos y macetas", texto: "De 3 a 10 lados, con o sin base.", href: "/disenar/plantillas-empaque?modelo=piramide", icono: "cam", color: VERDE, acceso: "gratis", para: ["papel"], claves: "cubeta vaso" },
    ],
  },
  {
    id: "texto",
    titulo: "Con tu texto o tu imagen",
    subtitulo: "Letreros, vectorizado, grabado, relieves y escaneo",
    tarjetas: [
      { nombre: "Letreros y nombres", texto: "19 letras, unidas y listas para cortar.", href: "/disenar/letreros", icono: "letrero", color: MORADO, acceso: "gratis", para: ["laser", "router"], claves: "nombre texto tipografía" },
      { nombre: "Llaveros y placas con nombre", texto: "Láser o impresión 3D, con argolla.", href: "/disenar/llaveros", icono: "llavero", color: "#DB2777", acceso: "gratis", para: ["laser", "3d"], claves: "llavero placa mascota etiqueta corazón adorno" },
      { nombre: "Vectorizar un logo", texto: "De JPG o PNG a DXF/SVG limpio.", href: "/disenar/vectorizador", icono: "vector", color: AZUL, acceso: "gratis", para: ["laser", "router"], claves: "imagen foto" },
      { nombre: "Foto para grabado láser", texto: "Tramada al tamaño y DPI de tu láser.", href: "/disenar/grabado-foto", icono: "grabado", color: AZUL2, acceso: "gratis", para: ["laser"] },
      { nombre: "Foto a relieve o litofanía", texto: "STL para tallar o imprimir.", href: "/disenar/litofania-relieve", icono: "relieve", color: AZUL2, acceso: "gratis", para: ["3d", "router"], claves: "lámpara" },
      { nombre: "SVG o DXF a STL", texto: "Extruye logos y letras; llaveros con placa.", href: "/disenar/svg-a-stl", icono: "extruir", color: MORADO, acceso: "gratis", para: ["3d", "router"], claves: "llavero sello 3d" },
      { nombre: "Escanear una pieza", texto: "Fotos → modelo 3D con medidas.", href: "/disenar/escanear-pieza", icono: "escaneo", color: AMARILLO, acceso: "creditos", para: ["3d", "router"], claves: "escaneo refacción" },
    ],
  },
  {
    id: "taller",
    titulo: "Para el taller",
    subtitulo: "Muebles, anidado, rompecabezas, patrones y conversión de archivos",
    tarjetas: [
      { nombre: "Despiece de muebles", texto: "Lista de corte, hojas, canto y herraje.", href: "/disenar/despiece-muebles", icono: "mueble", color: "#C2560A", acceso: "gratis", para: ["router"], claves: "gabinete closet cocina melamina" },
      { nombre: "Anidado de piezas", texto: "Tus DXF acomodados en la hoja.", href: "/disenar/anidado-piezas", icono: "anidado", color: MARINO, acceso: "gratis", para: ["laser", "router"], claves: "nesting hoja" },
      { nombre: "Rompecabezas", texto: "Piezas a tu medida, con marco y base.", href: "/disenar/rompecabezas", icono: "rompecabezas", color: AMARILLO, acceso: "gratis", para: ["laser"], claves: "puzzle juego regalo foto" },
      { nombre: "Patrones y mandalas", texto: "Arte de pared en capas.", href: "/disenar/patrones-radiales", icono: "generador", color: ROSA, acceso: "gratis", para: ["laser", "router"] },
      { nombre: "Convertir y reescalar", texto: "DXF ↔ SVG, STL ↔ OBJ, otro espesor.", href: "/disenar/convertidor", icono: "convertir", color: GRIS, acceso: "gratis", para: ["laser", "router", "3d"], claves: "convertidor pulgadas" },
    ],
  },
]
