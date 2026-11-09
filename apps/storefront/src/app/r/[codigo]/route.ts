// Liga corta medida del Social Hub: hetnacnc.com/r/<codigo>
// Cuenta el clic, recuerda 30 días de qué publicación llegó (cookie
// hetna_social) y manda al destino con UTM. packages/api/src/lib/social-hub.ts
const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export async function GET(_req: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params
  const inicio = "https://hetnacnc.com/mx"
  if (!/^[a-z0-9]{7}$/.test(codigo)) return Response.redirect(inicio, 302)
  const r = await fetch(`${MEDUSA_BACKEND_URL}/hooks/social-hub/clic?c=${codigo}`, { cache: "no-store" }).catch(() => null)
  const d = r && r.ok ? await r.json().catch(() => null) : null
  const destino = typeof d?.destino === "string" && /^https:\/\//.test(d.destino) ? d.destino : inicio
  return new Response(null, {
    status: 302,
    headers: {
      Location: destino,
      "Set-Cookie": `hetna_social=${codigo}; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax; HttpOnly; Secure`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  })
}
