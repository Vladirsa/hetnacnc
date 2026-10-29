// Tipos y catálogos del Foro CNC México (se usan en servidor y navegador)

export const TIPOS_CUENTA = {
  taller: { nombre: "Taller", descripcion: "Fabricas piezas o das servicio de corte y maquinado" },
  proveedor: { nombre: "Proveedor", descripcion: "Vendes máquinas, herramientas, refacciones o material" },
  marca: { nombre: "Marca", descripcion: "Fabricante o distribuidor oficial de una marca" },
  profesional: { nombre: "Profesional", descripcion: "Operador, diseñador, programador CAM o técnico" },
  cliente: { nombre: "Cliente", descripcion: "Buscas quién te fabrique piezas o proyectos" },
  aficionado: { nombre: "Aficionado", descripcion: "Aprendes o tienes una máquina por gusto" },
} as const
export type TipoCuenta = keyof typeof TIPOS_CUENTA
export const esTipoCuenta = (v: unknown): v is TipoCuenta => typeof v === "string" && v in TIPOS_CUENTA
export const ES_NEGOCIO: TipoCuenta[] = ["taller", "proveedor", "marca"]

export const TIPOS_TEMA = {
  pregunta: { nombre: "Pregunta", ayuda: "Tienes una duda o un problema con tu máquina" },
  debate: { nombre: "Debate", ayuda: "Quieres opiniones; puedes agregar una encuesta" },
  trabajo: { nombre: "Trabajo", ayuda: "Muestras una pieza terminada y cómo la hiciste" },
  video: { nombre: "Video", ayuda: "Compartes un video de YouTube, TikTok o Facebook" },
  novedad: { nombre: "Novedad", ayuda: "Producto, servicio o promoción (solo negocios)" },
  busco: { nombre: "Busco maquinado", ayuda: "Necesitas que un taller te haga una pieza o un trabajo" },
  ofrezco: { nombre: "Ofrezco capacidad", ayuda: "Tienes horas libres de máquina (solo talleres)" },
} as const
export type TipoTema = keyof typeof TIPOS_TEMA
export const esTipoTema = (v: unknown): v is TipoTema => typeof v === "string" && v in TIPOS_TEMA

export const REDES = {
  facebook: { nombre: "Facebook", dominios: ["facebook.com", "fb.com", "fb.me"] },
  instagram: { nombre: "Instagram", dominios: ["instagram.com"] },
  tiktok: { nombre: "TikTok", dominios: ["tiktok.com"] },
  youtube: { nombre: "YouTube", dominios: ["youtube.com", "youtu.be"] },
  x: { nombre: "X", dominios: ["x.com", "twitter.com"] },
  linkedin: { nombre: "LinkedIn", dominios: ["linkedin.com"] },
  web: { nombre: "Página web", dominios: [] as string[] },
} as const
export type Red = keyof typeof REDES

export const ESTADOS_MX = [
  "Aguascalientes", "Baja California", "Baja California Sur", "Campeche", "Chiapas", "Chihuahua",
  "Ciudad de México", "Coahuila", "Colima", "Durango", "Estado de México", "Guanajuato", "Guerrero",
  "Hidalgo", "Jalisco", "Michoacán", "Morelos", "Nayarit", "Nuevo León", "Oaxaca", "Puebla", "Querétaro",
  "Quintana Roo", "San Luis Potosí", "Sinaloa", "Sonora", "Tabasco", "Tamaulipas", "Tlaxcala", "Veracruz",
  "Yucatán", "Zacatecas", "Fuera de México",
]

export type Seccion = {
  id: number
  slug: string
  nombre: string
  descripcion: string
  soloNegocios: boolean
  temas: number
  ultima: string | null
}

// Taller del directorio de HETNA al que está ligado un perfil del foro (ver
// vincularMiTaller). Con él se enseña "Taller verificado" y la liga a su perfil.
export type TallerLigado = { handle: string; nombre: string; verificado: boolean }

export type Autor = {
  id: string
  usuario: string
  nombre: string
  tipo: TipoCuenta
  verificado: boolean
  reputacion: number
  foto: string | null
  taller: TallerLigado | null
}

export type TemaResumen = {
  id: number
  seccion: { slug: string; nombre: string }
  tipo: TipoTema
  titulo: string
  slug: string
  extracto: string
  votos: number
  respuestas: number
  vistas: number
  fijado: boolean
  patrocinado: boolean
  resuelto: boolean
  video: boolean
  foto: string | null
  estado: "publicado" | "revision" | "oculto"
  creado: string
  ultimaActividad: string
  autor: Autor
}

export type Encuesta = { pregunta: string; opciones: string[] }

export type Tema = TemaResumen & {
  cuerpo: string
  ligas: string[]
  fotos: string[]
  encuesta: Encuesta | null
  resultados: number[]
  mejorRespuestaId: number | null
  actualizado: string
}

export type Respuesta = {
  id: number
  padreId: number | null
  cuerpo: string
  fotos: string[]
  votos: number
  estado: "publicado" | "revision" | "oculto"
  creado: string
  autor: Autor
}

export type Perfil = Autor & {
  bio: string
  ciudad: string
  estadoMx: string
  redes: Partial<Record<Red, string>>
  maquinas: string[]
  software: string[]
  rol: "usuario" | "moderador" | "admin"
  suspendido: boolean
  vendedor: string | null
  creado: string
  temas: number
  respuestas: number
  mejores: number
}

export type MisVotos = { tema: boolean; respuestas: number[]; encuesta: number | null }

// Dirección pública de un tema y de un perfil (sin el /mx, lo agrega LocalizedClientLink)
export const urlTema = (t: { seccion: { slug: string } | string; slug: string }) =>
  `/foro-cnc/${typeof t.seccion === "string" ? t.seccion : t.seccion.slug}/${t.slug}`
export const urlPerfil = (usuario: string) => `/foro-cnc/perfil/${usuario}`
export const urlFoto = (id: string) => `/api/foro/foto/${id}`

// Errores que devuelve la base -> mensaje para la persona
export const MENSAJES: Record<string, string> = {
  sin_sesion: "Inicia sesión o crea tu cuenta gratis para participar.",
  sin_perfil: "Primero crea tu perfil del foro.",
  perfil_suspendido: "Tu cuenta del foro está suspendida. Escríbenos si crees que es un error.",
  solo_negocios: "Esta sección es solo para talleres, proveedores y marcas.",
  limite_diario: "Llegaste al límite de publicaciones de hoy. Intenta mañana.",
  tema_no_existe: "Este tema ya no existe o está en revisión.",
  respuesta_no_existe: "La respuesta ya no existe.",
  seccion_no_existe: "Elige una sección.",
  usuario_ocupado: "Ese nombre de usuario ya está ocupado. Prueba otro.",
  solo_el_autor: "Solo quien publicó el tema puede elegir la mejor respuesta.",
  opcion_invalida: "Elige una opción de la encuesta.",
  sin_foro: "El foro abre muy pronto.",
  tipo_no_activo: "Este tipo de publicación todavía no está activo. Elige otro.",
  sin_taller: "No encontramos un taller registrado con el correo de tu cuenta.",
  error: "Algo salió mal. Intenta de nuevo.",
}

// Dirección completa del sitio (para ligas canónicas, datos estructurados y el mapa del sitio)
export const SITIO = (process.env.NEXT_PUBLIC_BASE_URL || "https://hetnacnc.com").replace(/\/$/, "")
