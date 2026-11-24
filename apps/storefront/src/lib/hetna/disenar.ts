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
  // Descripción corta para Google y redes (≤155, frase completa). Si falta, se recorta "descripcion".
  meta?: string
  // Imagen para compartir en redes (si falta, la de HETNA)
  imagen?: string
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
    titulo: "Generador de cajas con juntas de dedo gratis",
    descripcion:
      "Crea gratis una caja con juntas de dedo para corte láser o router CNC: escribe medidas y espesor de MDF o acrílico y descarga en DXF, SVG o PDF.",
  },
  {
    slug: "letras-3d",
    nombre: "Letras 3D en caja",
    texto: "Letras huecas para anuncios luminosos: MDF y acrílico, por capas, con hojas de corte listas.",
    icono: "letrero",
    acceso: "gratis",
    titulo: "Letras 3D en caja para corte láser gratis",
    descripcion:
      "Escribe tu texto, elige la tipografía, el alto y el fondo, y descarga gratis las hojas de corte en DXF o SVG: frente de acrílico, paredes y fondo de MDF con barreno para el LED. Vista 3D del armado.",
    meta: "Haz letras 3D en caja con frente de acrílico y paredes de MDF: elige texto, letra y alto, y descarga gratis el DXF o SVG para corte láser.",
  },
  {
    slug: "letreros",
    nombre: "Letreros y nombres",
    texto: "Escribe el texto, elige la letra y descarga el DXF con las letras unidas.",
    icono: "letrero",
    acceso: "gratis",
    titulo: "Generador de letreros en DXF para CNC y láser",
    descripcion:
      "Escribe un nombre o un letrero, elige entre 19 tipografías y descarga gratis el DXF con las letras unidas, con barra o en placa con barrenos. Revisa si tu fresa alcanza todos los detalles.",
  },
  {
    slug: "llaveros",
    nombre: "Llaveros y placas con nombre",
    texto: "Nombre, letra y forma; DXF para láser o STL con relieve para imprimir.",
    icono: "llavero",
    acceso: "gratis",
    titulo: "Llaveros con nombre gratis: DXF y STL",
    descripcion:
      "Haz llaveros, etiquetas, placas de mascota, corazones y adornos con nombre: elige la letra y la forma, y descarga el DXF/SVG con capas de corte y grabado o el STL con las letras en relieve. Con el agujero de la argolla.",
    meta: "Llaveros, placas de mascota y adornos con nombre: elige letra y forma y descarga gratis el DXF para láser o el STL para impresión 3D.",
  },
  {
    slug: "texturizador",
    nombre: "Texturizador para impresión 3D",
    texto: "Placa con un patrón de palabras e íconos para texturizar barro, fondant o plastilina.",
    icono: "relieve",
    acceso: "gratis",
    titulo: "Texturizador 3D gratis: placa con patrón en STL",
    descripcion:
      "Haz una placa texturizadora con nombres, palabras e íconos repetidos (estrellas, corazones, huellitas, copos…), en relieve o hundida y en espejo para que se lea al presionar. Descarga gratis el STL para imprimir en 3D y úsala en barro, fondant, galletas o plastilina.",
    meta: "Texturizador gratis para impresión 3D: placa con palabras e íconos repetidos, en relieve o hundida y en espejo. Descarga el STL al instante.",
  },
  {
    slug: "rompecabezas",
    nombre: "Rompecabezas",
    texto: "Mide la placa, elige cuántas piezas y descarga las líneas de corte.",
    icono: "rompecabezas",
    acceso: "gratis",
    titulo: "Generador de rompecabezas para láser gratis",
    descripcion:
      "Crea gratis un rompecabezas a tu medida para corte láser en MDF, triplay o acrílico: elige columnas, filas y tamaño del nudo, con marco y base opcionales. Ninguna pieza se repite. Descarga en DXF o SVG.",
  },
  {
    slug: "vectorizador",
    nombre: "Vectorizador de imágenes",
    texto: "Un logotipo o dibujo convertido en contornos DXF o SVG.",
    icono: "vector",
    acceso: "gratis",
    titulo: "Vectorizar imagen a DXF y SVG gratis",
    descripcion:
      "Convierte gratis un logotipo, dibujo o foto en vector: contornos cerrados en DXF o SVG listos para corte láser, router CNC o plasma. Tu imagen no se sube a ningún servidor.",
  },
  {
    slug: "muebles-desde-imagen",
    nombre: "Mueble desde una imagen",
    texto: "Sube la foto o el plano de un mueble y sale listo para maquilar, visto armado en 3D.",
    icono: "mueble",
    acceso: "creditos",
    titulo: "Diseñar muebles desde una foto para CNC",
    descripcion:
      "Sube la foto, boceto o plano de un mueble de tablero: la IA lo convierte en piezas con espigas y mortajas a las medidas y el grosor que elijas, lo ves armado en 3D y descargas DXF, SVG o PDF listos para router CNC o láser.",
    meta: "Sube la foto o el plano de un mueble y la IA lo convierte en piezas con caja y espiga a tu medida, listas para cortar en router CNC.",
  },
  {
    slug: "costillas-desde-imagen",
    nombre: "Costillas desde imagen",
    texto: "Pared paramétrica o banca de tablas paralelas que siguen tu imagen, vista armada en 3D.",
    icono: "mueble",
    acceso: "gratis",
    titulo: "Pared paramétrica y banca de costillas desde una imagen para CNC",
    descripcion:
      "Sube una imagen (una ola, una montaña, un logotipo o una foto con profundidad por IA) y sale una pared paramétrica, cabecera o banca hecha de costillas: cada tabla sigue la imagen. Ranuras a media madera o varillas roscadas, alivio para fresa, piezas numeradas y acomodadas en hojas, vista 3D y DXF para router CNC o láser.",
    meta: "Sube una imagen y descarga gratis una pared paramétrica o banca de costillas en DXF, con ranuras, piezas numeradas y acomodo en hojas para router CNC.",
  },
  {
    slug: "molduras-tallados",
    nombre: "Molduras y tallados",
    texto: "Perfiles de moldura y paneles tallados en 3D, listos para el Laboratorio CAM.",
    icono: "mueble",
    acceso: "gratis",
    titulo: "Molduras y tallados 3D para router CNC gratis",
    descripcion:
      "Diseña molduras con perfil de fresa (media caña, bocel, gola, romana, clásica) y paneles con marco moldurado y centro tallado (rosetón, estrella, rombos o tu imagen). Vista 3D, STL para desbaste y acabado, DXF para tallar en V y envío directo al Laboratorio CAM.",
    meta: "Diseña molduras con perfil de fresa y paneles tallados (rosetón, estrella, rombos) y descarga gratis el STL para tu router CNC.",
  },
  {
    slug: "muebles-ensamble",
    nombre: "Muebles de ensamble sin tornillos",
    texto: "Exhibidores, libreros y muebles de caja y espiga del catálogo, a tu medida y vistos armados en 3D.",
    icono: "mueble",
    acceso: "gratis",
    titulo: "Muebles de ensamble sin tornillos para CNC",
    descripcion:
      "Elige un exhibidor, librero, mesa o banco de caja y espiga del catálogo, o sube la foto de tu mueble: cambia medidas, grosor, número de espigas y tipo de alivio (cabeza de fémur o en T), míralo armado en 3D y descarga las piezas listas para el router.",
    meta: "Exhibidores, libreros, mesas y bancos de caja y espiga, sin tornillos: cambia medidas y grosor y descarga las piezas para router CNC.",
  },
  {
    slug: "despiece-muebles",
    nombre: "Cocina y muebles de melamina a la medida",
    texto: "Gabinetes de cocina, libreros, roperos, cómodas y burós: elige el modelo, cambia sus medidas y sale el despiece.",
    icono: "mueble",
    acceso: "gratis",
    titulo: "Planos de muebles de melamina con despiece",
    descripcion:
      "Gabinetes de cocina, alacenas, libreros, roperos, cómodas, burós, zapateras y muebles de TV a tu medida: cambia ancho, alto y fondo o arma la cocina completa. Melamina o MDF, minifix o confirmat, bisagras, correderas, lista de corte con canto, acomodo en hojas y DXF. Y si quieres, lo manda a cortar un taller HETNA."
  },
  {
    slug: "plantillas-empaque",
    nombre: "Plantillas de empaque",
    texto: "35 modelos: cajas con tapa, pizza, pastel, bolsas con asas, sobres, tubos y más.",
    icono: "empaque",
    acceso: "gratis",
    titulo: "Plantillas de cajas y empaques gratis (DXF)",
    descripcion:
      "49 plantillas gratis a tu medida: caja de envío autoarmable, cajas redonda, de corazón, de estrella, ataúd y de N lados con tapa, caja con tapa, para pizza, pastel, cupcakes, almohada, cajón, caja de leche, exhibidor de mostrador, hexagonal, tubos, bolsas con asas, sobres, pirámides, conos y macetas. Descarga en DXF, SVG o PDF para imprimir, plotter o láser.",
    meta: "49 plantillas de cajas y empaques a tu medida: envío, pizza, regalo, redonda y más. Descarga gratis el DXF, SVG o PDF para cortar.",
  },
  {
    slug: "grabado-foto",
    nombre: "Foto para grabado láser",
    texto: "Tu foto tramada al tamaño y la resolución de tu láser.",
    icono: "grabado",
    acceso: "gratis",
    titulo: "Foto para grabado láser gratis (Jarvis y DPI)",
    descripcion:
      "Prepara gratis tu foto para grabar con láser en madera, MDF, piel, pizarra o acrílico: brillo, contraste, tramado Jarvis, Stucki o Floyd, semitono y PNG con la resolución exacta para LightBurn.",
    meta: "Prepara gratis tu foto para grabado láser en madera, piel o acrílico: tramado Jarvis, Stucki o semitono y PNG al DPI exacto de tu láser.",
  },
  {
    slug: "litofania-relieve",
    nombre: "Litofanías y relieves 3D",
    texto: "Tu foto convertida en STL: litofanía o relieve para tallar.",
    icono: "relieve",
    acceso: "gratis",
    titulo: "Litofanías y relieves 3D de foto a STL gratis",
    descripcion:
      "Convierte gratis una foto en STL: litofanía plana, curva o en cilindro para lámpara lista para imprimir, o relieve 3D con mapa de alturas para tallar en router CNC con VCarve o Aspire.",
    meta: "Convierte una foto en STL gratis: litofanía plana, curva o para lámpara, o relieve 3D con profundidad por IA para tallar o imprimir.",
    imagen: "/img/relieve-ia/laser-relieve-ia.webp",
  },
  {
    slug: "patrones-radiales",
    nombre: "Patrones radiales",
    texto: "Mandalas y arte de pared en capas, listos para cortar.",
    icono: "generador",
    acceso: "gratis",
    titulo: "Mandalas y patrones radiales para láser gratis",
    descripcion:
      "Crea gratis mandalas y patrones decorativos para corte láser: capas escaladas y rotadas con una fórmula matemática. Descarga en DXF o SVG.",
  },
  {
    slug: "convertidor",
    nombre: "Convertidor y reescalador",
    texto: "DXF a SVG y al revés, STEP a STL y STL a STEP, STL a OBJ, cambio de tamaño y de espesor.",
    icono: "convertir",
    acceso: "gratis",
    titulo: "Convertir STEP a STL y DXF a SVG gratis",
    descripcion:
      "Convierte gratis archivos STEP, DXF, SVG, STL y OBJ, cambia su tamaño o ajústalos a otro espesor de material para corte láser, router o plasma. Sin subir tu archivo.",
  },
  {
    slug: "partir-3d",
    nombre: "Partir modelo 3D",
    texto: "Imprime en grande: divide tu modelo en piezas que caben en la cama, con pernos o imanes.",
    icono: "partir",
    acceso: "gratis",
    titulo: "Partir modelo 3D en piezas con pernos gratis",
    descripcion:
      "Divide gratis tu STL, OBJ o STEP en piezas que caben en tu impresora (Ender 3, Bambu, Prusa…): tú eliges dónde cortar y cuántos pernos o imanes por unión. Cascos, macetas, letreros y piezas largas. Descarga el ZIP, cotiza o pide que un taller lo imprima. Sin marca de agua.",
    imagen: "/img/partir-3d/esfera-piezas.webp",
  },
  {
    slug: "svg-a-stl",
    nombre: "SVG o DXF a STL",
    texto: "Archivos de corte láser a 3D: corte, grabado y líneas marcadas por color; placa base para llaveros.",
    icono: "extruir",
    acceso: "gratis",
    titulo: "Convertir SVG o DXF a STL gratis",
    descripcion:
      "Sube un SVG o DXF de corte láser, elige qué hace cada color (corte, grabado hundido o línea marcada), dale altura y descarga el STL para imprimir en 3D o tallar en relieve. Placa base opcional para llaveros, placas y letreros; modo espejo para sellos. Sin subir tu archivo.",
    meta: "Convierte gratis tu SVG o DXF en STL: elige qué color se corta, se graba o se marca, dale altura e imprime en 3D o talla en relieve.",
  },
  {
    slug: "anidado-piezas",
    nombre: "Anidado de piezas",
    texto: "Acomoda muchas piezas en tus hojas de material para desperdiciar menos.",
    icono: "anidado",
    acceso: "gratis",
    titulo: "Anidado de piezas DXF en hojas gratis",
    descripcion:
      "Sube tus piezas en DXF o SVG, di cuántas de cada una y el tamaño de la hoja: te las acomodamos con giro de 90° y separación de kerf, y descargas el DXF con todas las hojas listo para cortar.",
    meta: "Acomoda tus piezas DXF o SVG en hojas de material para desperdiciar menos: con giro y separación de kerf. Descarga el DXF gratis.",
  },
  {
    slug: "celosias",
    nombre: "Celosías y paneles decorativos",
    texto: "Paneles calados para divisores, puertas, plafones y fachadas: 10 patrones.",
    icono: "generador",
    acceso: "gratis",
    titulo: "Celosías y paneles decorativos CNC gratis",
    descripcion:
      "Diseña gratis celosías y paneles calados para divisores, puertas de closet, plafones y fachadas: 10 patrones, medidas, marco y puente entre huecos. Descarga DXF, SVG o PDF para router, láser o plasma.",
  },
  {
    slug: "celosia-desde-imagen",
    nombre: "Celosía desde imagen",
    texto: "Sube la foto de la celosía que te gustó y sale el panel listo para plasma, láser o router.",
    icono: "generador",
    acceso: "gratis",
    titulo: "Celosía desde imagen: de foto a DXF para plasma y láser",
    descripcion:
      "Sube la foto o captura de una celosía, enderézala con 4 puntos y elige plasma, láser o router y el espesor: la app quita huecos que no se cortan, engruesa puentes delgados y une las piezas sueltas. Descarga gratis el panel con marco en DXF, SVG o PDF.",
    meta: "Convierte la foto de una celosía en un panel listo para plasma, láser o router: revisa puentes, huecos e islas y descarga gratis el DXF.",
  },
  {
    slug: "patron-voronoi",
    nombre: "Patrón Voronoi",
    texto: "Celdas irregulares para celosías, lámparas, mesas y mosaicos: cada clic, un diseño nuevo.",
    icono: "generador",
    acceso: "gratis",
    titulo: "Generador de patrón Voronoi para láser y CNC",
    descripcion:
      "Crea gratis paneles y mosaicos con patrón Voronoi: rectángulo o círculo, cuántas celdas, puente, redondeo y dónde van más celdas. Cada clic da un diseño nuevo. Descarga DXF, SVG o PDF para láser, router o plasma.",
    meta: "Genera gratis patrones Voronoi para celosías, lámparas y mosaicos: elige forma, celdas y puente y descarga el DXF o SVG para cortar.",
  },
  {
    slug: "bisagra-viva",
    nombre: "Bisagra viva (madera flexible)",
    texto: "Cortes que dejan doblar el MDF: cajas redondeadas, lámparas y libretas.",
    icono: "generador",
    acceso: "gratis",
    titulo: "Bisagra viva para corte láser gratis (DXF)",
    descripcion:
      "Haz que el MDF o el triplay doble: elige el radio y el ángulo y el generador calcula la zona de cortes. Para cajas con esquinas curvas, lámparas y portadas de libreta. Descarga DXF, SVG o PDF.",
  },
  {
    slug: "codigo-qr",
    nombre: "Código QR para grabar",
    texto: "QR vectorial con texto y placa para grabar en láser o router.",
    icono: "grabado",
    acceso: "gratis",
    titulo: "Código QR en DXF y SVG para láser gratis",
    descripcion:
      "Convierte una liga en un código QR vectorial listo para grabar: placa con esquinas redondas, texto abajo como \"Escanea el menú\" y barreno para colgar. Descarga DXF, SVG o PDF.",
  },
  {
    slug: "rebanado-capas",
    nombre: "Rebanado en capas (3D a 2D)",
    texto: "Tu modelo 3D en capas numeradas para cortar y pegar, acomodadas en hojas.",
    icono: "anidado",
    acceso: "gratis",
    titulo: "Rebanar STL en capas para láser gratis",
    descripcion:
      "Sube un STL u OBJ, elige la altura y el espesor del material, y descarga las capas en DXF con número grabado, barrenos de alineación y acomodadas en tus hojas. Para esculturas, maquetas y topografía.",
  },
  {
    slug: "engranes",
    nombre: "Engranes",
    texto: "Engranes rectos que sí engranan, con su par y la distancia entre centros.",
    icono: "generador",
    acceso: "gratis",
    titulo: "Generador de engranes en DXF gratis",
    descripcion:
      "Dibuja engranes rectos de evolvente que sí engranan: dientes, módulo, ángulo de presión, barreno con cuñero, rayos y el par con la distancia entre centros calculada. Descarga DXF, SVG o PDF.",
    meta: "Engranes rectos de evolvente que sí engranan: dientes, módulo, barreno con cuñero y rayos. Descarga gratis el DXF o SVG para cortar.",
  },
  {
    slug: "relojes",
    nombre: "Relojes de pared",
    texto: "Carátulas con números romanos o arábigos y el hueco del mecanismo.",
    icono: "grabado",
    acceso: "gratis",
    titulo: "Carátulas de reloj para láser y CNC gratis",
    descripcion:
      "Diseña la carátula de tu reloj: redonda, cuadrada o hexagonal, números romanos o arábigos grabados o calados, marcas de minutos, nombre al centro y el barreno del mecanismo. Descarga DXF, SVG o PDF.",
    meta: "Diseña la carátula de tu reloj de pared: forma, números romanos o arábigos, marcas y nombre. Descarga gratis el DXF para láser o CNC.",
  },
  {
    slug: "organizador-cajon",
    nombre: "Organizadores de cajón",
    texto: "Separadores a la medida del cajón que se encastran, para cubiertos, herramienta o fresas.",
    icono: "caja",
    acceso: "gratis",
    titulo: "Organizador de cajón a la medida (DXF gratis)",
    descripcion:
      "Pon las medidas de tu cajón y cuántos compartimentos quieres: el generador dibuja las tiras con ranuras de media madera, paredes y muescas para los dedos, acomodadas en tu hoja. Descarga DXF, SVG o PDF.",
    meta: "Pon las medidas de tu cajón y los compartimentos: te damos las tiras con ranuras de media madera listas para cortar. DXF gratis.",
  },
  {
    slug: "lamparas-capas",
    nombre: "Lámparas por capas",
    texto: "Costillas y anillos que se encastran, con el hueco del socket E27.",
    icono: "generador",
    acceso: "gratis",
    titulo: "Lámparas de madera por capas para láser gratis",
    descripcion:
      "Elige la forma (esfera, gota, jarrón o cilindro), el alto, las costillas y los anillos: te damos todas las piezas encastrables con el hueco del socket, acomodadas en tus hojas. Descarga DXF, SVG o PDF.",
    meta: "Lámparas de madera por capas (esfera, gota, jarrón o cilindro) con piezas encastrables y hueco para el socket. DXF gratis.",
  },
  {
    slug: "estencil-letras",
    nombre: "Esténcil de letras",
    texto: "Plantillas de texto con puentes para pintar cajas, bultos y señalética.",
    icono: "letrero",
    acceso: "gratis",
    titulo: "Esténcil de letras en DXF gratis",
    descripcion:
      "Escribe el texto, elige la letra y descarga la plantilla con puentes en las islas (O, A, B, D) para pintar con aerosol cajas, costales y señalamientos. DXF, SVG o PDF.",
  },
  {
    slug: "marcos-portarretratos",
    nombre: "Marcos y portarretratos",
    texto: "Marco por capas con ranura para vidrio y foto, nombre grabado y pata.",
    icono: "generador",
    acceso: "gratis",
    titulo: "Portarretratos y marcos para láser gratis",
    descripcion:
      "Elige el tamaño de la foto, el estilo del borde y un nombre o fecha: te damos el frente, la capa con ranura para vidrio y foto, la espalda y la pata para mesa o el colgador. Descarga DXF, SVG o PDF.",
    meta: "Marcos y portarretratos para corte láser: tamaño de foto, borde y nombre o fecha, con ranura para vidrio y pata. DXF y SVG gratis.",
  },
  {
    slug: "esferas-navidad",
    nombre: "Esferas navideñas con nombre",
    texto: "Adornos de Navidad personalizados: escribe los nombres y descarga una esfera por cada uno.",
    icono: "generador",
    acceso: "gratis",
    titulo: "Esferas navideñas con nombre para láser gratis",
    descripcion:
      "Generador de esferas de Navidad personalizadas: elige el diseño (copos, estrellas, pinos, regalos…), escribe uno o varios nombres y descarga las esferas de una sola pieza, con las letras unidas, en DXF, SVG o PDF para corte láser, plotter o cartulina.",
    meta: "Esferas navideñas personalizadas con nombre: elige el diseño, escribe uno o varios nombres y descarga gratis el DXF o SVG para láser.",
  },
  {
    slug: ESCANEAR,
    nombre: "Imagen a 3D con IA",
    texto: "Sube una foto y la IA crea el modelo 3D con textura en minutos. Descarga GLB o STL. 1 gratis al mes.",
    icono: "ia",
    acceso: "creditos",
    titulo: "Imagen a 3D con IA: de foto a modelo STL y GLB",
    descripcion:
      "Convierte una imagen en un modelo 3D con inteligencia artificial: sube la foto de una figura, pieza o producto y en 3 a 5 minutos descargas el modelo con textura en GLB y en STL para impresión 3D o router CNC. El primero de cada mes es gratis.",
    meta: "Convierte una foto en modelo 3D con IA: en 3 a 5 minutos descargas el GLB con color y el STL para imprimir o maquinar. El primero es gratis.",
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

// ── Estudios de pantalla completa ──────────────────────────────────────────
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
      { slug: "texturizador", corto: "Texturizador" },
      { slug: "partir-3d", corto: "Partir modelo" },
    ],
  },
  "2d": {
    nombre: "2D Studio",
    herramientas: [
      { slug: "caja-con-juntas", corto: "Cajas" },
      { slug: "vectorizador", corto: "Imagen" }, // vectorizador + foto a grabado + litofanía
      { slug: "letreros", corto: "Letreros y placas" }, // letreros + esténcil + código QR
      { slug: "rompecabezas", corto: "Juegos y mecanismos" }, // rompecabezas + engranes
      { slug: "despiece-muebles", corto: "Muebles" },
      { slug: "plantillas-empaque", corto: "Empaques" },
      { slug: "convertidor", corto: "Archivos" }, // convertidor + anidado + rebanado + SVG a STL
      { slug: "celosias", corto: "Patrones" }, // celosías + patrones radiales + bisagra viva
      { slug: "relojes", corto: "Decoración" }, // relojes + marcos + lámparas
    ],
  },
}

export const estudioDe = (slug: string): Estudio =>
  ESTUDIOS["3d"].herramientas.some((h) => h.slug === slug) ? "3d" : "2d"
