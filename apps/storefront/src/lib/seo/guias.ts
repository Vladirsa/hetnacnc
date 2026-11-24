// Guías CNC: páginas orientadas a búsquedas concretas (auditoría SEO del
// 13 nov 2026, parte 2). Cada una contesta una búsqueda real con contenido
// propio y con datos vivos de la red (talleres de ese servicio, trabajos
// abiertos) y lleva al siguiente paso: cotizar, calcular o descargar.
//
// Ruta: /mx/cnc/<slug> y, en las que tienen ciudades, /mx/cnc/<slug>/<ciudad>.
// Una ciudad sólo se indexa si hay talleres de ese servicio en su estado: sin
// talleres sería una página "puerta" que Google castiga (ver ciudadIndexable).
//
// No se inventan precios: para eso están los cotizadores.

export type Seccion = { titulo: string; parrafos?: string[]; lista?: string[] }
export type Enlace = { href: string; texto: string; detalle?: string }
export type Guia = {
  slug: string
  titulo: string // <title> (la plantilla agrega "| HETNA CNC"), ≤ 60 caracteres con la marca
  descripcion: string // meta description, ≤ 155 caracteres
  h1: string
  intro: string[]
  servicio: string // servicio de los trabajos abiertos (lib/trabajos)
  coincide: string[] // servicios del perfil del taller que cuentan
  materiales?: string[] // materiales del taller que suben su posición
  tipo: string // serviceType del schema Service
  cta: Enlace // acción principal
  secciones: Seccion[]
  faqs: { p: string; r: string }[]
  enlaces: Enlace[]
  ciudades?: boolean
  // Calculadora de precio dentro de la página (la misma de /cotizar/<servicio>)
  calculadora?: Calculadora
}

export type Calculadora = {
  servicio: "laser_co2" | "router" | "plasma" | "impresion_3d"
  titulo: string
  materiales: string[]
  servicioSolicitud: string
  opcion?: { campo: "calibre" | "calidad"; etiqueta: string; valores: string[]; inicial?: string }
}

// Las mismas opciones que las páginas /cotizar/* (no cambiar una sin la otra)
export const CALC_LASER: Calculadora = { servicio: "laser_co2", titulo: "corte láser", materiales: ["MDF delgado (hasta 2.5mm)", "MDF/Madera (3-5mm)", "Acrílico, cuero, tela u otro"], servicioSolicitud: "Corte láser" }
export const CALC_ROUTER: Calculadora = { servicio: "router", titulo: "router CNC", materiales: ["MDF 3mm", "MDF 9mm", "MDF 15mm", "MDF 18mm", "Acrilico", "Pino", "Cedro", "Parota", "Encino", "Aluminio"], servicioSolicitud: "Corte CNC" }
export const CALC_PLASMA: Calculadora = {
  servicio: "plasma",
  titulo: "corte plasma",
  materiales: ["Acero al carbón", "Acero inoxidable", "Aluminio"],
  opcion: { campo: "calibre", etiqueta: "Grosor", valores: ["Lámina delgada (cal. 20 a 12)", "Placa (cal. 10 o más grueso)"] },
  servicioSolicitud: "Corte plasma",
}

export type Ciudad = { slug: string; nombre: string; estado: string; alias: string[] }

// Ciudades con más demanda de CNC. El estado decide qué talleres son "locales";
// una ciudad sin talleres de ese servicio en su estado no se indexa (ciudadIndexable).
export const CIUDADES: Ciudad[] = [
  { slug: "cdmx", nombre: "Ciudad de México", estado: "Ciudad de México", alias: ["ciudad de mexico", "cdmx", "df", "distrito federal"] },
  { slug: "guadalajara", nombre: "Guadalajara", estado: "Jalisco", alias: ["jalisco", "guadalajara"] },
  { slug: "monterrey", nombre: "Monterrey", estado: "Nuevo León", alias: ["nuevo leon", "monterrey"] },
  { slug: "puebla", nombre: "Puebla", estado: "Puebla", alias: ["puebla"] },
  { slug: "queretaro", nombre: "Querétaro", estado: "Querétaro", alias: ["queretaro"] },
  { slug: "tlaxcala", nombre: "Tlaxcala y Apizaco", estado: "Tlaxcala", alias: ["tlaxcala", "apizaco"] },
  { slug: "toluca", nombre: "Toluca", estado: "Estado de México", alias: ["estado de mexico", "edomex", "toluca", "mexico"] },
  { slug: "leon", nombre: "León", estado: "Guanajuato", alias: ["guanajuato", "leon"] },
  { slug: "aguascalientes", nombre: "Aguascalientes", estado: "Aguascalientes", alias: ["aguascalientes"] },
  { slug: "san-luis-potosi", nombre: "San Luis Potosí", estado: "San Luis Potosí", alias: ["san luis potosi", "slp"] },
  { slug: "saltillo", nombre: "Saltillo", estado: "Coahuila", alias: ["coahuila", "saltillo", "torreon"] },
  { slug: "chihuahua", nombre: "Chihuahua y Ciudad Juárez", estado: "Chihuahua", alias: ["chihuahua", "juarez"] },
  { slug: "tijuana", nombre: "Tijuana y Mexicali", estado: "Baja California", alias: ["baja california", "tijuana", "mexicali", "ensenada"] },
  { slug: "hermosillo", nombre: "Hermosillo", estado: "Sonora", alias: ["sonora", "hermosillo"] },
  { slug: "morelia", nombre: "Morelia", estado: "Michoacán", alias: ["michoacan", "morelia"] },
  { slug: "veracruz", nombre: "Veracruz y Xalapa", estado: "Veracruz", alias: ["veracruz", "xalapa"] },
  { slug: "merida", nombre: "Mérida", estado: "Yucatán", alias: ["yucatan", "merida"] },
  { slug: "cancun", nombre: "Cancún", estado: "Quintana Roo", alias: ["quintana roo", "cancun", "playa del carmen"] },
  { slug: "culiacan", nombre: "Culiacán", estado: "Sinaloa", alias: ["sinaloa", "culiacan", "mazatlan"] },
  { slug: "pachuca", nombre: "Pachuca", estado: "Hidalgo", alias: ["hidalgo", "pachuca"] },
]

