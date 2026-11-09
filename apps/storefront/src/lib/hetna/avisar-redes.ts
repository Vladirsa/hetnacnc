// Avisa de un tema nuevo del foro para publicarlo en redes. Desde la Fase 5A
// pasa por el Social Hub del backend (textos por red, horario y medición). Si
// el backend no responde, se usa el aviso directo a n8n de antes.
// Solo se manda lo público (título, resumen y liga). Variables: N8N_REDES_URL y N8N_REDES_TOKEN.
const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"

export async function avisarRedes(a: { tipo: "foro" | "licitacion"; titulo: string; resumen?: string; lugar?: string; url: string; id?: string }) {
  const token = process.env.N8N_REDES_TOKEN || ""
  try {
    const r = await fetch(`${MEDUSA_BACKEND_URL}/hooks/social-hub/aviso`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-hetna-token": token },
      body: JSON.stringify(a),
      signal: AbortSignal.timeout(8000),
    })
    if (r.ok) return
  } catch {
    // sigue con el aviso directo
  }
  const url = process.env.N8N_REDES_URL
  if (!url) return
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-hetna-token": token },
      body: JSON.stringify(a),
      signal: AbortSignal.timeout(8000),
    })
  } catch (e) {
    console.warn("[redes] no se pudo avisar a n8n:", (e as Error).message)
  }
}
