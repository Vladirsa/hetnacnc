// Descarga del contrato SafeDeal o de la constancia de firmas (Licitaciones
// 3.0, Fase 4). La liga secreta de la solicitud es la credencial del cliente.
const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!/^[A-Za-z0-9_-]{32,}$/.test(token)) return new Response("No encontrado", { status: 404 })
  const u = new URL(req.url)
  const tipo = u.searchParams.get("tipo") === "constancia" ? "constancia" : "contrato"
  const version = u.searchParams.get("version")
  const qs = new URLSearchParams({ tipo, ...(version && /^\d+$/.test(version) ? { version } : {}) })
  const r = await fetch(`${MEDUSA_BACKEND_URL}/store/solicitudes-taller/${token}/acuerdo/documento?${qs}`, {
    headers: { "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string },
    cache: "no-store",
  }).catch(() => null)
  if (!r || !r.ok) return new Response("Todavía no hay contrato generado.", { status: 404 })
  return new Response(await r.arrayBuffer(), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": r.headers.get("content-disposition") || `attachment; filename="${tipo}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
    },
  })
}
