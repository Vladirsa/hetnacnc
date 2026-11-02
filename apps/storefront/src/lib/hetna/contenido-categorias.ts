// Textos propios de cada categoría de la tienda, para Google y para el
// comprador: una introducción corta arriba de los productos y, abajo, una guía
// de compra, preguntas frecuentes (con su FAQPage para Google) y enlaces a los
// servicios relacionados.
//
// La llave es el handle de la categoría (la parte de la URL:
// /mx/categories/<handle>). Categoría sin entrada aquí = página como antes.
//
// REGLA: sólo cosas ciertas y útiles. Nada de cifras inventadas ni promesas
// que la tienda no cumple (tiempos, garantías, existencias).

export type ContenidoCategoria = {
  // <title> y meta description; si faltan se usan los de siempre
  titulo_seo?: string
  descripcion_seo?: string
  // 1 o 2 frases arriba de los productos
  intro: string
  // Guía de compra abajo de los productos
  secciones: { titulo: string; parrafos?: string[]; lista?: string[] }[]
  faqs: { pregunta: string; respuesta: string }[]
  // Enlaces internos a servicios, cotizador, foro o herramientas
  enlaces?: { texto: string; href: string }[]
}

export const CONTENIDO_CATEGORIAS: Record<string, ContenidoCategoria> = {
  "routers-cnc": {
    titulo_seo: "Routers CNC en México: precios, tipos y cómo elegir | HETNA CNC",
    descripcion_seo:
      "Routers CNC para madera, MDF, acrílico y aluminio. Guía para elegir área de trabajo, spindle y controlador, y talleres en México que te cortan tu pieza.",
    intro:
      "Routers CNC para cortar y grabar madera, MDF, acrílico, PVC y aluminio. Si todavía no vas a comprar máquina, también puedes mandar a cortar tu pieza con un taller de HETNA.",
    secciones: [
      {
        titulo: "Qué revisar antes de comprar un router CNC",
        lista: [
          "Área de trabajo: una hoja de MDF mide 122 × 244 cm. Si vas a trabajar hojas completas, busca una mesa de 1325 o 1530; para piezas chicas basta una de escritorio.",
          "Spindle: de 1.5 a 2.2 kW enfriado por agua es lo común para madera y acrílico; para aluminio importa más la rigidez de la máquina que la potencia.",
          "Estructura y transmisión: husillos de bolas o cremallera y guías lineales de perfil. Una máquina que vibra deja mal acabado y rompe fresas.",
          "Controlador: Mach3, DSP o controladores con pantalla propia. Confirma que tu programa CAM tenga postprocesador para él.",
          "Soporte y refacciones en México: pregunta quién te vende fresas, collets y drivers cuando algo falle.",
        ],
      },
      {
        titulo: "Router CNC, láser o plasma: cuál necesitas",
        parrafos: [
          "El router corta con una fresa que gira, así que sirve para materiales gruesos y para relieves en 3D. El láser es más preciso en detalles finos sobre materiales delgados (MDF de 3 a 6 mm, acrílico, papel, piel) pero no corta metal grueso. El plasma es para lámina de acero y aluminio.",
          "Si dudas, empieza por cotizar tu pieza con un taller: así ves cuánto cuesta producirla antes de invertir en una máquina.",
        ],
      },
    ],
    faqs: [
      {
        pregunta: "¿Qué materiales corta un router CNC?",
        respuesta:
          "Madera, MDF, triplay, acrílico, PVC espumado, policarbonato, nylon y aluminio. El acero se puede maquinar sólo con máquinas muy rígidas; para lámina de acero conviene plasma o láser de fibra.",
      },
      {
        pregunta: "¿Qué tamaño de router CNC me conviene?",
        respuesta:
          "Depende de las piezas: para letreros y piezas chicas, una de 60 × 90 cm; para muebles y hojas completas de MDF, una de 130 × 250 cm (1325) o más.",
      },
      {
        pregunta: "¿Qué programa necesito para usar un router CNC?",
        respuesta:
          "Uno para dibujar (CAD), uno para generar las trayectorias (CAM) y el del controlador. Programas como Fusion 360, Aspire o ArtCAM hacen CAD y CAM. En la Academia de HETNA hay cursos para empezar.",
      },
      {
        pregunta: "No tengo máquina, ¿me pueden cortar mi diseño?",
        respuesta:
          "Sí. Sube tu archivo (DXF, SVG, STL o una foto con medidas) en Cotizar y los talleres de HETNA te mandan propuestas con precio y tiempo de entrega.",
      },
    ],
    enlaces: [
      { texto: "Cotizar corte con router CNC", href: "/cotizar/router-cnc" },
      { texto: "Fresas y brocas para router", href: "/categories/fresas-y-brocas" },
      { texto: "Calculadora de velocidades y avances", href: "/calculadora-cnc" },
      { texto: "Cursos de CNC en la Academia", href: "/servicios/aprendizaje-cnc" },
    ],
  },

  "laser-cnc": {
    titulo_seo: "Máquinas láser CNC en México: CO2 y fibra, cómo elegir | HETNA CNC",
    descripcion_seo:
      "Cortadoras y grabadoras láser CO2 y de fibra. Qué potencia necesitas, qué materiales corta cada una y talleres en México que hacen tu corte láser.",
    intro:
      "Cortadoras y grabadoras láser para MDF, acrílico, piel, papel y metal. Aquí te explicamos la diferencia entre CO2, diodo y fibra, y si sólo necesitas unas piezas, un taller te las corta.",
    secciones: [
      {
        titulo: "CO2, diodo o fibra",
        lista: [
          "Láser CO2: el más versátil para no metales. Corta MDF, acrílico, triplay delgado, piel y papel, y graba vidrio y piedra.",
          "Láser de diodo: económico y compacto; bueno para grabar y cortar materiales delgados, pero lento y limitado en espesor.",
          "Láser de fibra: para metales. Graba acero, aluminio y latón, y en potencias altas corta lámina de acero.",
        ],
      },
      {
        titulo: "Qué potencia necesitas",
        parrafos: [
          "Para grabar y cortar MDF o acrílico de 3 mm basta un CO2 de 40 a 60 W. Para cortar 6 a 10 mm con buena velocidad, de 80 a 150 W. En metal, la potencia del láser de fibra define el espesor máximo de corte.",
          "Revisa también el área de trabajo, la extracción de humo (obligatoria: el acrílico y el MDF sueltan gases) y el enfriamiento del tubo.",
        ],
      },
    ],
    faqs: [
      {
        pregunta: "¿El láser corta metal?",
        respuesta:
          "El láser CO2 no corta metal en la práctica. Para metal se usa láser de fibra; para lámina gruesa, plasma.",
      },
      {
        pregunta: "¿Qué archivo necesito para corte láser?",
        respuesta:
          "Un vectorial: DXF, SVG, AI o PDF vectorial. Si tienes una imagen, el vectorizador de HETNA te ayuda a convertirla.",
      },
      {
        pregunta: "¿Se puede cortar PVC con láser?",
        respuesta:
          "No. El PVC suelta cloro al quemarse, que daña la máquina y es tóxico. Para PVC usa router CNC.",
      },
      {
        pregunta: "¿Cuánto cuesta el corte láser por pieza?",
        respuesta:
          "Depende del material, el espesor y los minutos de corte. Sube tu archivo en Cotizar y los talleres te dan precio exacto.",
      },
    ],
    enlaces: [
      { texto: "Cotizar corte láser", href: "/cotizar/corte-laser" },
      { texto: "Vectorizador: de imagen a archivo de corte", href: "/disenar/vectorizador" },
      { texto: "Diseños listos para láser", href: "/categories/archivos-para-cnc" },
      { texto: "Pregunta en el Foro CNC", href: "/foro-cnc" },
    ],
  },

  "plasma-cnc": {
    titulo_seo: "Mesas de plasma CNC en México: cómo elegir | HETNA CNC",
    descripcion_seo:
      "Mesas de corte por plasma CNC para lámina de acero, inoxidable y aluminio. Amperaje, espesores, consumibles y talleres en México que cortan tu pieza.",
    intro:
      "Mesas de plasma CNC para cortar lámina y placa de acero, inoxidable y aluminio. Si sólo necesitas unas piezas, un taller de HETNA te las corta.",
    secciones: [
      {
        titulo: "Qué revisar en una mesa de plasma",
        lista: [
          "Amperaje de la fuente: define el espesor que corta limpio. Una de 45 A corta bien hasta 1/4\" de acero; para 1/2\" o más se necesitan 65 a 105 A.",
          "Control de altura de antorcha (THC): mantiene la distancia a la lámina y mejora mucho el corte; es casi indispensable.",
          "Mesa de agua o de extracción: atrapa el humo y el polvo metálico.",
          "Consumibles: boquillas y electrodos se gastan; asegúrate de conseguirlos en México.",
        ],
      },
      {
        titulo: "Plasma o láser de fibra",
        parrafos: [
          "El plasma es más barato por hora y corta placa gruesa; el láser de fibra deja mejor acabado y más precisión en lámina delgada. Para estructuras, bases y piezas de herrería, el plasma suele ser la mejor relación costo-calidad.",
        ],
      },
    ],
    faqs: [
      {
        pregunta: "¿Qué espesor corta una mesa de plasma?",
        respuesta:
          "Depende del amperaje: con 45 A, hasta 1/4\" con buen acabado; con 85 a 105 A, de 1/2\" a 3/4\". Siempre revisa la tabla del fabricante de la fuente.",
      },
      {
        pregunta: "¿El plasma corta acero inoxidable y aluminio?",
        respuesta: "Sí, corta cualquier metal que conduzca electricidad: acero al carbón, inoxidable, aluminio, cobre y latón.",
      },
      {
        pregunta: "¿Qué archivo necesito para corte plasma?",
        respuesta: "Un DXF a escala real. Si tienes un dibujo o foto con medidas, un taller puede dibujarlo por ti.",
      },
      {
        pregunta: "¿Me pueden cortar piezas sin comprar la máquina?",
        respuesta: "Sí. Sube tu archivo en Cotizar y recibe propuestas de talleres de plasma de todo México.",
      },
    ],
    enlaces: [
      { texto: "Cotizar corte plasma", href: "/cotizar/corte-plasma" },
      { texto: "Consumibles para plasma", href: "/categories/consumibles-plasma" },
      { texto: "Laboratorio CAM: G-code para tu máquina", href: "/laboratorio-cam" },
    ],
  },

  "fresas-y-brocas": {
    titulo_seo: "Fresas para router CNC en México: tipos y cómo elegir | HETNA CNC",
    descripcion_seo:
      "Fresas y brocas para router CNC: rectas, de espiral ascendente y descendente, en V y bola. Cuál usar en madera, MDF, acrílico y aluminio.",
    intro:
      "Fresas y brocas para router CNC y fresadora. Elegir bien la fresa es la diferencia entre un corte limpio y una pieza quemada o astillada.",
    secciones: [
      {
        titulo: "Qué fresa usar según el trabajo",
        lista: [
          "Espiral ascendente (up-cut): saca bien la viruta; ideal para ranuras y cortes profundos, aunque puede astillar la cara de arriba.",
          "Espiral descendente (down-cut): deja la cara de arriba limpia; muy usada en melamina y MDF enchapado.",
          "Compresión: combina las dos; corta limpio arriba y abajo en tableros laminados.",
          "Un solo filo (O-flute): la mejor para acrílico y aluminio, porque saca la viruta sin derretir el material.",
          "En V: para grabado de letras, biselados y letreros.",
          "Punta bola: para relieves y acabados en 3D.",
        ],
      },
      {
        titulo: "Cuida tus fresas",
        parrafos: [
          "La mayoría de las fresas se rompen o se queman por velocidad y avance mal calculados, no por mala calidad. Usa la calculadora de HETNA para sacar las revoluciones y el avance según el diámetro, los filos y el material.",
          "Revisa que el zanco de la fresa sea del mismo diámetro que tu collet (1/8\", 1/4\", 6 mm, etc.).",
        ],
      },
    ],
    faqs: [
      {
        pregunta: "¿Qué fresa es mejor para MDF?",
        respuesta:
          "Una de 2 filos en espiral ascendente para cortes generales, o de compresión si el MDF trae laminado o melamina.",
      },
      {
        pregunta: "¿Qué fresa uso para acrílico?",
        respuesta: "Una de un solo filo (O-flute), con buena velocidad de avance para que la viruta salga y no se derrita.",
      },
      {
        pregunta: "¿Por qué se quema la madera al cortar?",
        respuesta:
          "Casi siempre es avance muy lento o revoluciones muy altas: la fresa roza en lugar de cortar. Sube el avance o baja las revoluciones con la calculadora.",
      },
      {
        pregunta: "¿Qué medida de zanco necesito?",
        respuesta: "La misma que tu collet. En routers chinos es común 1/8\", 1/4\" o 6 mm; revisa el collet antes de comprar.",
      },
    ],
    enlaces: [
      { texto: "Calculadora de velocidades y avances", href: "/calculadora-cnc" },
      { texto: "Routers CNC", href: "/categories/routers-cnc" },
      { texto: "Pregunta en el Foro CNC", href: "/foro-cnc" },
    ],
  },

  "archivos-para-cnc": {
    titulo_seo: "Archivos para CNC: DXF, SVG y STL listos para cortar | HETNA CNC",
    descripcion_seo:
      "Diseños listos para router CNC, láser y plasma en DXF, SVG y STL. Descarga al momento y corta en tu máquina o mándalo a cortar con un taller.",
    intro:
      "Diseños listos para cortar en router CNC, láser o plasma. Los descargas al momento después de pagar, y si no tienes máquina, un taller de HETNA te los corta.",
    secciones: [
      {
        titulo: "Qué formato necesitas",
        lista: [
          "DXF: el estándar para corte en 2D (láser, plasma, router). Lo abre casi cualquier programa CAD y CAM.",
          "SVG: vectorial, muy usado en láser y en programas como LightBurn e Inkscape.",
          "STL: modelo 3D para relieves en router o para impresión 3D.",
        ],
      },
      {
        titulo: "Antes de cortar",
        parrafos: [
          "Revisa que el espesor del material sea el que indica el diseño: en piezas que ensamblan (cajas, muebles, rompecabezas) las ranuras están hechas para un espesor específico.",
          "Compensa el ancho del corte (kerf) de tu máquina si las piezas deben embonar justas.",
        ],
      },
    ],
    faqs: [
      {
        pregunta: "¿Cómo recibo el archivo después de pagar?",
        respuesta: "Te llega por correo y queda en Mi cuenta → Mis descargas, para bajarlo cuando quieras.",
      },
      {
        pregunta: "¿Puedo vender las piezas que corte con estos diseños?",
        respuesta:
          "Depende del diseño. Si lo quieres para producir y vender piezas, escríbenos antes de comprar y te confirmamos el permiso de uso comercial.",
      },
      {
        pregunta: "¿Tienen devolución los archivos digitales?",
        respuesta:
          "No, porque se entregan al momento. Si el archivo no corresponde a lo anunciado, escríbenos y lo revisamos.",
      },
      {
        pregunta: "¿Pueden hacer un diseño a mi medida?",
        respuesta: "Sí. Pide un diseño personalizado en Cotizar, o arma cajas y piezas con las herramientas gratis de Diseñar.",
      },
    ],
    enlaces: [
      { texto: "Herramientas gratis para diseñar", href: "/disenar" },
      { texto: "Mandar a cortar tu diseño", href: "/cotizar" },
      { texto: "Corte láser: máquinas y guía", href: "/categories/laser-cnc" },
    ],
  },
}

export const contenidoCategoria = (handle: string): ContenidoCategoria | undefined =>
  CONTENIDO_CATEGORIAS[handle]
