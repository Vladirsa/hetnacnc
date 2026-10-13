// Avisa a n8n cuando hay un mensaje nuevo, para que n8n lo mande por WhatsApp/correo.
// Variables en el servidor: N8N_CHAT_URL (la dirección del webhook) y N8N_REDES_TOKEN (la clave compartida).
// Si N8N_CHAT_URL no existe, simplemente no avisa (el chat sigue funcionando).

export type AvisoChat =
  | { tipo: "mensaje_a_taller"; tallerId: string; tallerHandle: string; tallerNombre: string; clienteNombre: string; producto?: string; vistaPrevia: string; url: string }
  | { tipo: "respuesta_a_cliente"; clienteCorreo: string; clienteNombre: string; tallerNombre: string; vistaPrevia: string; url: string }
  | { tipo: "moderacion"; autor: string; intentos: number; motivos: string[]; conversacionId: string | null }

export async function avisarChat(a: AvisoChat) {
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
