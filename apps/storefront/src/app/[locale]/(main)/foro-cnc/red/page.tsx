import type { Metadata } from "next"

import { ChipsSecciones, ColIzquierda, Publicacion } from "@/components/hetna/foro/Feed"
import { ForoCerrado, Paginacion } from "@/components/hetna/foro/Piezas"
import { CAJA_RED, ProductosRed, TarjetaPersona, TarjetaTallerRed } from "@/components/hetna/foro/Red"
import { BotonSeguir } from "@/components/hetna/foro/RedCliente"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { listarTalleres } from "@/lib/hetna/talleres"
import { secciones, sesionForo } from "@/lib/foro/consultas"
import {
  POR_PAGINA_RED,
  cuentasRed,
  feedRed,
  objetivosDe,
  objetivosSeguidos,
  pendientesDe,
  productosDeTalleres,
  seguidoresDe,
  siguiendoDe,
  sugerencias,
} from "@/lib/foro/red"
import { objetivoSeccion, objetivoTaller, urlPerfil, urlRed, urlTema } from "@/lib/foro/tipos"

export const metadata: Metadata = {
  title: { absolute: "Mi red | Foro CNC México" },
  description: "Sigue talleres, proveedores y profesionales CNC de México y entérate de sus productos, trabajos y publicaciones.",
  robots: { index: false, follow: true },
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }
const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || ""

const VISTAS = [
  ["", "Novedades"],
  ["siguiendo", "Siguiendo"],
  ["seguidores", "Seguidores"],
] as const

