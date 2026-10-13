// Muestra los anuncios vigentes de un espacio (franja del inicio, foro, categorías).
// Si no hay ninguno vigente, no dibuja nada (no deja huecos).
import { piezasDe } from "@/lib/publicidad/consultas"
import { ESPACIOS, esEspacio } from "@/lib/publicidad/tipos"

import { EnlacePub, EtiquetaPublicidad, ImagenPieza, TextoPieza } from "./PiezasBase"
import PubVista from "./PubVista"

export default async function AnunciosEspacio({ espacio, className = "" }: { espacio: string; className?: string }) {
  if (!esEspacio(espacio)) return null
  const piezas = await piezasDe(espacio)
  if (!piezas.length) return null

  const cfg = ESPACIOS[espacio]
  const franja = espacio === "franja_inicio"
  const ratio = franja && piezas.length > 1 ? "2 / 1" : cfg.ratio
  const contenedor = franja
    ? `mx-auto grid w-full max-w-[1400px] gap-4 px-4 py-4 lg:px-8 ${piezas.length > 1 ? "md:grid-cols-2" : ""}`
    : "flex flex-col gap-3"

  return (
    <section aria-label="Publicidad" className={`${contenedor} ${className}`}>
      {piezas.map((p) => (
        <EnlacePub
          key={p.id}
          id={p.id}
          publicidad={p.es_publicidad}
          className="group relative block overflow-hidden rounded-2xl bg-gradient-to-br from-[#142033] to-[#1E3250]"
        >
          <div className="relative w-full" style={{ aspectRatio: ratio }}>
            <ImagenPieza p={p} />
            <TextoPieza p={p} />
          </div>
          {p.es_publicidad && <EtiquetaPublicidad />}
        </EnlacePub>
      ))}
      <PubVista ids={piezas.map((p) => p.id)} />
    </section>
  )
}
