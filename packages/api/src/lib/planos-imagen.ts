// Láminas del carrusel de un plano en PNG. La tienda dibuja el SVG
// (/mx/planos/[slug]/redes/[n]) y aquí se convierte con sharp, que en el
// backend sí funciona (los pósters de redes también lo usan).
import sharp from "sharp"

import { STORE_URL } from "./licitacion"
import { PLANOS_NOMBRES } from "./planos-correo"

export const laminaValida = (slug: string, n: number) => Boolean(PLANOS_NOMBRES[slug]) && Number.isInteger(n) && n >= 1 && n <= 4

/** PNG 1080 × 1350 de la lámina n (1 a 4) del plano. */
export async function pngLaminaPlano(slug: string, n: number): Promise<Buffer> {
  if (!laminaValida(slug, n)) throw new Error("Lámina no válida")
  const r = await fetch(`${STORE_URL}/mx/planos/${encodeURIComponent(slug)}/redes/${n}`, { signal: AbortSignal.timeout(20_000) })
  if (!r.ok) throw new Error(`lámina ${n} de ${slug}: HTTP ${r.status}`)
  const svg = await r.text()
  if (!svg.trimStart().startsWith("<svg")) throw new Error(`lámina ${n} de ${slug}: no es SVG`)
  return sharp(Buffer.from(svg)).png().toBuffer()
}

/** Liga pública del PNG (la sirve el backend en /api/planos-redes). */
export const urlLaminaPlano = (slug: string, n: number) => `${STORE_URL}/api/planos-redes/${encodeURIComponent(slug)}/${n}`
