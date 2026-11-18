// Vista previa de las ligas que manda el WhatsApp de HETNA (espacio
// «vista_whatsapp» de publicidad). WhatsApp arma la tarjeta con la imagen og de
// la página y la guarda por dirección; por eso el agente le pone a la liga un
// número (?wa=37) y cada número muestra uno de los anuncios vigentes. Sin
// anuncios, sale la imagen de HETNA de siempre. Sólo servidor.
import type { Metadata } from "next"

import { piezasDe } from "./consultas"

export async function vistaPreviaWhatsapp(wa: string | undefined, base: Metadata): Promise<Metadata> {
  const n = Number(wa)
  if (!wa || !Number.isInteger(n) || n < 0) return base
  const piezas = (await piezasDe("vista_whatsapp").catch(() => [])).filter((p) => p.imagen_url && /^https:\/\//.test(p.imagen_url))
  if (!piezas.length) return base
  const p = piezas[n % piezas.length]
  const titulo = p.titulo || String((base.openGraph as any)?.title || base.title || "HETNA CNC")
  const descripcion = p.subtitulo || String(base.description || "")
  return {
    ...base,
    // La tarjeta es de la publicidad; la página para Google sigue siendo la misma
    robots: { index: false, follow: true },
    openGraph: {
      ...(base.openGraph || {}),
      title: titulo,
      description: descripcion,
      images: [{ url: p.imagen_url!, width: 1200, height: 630, alt: titulo }],
    },
    twitter: { card: "summary_large_image", title: titulo, description: descripcion, images: [p.imagen_url!] },
  }
}
