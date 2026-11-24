import "server-only"

// API de conversiones de Meta para los "Lead" (solicitud de fabricación y
// estimado al instante): la conversión principal de HETNA. Sin esto, Meta sólo
// ve visitas y no puede optimizar los anuncios hacia gente que cotiza.
//
// Se llama desde la server action que ya recibió los datos del formulario
// (enviarSolicitudTaller, cotizarLead), nunca desde una acción pública aparte:
// así nadie puede mandar a Meta leads inventados con correos ajenos.
// Sólo si la persona aceptó cookies de publicidad (el navegador manda
// rastreo: permiteRastreo()). Mismo event_id que el Pixel: Meta lo cuenta una vez.
//
// Variables: NEXT_PUBLIC_META_PIXEL_ID y META_CAPI_TOKEN (las mismas de la compra).
import { createHash } from "crypto"
import { cookies, headers } from "next/headers"

import { ipDe } from "@/lib/seguridad/ip-cliente"

const sha = (v: string) => createHash("sha256").update(v).digest("hex")
const norm = (v: unknown) => String(v ?? "").trim().toLowerCase()

export function telefonoMeta(v: unknown): string | undefined {
  const d = String(v ?? "").replace(/\D/g, "")
  if (d.length < 10) return undefined
  return sha(d.length === 10 ? `52${d}` : d)
}

export async function reportarLeadMeta(d: {
  /** Lead (por omisión) o CompleteRegistration (registro de taller) */
  evento?: "Lead" | "CompleteRegistration"
  eventId: string
  contenido: string
  email?: string
  telefono?: string
  ciudad?: string
  estado?: string
  cp?: string
}): Promise<void> {
  const pixel = process.env.NEXT_PUBLIC_META_PIXEL_ID
  const token = process.env.META_CAPI_TOKEN
  if (!pixel || !token || !d.eventId) return
  try {
    const cabeceras = await headers()
    const galletas = await cookies()
    const em = norm(d.email)
    const evento = {
      event_name: d.evento || "Lead",
      event_time: Math.floor(Date.now() / 1000),
      event_id: d.eventId,
      action_source: "website",
      event_source_url: cabeceras.get("referer") || undefined,
      user_data: {
        em: em.includes("@") ? [sha(em)] : undefined,
        ph: telefonoMeta(d.telefono) ? [telefonoMeta(d.telefono)] : undefined,
        ct: norm(d.ciudad) ? sha(norm(d.ciudad).replace(/\s+/g, "")) : undefined,
        st: norm(d.estado) ? sha(norm(d.estado)) : undefined,
        zp: norm(d.cp) ? sha(norm(d.cp)) : undefined,
        country: sha("mx"),
        client_ip_address: ipDe(cabeceras) || undefined,
        client_user_agent: cabeceras.get("user-agent") || undefined,
        fbp: galletas.get("_fbp")?.value,
        fbc: galletas.get("_fbc")?.value,
      },
      custom_data: { content_name: d.contenido },
    }
    const r = await fetch(`https://graph.facebook.com/v21.0/${pixel}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: token,
        data: [evento],
        ...(process.env.META_CAPI_TEST_CODE ? { test_event_code: process.env.META_CAPI_TEST_CODE } : {}),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    })
    if (!r.ok) console.error("[meta-lead] no aceptado", r.status, (await r.text()).slice(0, 300))
  } catch (e) {
    // Medición: si falla, la solicitud ya quedó y el Pixel sigue
    console.error("[meta-lead] no se pudo reportar", e instanceof Error ? e.message : e)
  }
}
