import type { Metadata } from "next"

import { ChipsSecciones, ColIzquierda, LATERAL_FIJO, Publicacion } from "@/components/hetna/foro/Feed"
import { Avatar, ForoCerrado, Paginacion } from "@/components/hetna/foro/Piezas"
import { CAJA_RED } from "@/components/hetna/foro/Red"
import { TarjetaTrabajo } from "@/components/hetna/trabajos/TarjetaTrabajo"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { POR_PAGINA, listaTemas, secciones, sesionForo } from "@/lib/foro/consultas"
import { abiertosATrabajo } from "@/lib/foro/red"
import { ES_NEGOCIO, SECCION_EMPLEOS, SITIO, TIPOS_CUENTA, urlEmpleos, urlPerfil } from "@/lib/foro/tipos"
import { trabajosAbiertos } from "@/lib/trabajos/datos"

export const metadata: Metadata = {
  title: { absolute: "Empleos y proyectos CNC en México | Foro CNC México" },
  description:
    "Vacantes de talleres CNC (operadores, programadores CAM, diseñadores), profesionales disponibles y proyectos de fabricación que buscan taller en México.",
  alternates: { canonical: `${SITIO}/mx${urlEmpleos}` },
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }
const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || ""

const BTN = "inline-flex items-center justify-center rounded-[10px] px-4 py-2.5 text-[14px] font-semibold"

export default async function EmpleosProyectos({ searchParams }: Props) {
  const q = await searchParams
  const pagina = Math.max(1, parseInt(uno(q.pagina)) || 1)
  const [secs, sesion, vacantes, buscan, abiertos, proyectos] = await Promise.all([
    secciones(),
    sesionForo(),
    listaTemas({ tipo: "vacante", orden: "nuevos", pagina }),
    pagina === 1 ? listaTemas({ tipo: "busco", orden: "nuevos", limite: 4 }) : Promise.resolve(null),
    pagina === 1 ? abiertosATrabajo(12) : Promise.resolve([]),
    pagina === 1 ? trabajosAbiertos({ limit: 3 }).catch(() => ({ trabajos: [], total: 0 })) : Promise.resolve({ trabajos: [], total: 0 }),
  ])
  if (!secs || !vacantes) return <ForoCerrado />
  const p = sesion?.perfil
  const esNegocio = Boolean(p && ES_NEGOCIO.includes(p.tipo))

  return (
    <main className="w-full bg-[#F4F1EA]">
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[230px_minmax(0,1fr)_290px] lg:gap-5 lg:py-6">
        <ColIzquierda secciones={secs} sesion={sesion} />

        <div className="flex min-w-0 flex-col gap-4">
          <ChipsSecciones secciones={secs} />
          <section className="rounded-[16px] bg-[#1E2566] p-5 text-white sm:p-7">
            <h1 className="m-0 text-[26px] font-extrabold leading-tight sm:text-[30px]">Empleos y proyectos CNC</h1>
            <p className="m-0 mt-2 max-w-2xl text-[15px] text-white/80">
              Vacantes de talleres, operadores y programadores disponibles, y proyectos de fabricación que buscan quién los haga.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <LocalizedClientLink
                href={esNegocio ? `/foro-cnc/nuevo?tipo=vacante&seccion=${SECCION_EMPLEOS}` : p ? "/foro-cnc/mi-perfil" : "/register"}
                className={`${BTN} bg-[#C2560A] text-white hover:brightness-110`}
              >
                Publicar una vacante
              </LocalizedClientLink>
              <LocalizedClientLink href={p ? "/foro-cnc/mi-perfil#curriculum" : "/register"} className={`${BTN} border border-white/40 text-white hover:bg-white/10`}>
                Busco trabajo: armar mi currículum
              </LocalizedClientLink>
            </div>
            {p && !esNegocio && (
              <p className="m-0 mt-3 text-[13px] text-white/70">Las vacantes las publican cuentas de taller, proveedor o marca. Puedes cambiar tu tipo de cuenta en tu perfil.</p>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="m-0 text-[18px] font-bold text-[#1B1B18]">Vacantes</h2>
            {vacantes.temas.length ? (
              vacantes.temas.map((t) => <Publicacion key={t.id} t={t} />)
            ) : (
              <p className="m-0 rounded-[12px] border border-dashed border-[#D9D4C8] bg-white p-6 text-center text-[14.5px] text-[#6B6A63]">
                Todavía no hay vacantes publicadas. ¿Tu taller busca operador o programador? Publica la primera: es gratis.
              </p>
            )}
            <Paginacion pagina={pagina} total={vacantes.total} porPagina={POR_PAGINA} base={urlEmpleos} />
          </section>

          {proyectos.trabajos.length > 0 && (
            <section className="flex flex-col gap-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="m-0 text-[18px] font-bold text-[#1B1B18]">Proyectos esperando precio</h2>
                <LocalizedClientLink href="/trabajos" className="text-[14px] font-semibold text-[#B34D07]">
                  Ver los {proyectos.total} →
                </LocalizedClientLink>
              </div>
              <p className="m-0 text-[14px] text-[#6B6A63]">Solicitudes reales de clientes. Los talleres registrados las cotizan.</p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {proyectos.trabajos.map((t) => (
                  <TarjetaTrabajo key={t.folio} trabajo={t} />
                ))}
              </div>
            </section>
          )}

          {buscan && buscan.temas.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="m-0 text-[18px] font-bold text-[#1B1B18]">Buscan quién les maquine</h2>
              {buscan.temas.map((t) => (
                <Publicacion key={t.id} t={t} />
              ))}
            </section>
          )}
        </div>

        <aside className={`flex flex-col gap-3 ${LATERAL_FIJO}`}>
          <section className={`${CAJA_RED} flex flex-col gap-3`}>
            <h2 className="m-0 text-[15px] font-bold text-[#1B1B18]">Abiertos a trabajo</h2>
            {abiertos.length ? (
              abiertos.map((a) => (
                <LocalizedClientLink key={a.id} href={urlPerfil(a.usuario)} className="flex items-start gap-3 rounded-[10px] p-1 hover:bg-[#F6F4EF]">
                  <Avatar a={a} size={40} />
                  <span className="min-w-0">
                    <strong className="block truncate text-[14.5px] text-[#1B1B18]">{a.nombre}</strong>
                    <span className="block truncate text-[12.5px] text-[#6B6A63]">
                      {TIPOS_CUENTA[a.tipo]?.nombre}
                      {a.estadoMx ? ` · ${a.estadoMx}` : ""}
                    </span>
                    {a.aptitudes.length > 0 && <span className="block truncate text-[12.5px] text-[#14683F]">{a.aptitudes.join(" · ")}</span>}
                  </span>
                </LocalizedClientLink>
              ))
            ) : (
              <p className="m-0 text-[14px] text-[#6B6A63]">Nadie se ha marcado todavía. Marca “Abierto a trabajo” en tu perfil y aparece aquí.</p>
            )}
          </section>
          <LocalizedClientLink href="/talleres/unete" className="flex flex-col gap-1 rounded-[12px] bg-[#142033] p-4 text-white hover:bg-[#1B2A42]">
            <strong className="text-[14.5px]">¿Tienes taller? Recibe proyectos</strong>
            <span className="text-[13px] text-[#C9D2E0]">Regístralo gratis y cotiza los trabajos que te interesan.</span>
          </LocalizedClientLink>
        </aside>
      </div>
    </main>
  )
}