export default async function MiRed({ searchParams }: Props) {
  const q = await searchParams
  const ver = uno(q.ver)
  const pagina = Math.max(1, parseInt(uno(q.pagina)) || 1)
  const [secs, sesion] = await Promise.all([secciones(), sesionForo()])
  if (!secs) return <ForoCerrado />
  const p = sesion?.perfil

  // Sin sesión o sin perfil: qué es la red y cómo entrar
  if (!p) {
    return (
      <main className="w-full bg-[#F4F1EA]">
        <div className="mx-auto flex max-w-[860px] flex-col gap-5 px-4 py-8">
          <section className="rounded-[18px] bg-[#142033] p-6 text-white sm:p-10">
            <p className="m-0 text-xs font-bold uppercase tracking-[.2em] text-[#F2A25F]">Red CNC de México</p>
            <h1 className="m-0 mt-2 text-3xl font-extrabold sm:text-4xl">Tu red profesional CNC</h1>
            <p className="m-0 mt-3 max-w-2xl text-white/80">
              Sigue a los talleres, proveedores y profesionales que te interesan y entérate de sus productos nuevos, sus trabajos y lo que publican.
              Arma tu currículum, recibe avales y recomendaciones, y encuentra empleo o proyectos.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <LocalizedClientLink
                href={sesion ? "/foro-cnc/mi-perfil?siguiente=/foro-cnc/red" : "/register"}
                className="rounded-xl bg-[#C2560A] px-6 py-3 font-semibold text-white hover:brightness-110"
              >
                {sesion ? "Crear mi perfil" : "Crear cuenta gratis"}
              </LocalizedClientLink>
              {!sesion && (
                <LocalizedClientLink href="/login" className="rounded-xl border border-white/40 px-6 py-3 font-semibold text-white hover:bg-white/10">
                  Ya tengo cuenta
                </LocalizedClientLink>
              )}
            </div>
          </section>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Sigue talleres", "Sus productos nuevos y sus trabajos te llegan a tu red."],
              ["Currículum y avales", "Tus aptitudes avaladas por la comunidad y recomendaciones de tus clientes."],
              ["Empleos y proyectos", "Vacantes de talleres y proyectos que buscan quién los fabrique."],
            ].map(([t, d]) => (
              <div key={t} className={CAJA_RED}>
                <strong className="block text-[15px] text-[#1B1B18]">{t}</strong>
                <span className="text-[14px] text-[#6B6A63]">{d}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    )
  }

  const [cuentas, seguidos, pendientes, siguiendo, sugeridos, directorio] = await Promise.all([
    cuentasRed(p),
    objetivosSeguidos(p.id),
    pendientesDe(p.id),
    siguiendoDe(p.id),
    sugerencias(p, 5),
    listarTalleres(),
  ])
  const [feed, productos, seguidores] = await Promise.all([
    ver ? Promise.resolve(null) : feedRed(p.id, pagina),
    ver || pagina > 1 ? Promise.resolve([]) : productosDeTalleres(siguiendo.talleres),
    ver === "seguidores" ? seguidoresDe(objetivosDe(p), 100) : Promise.resolve([]),
  ])
  const talleresSugeridos = directorio
    .filter((t) => !seguidos.has(objetivoTaller(t.id)) && t.id !== p.vendedor)
    .sort((a, b) => Number(b.verificado) - Number(a.verificado))
    .slice(0, 4)
  const comunidades = secs.filter((s) => !seguidos.has(objetivoSeccion(s.slug))).slice(0, 5)
  const nadaQueVer = seguidos.size === 0

  return (
    <main className="w-full bg-[#F4F1EA]">
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[230px_minmax(0,1fr)_290px] lg:gap-5 lg:py-6">
        <ColIzquierda secciones={secs} sesion={sesion} />

        <div className="flex min-w-0 flex-col gap-3">
          <ChipsSecciones secciones={secs} />
          <section className={`${CAJA_RED} flex flex-wrap items-center justify-between gap-3`}>
            <div>
              <h1 className="m-0 text-[22px] font-extrabold text-[#142033]">Mi red</h1>
              <p className="m-0 text-[13.5px] text-[#6B6A63]">
                <a href="?ver=seguidores" className="font-semibold text-[#1B1B18] hover:text-[#B34D07]">
                  {cuentas.seguidores} seguidores
                </a>{" "}
                ·{" "}
                <a href="?ver=siguiendo" className="font-semibold text-[#1B1B18] hover:text-[#B34D07]">
                  {cuentas.siguiendo} siguiendo
                </a>
              </p>
            </div>
            <LocalizedClientLink href={urlPerfil(p.usuario)} className="text-[14px] font-semibold text-[#B34D07] hover:underline">
              Ver mi perfil →
            </LocalizedClientLink>
          </section>

          {/* Pendientes: postulaciones a sus vacantes y recomendaciones por aceptar */}
          {(pendientes.vacantes.length > 0 || pendientes.recomendaciones > 0) && (
            <section className="flex flex-col gap-2 rounded-[14px] border border-[#F2C98F] bg-[#FFF6E8] p-4">
              {pendientes.recomendaciones > 0 && (
                <LocalizedClientLink href={`${urlPerfil(p.usuario)}#recomendaciones`} className="text-[14px] text-[#5A3A12] hover:underline">
                  <strong>
                    {pendientes.recomendaciones === 1 ? "1 recomendación espera" : `${pendientes.recomendaciones} recomendaciones esperan`}
                  </strong>{" "}
                  que decidas si salen en tu perfil →
                </LocalizedClientLink>
              )}
              {pendientes.vacantes.map((v) => (
                <LocalizedClientLink key={v.slug} href={`${urlTema({ seccion: v.seccion, slug: v.slug })}#postulaciones`} className="text-[14px] text-[#5A3A12] hover:underline">
                  <strong>{v.n === 1 ? "1 postulación" : `${v.n} postulaciones`}</strong> a tu vacante “{v.titulo}” →
                </LocalizedClientLink>
              ))}
            </section>
          )}

          <nav className="flex gap-1 border-b border-[#E7E4DC]" aria-label="Vistas de mi red">
            {VISTAS.map(([v, n]) => (
              <a
                key={v}
                href={v ? `?ver=${v}` : "?"}
                className={`-mb-px border-b-2 px-3.5 py-2.5 text-[14px] font-semibold ${
                  ver === v ? "border-[#C2560A] text-[#1B1B18]" : "border-transparent text-[#6B6A63] hover:text-[#1B1B18]"
                }`}
              >
                {n}
              </a>
            ))}
          </nav>

          {!ver && (
            <>
              <ProductosRed productos={productos} />
              {feed && feed.temas.length > 0 ? (
                <>
                  {feed.temas.map((t) => (
                    <Publicacion key={t.id} t={t} />
                  ))}
                  <Paginacion pagina={pagina} total={feed.total} porPagina={POR_PAGINA_RED} base={urlRed} />
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 rounded-[12px] border border-dashed border-[#D9D4C8] bg-white p-8 text-center">
                  <strong className="text-[16px] text-[#1B1B18]">
                    {nadaQueVer ? "Tu red está vacía" : "Todavía no hay publicaciones nuevas de tu red"}
                  </strong>
                  <p className="m-0 max-w-md text-[14.5px] text-[#6B6A63]">
                    {nadaQueVer
                      ? "Sigue talleres, personas y secciones (a la derecha) y aquí verás sus productos nuevos, sus trabajos y sus publicaciones."
                      : "Cuando las personas y talleres que sigues publiquen, aparece aquí. Mientras, sigue a más gente."}
                  </p>
                </div>
              )}
            </>
          )}

          {ver === "siguiendo" && (
            <section className={`${CAJA_RED} flex flex-col gap-5`}>
              {siguiendo.talleres.length > 0 && (
                <div className="flex flex-col gap-3">
                  <h2 className="m-0 text-[15px] font-bold text-[#1B1B18]">Talleres</h2>
                  {siguiendo.talleres.map((t) => (
                    <TarjetaTallerRed key={t.id} t={t} sesion siguiendo />
                  ))}
                </div>
              )}
              {siguiendo.personas.length > 0 && (
                <div className="flex flex-col gap-3">
                  <h2 className="m-0 text-[15px] font-bold text-[#1B1B18]">Personas</h2>
                  {siguiendo.personas.map((a) => (
                    <TarjetaPersona key={a.id} a={a} sesion siguiendo />
                  ))}
                </div>
              )}
              {siguiendo.secciones.length > 0 && (
                <div className="flex flex-col gap-3">
                  <h2 className="m-0 text-[15px] font-bold text-[#1B1B18]">Comunidades</h2>
                  {siguiendo.secciones.map((s) => (
                    <div key={s.slug} className="flex items-center justify-between gap-3">
                      <LocalizedClientLink href={`/foro-cnc/${s.slug}`} className="font-semibold text-[#1B1B18] hover:text-[#B34D07]">
                        {s.nombre}
                      </LocalizedClientLink>
                      <BotonSeguir objetivo={objetivoSeccion(s.slug)} siguiendo seguidores={0} conCuenta={false} chico />
                    </div>
                  ))}
                </div>
              )}
              {nadaQueVer && <p className="m-0 text-[14.5px] text-[#6B6A63]">Aún no sigues a nadie.</p>}
            </section>
          )}

          {ver === "seguidores" && (
            <section className={`${CAJA_RED} flex flex-col gap-3`}>
              {seguidores.length ? (
                seguidores.map((a) => (
                  <TarjetaPersona key={a.id} a={a} sesion siguiendo={seguidos.has(`p:${a.id}`) || Boolean(a.taller?.id && seguidos.has(objetivoTaller(a.taller.id)))} />
                ))
              ) : (
                <p className="m-0 text-[14.5px] text-[#6B6A63]">
                  Aún no tienes seguidores. Publica tus trabajos, responde preguntas y completa tu currículum: así te encuentran.
                </p>
              )}
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-3 lg:sticky lg:top-4 lg:self-start">
          {sugeridos.length > 0 && (
            <section className={`${CAJA_RED} flex flex-col gap-3`}>
              <h2 className="m-0 text-[15px] font-bold text-[#1B1B18]">Personas que quizá conozcas</h2>
              {sugeridos.map((a) => (
                <TarjetaPersona key={a.id} a={a} sesion />
              ))}
            </section>
          )}
          {talleresSugeridos.length > 0 && (
            <section className={`${CAJA_RED} flex flex-col gap-3`}>
              <h2 className="m-0 text-[15px] font-bold text-[#1B1B18]">Talleres para seguir</h2>
              {talleresSugeridos.map((t) => (
                <TarjetaTallerRed key={t.id} t={t} sesion />
              ))}
              <LocalizedClientLink href="/talleres" className="text-[13.5px] font-semibold text-[#B34D07] hover:underline">
                Ver todos los talleres →
              </LocalizedClientLink>
            </section>
          )}
          {comunidades.length > 0 && (
            <section className={`${CAJA_RED} flex flex-col gap-3`}>
              <h2 className="m-0 text-[15px] font-bold text-[#1B1B18]">Comunidades</h2>
              {comunidades.map((s) => (
                <div key={s.slug} className="flex items-center justify-between gap-2">
                  <LocalizedClientLink href={`/foro-cnc/${s.slug}`} className="min-w-0 truncate text-[14px] font-semibold text-[#1B1B18] hover:text-[#B34D07]">
                    {s.nombre}
                  </LocalizedClientLink>
                  <BotonSeguir objetivo={objetivoSeccion(s.slug)} siguiendo={false} seguidores={0} etiqueta="Unirme" conCuenta={false} chico />
                </div>
              ))}
            </section>
          )}
        </aside>
      </div>
    </main>
  )
}
