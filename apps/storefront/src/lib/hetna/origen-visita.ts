// De dónde llegó la visita (anuncio de Meta o Google, correo, redes…): se
// guarda en el navegador la última liga con utm_* / gclid / fbclid durante 30
// días y viaja con la solicitud de fabricación, para que el tablero de
// estrategia diga cuántas solicitudes trae cada campaña (backend:
// packages/api/src/lib/origen-visita.ts). Sólo se queda en HETNA.

export type OrigenVisita = { fuente: string; medio: string; campana: string; contenido: string }

const CLAVE = "hetna-origen"
const DIAS = 30

export function guardarOrigen(href: string, referrer = ""): void {
  try {
    const u = new URL(href)
    const p = u.searchParams
    let fuente = p.get("utm_source") || ""
    if (!fuente && p.get("gclid")) fuente = "google"
    if (!fuente && p.get("fbclid")) fuente = "meta"
    if (!fuente && referrer) {
      const h = new URL(referrer).hostname.replace(/^www\./, "")
      if (h && !h.endsWith("hetnacnc.com")) fuente = h
    }
    if (!fuente) return
    const o: OrigenVisita & { t: number } = {
      fuente,
      medio: p.get("utm_medium") || (p.get("gclid") || p.get("fbclid") ? "paid" : "referral"),
      campana: p.get("utm_campaign") || "",
      contenido: p.get("utm_content") || "",
      t: Date.now(),
    }
    // Una visita sin utm (referral) no borra una campaña reciente
    const ant = leerOrigen()
    if (!p.get("utm_source") && !p.get("gclid") && !p.get("fbclid") && ant) return
    localStorage.setItem(CLAVE, JSON.stringify(o))
  } catch {
    // sin localStorage o URL rara: nada
  }
}

export function leerOrigen(): OrigenVisita | null {
  try {
    const o = JSON.parse(localStorage.getItem(CLAVE) || "null")
    if (!o || Date.now() - Number(o.t || 0) > DIAS * 86_400_000) return null
    return { fuente: o.fuente, medio: o.medio, campana: o.campana, contenido: o.contenido }
  } catch {
    return null
  }
}
