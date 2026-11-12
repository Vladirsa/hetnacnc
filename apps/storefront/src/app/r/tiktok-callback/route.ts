// Regreso de TikTok (https://hetnacnc.com/r/tiktok-callback): después de que el
// dueño entra con la cuenta de TikTok de HETNA, TikTok manda aquí un código. Se
// pasa al backend (con el token interno), que lo cambia por los tokens y los
// guarda. Vive bajo /r/ porque en el servidor /api/* no llega a la tienda.
const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

const pagina = (ok: boolean, texto: string) =>
  new Response(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>TikTok · HETNA CNC</title>
<style>body{font-family:system-ui,sans-serif;background:#F7F5EF;color:#142033;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:16px}main{max-width:460px;background:#fff;border-radius:16px;padding:28px;box-shadow:0 8px 30px rgba(20,32,51,.1);text-align:center}h1{font-size:22px;margin:0 0 10px;color:${ok ? "#2E9E57" : "#B3261E"}}p{line-height:1.5}</style></head>
<body><main><h1>${ok ? "✓ TikTok conectado" : "No se pudo conectar TikTok"}</h1><p>${texto}</p></main></body></html>`,
    { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } }
  )

const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c] as string)

export async function GET(req: Request) {
  const u = new URL(req.url)
  const code = u.searchParams.get("code") || ""
  const state = u.searchParams.get("state") || ""
  const error = u.searchParams.get("error_description") || u.searchParams.get("error") || ""
  if (error) return pagina(false, `TikTok respondió: ${esc(error.slice(0, 200))}. Vuelve al panel y aprieta "Conectar TikTok" otra vez.`)
  if (!code || !state) return pagina(false, "Faltan datos de TikTok. Vuelve al panel y aprieta \"Conectar TikTok\".")
  const token = process.env.N8N_REDES_TOKEN || ""
  if (!token) return pagina(false, "Falta configurar el servidor (N8N_REDES_TOKEN en la tienda).")
  try {
    const r = await fetch(`${MEDUSA_BACKEND_URL}/hooks/social-hub/tiktok`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-hetna-token": token },
      body: JSON.stringify({ code, state }),
      signal: AbortSignal.timeout(40_000),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok || !d.ok) return pagina(false, esc(String(d.message || `El servidor respondió ${r.status}`).slice(0, 240)))
    return pagina(true, `${d.usuario ? `Cuenta: <b>${esc(String(d.usuario))}</b>. ` : ""}Ya puedes cerrar esta ventana y regresar al Social Hub.`)
  } catch {
    return pagina(false, "El servidor de HETNA no respondió. Intenta en un minuto.")
  }
}
