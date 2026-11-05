
// "Diseñar y escanear": los generadores y el escaneo 3D en un solo espacio de
// trabajo (/disenar). Entras una vez y cambias de herramienta desde el menú de
// la izquierda (o la fila de arriba en el celular) sin salir de la página.
//
// Antes cada generador era una página suelta bajo /servicios/generador-2d-3d/…
// y el escaneo vivía en /taller/escaneos/nuevo; las direcciones viejas
// redirigen aquí (next.config).
//
// Las usan: el espacio /disenar (menú, inicio y metadatos de cada herramienta),
// la página /herramientas-cnc, el menú del encabezado y el mapa del sitio.

export type HerramientaDiseno = {
  slug: string
  nombre: string
  texto: string
  icono: string
  acceso: "gratis" | "creditos"
  // Título y descripción para el buscador
  titulo: string
  descripcion: string
}

// Antes "escanear-pieza": la dirección vieja redirige aquí (next.config).
export const ESCANEAR = "imagen-a-3d"

export const HERRAMIENTAS_DISENO: HerramientaDiseno[] = [
  {
    slug: "caja-con-juntas",
    nombre: "Caja con juntas de dedo",
    texto: "Medidas y espesor, y descargas la caja en DXF, SVG o PDF.",
    icono: "caja",
    acceso: "gratis",
    titulo: "Generador de caja con juntas de dedo gratis (DXF y SVG)",
    descripcion:
      "Crea gratis una caja con juntas de dedo para corte láser o router CNC: escribe medidas y espesor de MDF o acrílico y descarga en DXF, SVG o PDF.",
  },
  {
    slug: "letras-3d",
    nombre: "Letras 3D en caja",
    texto: "Letras huecas para anuncios luminosos: MDF y acrílico, por capas, con hojas de corte listas.",
    icono: "letrero",
    acceso: "gratis",
    titulo: "Generador de letras 3D en caja para corte láser gratis (MDF y acrílico)",
    descripcion:
      "Escribe tu texto, elige la tipografía, el alto y el fondo, y descarga gratis las hojas de corte en DXF o SVG: frente de acrílico, paredes y fondo de MDF con barreno para el LED. Vista 3D del armado.",
  },
  {
    slug: "letreros",
    nombre: "Letreros y nombres",
    texto: "Escribe el texto, elige la letra y descarga el DXF con las letras unidas.",
    icono: "letrero",
    acceso: "gratis",
    titulo: "Generador de letreros y nombres en DXF gratis para router CNC y láser",
    descripcion:
      "Escribe un nombre o un letrero, elige entre 19 tipografías y descarga gratis el DXF con las letras unidas, con barra o en placa con barrenos. Revisa si tu fresa alcanza todos los detalles.",
  },
  {
    slug: "llaveros",
    nombre: "Llaveros y placas con nombre",
    texto: "Nombre, letra y forma; DXF para láser o STL con relieve para imprimir.",
    icono: "llavero",
    acceso: "gratis",
    titulo: "Llaveros y placas con nombre gratis: DXF para láser y STL para impresión 3D",
    descripcion:
      "Haz llaveros, etiquetas, placas de mascota, corazones y adornos con nombre: elige la letra y la forma, y descarga el DXF/SVG con capas de corte y grabado o el STL con las letras en relieve. Con el agujero de la argolla.",
  },
  {
    slug: "rompecabezas",
    nombre: "Rompecabezas",
    texto: "Mide la placa, elige cuántas piezas y descarga las líneas de corte.",
    icono: "rompecabezas",
    acceso: "gratis",
    titulo: "Generador de rompecabezas para corte láser gratis (DXF y SVG)",
    descripcion:
      "Crea gratis un rompecabezas a tu medida para corte láser en MDF, triplay o acrílico: elige columnas, filas y tamaño del nudo, con marco y base opcionales. Ninguna pieza se repite. Descarga en DXF o SVG.",
  },
  {
    slug: "vectorizador",
    nombre: "Vectorizador de imágenes",
    texto: "Un logotipo o dibujo convertido en contornos DXF o SVG.",
    icono: "vector",
    acceso: "gratis",
    titulo: "Vectorizar imagen gratis para CNC y láser: de JPG o PNG a DXF y SVG",
    descripcion:
      "Convierte gratis un logotipo, dibujo o foto en vector: contornos cerrados en DXF o SVG listos para corte láser, router CNC o plasma. Tu imagen no se sube a ningún servidor.",
  },
  {
    slug: "despiece-muebles",
    nombre: "Despiece de muebles",
    texto: "Gabinetes, closets y cocinas: piezas, acomodo en hojas, canto y herraje.",
    icono: "mueble",
    acceso: "gratis",
    titulo: "Despiece de muebles gratis: lista de corte y acomodo en hojas (DXF)",
    descripcion:
      "Calcula gratis el despiece de gabinetes, libreros, closets y cocinas en melamina o MDF: lista de corte, acomodo en hojas, metros de canto y herrajes. Descarga el DXF para tu router CNC.",
  },
  {
    slug: "plantillas-empaque",
    nombre: "Plantillas de empaque",
    texto: "35 modelos: cajas con tapa, pizza, pastel, bolsas con asas, sobres, tubos y más.",
    icono: "empaque",
    acceso: "gratis",
    titulo: "Generador de plantillas de cajas y empaques gratis (DXF, SVG, PDF)",
    descripcion:
      "35 plantillas gratis a tu medida: caja con tapa, para pizza, pastel, cupcakes, almohada, cajón, hexagonal, tubos, bolsas con asas, sobres, pirámides, conos y macetas. Descarga en DXF, SVG o PDF para imprimir, plotter o láser.",
  },
  {
    slug: "grabado-foto",
    nombre: "Foto para grabado láser",
    texto: "Tu foto tramada al tamaño y la resolución de tu láser.",
    icono: "grabado",
    acceso: "gratis",
    titulo: "Foto para grabado láser gratis: tramado Jarvis, semitono y DPI exacto",
    descripcion:
      "Prepara gratis tu foto para grabar con láser en madera, MDF, piel, pizarra o acrílico: brillo, contraste, tramado Jarvis, Stucki o Floyd, semitono y PNG con la resolución exacta para LightBurn.",
  },
  {
    slug: "litofania-relieve",
    nombre: "Litofanías y relieves 3D",
    texto: "Tu foto convertida en STL: litofanía o relieve para tallar.",
    icono: "relieve",
    acceso: "gratis",
    titulo: "Generador de litofanías y relieves 3D gratis: de foto a STL",
    descripcion:
      "Convierte gratis una foto en STL: litofanía plana, curva o en cilindro para lámpara lista para imprimir, o relieve 3D con mapa de alturas para tallar en router CNC con VCarve o Aspire.",
  },
  {
    slug: "patrones-radiales",
    nombre: "Patrones radiales",
    texto: "Mandalas y arte de pared en capas, listos para cortar.",
    icono: "generador",
    acceso: "gratis",
    titulo: "Generador de patrones radiales gratis: mandalas y arte de pared (DXF, SVG)",
    descripcion:
      "Crea gratis mandalas y patrones decorativos para corte láser: capas escaladas y rotadas con una fórmula matemática. Descarga en DXF o SVG.",
  },
  {
    slug: "convertidor",
    nombre: "Convertidor y reescalador",
    texto: "DXF a SVG y al revés, STL a OBJ, cambio de tamaño y de espesor.",
    icono: "convertir",
    acceso: "gratis",
    titulo: "Convertir DXF a SVG, SVG a DXF y STL a OBJ gratis en línea",
    descripcion:
      "Convierte gratis archivos DXF, SVG, STL y OBJ, cambia su tamaño o ajústalos a otro espesor de material para corte láser, router o plasma. Sin subir tu archivo.",
  },
  {
    slug: "svg-a-stl",
    nombre: "SVG o DXF a STL",
    texto: "Extruye un logotipo, nombre o silueta en 3D, con placa base para llaveros.",
    icono: "extruir",
    acceso: "gratis",
    titulo: "Convertir SVG o DXF a STL gratis: extruir logotipos y letras en 3D",
    descripcion:
      "Sube un SVG o DXF, dale altura y descarga el STL para imprimir en 3D o tallar en relieve. Placa base opcional para llaveros, placas y letreros; modo espejo para sellos. Sin subir tu archivo.",
  },
  {
    slug: "anidado-piezas",
    nombre: "Anidado de piezas",
    texto: "Acomoda muchas piezas en tus hojas de material para desperdiciar menos.",
    icono: "anidado",
    acceso: "gratis",
    titulo: "Anidado de piezas gratis: acomodar DXF en hojas para láser, router y plasma",
    descripcion:
      "Sube tus piezas en DXF o SVG, di cuántas de cada una y el tamaño de la hoja: te las acomodamos con giro de 90° y separación de kerf, y descargas el DXF con todas las hojas listo para cortar.",
  },
  {
    slug: "celosias",
    nombre: "Celosías y paneles decorativos",
    texto: "Paneles calados para divisores, puertas, plafones y fachadas: 10 patrones.",
    icono: "generador",
    acceso: "gratis",
    titulo: "Generador de celosías y paneles decorativos gratis para router CNC y láser (DXF)",
    descripcion:
      "Diseña gratis celosías y paneles calados para divisores, puertas de closet, plafones y fachadas: 10 patrones, medidas, marco y puente entre huecos. Descarga DXF, SVG o PDF para router, láser o plasma.",
  },
  {
    slug: "bisagra-viva",
    nombre: "Bisagra viva (madera flexible)",
    texto: "Cortes que dejan doblar el MDF: cajas redondeadas, lámparas y libretas.",
    icono: "generador",
    acceso: "gratis",
    titulo: "Generador de bisagra viva gratis: madera flexible para corte láser (DXF y SVG)",
    descripcion:
      "Haz que el MDF o el triplay doble: elige el radio y el ángulo y el generador calcula la zona de cortes. Para cajas con esquinas curvas, lámparas y portadas de libreta. Descarga DXF, SVG o PDF.",
  },
  {
    slug: "codigo-qr",
    nombre: "Código QR para grabar",
    texto: "QR vectorial con texto y placa para grabar en láser o router.",
    icono: "grabado",
    acceso: "gratis",
    titulo: "Generador de código QR en DXF y SVG gratis para grabar en láser o router CNC",
    descripcion:
      "Convierte una liga en un código QR vectorial listo para grabar: placa con esquinas redondas, texto abajo como \"Escanea el menú\" y barreno para colgar. Descarga DXF, SVG o PDF.",
  },
  {
    slug: "rebanado-capas",
    nombre: "Rebanado en capas (3D a 2D)",
    texto: "Tu modelo 3D en capas numeradas para cortar y pegar, acomodadas en hojas.",
    icono: "anidado",
    acceso: "gratis",
    titulo: "Rebanar STL en capas para corte láser gratis: de modelo 3D a DXF",
    descripcion:
      "Sube un STL u OBJ, elige la altura y el espesor del material, y descarga las capas en DXF con número grabado, barrenos de alineación y acomodadas en tus hojas. Para esculturas, maquetas y topografía.",
  },
  {
    slug: "engranes",
    nombre: "Engranes",
    texto: "Engranes rectos que sí engranan, con su par y la distancia entre centros.",
    icono: "generador",
    acceso: "gratis",
    titulo: "Generador de engranes gratis en DXF y SVG para corte láser y router CNC",
    descripcion:
      "Dibuja engranes rectos de evolvente que sí engranan: dientes, módulo, ángulo de presión, barreno con cuñero, rayos y el par con la distancia entre centros calculada. Descarga DXF, SVG o PDF.",
  },
  {
    slug: "relojes",
    nombre: "Relojes de pared",
    texto: "Carátulas con números romanos o arábigos y el hueco del mecanismo.",
    icono: "grabado",
    acceso: "gratis",
    titulo: "Generador de carátulas de reloj de pared gratis para láser y router CNC (DXF)",
    descripcion:
      "Diseña la carátula de tu reloj: redonda, cuadrada o hexagonal, números romanos o arábigos grabados o calados, marcas de minutos, nombre al centro y el barreno del mecanismo. Descarga DXF, SVG o PDF.",
  },
  {
    slug: "organizador-cajon",
    nombre: "Organizadores de cajón",
    texto: "Separadores a la medida del cajón que se encastran, para cubiertos, herramienta o fresas.",
    icono: "caja",
    acceso: "gratis",
    titulo: "Organizador de cajón a la medida para cortar en CNC o láser: DXF gratis",
    descripcion:
      "Pon las medidas de tu cajón y cuántos compartimentos quieres: el generador dibuja las tiras con ranuras de media madera, paredes y muescas para los dedos, acomodadas en tu hoja. Descarga DXF, SVG o PDF.",
  },
  {
    slug: "lamparas-capas",
    nombre: "Lámparas por capas",
    texto: "Costillas y anillos que se encastran, con el hueco del socket E27.",
    icono: "generador",
    acceso: "gratis",
    titulo: "Generador de lámparas de madera por capas para corte láser y CNC (DXF gratis)",
    descripcion:
      "Elige la forma (esfera, gota, jarrón o cilindro), el alto, las costillas y los anillos: te damos todas las piezas encastrables con el hueco del socket, acomodadas en tus hojas. Descarga DXF, SVG o PDF.",
  },
  {
    slug: "estencil-letras",
    nombre: "Esténcil de letras",
    texto: "Plantillas de texto con puentes para pintar cajas, bultos y señalética.",
    icono: "letrero",
    acceso: "gratis",
    titulo: "Generador de esténcil de letras gratis: plantillas en DXF para corte láser",
    descripcion:
      "Escribe el texto, elige la letra y descarga la plantilla con puentes en las islas (O, A, B, D) para pintar con aerosol cajas, costales y señalamientos. DXF, SVG o PDF.",
  },
  {
    slug: "marcos-portarretratos",
    nombre: "Marcos y portarretratos",
    texto: "Marco por capas con ranura para vidrio y foto, nombre grabado y pata.",
    icono: "generador",
    acceso: "gratis",
    titulo: "Generador de portarretratos y marcos para corte láser gratis (DXF y SVG)",
    descripcion:
      "Elige el tamaño de la foto, el estilo del borde y un nombre o fecha: te damos el frente, la capa con ranura para vidrio y foto, la espalda y la pata para mesa o el colgador. Descarga DXF, SVG o PDF.",
  },
  {
    slug: ESCANEAR,
    nombre: "Imagen a 3D con IA",
    texto: "Sube una foto y la IA crea el modelo 3D con textura en minutos. Descarga GLB o STL. 1 gratis al mes.",
    icono: "ia",
    acceso: "creditos",
    titulo: "Imagen a 3D con IA: convierte una foto en modelo 3D (STL y GLB) gratis",
    descripcion:
      "Convierte una imagen en un modelo 3D con inteligencia artificial: sube la foto de una figura, pieza o producto y en 3 a 5 minutos descargas el modelo con textura en GLB y en STL para impresión 3D o router CNC. El primero de cada mes es gratis.",
  },
]

