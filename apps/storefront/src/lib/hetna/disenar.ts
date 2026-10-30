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

export const ESCANEAR = "escanear-pieza"

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
    slug: ESCANEAR,
    nombre: "Escaneo 3D de piezas",
    texto: "Vista previa gratis; el escaneo que mide de verdad se paga con créditos.",
    icono: "escaneo",
    acceso: "creditos",
    titulo: "Escaneo 3D de piezas con fotos: de la pieza al modelo STL",
    descripcion:
      "Toma fotos de una pieza que ya existe y recibe su modelo 3D. Vista previa gratis; el escaneo con medidas reales se paga con créditos y queda guardado en tu perfil.",
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
