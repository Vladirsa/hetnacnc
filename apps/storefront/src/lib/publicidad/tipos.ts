// Tipos y configuración de los espacios publicitarios de HETNA CNC.
// Este archivo NO toca la base de datos: lo pueden usar tanto el servidor como el navegador.

export type EspacioId =
  | "carrusel_principal"
  | "banner_promo"
  | "franja_inicio"
  | "banner_herramientas"
  | "foro_lateral"
  | "categorias_lateral"
  | "vista_whatsapp"
  | "ficha_producto"
  | "ficha_lateral"
  | "tienda_banner"
  | "listado_productos"
  | "directorio_talleres"
  | "cotizar_disenar"

export type ConfigEspacio = {
  nombre: string // nombre que ve el administrador
  medidas: string // medidas recomendadas de la imagen
  anchoMax: number // ancho máximo (px) al comprimir la imagen
  max: number // cuántos anuncios caben a la vez
  ratio: string // proporción de la caja (CSS aspect-ratio)
  publicidad: boolean // ¿normalmente es publicidad de terceros?
  ayuda: string
  donde: string // lo que lee el anunciante en /anunciate: dónde sale y quién lo ve
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
    donde: "Lo primero que se ve en la página de inicio, en computadora y celular.",
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
    donde: "Dos tarjetas grandes en el inicio, justo debajo del carrusel.",
  },
  franja_inicio: {
    nombre: "Publicidad: franja del inicio",
    medidas: "1200 × 300 px",
    anchoMax: 1200,
    max: 2,
    ratio: "4 / 1",
    publicidad: true,
    ayuda: "Franja de publicidad debajo de las tarjetas promocionales. Ideal para anunciantes de pago.",
    donde: "Franja ancha en el inicio, debajo de las tarjetas promocionales.",
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
    donde: "Fondo del bloque de herramientas CNC del inicio.",
  },
  foro_lateral: {
    nombre: "Publicidad: columna derecha del foro",
    medidas: "600 × 500 px",
    anchoMax: 700,
    max: 3,
    ratio: "6 / 5",
    publicidad: true,
    ayuda: "Aparece en la columna derecha del foro, debajo de la Calculadora CNC.",
    donde: "Columna derecha del Foro CNC, donde operadores y talleres preguntan y responden.",
  },
  categorias_lateral: {
    nombre: "Publicidad: categorías",
    medidas: "970 × 250 px",
    anchoMax: 1000,
    max: 2,
    ratio: "970 / 250",
    publicidad: true,
    ayuda: "Banner horizontal arriba del listado de productos de cada categoría.",
    donde: "Arriba de los productos de cada categoría.",
  },
  vista_whatsapp: {
    nombre: "Publicidad: vista previa en WhatsApp",
    medidas: "1200 × 630 px",
    anchoMax: 1200,
    max: 6,
    ratio: "1200 / 630",
    publicidad: true,
    ayuda:
      "La imagen grande que sale cuando el WhatsApp de HETNA manda la liga de «Solicitar cotización». Si hay varias, se turnan en cada mensaje. Sin ninguna, sale la imagen de HETNA de siempre. Deja lo importante al centro: WhatsApp recorta un poco las orillas.",
    donde: "La imagen que sale cuando HETNA manda por WhatsApp la liga para pedir cotización.",
  },
  // ---- Publicidad 2.0: donde está la gente que compra ----
  ficha_producto: {
    nombre: "Publicidad: ficha de producto",
    medidas: "800 × 450 px",
    anchoMax: 900,
    max: 2,
    ratio: "16 / 9",
    publicidad: true,
    ayuda: "Tarjeta en la columna de compra de cada producto, debajo del vendedor. Buena para talleres que fabrican o proveedores de material.",
    donde: "En la ficha de cada producto, junto al botón de compra: lo ve quien ya está decidido a comprar.",
  },
  // Pedido de Vlado (23 nov 2026): el hueco bajo "Fabrícalo" en la columna
  // izquierda de la ficha. Franja ancha y baja para no empujar las pestañas.
  ficha_lateral: {
    nombre: "Publicidad: ficha de producto (columna izquierda)",
    medidas: "1200 × 300 px",
    anchoMax: 1200,
    max: 1,
    ratio: "4 / 1",
    publicidad: true,
    ayuda: "Franja en la columna izquierda de cada producto, debajo de «Fabrícalo con un taller». Solo en computadora.",
    donde: "En la ficha de cada producto, debajo de «Fabrícalo con un taller»: lo ve quien está por comprar o mandar a fabricar.",
  },
  tienda_banner: {
    nombre: "Publicidad: tienda",
    medidas: "1200 × 300 px",
    anchoMax: 1200,
    max: 2,
    ratio: "4 / 1",
    publicidad: true,
    ayuda: "Franja en /tienda, debajo de las categorías.",
    donde: "En la Tienda (¿Qué necesitas hoy?), debajo de las categorías.",
  },
  listado_productos: {
    nombre: "Publicidad: lista de todos los productos y búsqueda",
    medidas: "970 × 250 px",
    anchoMax: 1000,
    max: 2,
    ratio: "970 / 250",
    publicidad: true,
    ayuda: "Banner arriba de Todos los productos y de los resultados de búsqueda.",
    donde: "Arriba de Todos los productos y de los resultados de búsqueda.",
  },
  directorio_talleres: {
    nombre: "Taller destacado (directorio)",
    medidas: "800 × 450 px",
    anchoMax: 900,
    max: 3,
    ratio: "16 / 9",
    publicidad: true,
    ayuda: "Tarjetas arriba del directorio de talleres. Para talleres: el enlace debe llevar a su perfil en HETNA.",
    donde: "Hasta arriba del directorio de talleres, donde los clientes eligen a quién pedirle su pieza.",
  },
  cotizar_disenar: {
    nombre: "Publicidad: cotizar y diseñar",
    medidas: "800 × 450 px",
    anchoMax: 900,
    max: 3,
    ratio: "16 / 9",
    publicidad: true,
    ayuda: "Tarjetas en la columna de Cotizar y en las herramientas de Diseñar (cajas, letras, celosías).",
    donde: "Junto al cotizador y a las herramientas de diseño: lo ve quien está por mandar a fabricar.",
  },
}

