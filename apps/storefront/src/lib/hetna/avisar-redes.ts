// Avisa a n8n para publicar un tema nuevo del foro en las redes de HETNA.
// Solo se manda lo público (título, resumen y liga). Variables: N8N_REDES_URL y N8N_REDES_TOKEN.
export async function avisarRedes(a: { tipo: "foro" | "licitacion"; titulo: string; resumen?: string; lugar?: string; url: string }) {
  const url = process.env.N8N_REDES_URL
  if (!url) return
  try {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), 8000)
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-hetna-token": process.env.N8N_REDES_TOKEN || "" },
      body: JSON.stringify(a),
      signal: ctl.signal,
    })
    clearTimeout(t)
  } catch (e) {
    console.warn("[redes] no se pudo avisar a n8n:", (e as Error).message)
  }
}
