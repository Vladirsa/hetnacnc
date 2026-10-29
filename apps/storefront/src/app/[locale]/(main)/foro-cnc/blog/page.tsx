import type { Metadata } from "next"

import { TarjetaArticulo } from "@/components/hetna/foro/Blog"
import { Migas, Paginacion } from "@/components/hetna/foro/Piezas"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { listarBlog } from "@/lib/foro/blog"
import { secciones } from "@/lib/foro/consultas"
import { SITIO } from "@/lib/foro/tipos"

export const revalidate = 300

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }
const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || ""
const POR_PAGINA = 12

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = await searchParams
  return {
    title: { absolute: "Blog CNC: guías de router, láser, plasma, CAM y precios | HETNA" },
    description:
      "Guías prácticas de CNC en español para México: pasar PDF a DXF, parámetros de corte, materiales, cuánto cobrar y más. Del equipo HETNA y talleres de la red.",
    alternates: { canonical: `${SITIO}/mx/foro-cnc/blog` },
    robots: uno(q.seccion) || uno(q.pagina) ? { index: false, follow: true } : undefined,
  }
}

export default async function BlogForo({ searchParams }: Props) {
  const q = await searchParams
  const seccion = uno(q.seccion)
  const pagina = Math.max(1, parseInt(uno(q.pagina)) || 1)
  const [{ articulos, total }, secs] = await Promise.all([
    listarBlog({ categoria: seccion || undefined, limit: POR_PAGINA, offset: (pagina - 1) * POR_PAGINA }),
    secciones(),
  ])
  const nombre = (slug: string) => secs?.find((s) => s.slug === slug)?.nombre || slug
  const base = seccion ? `/foro-cnc/blog?seccion=${seccion}` : "/foro-cnc/blog"

  return (
    <main className="w-full bg-[#F4F1EA]">
      <div className="max-w-[1100px] mx-auto px-4 py-6 lg:py-8 flex flex-col gap-5">
        <Migas items={[{ nombre: "Foro CNC", href: "/foro-cnc" }, { nombre: "Blog" }]} />
        <header className="bg-[#142033] text-white rounded-[16px] p-6 sm:p-8">
          <p className="m-0 text-xs font-bold uppercase tracking-[.2em] text-[#F2A25F]">Blog del Foro CNC</p>
          <h1 className="m-0 mt-1 text-[28px] sm:text-[36px] font-extrabold leading-tight">Guías CNC para resolver lo que más se pregunta</h1>
          <p className="m-0 mt-2 max-w-2xl text-white/80">
            Paso a paso de diseño, parámetros, materiales y negocio, escritas para talleres y makers de México. Si te queda una duda,
            pregúntala en el foro.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <LocalizedClientLink href="/foro-cnc/nuevo" className="rounded-full bg-[#C2560A] px-4 py-2 text-sm font-semibold hover:bg-[#A84A08]">
              Hacer una pregunta
            </LocalizedClientLink>
            <LocalizedClientLink href="/foro-cnc" className="rounded-full border border-white/40 px-4 py-2 text-sm font-semibold hover:bg-white/10">
              Ir al foro
            </LocalizedClientLink>
          </div>
        </header>

        {secs && (
          <nav className="flex flex-wrap gap-2" aria-label="Secciones del blog">
            <LocalizedClientLink
              href="/foro-cnc/blog"
              className={`rounded-full px-3.5 py-1.5 text-[13.5px] font-semibold ${!seccion ? "bg-[#142033] text-white" : "bg-white border border-[#E0DCD2] text-[#44433D]"}`}
            >
              Todo
            </LocalizedClientLink>
            {secs
              .filter((s) => s.slug !== "novedades-ofertas")
              .map((s) => (
                <LocalizedClientLink
                  key={s.slug}
                  href={`/foro-cnc/blog?seccion=${s.slug}`}
                  className={`rounded-full px-3.5 py-1.5 text-[13.5px] font-semibold ${seccion === s.slug ? "bg-[#142033] text-white" : "bg-white border border-[#E0DCD2] text-[#44433D]"}`}
                >
                  {s.nombre}
                </LocalizedClientLink>
              ))}
          </nav>
        )}

        {articulos.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {articulos.map((a) => (
              <TarjetaArticulo key={a.id} a={a} />
            ))}
          </div>
        ) : (
          <div className="bg-white border border-dashed border-[#D9D4C8] rounded-[12px] p-8 text-center">
            <p className="m-0 text-[15px] text-[#44433D]">
              {seccion ? `Todavía no hay guías de ${nombre(seccion)}.` : "Pronto publicamos las primeras guías."} Mientras, pregunta en el foro: la
              comunidad te ayuda.
            </p>
          </div>
        )}
        <Paginacion pagina={pagina} total={total} porPagina={POR_PAGINA} base={base} />
      </div>
    </main>
  )
}