const normal = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim()

/** ¿El taller está en el estado de esa ciudad? */
export const enCiudad = (c: Ciudad, estado?: string, ciudad?: string) => {
  const e = normal(estado || "")
  const ci = normal(ciudad || "")
  if (c.slug === "toluca" && e.includes("ciudad de mexico")) return false
  // "Nuevo León" contiene "leon": no es León, Guanajuato
  if (c.slug === "leon" && (e.includes("nuevo leon") || ci.includes("nuevo leon"))) return false
  return c.alias.some((a) => e === a || e.includes(a) || ci.includes(a))
}

export const GUIAS: Guia[] = [
  {
    slug: "taller-router-cnc-mexico",
    titulo: "Taller de router CNC en México: corte y tallado",
    descripcion: "Encuentra un taller de router CNC en México para cortar y tallar MDF, triplay, madera y acrílico. Precio al instante o propuestas de varios talleres.",
    h1: "Taller de router CNC en México",
    intro: [
      "Un router CNC corta, perfora y talla tableros grandes con una fresa que gira a alta velocidad. Es la máquina para muebles, letreros, exhibidores, moldes de madera, piezas de acrílico y prototipos de gran formato.",
      "En HETNA puedes ver el precio aproximado al instante o publicar tu trabajo para que varios talleres de router CNC de México te manden su propuesta. Comparas precio, tiempo de entrega y reputación, y pagas dentro de la plataforma.",
    ],
    servicio: "Corte CNC",
    coincide: ["Corte CNC", "Fresado de madera", "Maquinado"],
    materiales: ["MDF", "Triplay", "Madera", "Acrílico"],
    tipo: "Corte y tallado en router CNC",
    cta: { href: "/cotizar/router-cnc", texto: "Ver precio al instante" },
    ciudades: true,
    calculadora: CALC_ROUTER,
    secciones: [
      {
        titulo: "Qué puede hacer un taller de router CNC",
        lista: [
          "Corte de piezas en tableros completos de 1220 × 2440 mm (4 × 8 pies), el tamaño estándar del MDF y el triplay.",
          "Ranurado, cajeado y perforado para muebles y ensambles.",
          "Tallado en relieve (2.5D y 3D) para letreros, puertas, cuadros y moldes.",
          "Grabado de textos y logotipos con fresa en V.",
          "Corte de acrílico, PVC espumado, policarbonato y aluminio delgado con la fresa adecuada.",
        ],
      },
      {
        titulo: "Materiales más comunes",
        parrafos: [
          "MDF de 3 a 30 mm, triplay de pino o caobilla, madera sólida (pino, cedro, parota, encino), acrílico cristal y de color, PVC espumado y ACM (Alucobond). En metal, un router de buena rigidez corta aluminio delgado; para acero se usa plasma, láser de fibra o centro de maquinado.",
        ],
      },
      {
        titulo: "De qué depende el precio",
        lista: [
          "Tiempo de máquina: longitud de corte, profundidad y número de pasadas.",
          "Material: si lo pone el taller o lo llevas tú, y cuántos tableros se usan (aprovechamiento).",
          "Cantidad: preparar la máquina cuesta lo mismo para una pieza que para cien.",
          "Diseño: si traes un DXF limpio o el taller tiene que dibujarlo.",
          "Acabado y envío: lijado, sellado, pintura y entrega.",
        ],
      },
      {
        titulo: "Cómo pedirlo bien",
        lista: [
          "Manda el archivo en DXF o SVG, en milímetros y con los contornos cerrados.",
          "Indica material, espesor, cantidad y si las piezas llevan cajeados o tallado.",
          "Si no tienes archivo, una foto con medidas basta para que los talleres que diseñan te coticen.",
        ],
      },
    ],
    faqs: [
      { p: "¿Cuál es el tamaño máximo que corta un router CNC?", r: "La mayoría de los talleres trabaja tableros de 1220 × 2440 mm. Piezas más grandes se hacen en partes y se ensamblan; algunos talleres tienen mesas mayores y lo indican en su perfil." },
      { p: "¿Puedo llevar mi propio material?", r: "Muchos talleres lo aceptan. Dilo en tu solicitud para que coticen sólo el corte." },
      { p: "¿Qué diferencia hay entre router CNC y corte láser?", r: "El láser es más preciso en detalles finos y en espesores delgados (hasta unos 6–9 mm de MDF) y deja el borde oscuro. El router corta espesores mayores, hace cajeados y tallado en relieve, y deja el borde del color del material." },
      { p: "¿En cuánto tiempo entregan?", r: "Depende del taller y de la cantidad. Cada propuesta incluye su tiempo de entrega comprometido; a eso súmale el envío." },
    ],
    enlaces: [
      { href: "/cotizar/router-cnc", texto: "Precio de corte en router CNC", detalle: "Estimado al instante con medidas y material" },
      { href: "/cnc/archivos-dxf-router-cnc", texto: "Archivos DXF para router CNC", detalle: "Cómo preparar tu archivo y dónde conseguirlo" },
      { href: "/calculadora-cnc", texto: "Calculadora de avance y RPM", detalle: "Parámetros de corte para tu fresa" },
      { href: "/talleres", texto: "Directorio de talleres CNC", detalle: "Busca por servicio, máquina o ciudad" },
    ],
  },
  {
    slug: "corte-laser-mdf",
    titulo: "Corte láser de MDF: espesores, precio y talleres",
    descripcion: "Corte y grabado láser de MDF de 3 a 9 mm con talleres de México. Qué espesores se cortan, cómo preparar tu archivo y precio al instante.",
    h1: "Corte láser de MDF",
    intro: [
      "El corte láser CO₂ es la forma más rápida y precisa de cortar MDF delgado: detalles finos, letras pequeñas, ensambles a presión y grabado en la misma pasada.",
      "Calcula el precio de tu corte al instante o publica tu trabajo para que talleres de corte láser te manden su propuesta, en tu ciudad o con envío a todo México.",
    ],
    servicio: "Corte láser",
    coincide: ["Corte láser", "Grabado"],
    materiales: ["MDF"],
    tipo: "Corte y grabado láser",
    cta: { href: "/cotizar/corte-laser", texto: "Ver precio al instante" },
    ciudades: true,
    calculadora: CALC_LASER,
    secciones: [
      {
        titulo: "Qué espesores de MDF se cortan con láser",
        parrafos: [
          "Con un láser CO₂ de 60 a 150 W se cortan bien el MDF de 3, 4.5 y 6 mm. El de 9 mm se corta con equipos de más potencia y más lento; de 12 mm en adelante conviene un router CNC. El grabado (sin atravesar) funciona en cualquier espesor.",
        ],
      },
      {
        titulo: "Qué esperar del borde",
        lista: [
          "El borde queda oscuro (quemado): es normal en el láser y se puede lijar o pintar.",
          "El rayo quita un poco de material (kerf, alrededor de 0.1–0.2 mm): importa en ensambles a presión.",
          "Puede quedar algo de humo en la cara; pide cinta de enmascarar si la pieza va al natural.",
        ],
      },
      {
        titulo: "Cómo preparar el archivo",
        lista: [
          "Vectores en DXF, SVG, AI o PDF, en milímetros y a escala 1:1.",
          "Contornos cerrados y sin líneas duplicadas (una línea doble se corta dos veces).",
          "Un color o capa para corte y otro para grabado.",
          "Textos convertidos a curvas.",
        ],
      },
      {
        titulo: "Usos más comunes",
        lista: ["Cajas y empaques", "Letreros y señalización", "Rompecabezas y juguetes", "Recuerdos para eventos", "Maquetas y prototipos", "Plantillas y troqueles"],
      },
    ],
    faqs: [
      { p: "¿Cuánto cuesta el corte láser de MDF?", r: "Depende del tiempo de corte (longitud de líneas), el espesor, la cantidad y si el taller pone el material. Con la calculadora ves un rango al instante; para un precio exacto publica tu trabajo y compara propuestas." },
      { p: "¿Se puede grabar y cortar en la misma pieza?", r: "Sí. Marca en tu archivo qué es corte y qué es grabado (un color o capa para cada uno)." },
      { p: "¿Puedo diseñar la caja en línea?", r: "Sí: en Diseñar cajas generas el DXF de una caja con juntas para láser con tus medidas, gratis." },
      { p: "¿Hacen envíos?", r: "Sí. Cada taller dice en su propuesta si el precio incluye envío; si prefieres recoger en tu ciudad, indícalo." },
    ],
    enlaces: [
      { href: "/cotizar/corte-laser", texto: "Precio de corte láser", detalle: "Estimado al instante" },
      { href: "/disenar/cajas", texto: "Diseñar cajas para láser", detalle: "DXF con juntas a tu medida, gratis" },
      { href: "/categories/disenos-2d", texto: "Diseños 2D para láser", detalle: "Archivos listos para cortar" },
      { href: "/cnc/taller-router-cnc-mexico", texto: "Router CNC para espesores mayores", detalle: "MDF de 12 mm en adelante" },
    ],
  },
  {
    slug: "maquinado-cnc-aluminio",
    titulo: "Maquinado CNC de aluminio en México",
    descripcion: "Maquinado CNC de piezas de aluminio 6061 y 7075 con talleres de México: fresado, torneado, tolerancias y acabados. Recibe propuestas y compara.",
    h1: "Maquinado CNC de aluminio",
    intro: [
      "El aluminio es el metal más usado en maquinado CNC: es ligero, resistente a la corrosión y se corta rápido, así que las piezas salen a buen costo con tolerancias finas.",
      "Publica tu pieza con plano o modelo 3D y talleres de maquinado de México te mandan su precio y tiempo de entrega.",
    ],
    servicio: "Maquinado",
    coincide: ["Maquinado", "Fresado de metal"],
    materiales: ["Aluminio"],
    tipo: "Maquinado CNC de aluminio",
    cta: { href: "/cotizar?servicio=Maquinado", texto: "Pedir propuestas" },
    secciones: [
      {
        titulo: "Aleaciones más comunes",
        lista: [
          "6061-T6: la más usada. Buena resistencia, se maquina bien y acepta anodizado. Para soportes, placas, carcasas y prototipos.",
          "7075-T6: mucho más resistente, para piezas sometidas a esfuerzo (aeronáutica, moldes, herramentales). Más cara.",
          "5052 y 1100: lámina y placa para piezas dobladas o soldadas; menos adecuadas para maquinado fino.",
        ],
      },
      {
        titulo: "Procesos",
        lista: [
          "Fresado en 3 ejes: placas, cajas, ranuras y perforaciones.",
          "Fresado en 4 y 5 ejes: piezas con caras en distintos ángulos en una sola sujeción.",
          "Torneado CNC: flechas, bujes, roscas y piezas de revolución.",
          "Router CNC: placa delgada y paneles de ACM o aluminio de baja dureza.",
        ],
      },
      {
        titulo: "Qué incluir en tu solicitud",
        lista: [
          "Modelo 3D (STEP o IGES) y, si hay tolerancias o roscas, un plano en PDF.",
          "Aleación y temple (por ejemplo 6061-T6) o para qué sirve la pieza, si no lo sabes.",
          "Tolerancias que de verdad necesitas: pedir ±0.01 mm donde basta ±0.1 mm encarece la pieza.",
          "Cantidad y acabado: anodizado natural o de color, sandblast, cepillado.",
        ],
      },
    ],
    faqs: [
      { p: "¿Qué tolerancia se puede lograr en aluminio?", r: "Un taller de maquinado trabaja normalmente con ±0.05 a ±0.1 mm, y con más cuidado ±0.01–0.02 mm en medidas críticas. Indica en el plano sólo las que importan." },
      { p: "¿Pueden anodizar las piezas?", r: "Muchos talleres lo ofrecen o lo mandan hacer. Pídelo en tu solicitud y especifica color." },
      { p: "¿Qué formato de archivo mando?", r: "STEP es el más útil para maquinado. STL sirve para ver la forma, pero no trae medidas exactas de agujeros ni caras." },
      { p: "¿Cómo calculo velocidades para aluminio?", r: "Con la calculadora de avance y RPM: eliges la fresa, el número de filos y el material, y te da revoluciones y avance de partida." },
    ],
    enlaces: [
      { href: "/categories/maquinado-cnc", texto: "Maquinado CNC", detalle: "Talleres y trabajos abiertos" },
      { href: "/categories/maquinado-4-y-5-ejes", texto: "Maquinado en 4 y 5 ejes", detalle: "Piezas complejas en una sujeción" },
      { href: "/cnc/programacion-cam-5-ejes", texto: "Programación CAM de 5 ejes", detalle: "Trayectorias y postprocesador" },
      { href: "/calculadora-cnc", texto: "Calculadora de avance y RPM", detalle: "Parámetros para aluminio" },
    ],
  },
  {
    slug: "torno-cnc",
    titulo: "Servicio de torno CNC en México",
    descripcion: "Torneado CNC de flechas, bujes, roscas y piezas de revolución en acero, aluminio, bronce y plásticos. Publica tu pieza y compara propuestas de talleres.",
    h1: "Servicio de torno CNC",
    intro: [
      "El torno CNC hace piezas redondas o de revolución: flechas, bujes, pernos, coples, poleas, roscas y casquillos. La pieza gira y la herramienta corta, así que se logran diámetros y acabados muy precisos.",
      "Publica tu pieza con plano o modelo 3D y talleres de torneado de México te mandan su precio, tiempo de entrega y garantía dentro de HETNA.",
    ],
    servicio: "Maquinado",
    coincide: ["Maquinado", "Torno", "Torneado"],
    materiales: ["Acero", "Aluminio", "Bronce", "Nylon"],
    tipo: "Torneado CNC",
    cta: { href: "/cotizar?servicio=Maquinado", texto: "Pedir propuestas" },
    secciones: [
      {
        titulo: "Qué piezas se hacen en torno",
        lista: [
          "Flechas y ejes, con cambios de diámetro, chaflanes y cuñeros.",
          "Bujes, casquillos y separadores.",
          "Roscas exteriores e interiores (métricas, UNC/UNF, NPT).",
          "Poleas, coples, pernos, tapones y conexiones.",
          "Piezas con caras fresadas o barrenos laterales, si el torno tiene herramienta motorizada.",
        ],
      },
      {
        titulo: "Materiales comunes",
        lista: [
          "Acero al carbón (1018, 1045) y aceros aleados (4140) para flechas y piezas de esfuerzo.",
          "Acero inoxidable (304, 316) para alimentos, agua y ambientes corrosivos.",
          "Aluminio (6061) para piezas ligeras y prototipos.",
          "Bronce y latón para bujes y piezas de desgaste.",
          "Plásticos de ingeniería (nylon, acetal/Delrin, UHMW) para bujes, rodillos y piezas que no deben rayar.",
        ],
      },
      {
        titulo: "Qué incluir en tu solicitud",
        lista: [
          "Plano en PDF con diámetros, largos y tolerancias; o modelo 3D en STEP.",
          "Material y, si aplica, tratamiento térmico o recubrimiento (pavonado, zincado, cromo duro).",
          "Especificación de roscas (por ejemplo M20x1.5 o 3/4-10 UNC).",
          "Cantidad: en lotes, el costo por pieza baja mucho porque el programa y la preparación se hacen una vez.",
        ],
      },
    ],
    faqs: [
      { p: "¿Qué tolerancia se puede lograr en torno CNC?", r: "En diámetros es común trabajar con ±0.02 a ±0.05 mm, y más fino en medidas críticas. Indica en el plano sólo las tolerancias que de verdad necesitas: apretar todas encarece la pieza." },
      { p: "¿Qué archivo mando?", r: "Un plano en PDF con medidas y tolerancias es lo más útil para torneado. Un STEP ayuda a ver la forma. STL no trae medidas exactas de roscas ni diámetros." },
      { p: "¿Hacen una sola pieza o sólo lotes?", r: "Depende del taller: algunos hacen piezas únicas y refacciones, otros prefieren lotes. En tu solicitud indica la cantidad y los talleres que la aceptan te mandan propuesta." },
      { p: "¿Cuánto cobra HETNA?", r: "Publicar tu solicitud es gratis y los trabajos de solicitudes no pagan comisión. Cada propuesta trae precio, tiempos, condiciones de pago y garantía para que compares." },
    ],
    enlaces: [
      { href: "/categories/maquinado-cnc", texto: "Maquinado CNC", detalle: "Talleres y trabajos abiertos" },
      { href: "/cnc/maquinado-cnc-aluminio", texto: "Maquinado CNC de aluminio", detalle: "Aleaciones, procesos y tolerancias" },
      { href: "/laboratorio-cam", texto: "CAM Studio", detalle: "Programas de torno CNC" },
      { href: "/calculadora-cnc", texto: "Calculadora de avance y RPM", detalle: "Parámetros de partida" },
    ],
  },
  {
    slug: "programacion-cam-5-ejes",
    titulo: "Programación CAM de 5 ejes: servicio en México",
    descripcion: "Programación CAM de 5 ejes simultáneos y 3+2: trayectorias, simulación y postprocesador para tu máquina. Cotiza con programadores de México.",
    h1: "Programación CAM de 5 ejes",
    intro: [
      "Programar una máquina de 5 ejes es la parte más especializada del maquinado: trayectorias que inclinan la herramienta sin chocar, simulación completa y un postprocesador que entienda tu máquina.",
      "Si tienes la máquina pero no el programador, o necesitas apoyo en una pieza difícil, publica tu trabajo y recibe propuestas de programadores CAM de México.",
    ],
    servicio: "Diseño CAD/CAM",
    coincide: ["Diseño CAD/CAM", "Maquinado", "Fresado de metal"],
    tipo: "Programación CAM",
    cta: { href: "/cotizar?servicio=Dise%C3%B1o%20CAD%2FCAM", texto: "Pedir propuestas" },
    secciones: [
      {
        titulo: "3+2 o 5 ejes simultáneos",
        parrafos: [
          "En 3+2 (posicional) la máquina inclina la pieza o el cabezal, se fija, y corta como una de 3 ejes. Sirve para piezas con caras en varios ángulos y es más sencillo de programar y verificar.",
          "En 5 ejes simultáneos los cinco ejes se mueven a la vez: superficies de forma libre, álabes, impulsores, moldes profundos y piezas que exigen la herramienta corta para no vibrar.",
        ],
      },
      {
        titulo: "Qué entrega un buen programador",
        lista: [
          "Trayectorias de desbaste y acabado con la estrategia adecuada para la geometría.",
          "Simulación con el modelo de la máquina, sujeción y portaherramientas para descartar choques.",
          "G-code generado con el postprocesador de tu control (Fanuc, Heidenhain, Siemens, Haas, entre otros).",
          "Hoja de herramientas y de cero pieza para el operador.",
        ],
      },
      {
        titulo: "Qué necesitas mandar",
        lista: [
          "Modelo 3D en STEP, IGES o Parasolid, y el plano con tolerancias.",
          "Marca, modelo y configuración de la máquina (mesa basculante, cabezal o mixta) y su control.",
          "Herramientas y sujeción disponibles, si ya los tienes.",
        ],
      },
    ],
    faqs: [
      { p: "¿Qué software usan para 5 ejes?", r: "Los más comunes son Fusion 360, Mastercam, PowerMill, hyperMILL, NX y SolidCAM. Lo importante es que el programador tenga el postprocesador probado para tu máquina." },
      { p: "¿Pueden programar sin tener la máquina?", r: "Sí, con el modelo de la máquina y su postprocesador. La primera pieza se prueba en tu taller con el programador en contacto." },
      { p: "¿Y si sólo necesito 2D o 3 ejes?", r: "Para DXF a G-code en router o láser puedes usar CAM Studio 2D gratis en HETNA; para 3 ejes hay programadores en Programación CAM." },
    ],
    enlaces: [
      { href: "/categories/programacion-cam", texto: "Programación CAM", detalle: "Talleres y programadores" },
      { href: "/cam/lab", texto: "CAM Studio 3D", detalle: "3, 4 y 5 ejes en el navegador" },
      { href: "/categories/maquinado-4-y-5-ejes", texto: "Maquinado en 4 y 5 ejes", detalle: "Talleres con máquina" },
      { href: "/categories/postprocesadores", texto: "Postprocesadores", detalle: "Para tu control" },
    ],
  },
  {
    slug: "archivos-dxf-router-cnc",
    titulo: "Archivos DXF para router CNC: listos para cortar",
    descripcion: "Archivos DXF para router CNC listos para cortar y cómo preparar los tuyos: contornos cerrados, escala, capas y compensación. Descarga y convierte gratis.",
    h1: "Archivos DXF para router CNC",
    intro: [
      "El DXF es el formato que entiende casi cualquier software de CAM para router CNC, láser y plasma. Un DXF bien hecho se corta a la primera; uno mal hecho cuesta material y tiempo de máquina.",
      "Aquí encuentras diseños DXF listos para cortar y las herramientas gratis de HETNA para convertir, revisar y llevar tu archivo hasta el G-code.",
    ],
    servicio: "Diseño CAD/CAM",
    coincide: ["Diseño CAD/CAM"],
    tipo: "Diseño de archivos DXF para CNC",
    cta: { href: "/categories/archivos-para-cnc", texto: "Ver archivos para CNC" },
    secciones: [
      {
        titulo: "Cómo debe ser un DXF para router CNC",
        lista: [
          "En milímetros y a escala real 1:1.",
          "Contornos cerrados: una pieza abierta no se puede cortar por fuera ni cajear.",
          "Sin líneas duplicadas ni encimadas.",
          "Curvas como arcos o polilíneas, no miles de segmentos diminutos (la máquina avanza a tirones).",
          "Una capa por operación: corte exterior, interior, cajeado, grabado.",
          "Textos convertidos a contornos.",
        ],
      },
      {
        titulo: "Detalles que separan un archivo bueno de uno que funciona",
        lista: [
          "Esquinas interiores con radio igual o mayor al de la fresa (una fresa redonda no hace esquinas a 90°).",
          "Puentes (tabs) en piezas pequeñas para que no se muevan al terminar el corte.",
          "Holgura en ensambles: considera el diámetro de la fresa y el espesor real del tablero.",
          "Piezas acomodadas (nesting) para aprovechar el tablero de 1220 × 2440 mm.",
        ],
      },
      {
        titulo: "Herramientas gratis",
        lista: [
          "Convierte una imagen a vectores DXF con el vectorizador.",
          "Genera cajas, letreros y despieces de muebles a tu medida.",
          "Pasa tu DXF a G-code para router o láser con CAM Studio 2D.",
        ],
      },
    ],
    faqs: [
      { p: "¿DXF o SVG?", r: "Los dos funcionan para corte. El DXF es el estándar en router CNC y plasma; el SVG es común en láser. Lo importante es la escala en milímetros y los contornos cerrados." },
      { p: "¿Puedo usar los diseños para vender piezas?", r: "Depende de la licencia de cada diseño; viene en su ficha. Lo que no se permite es revender o compartir el archivo." },
      { p: "¿Me pueden hacer el DXF?", r: "Sí: publica tu idea con una foto y medidas, y los talleres que diseñan te cotizan el archivo, con o sin el corte." },
    ],
    enlaces: [
      { href: "/categories/archivos-para-cnc", texto: "Archivos para CNC", detalle: "DXF, SVG y STL listos para cortar" },
      { href: "/categories/disenos-2d", texto: "Diseños 2D", detalle: "Para router, láser y plasma" },
      { href: "/disenar/vectorizador", texto: "Vectorizar imagen a DXF", detalle: "Gratis, en el navegador" },
      { href: "/cam/subir", texto: "De DXF a G-code", detalle: "CAM Studio 2D gratis" },
    ],
  },
  {
    slug: "corte-plasma",
    titulo: "Corte plasma CNC: lámina y placa de acero",
    descripcion: "Corte plasma CNC de lámina y placa de acero, inoxidable y aluminio con talleres de México. Cómo preparar tu archivo y precio al instante.",
    h1: "Corte plasma CNC",
    intro: [
      "El plasma CNC corta metal conductor —acero al carbón, inoxidable y aluminio— desde lámina delgada hasta placa gruesa. Es la opción más económica para piezas de herrería, bases, soportes, letreros de metal y piezas estructurales.",
      "Calcula el precio al instante o publica tu trabajo para que talleres de corte plasma te manden su propuesta, en tu ciudad o con envío.",
    ],
    servicio: "Corte plasma",
    coincide: ["Corte plasma"],
    materiales: ["Acero", "Acero inoxidable", "Aluminio"],
    tipo: "Corte plasma CNC",
    cta: { href: "/cotizar/corte-plasma", texto: "Ver precio al instante" },
    ciudades: true,
    calculadora: CALC_PLASMA,
    secciones: [
      {
        titulo: "Qué se corta con plasma",
        parrafos: [
          "Acero al carbón, acero inoxidable, aluminio y otros metales que conducen electricidad. El espesor máximo depende del equipo (su amperaje): cada taller dice en su perfil hasta qué grosor corta. Madera, acrílico o plástico no se cortan con plasma.",
        ],
      },
      {
        titulo: "Qué esperar del corte",
        lista: [
          "El borde queda con una ligera inclinación y puede traer escoria abajo: se limpia con esmeril o lija.",
          "El corte se lleva algunos décimos de milímetro a más de un milímetro de material (kerf), según el equipo y el grosor.",
          "Los agujeros muy chicos no salen redondos: como regla práctica, que no sean menores que el grosor de la lámina. Para agujeros de precisión, se cortan más chicos y se taladran.",
          "Si necesitas bordes muy finos o detalle pequeño, pregunta por láser de fibra.",
        ],
      },
      {
        titulo: "Cómo preparar el archivo",
        lista: [
          "DXF en milímetros y a escala 1:1.",
          "Contornos cerrados y sin líneas duplicadas.",
          "Letras y figuras con \"puentes\" para que las partes interiores (como el centro de la O) no se caigan.",
          "Indica el material, el grosor (calibre o milímetros) y la cantidad.",
        ],
      },
      {
        titulo: "Usos más comunes",
        lista: ["Herrería y portones", "Bases y placas de anclaje", "Soportes y escuadras", "Letreros y figuras de metal", "Piezas para remolques y maquinaria", "Decoración (siluetas, parrillas, chimeneas)"],
      },
    ],
    faqs: [
      { p: "¿Cuánto cuesta el corte plasma?", r: "Depende de los metros de corte, el número de perforaciones, el grosor, la cantidad y si el taller pone el material. Con la calculadora ves un rango al instante; para un precio exacto publica tu trabajo y compara propuestas." },
      { p: "¿Plasma o láser de fibra?", r: "El plasma es más económico y corta placa gruesa; el láser de fibra deja un borde más fino y detalle más pequeño en lámina. Si no sabes, publica tu trabajo y deja que el taller te recomiende." },
      { p: "¿El taller pone el material?", r: "Muchos sí. Al pedir precio indica si lo pones tú o si el taller lo consigue." },
      { p: "¿Hacen envíos?", r: "Sí. Cada taller dice en su propuesta si el precio incluye envío; si prefieres recoger en tu ciudad, indícalo." },
    ],
    enlaces: [
      { href: "/cotizar/corte-plasma", texto: "Precio de corte plasma", detalle: "Estimado al instante" },
      { href: "/cnc/preparar-archivo-corte-plasma", texto: "Cómo preparar tu archivo para plasma", detalle: "Puentes, agujeros y escala" },
      { href: "/disenar/letreros", texto: "Diseñar letreros", detalle: "Genera el DXF de tu letrero" },
      { href: "/talleres", texto: "Talleres de la red", detalle: "Con reputación medida" },
    ],
  },
  {
    slug: "corte-laser-acrilico",
    titulo: "Corte láser de acrílico: espesores y talleres",
    descripcion: "Corte y grabado láser de acrílico cristal y de color con talleres de México. Qué espesores se cortan, cómo preparar tu archivo y precio al instante.",
    h1: "Corte láser de acrílico",
    intro: [
      "El láser CO₂ corta el acrílico (PMMA) con un borde pulido y brillante, sin lijar: por eso es el proceso favorito para exhibidores, letreros, trofeos, llaveros y piezas transparentes.",
      "Calcula el precio de tu corte al instante o publica tu trabajo para que talleres de corte láser te manden su propuesta, en tu ciudad o con envío a todo México.",
    ],
    servicio: "Corte láser",
    coincide: ["Corte láser", "Grabado"],
    materiales: ["Acrílico"],
    tipo: "Corte y grabado láser de acrílico",
    cta: { href: "/cotizar/corte-laser", texto: "Ver precio al instante" },
    ciudades: true,
    calculadora: CALC_LASER,
    secciones: [
      {
        titulo: "Qué espesores de acrílico se cortan con láser",
        parrafos: [
          "Los más comunes son de 2 a 6 mm. Con más potencia se cortan espesores mayores, más lento. El máximo depende del equipo de cada taller: compáralo en sus perfiles o pregúntalo al pedir precio.",
        ],
      },
      {
        titulo: "Acrílico cristal, de color, espejo y \"cast\" o extruido",
        lista: [
          "Acrílico cast (colado): da el mejor borde pulido y graba en blanco escarchado.",
          "Acrílico extruido: más barato; corta bien pero el grabado queda menos contrastado.",
          "Acrílico espejo: se graba por la parte de atrás para que el espejo quede al frente.",
          "Pide que dejen el papel protector durante el corte para que no se marque la superficie.",
        ],
      },
      {
        titulo: "Cómo preparar el archivo",
        lista: [
          "Vectores en DXF, SVG, AI o PDF, en milímetros y a escala 1:1.",
          "Contornos cerrados y sin líneas duplicadas.",
          "Un color o capa para corte y otro para grabado.",
          "Textos convertidos a curvas; en piezas transparentes, piensa si el grabado va al frente o en espejo atrás.",
        ],
      },
      {
        titulo: "Usos más comunes",
        lista: ["Exhibidores y porta folletos", "Letreros y señalización", "Trofeos y reconocimientos", "Llaveros y recuerdos", "Cajas y organizadores", "Protecciones y guardas de máquinas"],
      },
    ],
    faqs: [
      { p: "¿Cuánto cuesta el corte láser de acrílico?", r: "Depende de la longitud de corte, el espesor, la cantidad y si el taller pone el material. Con la calculadora ves un rango al instante; para un precio exacto publica tu trabajo y compara propuestas." },
      { p: "¿El borde queda transparente?", r: "Con acrílico cast y un láser bien ajustado, el borde queda pulido y brillante. El extruido también queda liso, aunque menos brillante." },
      { p: "¿Se puede doblar el acrílico?", r: "Sí, con calor (termoformado). Pregunta en tu solicitud si el taller ofrece doblado." },
      { p: "¿Hacen envíos?", r: "Sí. Cada taller dice en su propuesta si el precio incluye envío; si prefieres recoger en tu ciudad, indícalo." },
    ],
    enlaces: [
      { href: "/cotizar/corte-laser", texto: "Precio de corte láser", detalle: "Estimado al instante" },
      { href: "/cnc/preparar-archivo-corte-laser", texto: "Cómo preparar tu archivo para láser", detalle: "Capas, colores y escala" },
      { href: "/disenar/llaveros", texto: "Diseñar llaveros", detalle: "DXF a tu medida, gratis" },
      { href: "/cnc/corte-laser-mdf", texto: "Corte láser de MDF", detalle: "Espesores y usos" },
    ],
  },
  {
    slug: "preparar-archivo-corte-laser",
    titulo: "Cómo preparar tu archivo para corte láser",
    descripcion: "Guía para preparar tu archivo de corte láser: formatos, escala, contornos cerrados, capas de corte y grabado, textos y kerf. Revísalo gratis al subirlo.",
    h1: "Cómo preparar tu archivo para corte láser",
    intro: [
      "La mitad de los retrasos en un corte láser vienen del archivo: una línea abierta, un texto sin convertir o un dibujo en la escala equivocada. Con esta guía tu archivo sale a la primera.",
      "Al subir tu DXF o SVG en la calculadora de abajo, HETNA lo revisa al instante y te dice qué corregir antes de pedir precio.",
    ],
    servicio: "Corte láser",
    coincide: ["Corte láser", "Grabado", "Diseño CAD/CAM"],
    tipo: "Preparación de archivos para corte láser",
    cta: { href: "/cotizar/corte-laser", texto: "Revisar mi archivo y ver precio" },
    calculadora: CALC_LASER,
    secciones: [
      {
        titulo: "1. Formato y escala",
        lista: [
          "Formatos vectoriales: DXF, SVG, AI o PDF vectorial. Una foto o un JPG no sirven para cortar (primero se vectorizan).",
          "En milímetros y a escala real 1:1: si tu pieza mide 10 cm, en el archivo debe medir 100 mm.",
          "Si exportas desde Illustrator o Inkscape, revisa que el SVG traiga las medidas en mm.",
        ],
      },
      {
        titulo: "2. Contornos cerrados y sin duplicados",
        lista: [
          "Cada pieza debe ser un contorno cerrado: si no cierra, la máquina no sabe qué es pieza y qué es sobrante.",
          "Borra las líneas encimadas o duplicadas: se cortarían dos veces, quemando la orilla y cobrando de más.",
          "Borra puntos sueltos y restos del dibujo.",
        ],
      },
      {
        titulo: "3. Corte y grabado separados",
        lista: [
          "Usa un color o capa para corte (por ejemplo rojo) y otro para grabado (negro o relleno).",
          "El grabado de rellenos va como área rellena; el grabado de líneas, como línea de otro color.",
          "Corta primero los interiores y al final el contorno exterior (el taller suele configurarlo así).",
        ],
      },
      {
        titulo: "4. Textos, detalles y kerf",
        lista: [
          "Convierte los textos a curvas o contornos: si no, el taller puede no tener tu tipografía.",
          "Detalles más finos que el grosor del material pueden quemarse o romperse.",
          "El láser se lleva unas décimas de milímetro (kerf): en ensambles a presión, considéralo o pide al taller que lo compense.",
        ],
      },
    ],
    faqs: [
      { p: "¿Qué pasa si mi archivo tiene errores?", r: "Al subirlo en la calculadora te mostramos la lista de lo que hay que corregir (contornos abiertos, duplicados, textos, agujeros chicos). Puedes pedir precio igual; la revisión viaja con tu solicitud para que el taller la vea." },
      { p: "Sólo tengo una imagen, ¿me sirve?", r: "Conviértela a vectores con el vectorizador gratis de HETNA, o publica tu trabajo con la imagen y pide que el taller te haga el archivo." },
      { p: "¿Puedo mandar un PDF?", r: "Sí, si es vectorial (hecho desde un programa de diseño, no escaneado). Para el precio al instante usa DXF o SVG." },
    ],
    enlaces: [
      { href: "/disenar/vectorizador", texto: "Vectorizar imagen", detalle: "De JPG/PNG a DXF o SVG, gratis" },
      { href: "/cnc/corte-laser-mdf", texto: "Corte láser de MDF", detalle: "Espesores y usos" },
      { href: "/cnc/corte-laser-acrilico", texto: "Corte láser de acrílico", detalle: "Cast, extruido y espejo" },
      { href: "/cnc/archivos-dxf-router-cnc", texto: "Archivos DXF para router CNC", detalle: "Si tu pieza va en router" },
    ],
  },
  {
    slug: "preparar-archivo-corte-plasma",
    titulo: "Cómo preparar tu archivo para corte plasma",
    descripcion: "Guía para preparar tu DXF de corte plasma: escala, contornos cerrados, puentes en letras, agujeros mínimos y kerf. Revisa tu archivo gratis al subirlo.",
    h1: "Cómo preparar tu archivo para corte plasma",
    intro: [
      "En plasma, un buen archivo ahorra lámina y retrabajo: letras con puentes, agujeros del tamaño correcto y contornos cerrados.",
      "Al subir tu DXF en la calculadora de abajo, HETNA lo revisa al instante y te avisa de lo que conviene corregir antes de pedir precio.",
    ],
    servicio: "Corte plasma",
    coincide: ["Corte plasma", "Diseño CAD/CAM"],
    tipo: "Preparación de archivos para corte plasma",
    cta: { href: "/cotizar/corte-plasma", texto: "Revisar mi archivo y ver precio" },
    calculadora: CALC_PLASMA,
    secciones: [
      {
        titulo: "1. Formato y escala",
        lista: [
          "DXF en milímetros y a escala real 1:1 (es el formato que usan casi todas las mesas de plasma).",
          "Curvas como arcos o polilíneas, no miles de segmentos diminutos: la antorcha avanza a tirones y el borde sale ondulado.",
        ],
      },
      {
        titulo: "2. Contornos cerrados y sin duplicados",
        lista: [
          "Cada pieza, un contorno cerrado.",
          "Sin líneas duplicadas: el plasma pasaría dos veces y dañaría el borde.",
          "Borra cotas, textos de notas y marcos del dibujo: el taller los podría confundir con cortes.",
        ],
      },
      {
        titulo: "3. Letras, figuras y puentes",
        lista: [
          "Las partes interiores de letras como A, B, D, O, P, Q y R se caen al cortar: agrega puentes (pequeñas uniones) o usa una tipografía de esténcil.",
          "Los detalles muy delgados se deforman con el calor: dales al menos el grosor de la lámina.",
        ],
      },
      {
        titulo: "4. Agujeros y precisión",
        lista: [
          "Como regla práctica, un agujero no debe ser más chico que el grosor de la lámina; si lo es, puede no salir redondo.",
          "Para agujeros de precisión (tornillería ajustada), pide que los corten más chicos y los taladren después.",
          "El plasma se lleva material (kerf) y deja una ligera inclinación en el borde: si la medida es crítica, indícalo.",
        ],
      },
    ],
    faqs: [
      { p: "¿Qué pasa si mi archivo tiene errores?", r: "Al subirlo en la calculadora te mostramos lo que hay que corregir (contornos abiertos, duplicados, textos, agujeros más chicos que el grosor). Puedes pedir precio igual; la revisión viaja con tu solicitud para que el taller la vea." },
      { p: "¿Cómo pongo puentes en mis letras?", r: "En tu programa de diseño, corta pequeñas uniones entre la parte interior y el resto de la letra, o usa el generador de esténcil de HETNA." },
      { p: "¿En qué grosor me conviene?", r: "Depende del uso. Si no sabes, publica tu trabajo con la descripción y el taller te recomienda el calibre." },
    ],
    enlaces: [
      { href: "/cnc/corte-plasma", texto: "Corte plasma CNC", detalle: "Materiales, usos y talleres" },
      { href: "/disenar/estencil-letras", texto: "Esténcil con puentes", detalle: "Letras listas para plasma" },
      { href: "/disenar/vectorizador", texto: "Vectorizar imagen", detalle: "De JPG/PNG a DXF, gratis" },
      { href: "/cotizar/corte-plasma", texto: "Precio de corte plasma", detalle: "Estimado al instante" },
    ],
  },
]

export const guiaPorSlug = (slug: string) => GUIAS.find((g) => g.slug === slug)
export const ciudadPorSlug = (slug: string) => CIUDADES.find((c) => c.slug === slug)
