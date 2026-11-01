// Liga "confirma tu correo" del taller (packages/api/src/lib/alta-taller.ts).
// Vive en /api/app/ porque nginx manda /api/v... a otro servicio. La API valida
// la firma y marca el correo; aquí solo se pinta la página.
const API = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
const PANEL = (process.env.NEXT_PUBLIC_VENDOR_URL || "/seller").replace(/\/$/, "")

export const dynamic = "force-dynamic"

const pagina = (ok: boolean, aprobado: boolean) => `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${ok ? "Correo confirmado" : "Liga no válida"} · HETNA CNC</title></head>
<body style="margin:0;font-family:Arial,Helvetica,sans-serif;background:#FAF9F6;color:#142033">
<div style="max-width:480px;margin:12vh auto;padding:28px;background:#fff;border:1px solid #E7E4DC;border-radius:16px">
<p style="font-size:40px;margin:0 0 8px">${ok ? "✅" : "⚠️"}</p>
<p style="font-weight:700;font-size:20px;margin:0 0 8px">${ok ? "¡Listo, tu correo quedó confirmado!" : "Esta liga ya no sirve"}</p>
<p style="margin:0 0 20px;line-height:1.5">${
  !ok
    ? "La liga venció o está incompleta. Entra a tu panel de taller y, en Mi tablero, pide una nueva."
    : aprobado
      ? "Tu tienda ya está aprobada: ya puedes publicar tus productos."
      : "Ahora revisamos tu taller. Te avisamos por correo en cuanto lo aprobemos (normalmente en menos de un día hábil). Mientras tanto puedes completar tu perfil."
}</p>
<a href="${PANEL}" style="display:inline-block;background:#C2560A;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700">Ir a mi panel de taller</a>
</div></body></html>`

export async function GET(req: Request) {
  const url = new URL(req.url)
  let ok = false
  let aprobado = false
  try {
    const r = await fetch(`${API}/hooks/alta-taller/confirmar${url.search}`, { cache: "no-store" })
    ok = r.ok
    if (ok) aprobado = Boolean(((await r.json().catch(() => ({}))) as { aprobado?: boolean }).aprobado)
  } catch {
    ok = false
  }
  return new Response(pagina(ok, aprobado), {
    status: ok ? 200 : 400,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  })
}
