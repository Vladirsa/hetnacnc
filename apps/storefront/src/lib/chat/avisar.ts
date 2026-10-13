// Avisa a n8n cuando hay un mensaje nuevo, para que n8n lo mande por WhatsApp/correo AL TALLER.
// Variables en el servidor: N8N_CHAT_URL (la dirección del webhook) y N8N_REDES_TOKEN (la clave compartida).
// Si N8N_CHAT_URL no existe, simplemente no avisa (el chat sigue funcionando).
//
// DECISIÓN DE NEGOCIO: al CLIENTE no se le manda correo ni WhatsApp cuando el taller responde.
// El cliente se entera por la campanita del sitio (contador de mensajes sin leer).

export type AvisoChat =
  | { tipo: "mensaje_a_taller"; tallerId: string; tallerHandle: string; tallerNombre: string; clienteNombre: string; producto?: string; vistaPrevia: string; url: string }
  | { tipo: "respuesta_a_cliente"; clienteCorreo: string; clienteNombre: string; tallerNombre: string; vistaPrevia: string; url: string }
  | { tipo: "moderacion"; autor: string; intentos: number; motivos: string[]; conversacionId: string | null }

export async function avisarChat(a: AvisoChat) {
  // Al cliente solo se le avisa dentro del sitio (campanita), nunca por fuera.
  if (a.tipo === "respuesta_a_cliente") return

  const url = process.env.N8N_CHAT_URL
  if (!url) return
  try {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), 8000)
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-hetna-token": process.env.N8N_REDES_TOKEN || "" },
      body: JSON.stringify(a),
      signal: ctl.signal,
    })
    clearTimeout(t)
  } catch (e) {
    console.warn("[chat] no se pudo avisar a n8n:", (e as Error).message)
  }
}
