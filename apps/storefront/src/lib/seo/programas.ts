// Páginas para buscadores de las herramientas de diseño y CAM (/mx/programas/...).
// Las herramientas son aplicaciones (no tienen texto que Google pueda leer):
// estas páginas explican qué hace cada una con las palabras que la gente busca,
// con pasos, lo que incluye, precio y preguntas frecuentes, y llevan a la
// herramienta. Todo lo que dicen existe hoy en el sitio.

export type Programa = {
  slug: string
  titulo: string // <title> y H1
  meta: string
  intro: string
  herramienta: { nombre: string; href: string; boton: string }
  pasos: { t: string; d: string }[]
  incluye: string[]
  precio: string
  preguntas: { p: string; r: string }[]
  palabras: string[]
}

const CREDITOS =
  "Diseñar, editar en 3D, ver medidas, costo y presupuesto es gratis. Pagas al bajar los archivos para fabricar: 1 crédito por cada 40 piezas (un mueble suelto, 1; una cocina completa, unos 5). Al abrir tu cuenta recibes 5 créditos de regalo y un diseño que ya pagaste no se vuelve a cobrar."

export const PROGRAMAS: Programa[] = [
  {
    slug: "diseno-de-cocinas-integrales",
    titulo: "Programa para diseñar cocinas integrales gratis en línea",
    meta: "Diseña tu cocina integral recta, en L o en U con isla, ventanas y electrodomésticos. Despiece, planos de taller y archivos para router CNC.",
    intro:
      "Arma la cocina en el cuarto: pared recta, en L o en U, con isla, ventanas, puertas, refrigerador, estufa o parrilla y lavavajillas. El programa pone esquineros, deja libre donde hay puertas, el fregadero bajo la ventana y saca el despiece de cada gabinete listo para cortar en melamina o MDF.",
    herramienta: { nombre: "Cocina integral", href: "/disenar/despiece-muebles", boton: "Diseñar mi cocina gratis" },
    pasos: [
      { t: "Mide el cuarto", d: "Escribe el largo de las paredes, dónde están la ventana y la puerta, y si quieres isla, refri y estufa." },
      { t: "Ajusta en 3D", d: "Ves la cocina en el cuarto y la editas pared por pared: medidas, frentes, tiradores, herrajes y material." },
      { t: "Baja todo para fabricar", d: "Lista de corte, acomodo en hojas, planos de taller, etiquetas con QR y DXF para tu router o para mandarlo a un taller." },
    ],
    incluye: [
      "Cocina recta, en L o en U, con isla y pasillo",
      "Esquineros ciegos, alacena y gabinetes altos que respetan las ventanas",
      "Parrilla con su recorte en la cubierta, refrigerador, estufa, lavavajillas y campana",
      "Minifix, confirmat, taquete o tu propio herraje con sus barrenos",
      "Frentes lisos, shaker, estriados o con vidrio; jaladera, Gola, uñero o push",
      "Costo del material, presupuesto en PDF para tu cliente y planos de taller",
    ],
    precio: CREDITOS,
    preguntas: [
      { p: "¿Es gratis diseñar la cocina?", r: "Sí. Diseñar, verla en 3D, sacar el costo y el presupuesto para tu cliente no cuesta. Sólo pagas créditos al bajar los archivos para fabricar." },
      { p: "¿Sirve para melamina?", r: "Sí: melamina blanca, gris, roble o nogal, MDF y triplay, con canto de PVC en las orillas del frente y la lista de corte con el canto marcado." },
      { p: "¿Qué necesito para cortarla?", r: "Un router CNC, o mandas los archivos a un taller de HETNA. También puedes usar la lista de corte en una seccionadora y barrenar a mano con los planos." },
      { p: "¿Puedo guardar el diseño y cambiarlo después?", r: "Sí. Con tu cuenta guardas hasta 50 diseños gratis y los vuelves a abrir para cambiar medidas o fabricarlos otra vez." },
    ],
    palabras: ["cocina integral", "diseño de cocinas", "cocina en L", "cocina en U", "despiece"],
  },
  {
    slug: "despiece-de-muebles-de-melamina",
    titulo: "Despiece de muebles de melamina con lista de corte y canto",
    meta: "Gabinetes, roperos, libreros, cómodas y burós a tu medida: despiece, lista de corte con canto, acomodo en hojas y DXF para CNC.",
    intro:
      "Elige un mueble del catálogo o de la biblioteca de cocina, cambia ancho, alto y fondo, y sale el despiece completo: cada pieza con su medida, canto, barrenos de herrajes y ranura de fondo, acomodadas en hojas de 2440 × 1220 para gastar menos material.",
    herramienta: { nombre: "Muebles de melamina", href: "/disenar/despiece-muebles", boton: "Hacer mi despiece gratis" },
    pasos: [
      { t: "Elige el mueble", d: "Gabinete bajo o alto, alacena, ropero, librero, cómoda, buró, zapatera o mueble de TV." },
      { t: "Ponle tus medidas", d: "Ancho, alto, fondo, grosor del tablero, repisas, cajones, puertas y herrajes." },
      { t: "Baja el despiece", d: "Lista de corte con canto, acomodo en hojas, planos con barrenos y etiquetas para cada pieza." },
    ],
    incluye: [
      "Lista de corte con medidas finales y canto por orilla",
      "Acomodo en hojas con veta y separación de la fresa",
      "Barrenos de minifix, confirmat, taquete, bisagras y correderas",
      "Repisas movibles con barrenos del sistema 32",
      "Planos de taller y etiquetas con QR por pieza",
      "Costo de material con tus precios por hoja y por metro de canto",
    ],
    precio: CREDITOS,
    preguntas: [
      { p: "¿La lista de corte trae el canto?", r: "Sí: cada pieza dice cuántas orillas largas y cortas llevan canto, y el plano lo marca." },
      { p: "¿Cuántas hojas voy a usar?", r: "El acomodo en hojas lo calcula por material y grosor, con la veta y la separación de tu fresa." },
      { p: "¿Puedo usar mis propios herrajes?", r: "Sí. En la biblioteca de herrajes ajustas diámetros, profundidades, separaciones y precio, o creas uno nuevo." },
    ],
    palabras: ["despiece de muebles", "lista de corte melamina", "planos de muebles"],
  },
  {
    slug: "mueble-desde-una-foto",
    titulo: "Convierte la foto de un mueble en piezas listas para CNC",
    meta: "Sube la foto, boceto o plano de un mueble y la IA lo convierte en piezas a tu medida, con uniones, vistas en 3D y archivos para router.",
    intro:
      "Sube la foto o el boceto de un mueble de tablero y la IA lo convierte en piezas a escala. Lo ves armado en 3D, cambias medidas, uniones (caja y espiga, dedos o herrajes) y bajas los archivos para cortarlo.",
    herramienta: { nombre: "Mueble desde imagen", href: "/disenar/muebles-ensamble", boton: "Subir mi foto" },
    pasos: [
      { t: "Sube la imagen", d: "Foto, boceto a mano o plano. Si la imagen no sirve, se regresan los créditos." },
      { t: "Ajusta en 3D", d: "Medidas totales, grosor, uniones, puertas, cajones, repisas y huecos, con vistas de frente, lado y arriba." },
      { t: "Baja las piezas", d: "DXF, planos de taller, etiquetas o mándalo directo al CAM de HETNA." },
    ],
    incluye: [
      "Caja y espiga, uniones de dedos para láser o herrajes",
      "Alivios de cabeza de fémur o en T para que embone",
      "Vistas estándar y rayos X para revisar barrenos",
      "Envío al CAM 2D para sacar el G-code de tu máquina",
    ],
    precio: "Leer la imagen con IA cuesta 2 créditos (se regresan si no sirve). Diseñar y editar es gratis; bajar los archivos, 1 crédito por cada 40 piezas.",
    preguntas: [
      { p: "¿Qué tipo de muebles reconoce?", r: "Muebles de tablero plano a escuadra: libreros, repisas, mesas, bancos, exhibidores y gabinetes. Las curvas se aproximan con rectángulos." },
      { p: "¿Necesito saber dibujar en CAD?", r: "No. La foto se convierte en piezas y todo lo demás se cambia con números y botones." },
    ],
    palabras: ["foto a mueble", "mueble con IA", "piezas para CNC"],
  },
  {
    slug: "molduras-y-tallados-cnc",
    titulo: "Molduras y paneles tallados para router CNC",
    meta: "Diseña molduras con perfil de fresa y paneles con marco y centro tallado. STL para desbaste y acabado, DXF para tallar en V y envío al Laboratorio CAM.",
    intro:
      "Elige el perfil de la moldura (media caña, bocel, gola, romana, clásica) o un panel con marco moldurado y centro tallado (rosetón, estrella, rombos o tu imagen). Lo ves en 3D y lo mandas al Laboratorio CAM para sacar el desbaste y el acabado.",
    herramienta: { nombre: "Molduras y tallados", href: "/disenar/molduras-tallados", boton: "Diseñar una moldura" },
    pasos: [
      { t: "Elige el perfil o el tallado", d: "Medidas de la moldura o del panel, ancho del marco y profundidad del tallado." },
      { t: "Revísalo en 3D", d: "El programa te dice la curva más cerrada para que elijas la fresa de bola correcta." },
      { t: "Mándalo a maquinar", d: "STL al Laboratorio CAM 3-5 ejes o DXF al CAM 2D." },
    ],
    incluye: ["Perfiles de moldura de fresa", "Paneles tallados para puertas", "Tallado a partir de tu imagen", "STL, DXF, SVG y PDF"],
    precio: "Ver y diseñar es gratis. Bajar los archivos o mandarlos al Laboratorio: moldura 1 crédito, panel tallado 2 créditos.",
    preguntas: [{ p: "¿Qué fresas necesito?", r: "Una recta para desbastar y una de bola para el acabado; el programa te dice el radio más cerrado del perfil." }],
    palabras: ["molduras cnc", "tallado cnc", "panel tallado"],
  },
  {
    slug: "generador-de-gcode-ncstudio-richauto-syntec",
    titulo: "Generador de G-code para NcStudio, Richauto DSP y Syntec",
    meta: "Sube tu DXF y saca el G-code para tu router CNC: NcStudio (Weihong), Richauto DSP, Syntec, Mach3, GRBL y LinuxCNC. Gratis y en el navegador.",
    intro:
      "El CAM Studio 2D convierte tu DXF en G-code para los controladores más comunes en los routers que se venden en México. Elige el material y la fresa, mira la trayectoria simulada y descarga el programa.",
    herramienta: { nombre: "CAM Studio 2D", href: "/cam/subir", boton: "Subir mi DXF" },
    pasos: [
      { t: "Sube tu DXF o SVG", d: "Elige material, espesor y tu máquina (o el controlador)." },
      { t: "Elige las operaciones", d: "Corte con pestañas, perfilado, cajeado, grabado en V, barrenado, roscado, incrustaciones o láser." },
      { t: "Simula y descarga", d: "Ves la trayectoria y el material quitado, el tiempo y el costo, e imprimes la hoja de trabajo para el operador." },
    ],
    incluye: [
      "NcStudio (Weihong), Richauto DSP (A11/A18), Syntec, Mach3, GRBL, LinuxCNC y láser GRBL",
      "Alivios de hueso o en T en esquinas interiores",
      "Cambiador automático de herramientas (M6)",
      "Copias y acomodo en la hoja, rampa de entrada y pestañas",
      "Plantillas por material y hoja de trabajo imprimible",
      "Cotizar el trabajo con tus tarifas",
    ],
    precio: "Calcular y simular es gratis y sin cuenta. La descarga del programa entra en el cupo de tu plan.",
    preguntas: [
      { p: "¿Funciona con el Richauto DSP?", r: "Sí. El archivo sale sin comentarios, como lo pide el DSP. Como el DSP no pausa a mitad del programa, se hace un programa por fresa." },
      { p: "¿Y con NcStudio?", r: "Sí, con el formato y fin de línea que lee NcStudio, y pausa para cambiar la fresa." },
      { p: "¿Tengo que instalar algo?", r: "No. Todo corre en el navegador, desde la computadora del taller o el celular." },
    ],
    palabras: ["gcode ncstudio", "richauto dsp", "syntec", "dxf a gcode"],
  },
  {
    slug: "planos-de-taller-y-presupuesto-de-muebles",
    titulo: "Planos de taller, etiquetas y presupuesto para muebles",
    meta: "Saca los planos de taller con vistas acotadas, la lista de corte, etiquetas con QR y el presupuesto en PDF para tu cliente.",
    intro:
      "Del mismo diseño salen los planos de taller (vistas de frente, lado y planta acotadas, lista de corte y un plano por pieza con sus barrenos), etiquetas con QR para cada pieza y el presupuesto para tu cliente con tu margen.",
    herramienta: { nombre: "Muebles y cocinas", href: "/disenar/despiece-muebles", boton: "Hacer mi presupuesto" },
    pasos: [
      { t: "Diseña el mueble o la cocina", d: "Con tus medidas, material y herrajes." },
      { t: "Pon tus precios", d: "Precio por hoja, por metro de canto, herrajes, mano de obra y utilidad." },
      { t: "Imprime o manda el PDF", d: "Presupuesto para tu cliente, planos para tu taller y etiquetas para las piezas." },
    ],
    incluye: ["Vistas acotadas y lista de corte", "Plano de cada pieza con barrenos", "Etiquetas A4 de 70 × 37 mm con QR", "Presupuesto con IVA, anticipo y entrega", "Envío al cotizador con tus tarifas"],
    precio: "El presupuesto es gratis. Los planos y las etiquetas se activan al bajar el diseño (1 crédito por cada 40 piezas).",
    preguntas: [{ p: "¿El presupuesto lleva mi marca?", r: "Lleva el nombre y el teléfono de tu taller, y se guardan para la próxima vez." }],
    palabras: ["planos de taller", "presupuesto de muebles", "etiquetas de piezas"],
  },
]

export const programaDe = (slug: string) => PROGRAMAS.find((p) => p.slug === slug) || null
