// Tipos y textos del chat (se pueden usar en el navegador y en el servidor).

export type Autor = "cliente" | "taller"

export type Mensaje = { id: number; de: Autor; cuerpo: string; creado: string }

export type Conversacion = {
  id: string
  tallerHandle: string
  tallerNombre: string
  clienteNombre: string
  productoHandle: string | null
  productoTitulo: string | null
  estado: "abierta" | "cerrada"
  sinLeer: number
  ultimoMensaje: string
  ultimo: string // vista previa del último mensaje
}

// Mensajes de error que ve la persona (las claves las manda el servidor)
export const ERRORES: Record<string, string> = {
  sin_sesion: "Inicia sesión para escribir al taller.",
  sin_chat: "El chat se está activando. Inténtalo en unos minutos.",
  taller_no_existe: "No encontramos ese taller.",
  conversacion_no_existe: "Esta conversación no existe o no tienes acceso.",
  conversacion_cerrada: "Esta conversación está cerrada.",
  mensaje_vacio: "Escribe tu mensaje.",
  demasiados: "Estás enviando muchos mensajes. Espera un poco e inténtalo de nuevo.",
  error: "No se pudo enviar. Inténtalo de nuevo.",
}

// Explicación amable cuando el filtro bloquea un mensaje
export const EXPLICACION_BLOQUEO: Record<string, string> = {
  telefono: "números de teléfono",
  correo: "correos electrónicos",
  red_social: "redes sociales o apps de mensajería",
  enlace: "enlaces externos",
  frase_contacto: "pedir o dar datos de contacto",
}
