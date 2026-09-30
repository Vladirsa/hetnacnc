import type { Metadata } from "next"
import { redirect } from "next/navigation"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { FormTema } from "@/components/hetna/foro/FormTema"
import { ForoCerrado, Migas } from "@/components/hetna/foro/Piezas"
import { secciones, sesionForo } from "@/lib/foro/consultas"
import { ES_NEGOCIO } from "@/lib/foro/tipos"

export const metadata: Metadata = {
  title: "Publicar en el Foro CNC México",
  robots: { index: false, follow: false },
}

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}
const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || ""

export default async function ForoNuevo({ params, searchParams }: Props) {
  const { locale } = await params
  const q = await searchParams
  const [secs, sesion] = await Promise.all([secciones(), sesionForo()])
  if (!secs) return <ForoCerrado />
  const seccion = uno(q.seccion)
  const volver = `/foro-cnc/nuevo${seccion ? `?seccion=${seccion}` : ""}`
  if (sesion && !sesion.perfil) redirect(`/${locale}/foro-cnc/mi-perfil?siguiente=${encodeURIComponent(volver)}`)

  return (
    <main className="w-full bg-[#FAF9F6]">
      <div className="max-w-[820px] mx-auto px-4 py-6 lg:py-8 flex flex-col gap-5">
        <Migas items={[{ nombre: "Foro CNC", href: "/foro-cnc" }, { nombre: "Publicar" }]} />
        <h1 className="font-display text-[28px] font-bold m-0 text-[#1B1B18]">Publicar en el foro</h1>
        {!sesion ? (
          <div className="bg-white border border-[#E7E4DC] rounded-[16px] p-6 flex flex-col gap-3">
            <p className="m-0 text-[15px] text-[#44433D]">Para publicar necesitas tu cuenta de HETNA CNC. Es gratis y es la misma con la que compras.</p>
            <div className="flex gap-2">
              <LocalizedClientLink href="/login" className="border border-[#E0DCD2] font-semibold px-4 py-2.5 rounded-[10px] text-[14px] hover:border-[#C2560A]">
                Entrar
              </LocalizedClientLink>
              <LocalizedClientLink href="/register" className="bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold px-4 py-2.5 rounded-[10px] text-[14px]">
                Crear cuenta gratis
              </LocalizedClientLink>
            </div>
          </div>
        ) : sesion.perfil?.suspendido ? (
          <p className="m-0 text-[15px] text-[#A42A2A]">Tu cuenta del foro está suspendida. Escríbenos si crees que es un error.</p>
        ) : (
          <div className="bg-white border border-[#E7E4DC] rounded-[16px] p-5 sm:p-7">
            <FormTema
              secciones={secs.map((s) => ({ slug: s.slug, nombre: s.nombre, soloNegocios: s.soloNegocios }))}
              seccionInicial={seccion}
              tipoInicial={uno(q.tipo)}
              esNegocio={Boolean(sesion.perfil && (ES_NEGOCIO.includes(sesion.perfil.tipo) || sesion.perfil.rol !== "usuario"))}
            />
          </div>
        )}
      </div>
    </main>
  )
}
