import type { Metadata } from "next"

import { MarcarLeidos } from "@/components/hetna/foro/ComunidadCliente"
import { ChipsSecciones, ColIzquierda } from "@/components/hetna/foro/Feed"
import { Avatar, ForoCerrado, haceCuanto } from "@/components/hetna/foro/Piezas"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { avisosDe } from "@/lib/foro/comunidad"
import { secciones, sesionForo } from "@/lib/foro/consultas"
import type { TipoAviso } from "@/lib/foro/tipos"

export const metadata: Metadata = {
  title: { absolute: "Avisos | Foro CNC México" },
  robots: { index: false, follow: false },
}

const ICONO: Record<TipoAviso, string> = {
  seguidor: "👤",
  respuesta: "💬",
  tema_seguido: "🔔",
  mejor: "✅",
  aval: "👍",
  recomendacion: "⭐",
  postulacion: "📄",
  solicitud: "🙋",
  mensaje: "✉️",
  evento: "📅",
}

export default async function Avisos() {
  const [secs, sesion] = await Promise.all([secciones(), sesionForo()])
  if (!secs) return <ForoCerrado />
  const p = sesion?.perfil
  const lista = p ? await avisosDe(p.id) : []
  const sinLeer = lista.some((a) => !a.leido)

  return (
    <main className="w-full bg-[#F4F1EA]">
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-5 lg:py-6">
        <ColIzquierda secciones={secs} sesion={sesion} />
        <div className="flex min-w-0 max-w-[760px] flex-col gap-3">
          <ChipsSecciones secciones={secs} />
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h1 className="m-0 text-[24px] font-extrabold text-[#142033]">Avisos</h1>
            {p && (
              <LocalizedClientLink href="/foro-cnc/mi-perfil#avisos" className="text-[13.5px] font-semibold text-[#B34D07] hover:underline">
                Avisos por correo: configurar
              </LocalizedClientLink>
            )}
          </div>
          {!p ? (
            <p className="m-0 rounded-[12px] border border-[#E7E4DC] bg-white p-6 text-[15px] text-[#44433D]">
              {sesion ? "Crea tu perfil del foro para recibir avisos." : "Entra con tu cuenta para ver tus avisos."}{" "}
              <LocalizedClientLink href={sesion ? "/foro-cnc/mi-perfil" : "/login"} className="font-semibold text-[#B34D07] underline">
                {sesion ? "Crear perfil" : "Entrar"}
              </LocalizedClientLink>
            </p>
          ) : lista.length ? (
            <ul className="m-0 flex list-none flex-col overflow-hidden rounded-[14px] border border-[#E7E4DC] bg-white p-0">
              {lista.map((a) => (
                <li key={a.id} className={`border-b border-[#F0EDE6] last:border-0 ${a.leido ? "" : "bg-[#FFF8EE]"}`}>
                  <LocalizedClientLink href={a.url || "/foro-cnc"} className="flex items-start gap-3 px-4 py-3 hover:bg-[#F6F4EF]">
                    {a.actor ? <Avatar a={a.actor} size={40} /> : <span className="grid h-10 w-10 place-items-center rounded-full bg-[#F4F1EA] text-[18px]">{ICONO[a.tipo]}</span>}
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14.5px] leading-snug text-[#1B1B18]">
                        <span aria-hidden="true">{ICONO[a.tipo]} </span>
                        {a.texto}
                      </span>
                      <span className="text-[12.5px] text-[#6B6A63]">{haceCuanto(a.creado)}</span>
                    </span>
                    {!a.leido && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-[#C2560A]" aria-label="Nuevo" />}
                  </LocalizedClientLink>
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 rounded-[12px] border border-dashed border-[#D9D4C8] bg-white p-8 text-center text-[15px] text-[#6B6A63]">
              Aún no tienes avisos. Aquí te avisamos cuando te respondan, te sigan, te escriban o te pidan una respuesta.
            </p>
          )}
          <MarcarLeidos hay={sinLeer} />
        </div>
      </div>
    </main>
  )
}