export const ORDEN_ESPACIOS: EspacioId[] = [
  "carrusel_principal",
  "banner_promo",
  "franja_inicio",
  "banner_herramientas",
  "foro_lateral",
  "categorias_lateral",
  "ficha_producto",
  "ficha_lateral",
  "directorio_talleres",
  "cotizar_disenar",
  "tienda_banner",
  "listado_productos",
  "vista_whatsapp",
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
  // Publicidad 2.0 (pueden faltar en filas viejas)
  vistas_objetivo?: number | null
  tipo_anunciante?: string | null
  pedido_id?: string | null
}

// Quién se anuncia. Las marcas de otro giro (Telcel, un banco, un refresco)
// pueden ligar a su propia página; los talleres y proveedores CNC sólo ligan
// dentro de HETNA (regla: todo negocio CNC se hace dentro de la plataforma).
export type TipoAnunciante = "cnc" | "marca"
export const TIPOS_ANUNCIANTE: Record<TipoAnunciante, { nombre: string; ayuda: string }> = {
  cnc: {
    nombre: "Taller o proveedor CNC",
    ayuda: "Tu anuncio lleva a tu perfil, tus productos o tu taller dentro de HETNA.",
  },
  marca: {
    nombre: "Marca de otro giro",
    ayuda: "Telefonía, bancos, refrescos, seguros… Tu anuncio puede llevar a tu propia página.",
  },
}

/** ¿El enlace lleva a una página de HETNA? (/ruta o https://hetnacnc.com/...) */
export const enlaceInterno = (v: string) => /^\/(?!\/)/.test(v) || /^https:\/\/(www\.)?hetnacnc\.com(\/|$)/i.test(v)

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

/** Nombre del espacio para el anunciante, sin el "Publicidad: " del panel ("Franja del inicio"). */
export const nombreCorto = (nombre: string) => {
  const t = nombre.replace(/^Publicidad: /, "")
  return t.charAt(0).toUpperCase() + t.slice(1)
}
