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
    ver: { texto: "Ver las 49", href: "/disenar/plantillas-empaque" },
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
      { nombre: "Esferas navideñas con nombre", texto: "Adornos de una pieza; varios nombres a la vez.", href: "/disenar/esferas-navidad", icono: "llavero", color: "#DC2626", acceso: "gratis", para: ["laser", "papel"], claves: "navidad esfera adorno nombre árbol regalo personalizado" },
      { nombre: "Llaveros y placas con nombre", texto: "Láser o impresión 3D, con argolla.", href: "/disenar/llaveros", icono: "llavero", color: "#DB2777", acceso: "gratis", para: ["laser", "3d"], claves: "llavero placa mascota etiqueta corazón adorno" },
      { nombre: "Placa redonda con texto en arco", texto: "Texto arriba y abajo y monograma al centro.", href: "/disenar/placa-redonda", icono: "letrero", color: MORADO, acceso: "gratis", para: ["laser", "router"], claves: "letrero redondo circular arco monograma iniciales negocio logo sello" },
      { nombre: "Incrustaciones (inlay)", texto: "Bolsillo y pieza que sí encajan.", href: "/disenar/incrustaciones", icono: "letrero", color: "#C2560A", acceso: "gratis", para: ["router", "laser"], claves: "inlay incrustacion madera contraste tabla letrero nogal maple resina" },
      { nombre: "Etiquetas en braille", texto: "Puntos a la medida estándar, acentos y ñ.", href: "/disenar/etiquetas-braille", icono: "llavero", color: "#DB2777", acceso: "gratis", para: ["3d"], claves: "braille ciegos inclusion accesibilidad señaletica baño puerta stl" },
      { nombre: "Etiquetas para cajas", texto: "Muchas de una vez; Gridfinity 36 × 11.", href: "/disenar/etiquetas-cajas", icono: "llavero", color: "#DB2777", acceso: "gratis", para: ["3d", "laser"], claves: "etiqueta label gridfinity cajon tornilleria organizador stl" },
      { nombre: "Organizador desde foto", texto: "La silueta de tus herramientas en espuma o MDF.", href: "/disenar/organizador-herramientas", icono: "vector", color: AZUL, acceso: "gratis", para: ["laser", "router", "3d"], claves: "shadow board foam espuma eva caja herramientas inserto kaizen silueta foto" },
      { nombre: "Vectorizar un logo", texto: "De JPG o PNG a DXF/SVG limpio.", href: "/disenar/vectorizador", icono: "vector", color: AZUL, acceso: "gratis", para: ["laser", "router"], claves: "imagen foto" },
      { nombre: "Foto para grabado láser", texto: "Tramada al tamaño y DPI de tu láser.", href: "/disenar/grabado-foto", icono: "grabado", color: AZUL2, acceso: "gratis", para: ["laser"] },
      { nombre: "Foto a relieve o litofanía", texto: "STL para tallar o imprimir.", href: "/disenar/litofania-relieve", icono: "relieve", color: AZUL2, acceso: "gratis", para: ["3d", "router"], claves: "lámpara" },
      { nombre: "Partir modelo 3D", texto: "No cabe en tu impresora: en piezas con pernos.", href: "/disenar/partir-3d", icono: "partir", color: AZUL, acceso: "gratis", para: ["3d"], claves: "dividir cortar stl grande piezas pernos imanes split cama impresora" },
      { nombre: "Generador de moldes 3D", texto: "Tu pieza en un molde de 2 partes o caja para silicona.", href: "/disenar/moldes-3d", icono: "partir", color: AZUL, acceso: "gratis", para: ["3d"], claves: "molde moldes silicona resina yeso concreto jabón jabon vela chocolate colado vaciado stl negativo" },
      { nombre: "SVG o DXF a STL", texto: "Extruye logos y letras; llaveros con placa.", href: "/disenar/svg-a-stl", icono: "extruir", color: MORADO, acceso: "gratis", para: ["3d", "router"], claves: "llavero sello 3d" },
      { nombre: "Imagen a 3D con IA", texto: "Una foto → modelo 3D con textura.", href: "/disenar/imagen-a-3d", icono: "ia", color: AMARILLO, acceso: "creditos", para: ["3d", "router"], claves: "escaneo refacción" },
    ],
  },
  {
    id: "modelos-3d",
    titulo: "Modelos 3D a tu medida",
    subtitulo: "Para impresión 3D · mueve las medidas y descarga el STL, sin saber CAD",
    ver: { texto: "Ver los 48", href: "/disenar/modelos-3d" },
    tarjetas: [
      { nombre: "Cajas Gridfinity", texto: "Cajitas y base del sistema modular de 42 mm.", href: "/disenar/modelos-3d?modelo=gridfinity-caja", icono: "anidado", color: AZUL, acceso: "gratis", para: ["3d"], claves: "gridfinity bin baseplate organizador modular cajon stl" },
      { nombre: "Florero para modo espiral", texto: "Con ondas y giro, en una sola pasada.", href: "/disenar/modelos-3d?modelo=florero-espiral", icono: "caja", color: AZUL2, acceso: "gratis", para: ["3d"], claves: "florero jarron vase mode espiral decoracion stl" },
      { nombre: "Pantalla de lámpara", texto: "Ondulada, con aro para socket E27.", href: "/disenar/modelos-3d?modelo=pantalla-lampara", icono: "caja", color: AZUL, acceso: "gratis", para: ["3d"], claves: "pantalla lampara lamp shade e27 foco stl" },
      { nombre: "Cadena portacables", texto: "Eslabones para los cables de tu CNC.", href: "/disenar/modelos-3d?modelo=cadena-portacables", icono: "cam", color: AZUL2, acceso: "gratis", para: ["3d"], claves: "cadena portacables drag chain eslabon cnc impresora stl" },
      { nombre: "Organizador de fresas y brocas", texto: "Agujeros a la medida de tus zancos.", href: "/disenar/modelos-3d?modelo=organizador-fresas", icono: "anidado", color: AZUL, acceso: "gratis", para: ["3d"], claves: "broca fresa end mill porta zanco router stl" },
      { nombre: "Soporte de motor NEMA 17 / 23", texto: "Escuadra con refuerzos y barrenos.", href: "/disenar/modelos-3d?modelo=soporte-nema", icono: "cam", color: AZUL2, acceso: "gratis", para: ["3d"], claves: "motor paso a paso stepper bracket stl" },
      { nombre: "Charola con divisiones", texto: "Compartimentos para tornillos y piezas.", href: "/disenar/modelos-3d?modelo=charola-divisiones", icono: "anidado", color: AZUL, acceso: "gratis", para: ["3d"], claves: "bandeja organizador tornillos tuercas stl" },
      { nombre: "Caja con tapa a presión", texto: "Caja y tapa listas para imprimir.", href: "/disenar/modelos-3d?modelo=caja-tapa", icono: "caja", color: AZUL2, acceso: "gratis", para: ["3d"], claves: "estuche contenedor electronica stl" },
      { nombre: "Abrazadera, escuadra y espaciadores", texto: "Herrajes de taller a tu medida.", href: "/disenar/modelos-3d?modelo=abrazadera-tubo", icono: "partir", color: AZUL, acceso: "gratis", para: ["3d"], claves: "clip tubo angulo separador buje brida stl" },
      { nombre: "Tapones para PTR y tubo", texto: "Regatones a presión a la medida de tu tubo.", href: "/disenar/modelos-3d?modelo=tapon-ptr", icono: "caja", color: AZUL2, acceso: "gratis", para: ["3d"], claves: "tapon regaton ptr tubo cuadrado redondo pata mesa herreria stl" },
      { nombre: "Soporte de spindle y chumaceras", texto: "Abrazadera de husillo y soporte de rodamiento.", href: "/disenar/modelos-3d?modelo=soporte-husillo", icono: "cam", color: AZUL, acceso: "gratis", para: ["3d"], claves: "spindle husillo 52 65 80 chumacera rodamiento balero 608 stl" },
      { nombre: "Sujetador de mesa CNC", texto: "Clamp con ranura para tuerca T.", href: "/disenar/modelos-3d?modelo=mordaza-cnc", icono: "cam", color: AZUL, acceso: "gratis", para: ["3d"], claves: "clamp sujetador mordaza router hold down stl" },
      { nombre: "Caja para Arduino, ESP32 o Raspberry", texto: "Postes para atornillar la tarjeta y ventilación.", href: "/disenar/modelos-3d?modelo=caja-electronica", icono: "caja", color: AZUL, acceso: "gratis", para: ["3d"], claves: "caja electronica arduino esp32 raspberry pcb gabinete stl" },
      { nombre: "Bisagra y bujes", texto: "Bisagra de dos hojas y bujes con brida.", href: "/disenar/modelos-3d?modelo=bisagra", icono: "partir", color: AZUL2, acceso: "gratis", para: ["3d"], claves: "bisagra buje casquillo brida stl" },
      { nombre: "Prueba de holguras", texto: "Calibra qué holgura usa tu impresora.", href: "/disenar/modelos-3d?modelo=prueba-holgura", icono: "anidado", color: AZUL2, acceso: "gratis", para: ["3d"], claves: "tolerancia calibracion impresora ajuste stl" },
      { nombre: "Perilla con tuerca embebida", texto: "Para tornillos M3 a M12: prensas y topes.", href: "/disenar/modelos-3d?modelo=perilla-tuerca", icono: "torno", color: AZUL2, acceso: "gratis", para: ["3d"], claves: "perilla knob tuerca m6 m8 prensa stl" },
      { nombre: "Macetas, lapiceros y soportes", texto: "Para casa y oficina.", href: "/disenar/modelos-3d?modelo=maceta", icono: "torno", color: AZUL2, acceso: "gratis", para: ["3d"], claves: "maceta lapicero celular gancho stl" },
    ],
  },
  {
    id: "taller",
    titulo: "Para el taller",
    subtitulo: "Muebles, anidado, rompecabezas, patrones y conversión de archivos",
    tarjetas: [
      { nombre: "Molduras y tallados", texto: "Perfiles y paneles tallados en 3D.", href: "/disenar/molduras-tallados", icono: "mueble", color: "#C2560A", acceso: "gratis", para: ["router"], claves: "moldura tallado relieve panel puerta rosetón perfil fresa bola stl" },
      { nombre: "Costillas desde imagen", texto: "Pared paramétrica o banca que sigue tu imagen.", href: "/disenar/costillas-desde-imagen", icono: "mueble", color: "#C2560A", acceso: "gratis", para: ["router", "laser"], claves: "costillas paramétrico parametrico pared muro cabecera banca banco mesa ola relieve rebanado slice waffle imagen" },
      { nombre: "Mueble desde una imagen", texto: "Foto o plano → piezas listas, vistas armadas.", href: "/disenar/muebles-desde-imagen", icono: "mueble", color: "#C2560A", acceso: "creditos", para: ["router", "laser"], claves: "foto plano imagen ia mueble mesa librero banco repisa ranura espiga" },
      { nombre: "Muebles de ensamble", texto: "Exhibidores y libreros sin tornillos, del catálogo.", href: "/disenar/muebles-desde-imagen", icono: "mueble", color: "#C2560A", acceso: "gratis", para: ["router", "laser"], claves: "exhibidor repisa estante librero ranura espiga sin tornillos stand" },
      { nombre: "Cocina y muebles de melamina", texto: "Gabinetes, libreros, roperos y cómodas a tu medida, con despiece y hojas.", href: "/disenar/despiece-muebles", icono: "mueble", color: "#C2560A", acceso: "gratis", para: ["router"], claves: "gabinete closet ropero librero comoda buro zapatera mueble tv cocina melamina planos despiece" },
      { nombre: "Anidado de piezas", texto: "Tus DXF acomodados en la hoja.", href: "/disenar/anidado-piezas", icono: "anidado", color: MARINO, acceso: "gratis", para: ["laser", "router"], claves: "nesting hoja" },
      { nombre: "Rompecabezas", texto: "Piezas a tu medida, con marco y base.", href: "/disenar/rompecabezas", icono: "rompecabezas", color: AMARILLO, acceso: "gratis", para: ["laser"], claves: "puzzle juego regalo foto" },
      { nombre: "Patrones y mandalas", texto: "Arte de pared en capas.", href: "/disenar/patrones-radiales", icono: "generador", color: ROSA, acceso: "gratis", para: ["laser", "router"] },
      { nombre: "Celosía desde imagen", texto: "Tu foto de celosía → panel para plasma o láser.", href: "/disenar/celosia-desde-imagen", icono: "generador", color: ROSA, acceso: "gratis", para: ["laser", "router"], claves: "celosia foto imagen plasma panel pinterest copiar dxf" },
      { nombre: "Patrón Voronoi", texto: "Celdas irregulares: celosías, lámparas y mosaicos.", href: "/disenar/patron-voronoi", icono: "generador", color: ROSA, acceso: "gratis", para: ["laser", "router"] },
      { nombre: "Desarrollo de lámina", texto: "Conos, cuadrado a redondo y boca de pescado.", href: "/disenar/desarrollo-lamina", icono: "convertir", color: MARINO, acceso: "gratis", para: ["laser", "router"], claves: "plasma paileria lamina cono reduccion transicion cuadrado redondo boca pescado tubo plantilla" },
      { nombre: "Pruebas de kerf y material", texto: "Calibra tu láser: kerf, ajuste y potencia.", href: "/disenar/pruebas-maquina", icono: "generador", color: MARINO, acceso: "gratis", para: ["laser"], claves: "kerf prueba calibrar ajuste ranura potencia velocidad lightburn matriz material" },
      { nombre: "Mapa topográfico por capas", texto: "Montañas reales de México en capas.", href: "/disenar/mapa-topografico", icono: "generador", color: VERDE, acceso: "gratis", para: ["laser", "router"], claves: "mapa topografico relieve montaña volcan capas regalo decoracion" },
      { nombre: "Reloj de palabras", texto: "La hora escrita con letras que se iluminan.", href: "/disenar/reloj-palabras", icono: "generador", color: AMARILLO, acceso: "gratis", para: ["laser"], claves: "reloj palabras word clock led arduino esp32 decoracion" },
      { nombre: "Convertir y reescalar", texto: "DXF ↔ SVG, STEP ↔ STL ↔ OBJ, otro espesor.", href: "/disenar/convertidor", icono: "convertir", color: GRIS, acceso: "gratis", para: ["laser", "router", "3d"], claves: "convertidor pulgadas step stp" },
    ],
  },
]
