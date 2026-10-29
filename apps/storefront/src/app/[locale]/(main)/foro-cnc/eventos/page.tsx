import type { Metadata } from "next"

import { TarjetaEvento } from "@/components/hetna/foro/Eventos"
import { ChipsSecciones, ColIzquierda } from "@/components/hetna/foro/Feed"
import { ForoCerrado } from "@/components/hetna/foro/Piezas"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { eventos } from "@/lib/foro/comunidad"
import { secciones, sesionForo } from "@/lib/foro/consultas"
import { SECCION_EVENTOS, SITIO, urlEventos } from "@/lib/foro/tipos"

export const metadata: Metadata = {
  title: { absolute: "Eventos y cursos CNC en México | Foro CNC México" },
  description: "Expos, cursos, talleres prácticos y reuniones de la comunidad CNC en México: router, láser, plasma, torno e impresión 3D.",
  alternates: { canonical: `${SITIO}/mx${urlEventos}` },
}

export default async function Eventos() {
  const [secs, sesion, proximos, pasados] = await Promise.all([secciones(), sesionForo(), eventos("proximos"), eventos("pasados", 6)])
  if (!secs) return <ForoCerrado />

  return (
    <main className="w-full bg-[#F4F1EA]">
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-5 lg:py-6">
        <ColIzquierda secciones={secs} sesion={sesion} />
        <div className="flex min-w-0 max-w-[820px] flex-col gap-4">
          <ChipsSecciones secciones={secs} />
          <section className="rounded-[16px] bg-[#0F3D2A] p-5 text-white sm:p-7">
            <h1 className="m-0 text-[26px] font-extrabold leading-tight sm:text-[30px]">Eventos y cursos CNC</h1>
            <p className="m-0 mt-2 max-w-2xl text-[15px] text-white/80">
              Expos, cursos, talleres prácticos y reuniones de la comunidad. Confirma con “Asistiré” y te recordamos un día antes.
            </p>
            <LocalizedClientLink
              href={`/foro-cnc/nuevo?tipo=evento&seccion=${SECCION_EVENTOS}`}
              className="mt-4 inline-flex rounded-[10px] bg-[#C2560A] px-4 py-2.5 text-[14px] font-semibold text-white hover:brightness-110"
            >
              Publicar un evento
            </LocalizedClientLink>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="m-0 text-[18px] font-bold text-[#1B1B18]">Próximos</h2>
            {proximos.length ? (
              proximos.map((t) => <TarjetaEvento key={t.id} t={t} />)
            ) : (
              <p className="m-0 rounded-[12px] border border-dashed border-[#D9D4C8] bg-white p-6 text-center text-[14.5px] text-[#6B6A63]">
                No hay eventos próximos. ¿Organizas un curso, una expo o una reunión? Publícalo gratis.
              </p>
            )}
          </section>

          {pasados.length > 0 && (
            <section className="flex flex-col gap-3 opacity-80">
              <h2 className="m-0 text-[18px] font-bold text-[#1B1B18]">Ya pasaron</h2>
              {pasados.map((t) => (
                <TarjetaEvento key={t.id} t={t} />
              ))}
            </section>
          )}
        </div>
      </div>
    </main>
  )
}
