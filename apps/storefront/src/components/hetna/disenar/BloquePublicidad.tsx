"use client"

// Espacio de publicidad de Cotizar y Diseñar (espacio "cotizar_disenar" del
// panel de publicidad): talleres, proveedores y marcas que pagan por salir
// frente a quien está por mandar a fabricar. Lee los anuncios del panel
// (/api/pub/espacio/cotizar_disenar) y, al final, el cuadro "Anúnciate aquí".
// Es componente de navegador porque vive dentro de herramientas interactivas.
import { T } from "@/components/hetna/i18n/Idioma"
import { useEffect, useState } from "react"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { registrarVistas } from "@/lib/publicidad/vistas-cliente"

type Anuncio = {
  id: string
  titulo: string
  subtitulo: string | null
  boton: string | null
  imagen_url: string | null
  anunciante: string | null
  es_publicidad: boolean
}

const Tarjeta = ({ a }: { a: Anuncio }) => (
  // Todo clic pasa por /api/pub/clic/<id> para contarlo
  <a href={`/api/pub/clic/${a.id}`} rel={a.es_publicidad ? "sponsored noopener" : "noopener"} className="block overflow-hidden rounded-[14px] border border-[#E7E4DC] bg-white hover:border-[#C2560A]">
    {a.imagen_url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={a.imagen_url} alt={a.titulo || a.anunciante || "Anuncio"} className="aspect-[16/9] w-full object-cover" loading="lazy" />
    ) : (
      <div className="grid aspect-[16/9] w-full place-items-center bg-[#142033] text-[22px] font-extrabold text-[#FFC53D]">
        {(a.anunciante || a.titulo || "AD").slice(0, 2).toUpperCase()}
      </div>
    )}
    {(a.titulo || a.anunciante || a.subtitulo || a.boton) && (
      <div className="p-3">
        {(a.titulo || a.anunciante) && <p className="text-[13.5px] font-bold text-[#1B1B18]">{a.titulo || a.anunciante}</p>}
        {a.subtitulo && <p className="mt-1 text-[12.5px] leading-snug text-[#4A4943]"><T>{a.subtitulo}</T></p>}
        {a.boton && <span className="mt-2 inline-block rounded-full bg-[#FF6A1A] px-3 py-1 text-[12px] font-bold text-white"><T>{a.boton}</T></span>}
      </div>
    )}
  </a>
)

export const BloquePublicidad = ({ compacto = false }: { compacto?: boolean }) => {
  const [anuncios, setAnuncios] = useState<Anuncio[]>([])

  useEffect(() => {
    let vivo = true
    fetch("/api/pub/espacio/cotizar_disenar")
      .then((r) => (r.ok ? r.json() : { piezas: [] }))
      .then((d: { piezas?: Anuncio[] }) => {
        if (!vivo) return
        const lista = d.piezas || []
        setAnuncios(lista)
        if (lista.length) registrarVistas(lista.map((a) => a.id))
      })
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [])

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-bold uppercase tracking-wide text-[#6B6A63]"><T>Talleres y proveedores destacados</T></span>
        {anuncios.length > 0 && <span className="text-[10px] text-[#9A978F]"><T>Patrocinado</T></span>}
      </div>
      <div className={compacto ? "grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3" : "flex flex-col gap-2.5"}>
        {anuncios.map((a) => (
          <Tarjeta key={a.id} a={a} />
        ))}
        {anuncios.length < 3 && (
          <LocalizedClientLink
            href="/anunciate?espacio=cotizar_disenar#comprar"
            className="flex flex-col items-center justify-center gap-1 rounded-[14px] border-2 border-dashed border-[#C2560A] p-4 text-center text-[#B34D07]"
          >
            <span className="text-[13.5px] font-extrabold"><T>Anúnciate aquí</T></span>
            <span className="text-[11.5px] text-[#6B6A63]"><T>Tu taller o tus materiales frente a quien está por mandar a fabricar.</T></span>
          </LocalizedClientLink>
        )}
      </div>
    </div>
  )
}
