import type { Metadata } from "next"

import { BotonPublicar, Buscador, Pestanas } from "@/components/hetna/foro/ForoMarco"
import { ChipsSecciones, ColDerecha, ColIzquierda, Composer, Publicacion } from "@/components/hetna/foro/Feed"
import { ForoCerrado, Paginacion } from "@/components/hetna/foro/Piezas"
import { type Orden, POR_PAGINA, destacados, listaTemas, secciones, sesionForo } from "@/lib/foro/consultas"
import { SITIO } from "@/lib/foro/tipos"

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || ""
const ORDENES: Orden[] = ["recientes", "populares", "sin-respuesta", "nuevos"]

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = await searchParams
  const buscar = uno(q.q)
  const indexar = !buscar && !uno(q.orden) && !uno(q.pagina)
  return {
    title: { absolute: buscar ? `${buscar} | Foro CNC México` : "Foro CNC México: router, láser, plasma y torno CNC" },
    description:
      "Comunidad CNC de México: pregunta y resuelve dudas de router CNC, corte láser, plasma, torno e impresión 3D. Comparte tus trabajos y encuentra talleres y proveedores cerca de ti.",
    alternates: { canonical: `${SITIO}/mx/foro-cnc` },
    robots: indexar ? undefined : { index: false, follow: true },
  }
}

export default async function ForoInicio({ params, searchParams }: Props) {
  const { locale } = await params
  const q = await searchParams
  const buscar = uno(q.q).slice(0, 120)
  const seccionBusqueda = uno(q.seccion)
  const orden = (ORDENES.includes(uno(q.orden) as Orden) ? uno(q.orden) : "recientes") as Orden
  const pagina = Math.max(1, parseInt(uno(q.pagina)) || 1)

  const [lista, secs, sesion, top] = await Promise.all([
    listaTemas({ orden, pagina, buscar, seccion: seccionBusqueda || undefined }),
    secciones(),
    sesionForo(),
    destacados(),
  ])
  if (!lista || !secs) return <ForoCerrado />

  const base = buscar ? `/foro-cnc?q=${encodeURIComponent(buscar)}${seccionBusqueda ? `&seccion=${seccionBusqueda}` : ""}` : "/foro-cnc"
  const baseOrden = orden === "recientes" ? base : `${base}${base.includes("?") ? "&" : "?"}orden=${orden}`

  return (
    <main className="w-full bg-[#F4F1EA]">
      <h1 className="sr-only">Foro CNC México</h1>
      <div className="max-w-[1180px] mx-auto px-4 py-4 lg:py-6 grid grid-cols-1 lg:grid-cols-[230px_minmax(0,1fr)_290px] gap-4 lg:gap-5">
        <ColIzquierda secciones={secs} sesion={sesion} />

        <div className="flex flex-col gap-3 min-w-0">
          <Buscador locale={locale} valor={buscar} />
          <ChipsSecciones secciones={secs} />
          <Composer sesion={sesion} />
          {buscar ? (
            <h2 className="m-0 text-[17px] font-bold text-[#1B1B18]">
              {lista.total} {lista.total === 1 ? "resultado" : "resultados"} para “{buscar}”
            </h2>
          ) : null}
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
                <Publicacion key={t.id} t={t} />
              ))}
            </div>
          ) : (
            <div className="bg-white border border-dashed border-[#D9D4C8] rounded-[12px] p-8 text-center flex flex-col items-center gap-3">
              <p className="m-0 text-[15px] text-[#44433D]">
                {buscar ? "No encontramos temas con esas palabras. Pregúntalo tú y la comunidad te ayuda." : "Todavía no hay temas aquí. ¡Sé el primero en publicar!"}
              </p>
              <BotonPublicar />
            </div>
          )}
          <Paginacion pagina={pagina} total={lista.total} porPagina={POR_PAGINA} base={baseOrden} />
        </div>

        <ColDerecha destacados={top} />
      </div>
    </main>
  )
}
