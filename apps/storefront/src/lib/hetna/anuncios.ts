// Anuncios del espacio Diseñar (talleres y proveedores que pagan por salir
// frente a quien está diseñando). Por ahora es una lista fija; cuando exista el
// panel de publicidad, de aquí se leerán los anuncios activos con su imagen.
//
// Para probar uno, agrega un objeto a ANUNCIOS y sube la imagen (JPG/PNG/WEBP,
// 800 × 450) a apps/storefront/public/img/anuncios/.

export type Anuncio = {
  id: string
  nombre: string // "Láser Maker Apizaco"
  detalle?: string // "Corte láser y router · ★ 4.9"
  texto: string // una o dos líneas
  imagen?: string // "/img/anuncios/laser-maker.jpg"
  href: string // a dónde lleva el botón (perfil del taller, tienda, cotizar)
  boton?: string // "Cotizar aquí"
}

export const ANUNCIOS: Anuncio[] = []
