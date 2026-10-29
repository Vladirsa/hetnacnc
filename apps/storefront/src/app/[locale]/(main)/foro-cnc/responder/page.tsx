import type { Metadata } from "next"

import { ChipsSecciones, ColIzquierda, Publicacion } from "@/components/hetna/foro/Feed"
import { ForoCerrado } from "@/components/hetna/foro/Piezas"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { preguntasParaTi } from "@/lib/foro/comunidad"
import { secciones, sesionForo } from "@/lib/foro/consultas"

export const metadata: Metadata = {
  title: { absolute: "Preguntas para ti | Foro CNC México" },
  robots: { index: false, follow: true },
}

// Como "Responder" de Quora: lo que te pidieron contestar y las preguntas sin
// resolver de tus comunidades. Responder suma puntos y lleva gente a tu perfil.
export default async function PreguntasParaTi() {
  const [secs, sesion] = await Promise.all([secciones(), sesionForo()])
  if (!secs) return <ForoCerrado />
  const p = sesion?.perfil
  const datos = p ? await preguntasParaTi(p.id) : { pedidas: [], abiertas: [] }

  return (
    <main className="w-full bg-[#F4F1EA]">
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-5 lg:py-6">
        <ColIzquierda secciones={secs} sesion={sesion} />
        <div className="flex min-w-0 max-w-[820px] flex-col gap-4">
          <ChipsSecciones secciones={secs} />
          <div>
            <h1 className="m-0 text-[24px] font-extrabold text-[#142033]">Preguntas para ti</h1>
            <p className="m-0 mt-1 text-[14.5px] text-[#6B6A63]">
              Lo que te pidieron responder y las preguntas sin resolver de tus comunidades. Cada respuesta útil suma puntos y, si tienes taller, te
              trae clientes.
            </p>
          </div>
          {!p ? (
            <p className="m-0 rounded-[12px] border border-[#E7E4DC] bg-white p-6 text-[15px] text-[#44433D]">
              <LocalizedClientLink href={sesion ? "/foro-cnc/mi-perfil" : "/login"} className="font-semibold text-[#B34D07] underline">
                {sesion ? "Crea tu perfil del foro" : "Entra con tu cuenta"}
              </LocalizedClientLink>{" "}
              para ver las preguntas que te tocan.
            </p>
          ) : (
            <>
              {datos.pedidas.length > 0 && (
                <section className="flex flex-col gap-3">
                  <h2 className="m-0 text-[17px] font-bold text-[#1B1B18]">Te pidieron que respondas</h2>
                  {datos.pedidas.map((t) => (
                    <div key={t.id} className="flex flex-col gap-1">
                      <span className="text-[13px] font-semibold text-[#9A4A06]">🙋 {t.pidio} te lo pidió</span>
                      <Publicacion t={t} />
                    </div>
                  ))}
                </section>
              )}
              <section className="flex flex-col gap-3">
                <h2 className="m-0 text-[17px] font-bold text-[#1B1B18]">Esperan respuesta</h2>
                {datos.abiertas.length ? (
                  datos.abiertas.map((t) => <Publicacion key={t.id} t={t} />)
                ) : (
                  <p className="m-0 rounded-[12px] border border-dashed border-[#D9D4C8] bg-white p-6 text-center text-[14.5px] text-[#6B6A63]">
                    Por ahora no hay preguntas sin resolver. Únete a más comunidades para ver más.
                  </p>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
