"use server"

// Avisos del directorio de perfiles no reclamados (ver lib/hetna/directorio.ts).
// Sólo mandan a n8n el slug y QUÉ se pidió; nunca el nombre, correo ni teléfono
// del cliente. n8n limita los avisos (1 por empresa cada 7 días, 25 al día).
import { empresaPorSlug } from "./directorio"

const N8N = process.env.HETNA_N8N_WEBHOOKS || "https://n8n.hetnacnc.com/webhook"
const corto = (s: unknown, n: number) => String(s ?? "").trim().slice(0, n)

async function postar(ruta: string, cuerpo: Record<string, string>) {
  try {
    const res = await fetch(`${N8N}/${ruta}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 (compatible; HETNA-Tienda/1.0)" },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(8000),
    })
    return res.ok
  } catch {
    return false
  }
}

export type DatosInteres = {
  slug: string
  folio?: string
  servicio?: string
  material?: string
  cantidad?: string
  ciudad?: string
  estado_mx?: string
}

/** Después de que la solicitud quedó registrada: invita a la empresa a responderla. */
export async function avisarInteresDirectorio(d: DatosInteres): Promise<boolean> {
  const empresa = await empresaPorSlug(d.slug)
  if (!empresa) return false
  return postar("hetna-directorio-interes", {
    slug: empresa.slug,
    folio: corto(d.folio, 30),
    servicio: corto(d.servicio, 80),
    material: corto(d.material, 60),
    cantidad: corto(d.cantidad, 30),
    ciudad: corto(d.ciudad, 60),
    estado_mx: corto(d.estado_mx, 40),
  })
}

/** «Quitar este perfil»: la confirmación llega al correo de la propia empresa. */
export async function pedirRetiroDirectorio(slug: string): Promise<boolean> {
  const empresa = await empresaPorSlug(slug)
  if (!empresa) return false
  return postar("hetna-directorio-quitar", { slug: empresa.slug })
}

/** Para el aviso de «Estás reclamando el perfil de…» en /talleres/unete. */
export async function perfilPorReclamar(slug: string): Promise<{ empresa: string; lugar: string } | null> {
  const e = await empresaPorSlug(slug)
  return e ? { empresa: e.empresa, lugar: [e.ciudad, e.estado].filter(Boolean).join(", ") } : null
}
