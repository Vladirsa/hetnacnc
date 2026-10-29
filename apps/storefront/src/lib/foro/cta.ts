// De la duda al servicio: qué ofrecerle a quien lee un tema o un artículo,
// según de qué trata. Reglas simples y a la vista, en orden: la primera que
// coincide con el texto gana el primer lugar; la sección pone la segunda.
//
// Nada de esto se le muestra a quien NO tiene ese problema: si el tema no
// toca ninguna regla y la sección no fabrica nada, no sale ningún botón.

export type Cta = { titulo: string; texto: string; href: string; boton: string }

type Regla = { re: RegExp; cta: Cta }

const REGLAS: Regla[] = [
  {
    re: /\b(pdf|dxf|svg|vectori|dibuj|plano|foto a|imagen a|archivo|corel|illustrator|inkscape)/i,
    cta: {
      titulo: "¿Necesitas el archivo listo para cortar?",
      texto: "Un diseñador de la red te prepara el DXF, SVG o STL y te cotiza el corte junto.",
      href: "/cotizar?necesidad=Dise%C3%B1o",
      boton: "Pedir mi archivo",
    },
  },
  {
    re: /\b(g-?code|postprocesador|post ?procesador|trayectoria|cam\b|fusion|aspire|vcarve|mach3|grbl)/i,
    cta: {
      titulo: "Herramientas CNC gratis",
      texto: "Genera G-code desde un DXF, calcula tiempos y prueba trayectorias en el navegador.",
      href: "/herramientas-cnc",
      boton: "Abrir herramientas",
    },
  },
  {
    re: /\b(quem|chamusc|negr|humo|fresa|broca|rpm|revoluciones|avance|velocidad|par[aá]metro|viruta|vibra|astill)/i,
    cta: {
      titulo: "Parámetros al instante",
      texto: "El Copiloto IA CNC te sugiere velocidades, avances y fresas para tu máquina y material.",
      href: "/servicios/copiloto-ia-cnc",
      boton: "Preguntar al Copiloto",
    },
  },
  {
    re: /\b(cu[aá]nto cobr|cobrar|precio|cotiz|cu[aá]nto cuesta|tarifa|ganancia|margen)/i,
    cta: {
      titulo: "Calcula un precio de referencia",
      texto: "Calculadoras de láser, router, plasma e impresión 3D con rangos reales.",
      href: "/fabricacion#capacidades",
      boton: "Ver calculadoras",
    },
  },
]

// Sección del foro → qué se puede mandar a fabricar y dónde están sus talleres.
const POR_SECCION: Record<string, { servicio: string; categoria: string; proceso: string }> = {
  "router-cnc": { servicio: "Corte CNC", categoria: "router-cnc", proceso: "router CNC" },
  "corte-laser": { servicio: "Corte láser", categoria: "corte-laser", proceso: "corte láser" },
  plasma: { servicio: "Corte plasma", categoria: "corte-plasma", proceso: "corte plasma" },
  "torno-fresadora": { servicio: "Maquinado", categoria: "maquinado-cnc", proceso: "maquinado CNC" },
  "impresion-3d": { servicio: "Impresión 3D", categoria: "impresion-3d", proceso: "impresión 3D" },
  "diseno-cam": { servicio: "Diseño CAD/CAM", categoria: "diseno-2d-3d", proceso: "diseño CAD/CAM" },
}

export function ctasPara(seccion: string, texto: string): Cta[] {
  const out: Cta[] = []
  const regla = REGLAS.find((r) => r.re.test(texto))
  if (regla) out.push(regla.cta)
  const s = POR_SECCION[seccion]
  if (s) {
    out.push({
      titulo: "¿Prefieres que te lo hagan?",
      texto: `Talleres de ${s.proceso} te mandan precio y tiempo. Sube tu archivo o describe la pieza.`,
      href: `/cotizar?servicio=${encodeURIComponent(s.servicio)}`,
      boton: "Pedir cotización",
    })
  }
  return out.slice(0, 2)
}

// "Ver talleres que hacen esto" para la sección, si fabrica algo.
export const talleresDeSeccion = (seccion: string) =>
  POR_SECCION[seccion] ? { href: `/categories/${POR_SECCION[seccion].categoria}`, proceso: POR_SECCION[seccion].proceso } : null
