// Tipos y configuración de los espacios publicitarios de HETNA CNC.
// Este archivo NO toca la base de datos: lo pueden usar tanto el servidor como el navegador.

export type EspacioId =
  | "carrusel_principal"
  | "banner_promo"
  | "franja_inicio"
  | "banner_herramientas"
  | "foro_lateral"
  | "categorias_lateral"

export type ConfigEspacio = {
  nombre: string // nombre que ve el administrador
  medidas: string // medidas recomendadas de la imagen
  anchoMax: number // ancho máximo (px) al comprimir la imagen
  max: number // cuántos anuncios caben a la vez
  ratio: string // proporción de la caja (CSS aspect-ratio)
  publicidad: boolean // ¿normalmente es publicidad de terceros?
  ayuda: string
}

export const ESPACIOS: Record<EspacioId, ConfigEspacio> = {
  carrusel_principal: {
    nombre: "Carrusel principal del inicio",
    medidas: "1920 × 700 px (opcional para celular: 800 × 900 px)",
    anchoMax: 1920,
    max: 8,
    ratio: "1920 / 700",
    publicidad: false,
    ayuda:
      "Las imágenes grandes de arriba en la página de inicio. Si activas al menos una aquí, reemplazan las diapositivas de texto actuales.",
  },
  banner_promo: {
    nombre: "Banner promocional (2 tarjetas)",
    medidas: "1200 × 600 px",
    anchoMax: 1200,
    max: 2,
    ratio: "2 / 1",
    publicidad: false,
    ayuda:
      "Dos tarjetas debajo de la barra de confianza. Orden 1 = izquierda, orden 2 = derecha. Si falta una, se muestra la tarjeta de siempre.",
  },
  franja_inicio: {
    nombre: "Publicidad: franja del inicio",
    medidas: "1200 × 300 px",
    anchoMax: 1200,
    max: 2,
    ratio: "4 / 1",
    publicidad: true,
    ayuda: "Franja de publicidad debajo de las tarjetas promocionales. Ideal para anunciantes de pago.",
  },
  banner_herramientas: {
    nombre: "Banner de herramientas",
    medidas: "1920 × 800 px",
    anchoMax: 1920,
    max: 1,
    ratio: "12 / 5",
    publicidad: false,
    ayuda:
      "Imagen de fondo del bloque de herramientas CNC. Si dejas título, subtítulo o botón vacíos, se conservan los textos de siempre.",
  },
  foro_lateral: {
    nombre: "Publicidad: columna derecha del foro",
    medidas: "600 × 500 px",
    anchoMax: 700,
    max: 3,
    ratio: "6 / 5",
    publicidad: true,
    ayuda: "Aparece en la columna derecha del foro, debajo de la Calculadora CNC.",
  },
  categorias_lateral: {
    nombre: "Publicidad: categorías",
    medidas: "970 × 250 px",
    anchoMax: 1000,
    max: 2,
    ratio: "970 / 250",
    publicidad: true,
    ayuda: "Banner horizontal arriba del listado de productos de cada categoría.",
  },
}

export const ORDEN_ESPACIOS: EspacioId[] = [
  "carrusel_principal",
  "banner_promo",
  "franja_inicio",
  "banner_herramientas",
  "foro_lateral",
  "categorias_lateral",
]

export const esEspacio = (v: string): v is EspacioId => Object.prototype.hasOwnProperty.call(ESPACIOS, v)

// Una pieza = un anuncio o banner guardado en la base de datos.
export type Pieza = {
  id: string
  espacio: string
  titulo: string
  subtitulo: string | null
  boton: string | null
  enlace: string
  imagen_url: string | null
  imagen_movil_url: string | null
  video_url: string | null
  anunciante: string | null
  es_publicidad: boolean
  orden: number
  desde: string
  hasta: string | null
  activo: boolean
  vistas: number
  clics: number
  creado: string
}

// Lo que envía el panel al guardar.
export type DatosPieza = {
  id?: string
  espacio: string
  titulo: string
  subtitulo: string
  boton: string
  enlace: string
  imagen_url: string
  imagen_movil_url: string
  video_url: string
  anunciante: string
  es_publicidad: boolean
  orden: number
  desde: string // fecha ISO o vacío (= ahora)
  hasta: string // fecha ISO o vacío (= sin fin)
  activo: boolean
}
