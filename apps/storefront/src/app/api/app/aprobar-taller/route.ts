// Botón "Revisar y aprobar" del correo al administrador
// (packages/api/src/lib/alta-taller.ts).
//   GET  -> muestra el taller y un botón "Aprobar" (no cambia nada: los
//           antivirus del correo abren las ligas solos)
//   POST -> aprueba (formulario de esta misma página)
// La firma de la liga es la que autoriza; la API la valida en los dos pasos.
const API = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
const ADMIN = (process.env.NEXT_PUBLIC_ADMIN_URL || "/dashboard").replace(/\/$/, "")

export const dynamic = "force-dynamic"

type Datos = { ok?: boolean; ya?: boolean; motivo?: string; nombre?: string; correo?: string; telefono?: string; estado?: string; correo_confirmado?: boolean }

const esc = (v: unknown) =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

const marco = (titulo: string, cuerpo: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(titulo)} · HETNA CNC</title></head>
<body style="margin:0;font-family:Arial,Helvetica,sans-serif;background:#FAF9F6;color:#142033">
<div style="max-width:480px;margin:10vh auto;padding:28px;background:#fff;border:1px solid #E7E4DC;border-radius:16px">
${cuerpo}
<p style="margin:20px 0 0;font-size:13px"><a href="${ADMIN}/sellers" style="color:#B34D07">Ver todos los talleres en el panel</a></p>
</div></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
  )

const ficha = (d: Datos) => `<table style="border-collapse:collapse;font-size:15px;margin:0 0 16px">
<tr><td style="padding:4px 12px 4px 0;color:#6B675C">Taller</td><td><b>${esc(d.nombre)}</b></td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#6B675C">Correo</td><td>${esc(d.correo)} ${d.correo_confirmado ? "✅" : "(sin confirmar)"}</td></tr>
${d.telefono ? `<tr><td style="padding:4px 12px 4px 0;color:#6B675C">Teléfono</td><td>${esc(d.telefono)}</td></tr>` : ""}
</table>`

const ligaMala = () =>
  marco("Liga no válida", `<p style="font-size:40px;margin:0 0 8px">⚠️</p><p style="font-weight:700;font-size:20px;margin:0 0 8px">Esta liga ya no sirve</p><p style="margin:0;line-height:1.5">Venció o está incompleta. Aprueba el taller desde el panel de administración.</p>`, 400)

export async function GET(req: Request) {
  const url = new URL(req.url)
  let d: Datos = {}
  try {
    const r = await fetch(`${API}/hooks/alta-taller/aprobar${url.search}`, { cache: "no-store" })
    d = (await r.json().catch(() => ({}))) as Datos
    if (!r.ok) return ligaMala()
  } catch {
    return marco("Error", "<p>No se pudo consultar el taller. Intenta en un momento.</p>", 503)
  }
  if (d.estado === "open") {
    return marco("Ya aprobado", `<p style="font-size:40px;margin:0 0 8px">✅</p><p style="font-weight:700;font-size:20px;margin:0 0 12px">Este taller ya está aprobado</p>${ficha(d)}`)
  }
  if (d.estado !== "pending_approval") {
    return marco("No se puede aprobar", `<p style="font-weight:700;font-size:20px;margin:0 0 12px">Este taller no está pendiente</p>${ficha(d)}<p>Estado actual: <b>${esc(d.estado)}</b>.</p>`, 409)
  }
  const s = url.searchParams
  return marco(
    "Aprobar taller",
    `<p style="font-weight:700;font-size:20px;margin:0 0 12px">¿Aprobar este taller?</p>${ficha(d)}
<p style="margin:0 0 16px;line-height:1.5;color:#40403A">Al aprobarlo podrá publicar productos y recibir pedidos, y le llega un correo avisándole.</p>
<form method="post">
<input type="hidden" name="s" value="${esc(s.get("s"))}"><input type="hidden" name="e" value="${esc(s.get("e"))}"><input type="hidden" name="t" value="${esc(s.get("t"))}">
<button type="submit" style="background:#C2560A;color:#fff;border:0;padding:12px 22px;border-radius:10px;font-weight:700;font-size:15px;cursor:pointer">Aprobar taller</button>
</form>`
  )
}

export async function POST(req: Request) {
  const f = await req.formData().catch(() => null)
  const cuerpo = { s: String(f?.get("s") || ""), e: String(f?.get("e") || ""), t: String(f?.get("t") || "") }
  let d: Datos = {}
  try {
    const r = await fetch(`${API}/hooks/alta-taller/aprobar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
      cache: "no-store",
    })
    d = (await r.json().catch(() => ({}))) as Datos
    if (r.status === 400) return ligaMala()
    if (!r.ok) {
      return marco("No se pudo aprobar", `<p style="font-weight:700;font-size:20px;margin:0 0 12px">No se pudo aprobar</p>${ficha(d)}<p>Estado actual: <b>${esc(d.estado || "desconocido")}</b>.</p>`, r.status)
    }
  } catch {
    return marco("Error", "<p>No se pudo aprobar en este momento. Intenta de nuevo.</p>", 503)
  }
  return marco(
    "Taller aprobado",
    `<p style="font-size:40px;margin:0 0 8px">✅</p><p style="font-weight:700;font-size:20px;margin:0 0 12px">${d.ya ? "Este taller ya estaba aprobado" : "¡Taller aprobado!"}</p>${ficha(d)}<p style="margin:0;line-height:1.5">${d.ya ? "" : "Ya puede publicar y le mandamos un correo avisándole."}</p>`
  )
}