export const buscarHerramientaDiseno = (slug: string) => HERRAMIENTAS_DISENO.find((h) => h.slug === slug)

// Los generadores (todo menos el escaneo), para las redirecciones y el mapa
export const SLUGS_GENERADORES = HERRAMIENTAS_DISENO.filter((h) => h.slug !== ESCANEAR).map((h) => h.slug)

// Enlace de un servicio de servicios-datos: el Generador 2D y 3D y sus
// generadores gratis abren el espacio /disenar (sin pasar por la redirección);
// lo demás sigue en /servicios/<slug>.
export const enlaceServicio = (slug: string) => {
  if (slug === "generador-2d-3d") return "/disenar"
  const h = slug.startsWith("generador-2d-3d/") ? slug.slice("generador-2d-3d/".length) : ""
  return h && SLUGS_GENERADORES.includes(h) ? `/disenar/${h}` : `/servicios/${slug}`
}

// ── Estudios de pantalla completa ─────────────────────────────────────────────────────────────────
// Las herramientas se abren dentro de dos estudios: el 3D (modelos para ver,
// imprimir o maquinar en volumen) y el 2D (vectores para corte láser, router
// y plasma). Cada estudio enseña sus herramientas como pestañas arriba.
export type Estudio = "3d" | "2d"

export const ESTUDIOS: Record<Estudio, { nombre: string; herramientas: { slug: string; corto: string }[] }> = {
  "3d": {
    nombre: "3D Studio",
    herramientas: [
      { slug: ESCANEAR, corto: "Imagen a 3D" },
      { slug: "letras-3d", corto: "Letras 3D" },
      { slug: "llaveros", corto: "Llaveros y placas" },
      { slug: "litofania-relieve", corto: "Litofanías y relieves" },
      { slug: "svg-a-stl", corto: "SVG a STL" },
    ],
  },
  "2d": {
    nombre: "2D Studio",
    herramientas: [
      { slug: "caja-con-juntas", corto: "Cajas" },
      { slug: "vectorizador", corto: "Vectorizador" },
      { slug: "letreros", corto: "Letreros" },
      { slug: "rompecabezas", corto: "Rompecabezas" },
      { slug: "despiece-muebles", corto: "Muebles" },
      { slug: "plantillas-empaque", corto: "Empaques" },
      { slug: "grabado-foto", corto: "Foto a grabado" },
      { slug: "patrones-radiales", corto: "Patrones" },
      { slug: "convertidor", corto: "Convertidor" },
      { slug: "anidado-piezas", corto: "Anidado" },
      { slug: "celosias", corto: "Celosías" },
      { slug: "bisagra-viva", corto: "Bisagra viva" },
      { slug: "codigo-qr", corto: "Código QR" },
      { slug: "rebanado-capas", corto: "Rebanado" },
      { slug: "engranes", corto: "Engranes" },
      { slug: "relojes", corto: "Relojes" },
      { slug: "organizador-cajon", corto: "Organizador" },
      { slug: "lamparas-capas", corto: "Lámparas" },
      { slug: "estencil-letras", corto: "Esténcil" },
      { slug: "marcos-portarretratos", corto: "Marcos" },
    ],
  },
}

export const estudioDe = (slug: string): Estudio =>
  ESTUDIOS["3d"].herramientas.some((h) => h.slug === slug) ? "3d" : "2d"
