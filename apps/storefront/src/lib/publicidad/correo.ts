// Correo al anunciante cuando se confirma su pago (solo servidor): le manda la
// liga de su panel (vistas, clics y renovar). Usa Resend por su API, igual que
// el backend. Si este servidor no tiene RESEND_API_KEY y RESEND_FROM_EMAIL, no
// manda nada: la liga también llega a n8n y aparece en la página de "Gracias".
import { ESPACIOS, esEspacio, nombreCorto } from "./tipos"
import { miles, pesos } from "./precios"

const limpiar = (t: string) => String(t || "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c] as string)

export async function correoPagoAnunciante(p: {
  correo: string
  anunciante: string
  espacio: string
  modalidad: string
  dias: number
  vistas: number | null
  monto: number
  panel: string
}): Promise<boolean> {
  const llave = process.env.RESEND_API_KEY
  const de = process.env.RESEND_FROM_EMAIL
  if (!llave || !de) {
    console.log("[publicidad] correo al anunciante no enviado: falta RESEND_API_KEY o RESEND_FROM_EMAIL en el sitio")
    return false
  }
  const espacio = esEspacio(p.espacio) ? nombreCorto(ESPACIOS[p.espacio].nombre) : p.espacio
  const que = p.modalidad === "vistas" ? `${miles(p.vistas || 0)} vistas` : `${p.dias} días`
  const html = `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1B1B18">
    <h2 style="margin:0 0 12px">¡Recibimos tu pago, ${limpiar(p.anunciante)}!</h2>
    <p>Tu anuncio en <b>${limpiar(espacio)}</b> (${que}, ${pesos(p.monto)}) ya está en revisión. Normalmente lo activamos en menos de 24 horas.</p>
    <p>En tu panel ves el estado, las vistas y los clics de tu anuncio, y puedes renovarlo:</p>
    <p><a href="${p.panel}" style="display:inline-block;background:#C2560A;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Ver mi anuncio</a></p>
    <p style="font-size:12px;color:#6B6A63">Guarda este correo: la liga es personal y no necesita contraseña. No la compartas.</p>
    <p style="font-size:12px;color:#6B6A63">HETNA CNC · hetnacnc.com</p>
  </div>`
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${llave}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: de, to: [p.correo], subject: "Tu anuncio en HETNA CNC: pago recibido", html }),
    })
    if (!r.ok) console.error("[publicidad] correo al anunciante", r.status)
    return r.ok
  } catch (e) {
    console.error("[publicidad] correo al anunciante", e instanceof Error ? e.message : e)
    return false
  }
}
