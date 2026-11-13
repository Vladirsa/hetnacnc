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
}

export type Ciudad = { slug: string; nombre: string; estado: string; alias: string[] }

// Ciudades con más demanda de corte láser. El estado decide qué talleres son "locales".
export const CIUDADES: Ciudad[] = [
  { slug: "cdmx", nombre: "Ciudad de México", estado: "Ciudad de México", alias: ["ciudad de mexico", "cdmx", "df", "distrito federal"] },
  { slug: "guadalajara", nombre: "Guadalajara", estado: "Jalisco", alias: ["jalisco", "guadalajara"] },
  { slug: "monterrey", nombre: "Monterrey", estado: "Nuevo León", alias: ["nuevo leon", "monterrey"] },
  { slug: "puebla", nombre: "Puebla", estado: "Puebla", alias: ["puebla"] },
  { slug: "queretaro", nombre: "Querétaro", estado: "Querétaro", alias: ["queretaro"] },
  { slug: "tlaxcala", nombre: "Tlaxcala y Apizaco", estado: "Tlaxcala", alias: ["tlaxcala", "apizaco"] },
  { slug: "toluca", nombre: "Toluca", estado: "Estado de México", alias: ["estado de mexico", "edomex", "toluca", "mexico"] },
  { slug: "leon", nombre: "León", estado: "Guanajuato", alias: ["guanajuato", "leon"] },
]

const normal = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim()

/** ¿El taller está en el estado de esa ciudad? */
export const enCiudad = (c: Ciudad, estado?: string, ciudad?: string) => {
  const e = normal(estado || "")
  const ci = normal(ciudad || "")
  if (c.slug === "toluca" && e.includes("ciudad de mexico")) return false
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
]

export const guiaPorSlug = (slug: string) => GUIAS.find((g) => g.slug === slug)
export const ciudadPorSlug = (slug: string) => CIUDADES.find((c) => c.slug === slug)
