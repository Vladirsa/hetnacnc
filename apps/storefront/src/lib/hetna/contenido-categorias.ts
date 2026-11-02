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
  "impresoras-3d": {
    titulo_seo: "Impresoras 3D en México: FDM y resina, cómo elegir | HETNA CNC",
    descripcion_seo:
      "Impresoras 3D de filamento (FDM) y de resina. Qué tecnología elegir, volumen de impresión, materiales y talleres en México que imprimen tu pieza.",
    intro:
      "Impresoras 3D de filamento y de resina para prototipos, refacciones y piezas finales. Si sólo necesitas unas piezas, un taller de HETNA te las imprime.",
    secciones: [
      {
        titulo: "Filamento (FDM) o resina",
        lista: [
          "FDM (filamento): la más común. Piezas resistentes y baratas en PLA, PETG, ABS, TPU o nylon. Se notan las capas.",
          "Resina (SLA/MSLA): detalle muy fino y superficie lisa; ideal para joyería, figuras, odontología y moldes. Las piezas son más frágiles y hay que lavarlas y curarlas.",
        ],
      },
      {
        titulo: "Qué revisar antes de comprar",
        lista: [
          "Volumen de impresión: el tamaño máximo de pieza. Para refacciones, 22 × 22 × 25 cm alcanza en la mayoría de los casos.",
          "Nivelación automática de cama y sensor de filamento: ahorran muchas impresiones fallidas.",
          "Extrusor directo si vas a imprimir materiales flexibles como TPU.",
          "Cámara cerrada si vas a imprimir ABS o nylon, que se deforman con las corrientes de aire.",
        ],
      },
    ],
    faqs: [
      {
        pregunta: "¿Qué filamento uso para piezas que aguanten?",
        respuesta: "PETG para uso general y resistencia al agua; ABS o ASA si van al sol o al calor; nylon o filamentos con fibra de carbono para piezas mecánicas.",
      },
      {
        pregunta: "¿Qué archivo necesito para imprimir en 3D?",
        respuesta: "Un STL, 3MF u OBJ. El programa laminador (Cura, PrusaSlicer, OrcaSlicer) lo convierte en G-code para tu impresora.",
      },
      {
        pregunta: "¿La impresión 3D sirve para piezas finales o sólo prototipos?",
        respuesta: "Para las dos: con el material y el relleno correctos se hacen refacciones, soportes y herramentales que se usan todos los días.",
      },
      {
        pregunta: "¿Me pueden imprimir una pieza sin comprar impresora?",
        respuesta: "Sí. Sube tu archivo o una foto con medidas en Cotizar y los talleres te mandan precio y tiempo de entrega.",
      },
    ],
    enlaces: [
      { texto: "Cotizar impresión 3D", href: "/cotizar/impresion-3d" },
      { texto: "Filamentos y resinas", href: "/categories/filamentos-y-resinas" },
      { texto: "Convertir SVG a STL", href: "/disenar/svg-a-stl" },
    ],
  },

  "madera-y-mdf": {
    titulo_seo: "MDF y madera para CNC y láser en México | HETNA CNC",
    descripcion_seo:
      "MDF, triplay y madera para router CNC y corte láser. Espesores, cuál conviene para cada trabajo y cómo cortarlos sin quemar ni astillar.",
    intro:
      "MDF, triplay y madera para cortar en router CNC y láser. Aquí te decimos qué material conviene para cada trabajo y cómo cortarlo limpio.",
    secciones: [
      {
        titulo: "MDF, triplay o madera sólida",
        lista: [
          "MDF: parejo, sin veta y fácil de cortar; ideal para letreros, maquetas, cajas y piezas que se van a pintar. No aguanta la humedad.",
          "Triplay (contrachapado): más resistente y ligero que el MDF; bueno para muebles y piezas estructurales. Puede tener huecos entre capas.",
          "Madera sólida: para piezas de vista y relieves; cada pieza es distinta por la veta y puede moverse con la humedad.",
          "MDF con melamina: acabado listo para muebles; córtalo con fresa de compresión o espiral descendente para que no se astille.",
        ],
      },
      {
        titulo: "Espesores más usados",
        parrafos: [
          "En láser se trabaja sobre todo MDF de 3 y 6 mm. En router, de 9 a 18 mm para muebles y de 3 a 6 mm para letreros y piezas decorativas. Mide el espesor real de tu hoja: puede variar unas décimas y afecta las piezas que ensamblan.",
        ],
      },
    ],
    faqs: [
      {
        pregunta: "¿Por qué se quema el MDF al cortarlo con router?",
        respuesta: "Por avance muy lento o revoluciones muy altas: la fresa roza en vez de cortar. Ajusta con la calculadora de velocidades y avances.",
      },
      {
        pregunta: "¿El MDF es tóxico al cortarlo con láser?",
        respuesta: "Suelta humo con formaldehído de la resina, por eso la extracción de humo es obligatoria. No lo cortes sin ventilación.",
      },
      {
        pregunta: "¿Qué espesor de MDF uso para cajas con juntas?",
        respuesta: "El que tengas a la mano, pero mídelo y pon ese espesor exacto en el generador de cajas para que las juntas embonen.",
      },
      {
        pregunta: "¿Pueden cortarme las piezas en MDF?",
        respuesta: "Sí. Sube tu archivo en Cotizar e indica material y espesor; los talleres te mandan propuestas.",
      },
    ],
    enlaces: [
      { texto: "Generador de cajas para corte", href: "/disenar/cajas" },
      { texto: "Calculadora de velocidades y avances", href: "/calculadora-cnc" },
      { texto: "Cotizar corte en router CNC", href: "/cotizar/router-cnc" },
    ],
  },

  "plasticos-y-acrilicos": {
    titulo_seo: "Acrílico y plásticos para CNC y láser en México | HETNA CNC",
    descripcion_seo:
      "Acrílico, PVC espumado, policarbonato, nylon y HDPE para router CNC y láser. Cuál usar, cuál no cortar con láser y cómo evitar que se derrita.",
    intro:
      "Acrílico, PVC espumado, policarbonato y plásticos de ingeniería para router CNC y láser. Ojo: no todos se pueden cortar con láser.",
    secciones: [
      {
        titulo: "Cuál plástico para qué trabajo",
        lista: [
          "Acrílico (PMMA): transparente y con buen acabado; letreros, exhibidores y protecciones. El acrílico cast se corta y graba mejor con láser que el extruido.",
          "PVC espumado (Sintra): ligero y fácil de cortar en router; letreros y señalética. No se corta con láser.",
          "Policarbonato: casi irrompible; protecciones y guardas. Con láser se amarillenta y quema, mejor en router.",
          "Nylon, HDPE y acetal (Delrin): plásticos de ingeniería para engranes, bujes y piezas que se deslizan; se maquinan en router o fresadora.",
        ],
      },
      {
        titulo: "Cómo cortar plástico sin que se derrita",
        parrafos: [
          "Usa fresa de un solo filo, avance alto y revoluciones moderadas: la idea es sacar viruta, no fricción. Si el plástico se derrite y se pega a la fresa, sube el avance o baja las revoluciones.",
        ],
      },
    ],
    faqs: [
      {
        pregunta: "¿Qué plásticos NO se deben cortar con láser?",
        respuesta: "PVC y vinilo (sueltan cloro, tóxico y corrosivo para la máquina), policarbonato (se quema) y ABS (se derrite y suelta humo tóxico).",
      },
      {
        pregunta: "¿Qué acrílico conviene para láser?",
        respuesta: "El acrílico cast (colado): corta con borde pulido y graba blanco. El extruido es más barato pero el grabado queda menos contrastado.",
      },
      {
        pregunta: "¿Qué fresa uso para acrílico en router?",
        respuesta: "De un solo filo (O-flute) con buen avance, para que la viruta salga sin derretir el material.",
      },
      {
        pregunta: "¿Me pueden cortar un letrero en acrílico?",
        respuesta: "Sí. Sube tu diseño en Cotizar, indica color y espesor, y recibe propuestas de talleres.",
      },
    ],
    enlaces: [
      { texto: "Cotizar corte láser", href: "/cotizar/corte-laser" },
      { texto: "Fresas para acrílico y plástico", href: "/categories/fresas-y-brocas" },
      { texto: "Generador de letreros", href: "/disenar/letreros" },
    ],
  },

  "tornos-cnc": {
    titulo_seo: "Tornos CNC en México: cómo elegir y qué revisar | HETNA CNC",
    descripcion_seo:
      "Tornos CNC para piezas cilíndricas en acero, aluminio, bronce y plásticos. Qué revisar, controladores comunes y talleres en México que tornean tu pieza.",
    intro:
      "Tornos CNC para piezas redondas: ejes, bujes, coples y roscas en metal o plástico. Si sólo necesitas unas piezas, un taller de torneado te las hace.",
    secciones: [
      {
        titulo: "Qué revisar en un torno CNC",
        lista: [
          "Volteo y distancia entre puntos: el diámetro y largo máximos de pieza.",
          "Paso de barra: si vas a trabajar desde barra larga, el diámetro que cabe por el husillo.",
          "Torreta o poste de herramientas: cuántas herramientas puede usar sin detenerse.",
          "Controlador: Fanuc, Siemens, GSK y otros. Confirma que tu CAM tenga postprocesador y que haya quien le dé servicio en México.",
        ],
      },
      {
        titulo: "Torno CNC o fresadora",
        parrafos: [
          "El torno hace piezas de revolución (todo lo redondo alrededor de un eje). Si la pieza tiene caras planas, cajas o barrenos fuera del centro, necesita fresadora o un torno con herramienta motorizada.",
        ],
      },
    ],
    faqs: [
      {
        pregunta: "¿Qué materiales se trabajan en torno CNC?",
        respuesta: "Acero, inoxidable, aluminio, bronce, latón, cobre y plásticos de ingeniería como nylon, acetal y teflón.",
      },
      {
        pregunta: "¿Qué necesito para cotizar una pieza torneada?",
        respuesta: "Un plano con medidas y tolerancias, o una pieza de muestra con fotos y medidas. Indica material y cantidad.",
      },
      {
        pregunta: "¿Hacen roscas en torno CNC?",
        respuesta: "Sí: roscas métricas, NPT, UNC/UNF, interiores y exteriores, según la herramienta del taller.",
      },
      {
        pregunta: "¿Pueden fabricar una refacción a partir de una pieza dañada?",
        respuesta: "Sí, muchos talleres hacen ingeniería inversa: miden la pieza y fabrican la nueva. Pídelo en Cotizar.",
      },
    ],
    enlaces: [
      { texto: "Cotizar torneado o maquinado", href: "/fabricacion" },
      { texto: "Laboratorio CAM para torno", href: "/cam/torno" },
      { texto: "Talleres CNC en México", href: "/talleres" },
    ],
  },

  "spindles-y-vfd": {
    titulo_seo: "Spindles y variadores (VFD) para router CNC en México | HETNA CNC",
    descripcion_seo:
      "Spindles enfriados por agua y por aire y variadores de frecuencia para router CNC. Potencia, voltaje, collets y cómo conectarlos.",
    intro:
      "Spindles y variadores de frecuencia (VFD) para router CNC: el corazón de la máquina. Aquí te explicamos cómo elegir la pareja correcta.",
    secciones: [
      {
        titulo: "Spindle enfriado por agua o por aire",
        lista: [
          "Por agua: más silencioso y aguanta trabajo continuo; necesita bomba y depósito (o chiller) y cuidar que no se congele ni se ensucie el agua.",
          "Por aire: sin bomba ni mangueras; más ruidoso, pero más simple de instalar y de mantener.",
        ],
      },
      {
        titulo: "Cómo elegir spindle y VFD",
        lista: [
          "Potencia: 1.5 kW para router de escritorio, 2.2 kW es el estándar para madera y acrílico, 3 a 4.5 kW para trabajo pesado.",
          "El VFD debe ser de la misma potencia o mayor que el spindle y del voltaje que tienes: 110 V, 220 V monofásico o 220 V trifásico.",
          "Collet: los spindles chinos usan ER11, ER16 o ER20; define el diámetro máximo de zanco de fresa que puedes usar.",
          "Configura en el VFD la frecuencia y los parámetros del spindle: unos valores mal puestos lo calientan o lo dañan.",
        ],
      },
    ],
    faqs: [
      {
        pregunta: "¿Qué potencia de spindle necesito?",
        respuesta: "Para madera, MDF y acrílico, 2.2 kW es lo más común. Para aluminio importa más la rigidez de la máquina que la potencia.",
      },
      {
        pregunta: "¿Puedo conectar un spindle de 220 V en mi casa?",
        respuesta: "Sí, con un VFD de entrada monofásica a 220 V. Revisa que tu instalación aguante el consumo y usa cable con tierra física.",
      },
      {
        pregunta: "¿Por qué se calienta mi spindle?",
        respuesta: "Por falta de agua o bomba apagada (en los enfriados por agua), parámetros mal puestos en el VFD o por trabajar muchas horas a baja velocidad.",
      },
      {
        pregunta: "¿Qué collet necesito para fresas de 1/4\"?",
        respuesta: "Un collet de 1/4\" (6.35 mm) de la serie de tu spindle (ER11, ER16 o ER20).",
      },
    ],
    enlaces: [
      { texto: "Routers CNC: guía para elegir", href: "/categories/routers-cnc" },
      { texto: "Fresas y brocas", href: "/categories/fresas-y-brocas" },
      { texto: "Pregunta en el Foro CNC", href: "/foro-cnc" },
    ],
  },
}

export const contenidoCategoria = (handle: string): ContenidoCategoria | undefined =>
  CONTENIDO_CATEGORIAS[handle]
