import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { BotonBloquear, FormMensaje } from "@/components/hetna/foro/ComunidadCliente"
import { AutorChip, ForoCerrado, haceCuanto } from "@/components/hetna/foro/Piezas"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { conversacionCon } from "@/lib/foro/comunidad"
import { secciones, sesionForo } from "@/lib/foro/consultas"
import { urlMensajes } from "@/lib/foro/tipos"

const metadataEs: Metadata = {
  title: { absolute: "Mensajes | Foro CNC México" },
  robots: { index: false, follow: false },
}

type Props = { params: Promise<{ usuario: string }> }

export default async function ConversacionPage({ params }: Props) {
  const { usuario } = await params
  const [secs, sesion] = await Promise.all([secciones(), sesionForo()])
  if (!secs) return <ForoCerrado />
  const p = sesion?.perfil
  if (!p) {
    return (
      <main className="w-full bg-[#F4F1EA]">
        <div className="mx-auto max-w-[760px] px-4 py-8">
          <p className="m-0 rounded-[12px] border border-[#E7E4DC] bg-white p-6 text-[15px] text-[#44433D]">
            <LocalizedClientLink href={sesion ? "/foro-cnc/mi-perfil" : "/login"} className="font-semibold text-[#B34D07] underline">
              <TS>{sesion ? "Crea tu perfil del foro" : "Entra con tu cuenta"}</TS>
            </LocalizedClientLink><TS>{" "}</TS>
            <TS>para mandar mensajes.</TS>
          </p>
        </div>
      </main>
    )
  }
  if (usuario.toLowerCase() === p.usuario) notFound()
  const c = await conversacionCon(p.id, usuario)
  if (!c) notFound()

  const aviso = c.meBloqueo
    ? "Esta persona no recibe mensajes tuyos."
    : c.bloqueadoPorMi
      ? "Bloqueaste a esta persona. Desbloquéala para escribirle."
      : undefined

  return (
    <main className="w-full bg-[#F4F1EA]">
      <div className="mx-auto flex max-w-[760px] flex-col gap-3 px-4 py-4 lg:py-6">
        <LocalizedClientLink href={urlMensajes} className="text-[14px] font-semibold text-[#B34D07] hover:underline">
          <TS>← Todos los mensajes</TS>
        </LocalizedClientLink>
        <div className="flex flex-col overflow-hidden rounded-[16px] border border-[#E7E4DC] bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-[#F0EDE6] px-4 py-3">
            <AutorChip a={c.otro} />
            <BotonBloquear perfilId={c.otro.id} bloqueado={c.bloqueadoPorMi} />
          </div>
          {/* flex-col-reverse: el scroll abre abajo, en lo más reciente */}
          <div className="flex max-h-[60vh] min-h-[240px] flex-col-reverse gap-2 overflow-y-auto bg-[#FAF9F6] px-4 py-4">
            {c.mensajes.length ? (
              [...c.mensajes].reverse().map((m) => (
                <div key={m.id} className={`flex flex-col ${m.mio ? "items-end" : "items-start"}`}>
                  <p
                    className={`m-0 max-w-[85%] whitespace-pre-line rounded-[14px] px-3.5 py-2 text-[14.5px] leading-relaxed ${
                      m.mio ? "rounded-br-[4px] bg-[#C2560A] text-white" : "rounded-bl-[4px] border border-[#E7E4DC] bg-white text-[#1B1B18]"
                    }`}
                  >
                    <TS>{m.texto}</TS>
                  </p>
                  <span className="mt-0.5 text-[11.5px] text-[#9A978C]">{haceCuanto(m.creado)}</span>
                </div>
              ))
            ) : (
              <p className="m-auto text-center text-[14px] text-[#6B6A63]"><TS>Escríbele a</TS> <TS>{c.otro.nombre}</TS><TS>. Preséntate y dile en qué te puede ayudar.</TS></p>
            )}
          </div>
          <div className="border-t border-[#F0EDE6] p-3">
            <FormMensaje usuario={c.otro.usuario} deshabilitado={aviso} />
          </div>
        </div>
      </div>
    </main>
  )
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata() {
  return metaEnIdioma(metadataEs)
}
