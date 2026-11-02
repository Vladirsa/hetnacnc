import type { Metadata } from "next"
import { descripcionCorta } from "@/lib/helpers/seo"
import { notFound } from "next/navigation"

import { BotonPublicar, Buscador, Lateral, Pestanas } from "@/components/hetna/foro/ForoMarco"
import { GuiasSeccion } from "@/components/hetna/foro/Blog"
import { ForoCerrado, Migas, Paginacion, TarjetaTema } from "@/components/hetna/foro/Piezas"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { listarBlog } from "@/lib/foro/blog"
import { type Orden, POR_PAGINA, destacados, listaTemas, rankingSemanal, secciones, sesionForo } from "@/lib/foro/consultas"
import { ctasPara, talleresDeSeccion } from "@/lib/foro/cta"
import { BotonSeguir } from "@/components/hetna/foro/RedCliente"
import { estadoRed } from "@/lib/foro/red"
import { SITIO, objetivoSeccion } from "@/lib/foro/tipos"

type Props = {
  params: Promise<{ locale: string; seccion: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || ""
const ORDENES: Orden[] = ["recientes", "populares", "sin-respuesta", "nuevos"]

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { seccion } = await params
  const q = await searchParams
  const s = (await secciones())?.find((x) => x.slug === seccion)
  if (!s) return {}
  const pagina = parseInt(uno(q.pagina)) || 1
  return {
    title: { absolute: `${s.nombre}: foro y dudas${pagina > 1 ? ` (página ${pagina})` : ""} | Foro CNC México` },
    description: descripcionCorta(`${s.descripcion} Pregunta y comparte con talleres y profesionales de CNC en México.`),
    alternates: { canonical: `${SITIO}/mx/foro-cnc/${s.slug}${pagina > 1 ? `?pagina=${pagina}` : ""}` },
    robots: uno(q.orden) ? { index: false, follow: true } : undefined,
  }
}

export default async function ForoSeccion({ params, searchParams }: Props) {
  const { locale, seccion } = await params
  const q = await searchParams
  const orden = (ORDENES.includes(uno(q.orden) as Orden) ? uno(q.orden) : "recientes") as Orden
  const pagina = Math.max(1, parseInt(uno(q.pagina)) || 1)

  const [secs, lista, sesion, top, semana, guias] = await Promise.all([
    secciones(),
    listaTemas({ seccion, orden, pagina }),
    sesionForo(),
    destacados(),
    rankingSemanal(),
    listarBlog({ categoria: seccion, guia: true, limit: 2 }),
  ])
  if (!secs || !lista) return <ForoCerrado />
  const s = secs.find((x) => x.slug === seccion)
  if (!s) notFound()

  const comunidad = await estadoRed([objetivoSeccion(s.slug)], sesion?.perfil?.id)
  const base = `/foro-cnc/${s.slug}`
  const fabricar = ctasPara(s.slug, "")[0]
  const talleres = talleresDeSeccion(s.slug)
  const baseOrden = orden === "recientes" ? base : `${base}?orden=${orden}`

  return (
    <main className="w-full bg-[#FAF9F6]">
      <div className="max-w-[1180px] mx-auto px-4 lg:px-16 xl:px-0 py-6 lg:py-8 flex flex-col gap-5">
        <Migas items={[{ nombre: "Inicio", href: "/" }, { nombre: "Foro CNC", href: "/foro-cnc" }, { nombre: s.nombre }]} />
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-[28px] lg:text-[34px] font-bold m-0 text-[#1B1B18]">{s.nombre}</h1>
            <p className="m-0 mt-1.5 text-[15px] text-[#6B6A63] max-w-[680px] leading-relaxed">{s.descripcion}</p>
            {s.soloNegocios && (
              <p className="m-0 mt-2 text-[13px] text-[#9A4A06]">Aquí solo publican talleres, proveedores y marcas. Todos pueden responder.</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
            <BotonSeguir objetivo={objetivoSeccion(s.slug)} siguiendo={comunidad.siguiendo} seguidores={comunidad.seguidores} etiqueta="Unirme a la comunidad" />
            <BotonPublicar seccion={s.slug} />
          </div>
        </div>
        <div className="max-w-[720px]">
          <Buscador locale={locale} seccion={s.slug} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 lg:gap-8">
          <div className="flex flex-col gap-4 min-w-0">
            {pagina === 1 && <GuiasSeccion guias={guias.articulos} />}
            {fabricar && pagina === 1 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[#E7E4DC] bg-white px-4 py-3">
                <span className="text-[14px] text-[#44433D]">
                  <strong className="text-[#1B1B18]">{fabricar.titulo}</strong> {fabricar.texto}
                </span>
                <span className="flex gap-3 shrink-0">
                  {talleres && (
                    <LocalizedClientLink href={talleres.href} className="text-[13.5px] font-semibold text-[#142033] hover:text-[#B34D07]">
                      Ver talleres
                    </LocalizedClientLink>
                  )}
                  <LocalizedClientLink href={fabricar.href} className="rounded-full bg-[#C2560A] px-3.5 py-1.5 text-[13px] font-semibold text-white hover:bg-[#A84A08]">
                    {fabricar.boton}
                  </LocalizedClientLink>
                </span>
              </div>
            )}
            <Pestanas
              base={base}
              actual={orden}
              opciones={[
                { v: "recientes", nombre: "Actividad reciente" },
                { v: "populares", nombre: "Populares" },
                { v: "sin-respuesta", nombre: "Sin respuesta" },
                { v: "nuevos", nombre: "Nuevos" },
              ]}
            />
            {lista.temas.length ? (
              <div className="flex flex-col gap-3">
                {lista.temas.map((t) => (
                  <TarjetaTema key={t.id} t={t} mostrarSeccion={false} />
                ))}
              </div>
            ) : (
              <div className="bg-white border border-dashed border-[#D9D4C8] rounded-[14px] p-8 text-center flex flex-col items-center gap-3">
                <p className="m-0 text-[15px] text-[#44433D]">Todavía no hay temas en {s.nombre}. ¡Abre el primero!</p>
                <BotonPublicar seccion={s.slug} />
              </div>
            )}
            <Paginacion pagina={pagina} total={lista.total} porPagina={POR_PAGINA} base={baseOrden} />
          </div>
          <Lateral secciones={secs} actual={s.slug} sesion={sesion} destacados={top} semana={semana} />
        </div>
      </div>
    </main>
  )
}
