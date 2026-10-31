// Liga de "confirma tu correo" (packages/api/src/lib/verificar-correo.ts).
// Reenvía la firma a la API, que es la que valida y marca la cuenta.
const API = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export const dynamic = "force-dynamic"

const pagina = (ok: boolean) => `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${ok ? "Correo confirmado" : "Liga no válida"} · HETNA CNC</title></head>
<body style="margin:0;font-family:Arial,Helvetica,sans-serif;background:#FAF9F6;color:#142033">
<div style="max-width:480px;margin:12vh auto;padding:28px;background:#fff;border:1px solid #E7E4DC;border-radius:16px">
<p style="font-size:40px;margin:0 0 8px">${ok ? "✅" : "⚠️"}</p>
<p style="font-weight:700;font-size:20px;margin:0 0 8px">${ok ? "¡Listo, tu correo quedó confirmado!" : "Esta liga ya no sirve"}</p>
<p style="margin:0 0 20px;line-height:1.5">${
  ok
    ? "Tu cuenta de HETNA CNC ya está activa. Inicia sesión con tu correo y tu contraseña."
    : "La liga venció o está incompleta. Entra a Iniciar sesión con tu correo y tu contraseña y te mandamos una nueva."
}</p>
<a href="/mx/login" style="display:inline-block;background:#C2560A;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700">Iniciar sesión</a></div></body></html>`

export async function GET(req: Request) {
  const url = new URL(req.url)
  let ok = false
  try {
    const r = await fetch(`${API}/hooks/verificar-correo${url.search}`, { cache: "no-store" })
    ok = r.ok
  } catch {
    ok = false
  }
  return new Response(pagina(ok), {
    status: ok ? 200 : 400,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  })
}
