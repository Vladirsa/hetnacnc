import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import type { Metadata } from "next"

import { ChipsSecciones, ColIzquierda } from "@/components/hetna/foro/Feed"
import { Avatar, ForoCerrado, haceCuanto } from "@/components/hetna/foro/Piezas"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { conversacionesDe } from "@/lib/foro/comunidad"
import { secciones, sesionForo } from "@/lib/foro/consultas"
import { urlConversacion } from "@/lib/foro/tipos"

const metadataEs: Metadata = {
  title: { absolute: "Mensajes | Foro CNC México" },
  robots: { index: false, follow: false },
}

export default async function Mensajes() {
  const [secs, sesion] = await Promise.all([secciones(), sesionForo()])
  if (!secs) return <ForoCerrado />
  const p = sesion?.perfil
  const lista = p ? await conversacionesDe(p.id) : []

  return (
    <main className="w-full bg-[#F4F1EA]">
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-5 lg:py-6">
        <ColIzquierda secciones={secs} sesion={sesion} />
        <div className="flex min-w-0 max-w-[760px] flex-col gap-3">
          <ChipsSecciones secciones={secs} />
          <h1 className="m-0 text-[24px] font-extrabold text-[#142033]"><TS>Mensajes</TS></h1>
          <p className="m-0 text-[14px] text-[#6B6A63]">
            <TS>Para escribirle a alguien, entra a su perfil y toca</TS> <strong><TS>Mensaje</TS></strong><TS>. ¿Quieres cotizar con un taller? Pídelo desde su página: ahí
            el pago y la entrega quedan protegidos.</TS>
          </p>
          {!p ? (
            <p className="m-0 rounded-[12px] border border-[#E7E4DC] bg-white p-6 text-[15px] text-[#44433D]">
              <LocalizedClientLink href={sesion ? "/foro-cnc/mi-perfil" : "/login"} className="font-semibold text-[#B34D07] underline">
                <TS>{sesion ? "Crea tu perfil del foro" : "Entra con tu cuenta"}</TS>
              </LocalizedClientLink><TS>{" "}</TS>
              <TS>para ver tus mensajes.</TS>
            </p>
          ) : lista.length ? (
            <ul className="m-0 flex list-none flex-col overflow-hidden rounded-[14px] border border-[#E7E4DC] bg-white p-0">
              {lista.map((c) => (
                <li key={c.otro.id} className="border-b border-[#F0EDE6] last:border-0">
                  <LocalizedClientLink href={urlConversacion(c.otro.usuario)} className={`flex items-center gap-3 px-4 py-3 hover:bg-[#F6F4EF] ${c.sinLeer ? "bg-[#FFF8EE]" : ""}`}>
                    <Avatar a={c.otro} size={44} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className={`truncate text-[15px] text-[#1B1B18] ${c.sinLeer ? "font-bold" : "font-semibold"}`}><TS>{c.otro.nombre}</TS></span>
                        <span className="shrink-0 text-[12px] text-[#9A978C]">{haceCuanto(c.ultimo)}</span>
                      </span>
                      <span className={`block truncate text-[13.5px] ${c.sinLeer ? "font-semibold text-[#1B1B18]" : "text-[#6B6A63]"}`}>
                        <TS>{c.mio ? "Tú: " : ""}</TS>
                        <TS>{c.texto}</TS>
                      </span>
                    </span>
                  </LocalizedClientLink>
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 rounded-[12px] border border-dashed border-[#D9D4C8] bg-white p-8 text-center text-[15px] text-[#6B6A63]">
              <TS>Aún no tienes conversaciones.</TS>
            </p>
          )}
        </div>
      </div>
    </main>
  )
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata() {
  return metaEnIdioma(metadataEs)
}
