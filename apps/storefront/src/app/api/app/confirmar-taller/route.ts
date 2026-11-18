// Liga "confirma tu correo" del taller (packages/api/src/lib/alta-taller.ts).
// Vive en /api/app/ porque nginx manda /api/v... a otro servicio.
//   GET  -> pinta la página con el botón "Confirmar mi correo" (no cambia nada:
//           los antivirus del correo abren las ligas solos)
//   POST -> confirma (formulario de esta misma página)
// La firma de la liga es la que autoriza; la API la valida en los dos pasos.
import { eventoSocial } from "@/lib/hetna/social-evento"

const API = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
const PANEL = (process.env.NEXT_PUBLIC_VENDOR_URL || "/seller").replace(/\/$/, "")

export const dynamic = "force-dynamic"

type Datos = { ok?: boolean; ya?: boolean; aprobado?: boolean }

const esc = (v: unknown) =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

const BOTON = "display:block;width:100%;box-sizing:border-box;text-align:center;background:#C2560A;color:#fff;text-decoration:none;border:0;padding:14px 20px;border-radius:10px;font-weight:700;font-size:16px;font-family:inherit;cursor:pointer"

const marco = (titulo: string, cuerpo: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(titulo)} · HETNA CNC</title></head>
<body style="margin:0;padding:0 16px;font-family:Arial,Helvetica,sans-serif;background:#FAF9F6;color:#142033">
<div style="max-width:480px;margin:10vh auto;padding:28px;box-sizing:border-box;background:#fff;border:1px solid #E7E4DC;border-radius:16px">
${cuerpo}
</div></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
  )

const alPanel = `<a href="${esc(PANEL)}" style="${BOTON}">Ir a mi panel de taller</a>`

const ligaMala = () =>
  marco(
    "Liga no válida",
    `<p style="font-size:40px;margin:0 0 8px">⚠️</p>
<p style="font-weight:700;font-size:20px;margin:0 0 8px">Esta liga ya no sirve</p>
<p style="margin:0 0 20px;line-height:1.5">La liga venció o está incompleta. Entra a tu panel de taller y, en Mi tablero, pide una nueva.</p>
${alPanel}`,
    400
  )

const sinServicio = () =>
  marco("Error", `<p style="margin:0;line-height:1.5">No pudimos confirmar tu correo en este momento. Intenta de nuevo en unos minutos.</p>`, 503)

const listo = (aprobado: boolean) =>
  marco(
    "Correo confirmado",
    `<p style="font-size:40px;margin:0 0 8px">✅</p>
<p style="font-weight:700;font-size:20px;margin:0 0 8px">¡Listo, tu correo quedó confirmado!</p>
<p style="margin:0 0 20px;line-height:1.5">${
      aprobado
        ? "Tu tienda ya está aprobada: ya puedes publicar tus productos."
        : "Ahora revisamos tu taller. Te avisamos por correo en cuanto lo aprobemos (normalmente en menos de un día hábil). Mientras tanto puedes completar tu perfil."
    }</p>
${alPanel}`
  )

export async function GET(req: Request) {
  const url = new URL(req.url)
  let d: Datos = {}
  try {
    const r = await fetch(`${API}/hooks/alta-taller/confirmar${url.search}`, { cache: "no-store" })
    if (!r.ok) return r.status >= 500 ? sinServicio() : ligaMala()
    d = (await r.json().catch(() => ({}))) as Datos
  } catch {
    return sinServicio()
  }
  if (d.ya) return listo(Boolean(d.aprobado))
  const s = url.searchParams
  return marco(
    "Confirma tu correo",
    `<p style="font-size:40px;margin:0 0 8px">✉️</p>
<p style="font-weight:700;font-size:20px;margin:0 0 8px">Un paso más: confirma tu correo</p>
<p style="margin:0 0 20px;line-height:1.5">Presiona el botón para activar tu taller en HETNA CNC.</p>
<form method="post">
<input type="hidden" name="s" value="${esc(s.get("s"))}"><input type="hidden" name="e" value="${esc(s.get("e"))}"><input type="hidden" name="t" value="${esc(s.get("t"))}">
<button type="submit" style="${BOTON}">Confirmar mi correo</button>
</form>
<p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#6B675C">Si tú no registraste este taller, cierra esta página y no pasa nada.</p>`
  )
}

export async function POST(req: Request) {
  const f = await req.formData().catch(() => null)
  const cuerpo = { s: String(f?.get("s") || ""), e: String(f?.get("e") || ""), t: String(f?.get("t") || "") }
  let d: Datos = {}
  try {
    const r = await fetch(`${API}/hooks/alta-taller/confirmar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
      cache: "no-store",
    })
    if (!r.ok) return r.status >= 500 ? sinServicio() : ligaMala()
    d = (await r.json().catch(() => ({}))) as Datos
    // Social Hub: taller que llegó por una publicación de redes (cookie hetna_social)
    if (!d.ya) await eventoSocial("registro_taller", cuerpo.s || undefined)
  } catch {
    return sinServicio()
  }
  return listo(Boolean(d.aprobado))
}
