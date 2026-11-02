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

export const CONTENIDO_CATEGORIAS: Record<string, ContenidoCategoria> = {}

export const contenidoCategoria = (handle: string): ContenidoCategoria | undefined =>
  CONTENIDO_CATEGORIAS[handle]
