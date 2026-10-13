// Avisa a n8n para que publique en las redes de HETNA (Telegram, Facebook, LinkedIn...).
// Solo viaja información pública: nunca nombre, correo, teléfono ni dirección del cliente.
// Variables: N8N_REDES_URL (webhook de n8n) y N8N_REDES_TOKEN (valor del encabezado x-hetna-token).
export type AvisoRedes = { tipo: "foro" | "licitacion"; titulo: string; resumen?: string; lugar?: string; url: string }

export async function avisarRedes(a: AvisoRedes, logger?: { warn: (m: string) => void }) {
  const url = process.env.N8N_REDES_URL
  if (!url) return false
  try {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), 8000)
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-hetna-token": process.env.N8N_REDES_TOKEN || "" },
      body: JSON.stringify(a),
      signal: ctl.signal,
    })
    clearTimeout(t)
    if (!r.ok) logger?.warn(`[redes] n8n respondió ${r.status}`)
    return r.ok
  } catch (e) {
    logger?.warn(`[redes] no se pudo avisar a n8n: ${(e as Error).message}`)
    return false
  }
}
