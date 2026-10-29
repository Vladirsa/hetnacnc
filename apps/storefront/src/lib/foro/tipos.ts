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
  vacante: { nombre: "Vacante", ayuda: "Buscas operador, programador CAM, diseñador o ayudante (solo negocios)" },
  evento: { nombre: "Evento", ayuda: "Expo, curso o reunión con fecha y lugar" },
} as const
// Tipos que sólo publican talleres, proveedores y marcas (lo vuelve a revisar la base)
export const TIPOS_NEGOCIO: TipoTema[] = ["novedad", "ofrezco", "vacante"]
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
export type TallerLigado = { id?: string; handle: string; nombre: string; verificado: boolean }

export type Autor = {
  id: string
  usuario: string
  nombre: string
  tipo: TipoCuenta
  verificado: boolean
  reputacion: number
  foto: string | null
  taller: TallerLigado | null
  // Titular profesional, como las credenciales de Quora ("Programador CAM · 8 años")
  titular: string
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
  evento: Evento | null
  autor: Autor
}

// Datos de un tema de tipo "evento"
export type Evento = {
  inicio: string // fecha y hora local de México, "2026-11-20T10:00"
  fin: string
  modalidad: "presencial" | "en_linea"
  lugar: string // dirección o ciudad; en línea, la plataforma
  liga: string // registro o transmisión
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

// ---------------------------------------------------------------------
// Red profesional: currículum, seguir, avales y recomendaciones
// ---------------------------------------------------------------------

export const TIPOS_TRAYECTORIA = {
  experiencia: "Experiencia",
  educacion: "Estudios",
  certificacion: "Certificaciones y cursos",
  proyecto: "Proyectos",
} as const
export type TipoTrayectoria = keyof typeof TIPOS_TRAYECTORIA
export type Paso = { tipo: TipoTrayectoria; titulo: string; lugar: string; desde: string; hasta: string; detalle: string }

export const RELACIONES = {
  cliente: "Fue su cliente",
  proveedor: "Le compra o le vende",
  companero: "Trabajaron juntos",
  jefe: "Fue su jefe o encargado",
  alumno: "Le enseñó o aprendió con él",
  otro: "Otro",
} as const
export type Relacion = keyof typeof RELACIONES

export const MAX_APTITUDES = 15
export const MAX_PASOS = 15

// Lo que se sigue: una persona (p:), un taller del directorio (t:) o una sección (s:).
// Un perfil ligado a un taller se sigue como el taller: así seguir a la
// persona o al mini-sitio es lo mismo y se cuenta una sola vez.
export const objetivoPerfil = (p: { id: string; vendedor?: string | null }) =>
  p.vendedor ? `t:${p.vendedor}` : `p:${p.id}`
export const objetivoTaller = (vendedorId: string) => `t:${vendedorId}`
export const objetivoSeccion = (slug: string) => `s:${slug}`
export const esObjetivo = (v: unknown): v is string =>
  typeof v === "string" && /^(p:[0-9a-f-]{36}|t:[A-Za-z0-9_]{3,60}|s:[a-z0-9-]{2,60})$/.test(v)

export type Aval = { aptitud: string; n: number; yo: boolean }
export type Recomendacion = {
  id: number
  relacion: Relacion
  texto: string
  estado: "pendiente" | "publicada" | "oculta"
  creado: string
  autor: Autor
}
export type Postulacion = { mensaje: string; creado: string; autor: Autor & { ciudad: string; estadoMx: string } }

export const CORREO_AVISOS = {
  al_momento: "Al momento (agrupados cada 10 minutos)",
  diario: "Un resumen al día",
  nunca: "No mandarme correos de avisos",
} as const
export type CorreoAvisos = keyof typeof CORREO_AVISOS

export type TipoAviso =
  | "seguidor" | "respuesta" | "mejor" | "aval" | "recomendacion" | "postulacion"
  | "solicitud" | "mensaje" | "evento" | "tema_seguido"
export type Aviso = { id: number; tipo: TipoAviso; texto: string; url: string; leido: boolean; creado: string; actor: Autor | null }

export type Contadores = { avisos: number; mensajes: number }

export const urlAvisos = "/foro-cnc/avisos"
export const urlMensajes = "/foro-cnc/mensajes"
export const urlConversacion = (usuario: string) => `/foro-cnc/mensajes/${usuario}`
export const urlEventos = "/foro-cnc/eventos"
export const urlResponder = "/foro-cnc/responder"
export const SECCION_EVENTOS = "eventos"
export const urlRed = "/foro-cnc/red"
export const urlEmpleos = "/foro-cnc/empleos"
export const SECCION_EMPLEOS = "empleos-proyectos"

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
  aptitudes: string[]
  trayectoria: Paso[]
  abierto: boolean
  correoAvisos: CorreoAvisos
  resumenSemanal: boolean
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
  red_no_activa: "La red todavía no está activa. Intenta más tarde.",
  a_ti_mismo: "Eso no se puede hacer con tu propio perfil.",
  no_existe: "Ya no existe.",
  no_es_vacante: "Sólo te puedes postular a una vacante.",
  ya_postulado: "Ya te postulaste a esta vacante.",
  bloqueado: "Esta persona no recibe mensajes tuyos.",
  mensaje_spam: "Tu mensaje parece publicidad o spam. Escríbelo de otra forma.",
  no_es_evento: "Esto no es un evento.",
  ya_pedido: "Ya le pediste a esta persona que responda.",
  error: "Algo salió mal. Intenta de nuevo.",
}

// Dirección completa del sitio (para ligas canónicas, datos estructurados y el mapa del sitio)
export const SITIO = (process.env.NEXT_PUBLIC_BASE_URL || "https://hetnacnc.com").replace(/\/$/, "")
