// Muestra los anuncios vigentes de un espacio (franja del inicio, foro,
// categorías, ficha de producto, tienda, directorio…).
// Si no hay ninguno: no dibuja nada (no deja huecos), salvo que `invitar` esté
// activo; entonces deja una tarjeta discreta "Tu anuncio aquí" que lleva a
// /anunciate con el espacio ya elegido (así el espacio vacío se vende solo).
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { piezasDe } from "@/lib/publicidad/consultas"
import { calcularMonto, pesos } from "@/lib/publicidad/precios"
import { ESPACIOS, esEspacio } from "@/lib/publicidad/tipos"

import { EnlacePub, EtiquetaPublicidad, ImagenPieza, TextoPieza } from "./PiezasBase"
import PubVista from "./PubVista"

export default async function AnunciosEspacio({
  espacio,
  className = "",
  invitar = false,
  titulo,
  columnas = false,
}: {
  espacio: string
  className?: string
  invitar?: boolean
  // Encabezado chico arriba de los anuncios ("Talleres destacados")
  titulo?: string
  // Tarjetas lado a lado (2-3 columnas en pantallas grandes) en vez de una columna
  columnas?: boolean
}) {
  if (!esEspacio(espacio)) return null
  const piezas = await piezasDe(espacio)
  if (!piezas.length && !invitar) return null

  const cfg = ESPACIOS[espacio]
  const franja = espacio === "franja_inicio"
  const ratio = franja && piezas.length > 1 ? "2 / 1" : cfg.ratio
  const contenedor = franja
    ? `mx-auto grid w-full max-w-[1400px] gap-4 px-4 py-4 lg:px-8 ${piezas.length > 1 ? "md:grid-cols-2" : ""}`
    : columnas
      ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      : "flex flex-col gap-3"

  const invitacion = (
    <LocalizedClientLink
      href={`/anunciate?espacio=${espacio}#comprar`}
      className="flex min-h-[88px] flex-col items-center justify-center gap-0.5 rounded-2xl border-2 border-dashed border-[#D9C9B6] bg-white/60 p-4 text-center hover:border-[#C2560A]"
    >
      <span className="text-[13.5px] font-bold text-[#B34D07]">Tu anuncio aquí</span>
      <span className="text-[12px] text-[#6B6A63]">Desde {pesos(calcularMonto(espacio, 7))} por semana</span>
    </LocalizedClientLink>
  )

  return (
    <section aria-label={titulo || "Publicidad"} className={className}>
      {titulo && (
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-[12px] font-bold uppercase tracking-wide text-[#6B6A63]">{titulo}</span>
          {piezas.length > 0 && <span className="text-[11px] text-[#9A978F]">Patrocinado</span>}
        </div>
      )}
      <div className={contenedor}>
        {piezas.map((p) => (
          <EnlacePub
            key={p.id}
            id={p.id}
            publicidad={p.es_publicidad}
            className="group relative block overflow-hidden rounded-2xl bg-gradient-to-br from-[#142033] to-[#1E3250]"
          >
            <div className="relative w-full" style={{ aspectRatio: ratio }}>
              <ImagenPieza p={p} sizes={columnas ? "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" : undefined} />
              <TextoPieza p={p} />
            </div>
            {p.es_publicidad && <EtiquetaPublicidad />}
          </EnlacePub>
        ))}
        {/* Con lugar libre, la invitación ocupa ese lugar */}
        {invitar && piezas.length < cfg.max && invitacion}
      </div>
      {piezas.length > 0 && <PubVista ids={piezas.map((p) => p.id)} />}
    </section>
  )
}
