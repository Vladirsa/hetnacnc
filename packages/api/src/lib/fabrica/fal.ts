// Cliente de la cola de fal.ai (se manda el trabajo, se espera y se recoge). Llave: FAL_KEY.
const FAL = () => (process.env.FAL_KEY || "").trim()

export async function fal(modelo: string, input: any, topeMin = 12) {
  const h = { Authorization: `Key ${FAL()}`, "Content-Type": "application/json" }
  const r = await fetch(`https://queue.fal.run/${modelo}`, { method: "POST", headers: h, body: JSON.stringify(input), signal: AbortSignal.timeout(60_000) })
  const d = await r.json().catch(() => ({}))
  if (!r.ok || !d.request_id) throw new Error(`fal ${modelo}: ${d.detail ? JSON.stringify(d.detail).slice(0, 200) : r.status}`)
  const fin = Date.now() + topeMin * 60_000
  while (Date.now() < fin) {
    await new Promise((ok) => setTimeout(ok, 4000))
    const s = await fetch(d.status_url, { headers: h, signal: AbortSignal.timeout(30_000) }).then((x) => x.json()).catch(() => null)
    if (s?.status === "COMPLETED") {
      const out = await fetch(d.response_url, { headers: h, signal: AbortSignal.timeout(60_000) }).then((x) => x.json())
      if (out?.detail) throw new Error(`fal ${modelo}: ${JSON.stringify(out.detail).slice(0, 200)}`)
      return out
    }
    if (s?.status && !["IN_QUEUE", "IN_PROGRESS"].includes(s.status)) throw new Error(`fal ${modelo}: ${s.status}`)
  }
  throw new Error(`fal ${modelo}: tardó más de ${topeMin} min`)
}
