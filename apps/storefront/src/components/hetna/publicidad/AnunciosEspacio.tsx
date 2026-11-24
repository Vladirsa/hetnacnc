// Muestra los anuncios vigentes de un espacio (foro, fichas de producto,
// categorías, tienda, directorio…).
// Si no hay ninguno: no dibuja nada (no deja huecos), salvo que `invitar` esté
// activo; entonces deja un banner "Anuncia tu taller aquí" que lleva a
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
  frase = "Anuncia tu taller o tus productos aquí",
}: {
  espacio: string
  className?: string
  invitar?: boolean
  // Encabezado chico arriba de los anuncios ("Talleres destacados")
  titulo?: string
  // Tarjetas lado a lado (2-3 columnas en pantallas grandes) en vez de una columna
  columnas?: boolean
  // Título del banner de invitación (cambia cuando hay dos en la misma página)
  frase?: string
}) {
  if (!esEspacio(espacio)) return null
  const piezas = await piezasDe(espacio)
  if (!piezas.length && !invitar) return null

  const cfg = ESPACIOS[espacio]
  const ratio = cfg.ratio
  const contenedor = columnas ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3" : "flex flex-col gap-3"

  // Banner que invita a anunciarse (pedido de Vlado, 22 nov 2026): antes era
  // una tarjeta punteada casi invisible ("Tu anuncio aquí"). Va en código y no
  // como imagen para que se vea nítido en cualquier pantalla y el precio salga
  // siempre de la tarifa vigente.
  const invitacion = (
    <LocalizedClientLink
      href={`/anunciate?espacio=${espacio}#comprar`}
      className="group relative flex min-h-[96px] items-center gap-4 overflow-hidden rounded-2xl bg-gradient-to-br from-[#142033] to-[#1E3250] p-4 text-white shadow-sm transition-shadow hover:shadow-md sm:p-5"
      data-testid="anuncio-invitacion"
    >
      {/* Retícula fina, como la mesa de una CNC */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.10]"
        style={{
          backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
      <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-[#C2560A]/35 blur-2xl" />
      <span aria-hidden="true" className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#C2560A] text-[24px] shadow-sm">
        📣
      </span>
      <span className="relative flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#F2B98C]">Espacio disponible</span>
        <span className="text-[16px] font-bold leading-snug">{frase}</span>
        <span className="text-[12.5px] leading-snug text-white/75">
          Lo ven quienes buscan fabricación CNC · desde {pesos(calcularMonto(espacio, 7))} por semana
        </span>
        {/* En celular, o en columnas angostas, el botón va como enlace dentro del texto */}
        <span className={`mt-1 text-[13px] font-bold text-[#F2B98C] underline-offset-2 group-hover:underline ${columnas ? "" : "sm:hidden"}`}>
          Anúnciate →
        </span>
      </span>
      {!columnas && (
        <span className="relative hidden min-h-[44px] shrink-0 items-center rounded-lg bg-white px-4 text-[13.5px] font-bold text-[#142033] transition-colors group-hover:bg-[#FFF1E6] sm:inline-flex">
          Anúnciate →
        </span>
      )}
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
