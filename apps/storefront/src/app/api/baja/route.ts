// Baja de correos promocionales con un clic (liga al pie de cada correo y botón
// "Cancelar suscripción" de Gmail/Outlook). Reenvía el correo y su firma a la API,
// que es la que valida y guarda. Ver packages/api/src/lib/baja.ts.
const API = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export const dynamic = "force-dynamic"

async function darDeBaja(req: Request): Promise<boolean> {
  const url = new URL(req.url)
  try {
    const r = await fetch(`${API}/hooks/baja${url.search}`, { method: "POST", cache: "no-store" })
    return r.ok
  } catch {
    return false
  }
}

const pagina = (ok: boolean) => `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${ok ? "Listo" : "No se pudo"} · HETNA CNC</title></head>
<body style="margin:0;font-family:Arial,Helvetica,sans-serif;background:#FAF9F6;color:#142033">
<div style="max-width:480px;margin:12vh auto;padding:28px;background:#fff;border:1px solid #E7E4DC;border-radius:16px">
<p style="font-weight:700;font-size:20px;margin:0 0 8px">${ok ? "Listo, te diste de baja" : "No pudimos procesar tu baja"}</p>
<p style="margin:0 0 16px;line-height:1.5">${
  ok
    ? "Ya no te enviaremos correos de promociones. Seguirás recibiendo los correos necesarios de tus pedidos y de tu cuenta."
    : "La liga no es válida o ya expiró. Escríbenos a contacto@hetnacnc.com y te damos de baja."
}</p>
<a href="/" style="color:#C2560A;font-weight:700">Ir a HETNA CNC</a></div></body></html>`

export async function GET(req: Request) {
  const ok = await darDeBaja(req)
  return new Response(pagina(ok), {
    status: ok ? 200 : 400,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  })
}

// Baja con un clic desde el cliente de correo (RFC 8058)
export async function POST(req: Request) {
  const ok = await darDeBaja(req)
  return Response.json({ ok }, { status: ok ? 200 : 400 })
}
