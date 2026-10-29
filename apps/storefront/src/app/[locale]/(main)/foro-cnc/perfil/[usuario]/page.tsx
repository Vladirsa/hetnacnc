import type { Metadata } from "next"
import { notFound } from "next/navigation"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { SocialIcon } from "@/components/hetna/SocialIcon"
import { AvisoSeguro } from "@/components/hetna/foro/AvisoSeguro"
import { Avatar, ForoCerrado, InsigniaCuenta, InsigniaTaller, Migas, Paginacion, Palomita, TarjetaTema } from "@/components/hetna/foro/Piezas"
import { Abierto, CAJA_RED, ListaRecomendaciones, Trayectoria } from "@/components/hetna/foro/Red"
import { Aptitudes, BotonSeguir, FormRecomendar } from "@/components/hetna/foro/RedCliente"
import { POR_PAGINA, listaTemas, perfilPorUsuario, sesionForo } from "@/lib/foro/consultas"
import { avalesDe, cuentasRed, estadoRed, miRecomendacion, objetivosDe, recomendacionesDe } from "@/lib/foro/red"
import { REDES, type Red, SITIO, TIPOS_CUENTA, objetivoPerfil, urlPerfil } from "@/lib/foro/tipos"

type Props = {
  params: Promise<{ locale: string; usuario: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const ETIQUETA_ICONO: Partial<Record<Red, string>> = { facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", x: "X" }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { usuario } = await params
  const p = await perfilPorUsuario(usuario)
  if (!p || p.suspendido) return { title: { absolute: "Perfil no encontrado | Foro CNC México" }, robots: { index: false } }
  const lugar = [p.ciudad, p.estadoMx].filter(Boolean).join(", ")
  const tipo = TIPOS_CUENTA[p.tipo].nombre
  return {
    title: { absolute: `${p.nombre}: ${tipo} CNC${lugar ? ` en ${lugar}` : ""} | Foro CNC México` },
    description: (p.bio || `${p.nombre} es ${tipo.toLowerCase()} en la comunidad CNC de HETNA.`).slice(0, 155),
    alternates: { canonical: `${SITIO}/mx${urlPerfil(p.usuario)}` },
    // perfiles vacíos no se indexan hasta que tengan contenido
    robots: p.temas + p.respuestas === 0 && !p.bio && !p.trayectoria.length ? { index: false, follow: true } : undefined,
  }
}

export default async function ForoPerfil({ params, searchParams }: Props) {
  const { usuario } = await params
  const q = await searchParams
  const pagina = Math.max(1, parseInt(Array.isArray(q.pagina) ? q.pagina[0] : q.pagina || "") || 1)
  const [p, sesion] = await Promise.all([perfilPorUsuario(usuario), sesionForo()])
  if (!p) {
    if (!(await listaTemas({ limite: 1 }))) return <ForoCerrado />
    notFound()
  }
  if (p.suspendido && sesion?.perfil?.id !== p.id) notFound()
  const propio = sesion?.perfil?.id === p.id
  const yo = sesion?.perfil || null
  const [temas, cuentas, red, avales, recomendaciones, previa] = await Promise.all([
    listaTemas({ autorId: p.id, orden: "nuevos", pagina }),
    cuentasRed(p),
    estadoRed(objetivosDe(p), yo?.id),
    avalesDe(p, yo?.id),
    recomendacionesDe(p.id, propio),
    yo && !propio ? miRecomendacion(p.id, yo.id) : Promise.resolve(null),
  ])
  const lugar = [p.ciudad, p.estadoMx].filter(Boolean).join(", ")
  const redes = (Object.keys(REDES) as Red[]).filter((r) => p.redes[r])

  const datos = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    dateCreated: p.creado,
    mainEntity: {
      "@type": ["taller", "proveedor", "marca"].includes(p.tipo) ? "Organization" : "Person",
      name: p.nombre,
      alternateName: p.usuario,
      description: p.bio || undefined,
      url: `${SITIO}/mx${urlPerfil(p.usuario)}`,
      sameAs: redes.map((r) => p.redes[r]),
      ...(p.aptitudes.length ? { knowsAbout: p.aptitudes } : {}),
      ...(p.foto ? { image: `${SITIO}${p.foto}` } : {}),
      interactionStatistic: [
        { "@type": "InteractionCounter", interactionType: "https://schema.org/WriteAction", userInteractionCount: p.temas + p.respuestas },
      ],
    },
  }

  return (
    <main className="w-full bg-[#FAF9F6]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datos).replace(/</g, "\\u003c") }} />
      <div className="max-w-[1180px] mx-auto px-4 lg:px-16 xl:px-0 py-6 lg:py-8 flex flex-col gap-5">
        <Migas items={[{ nombre: "Foro CNC", href: "/foro-cnc" }, { nombre: p.nombre }]} />

        <section className="bg-white border border-[#E7E4DC] rounded-[18px] overflow-hidden">
          <div className="h-[84px] sm:h-[110px] bg-[#142033] relative">
            <div
              className="absolute inset-0 opacity-[0.12]"
              style={{ backgroundImage: "linear-gradient(#C9D2E0 1px, transparent 1px), linear-gradient(90deg, #C9D2E0 1px, transparent 1px)", backgroundSize: "24px 24px" }}
            />
          </div>
          <div className="relative px-5 sm:px-7 pb-6 -mt-10 sm:-mt-12 flex flex-col gap-4">
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div className="rounded-full ring-4 ring-white bg-white">
                <Avatar a={p} size={96} />
              </div>
              {propio ? (
                <LocalizedClientLink href="/foro-cnc/mi-perfil" className="border border-[#E0DCD2] font-semibold px-4 py-2 rounded-[10px] text-[14px] hover:border-[#C2560A]">
                  Editar perfil
                </LocalizedClientLink>
              ) : (
                <BotonSeguir objetivo={objetivoPerfil(p)} siguiendo={red.siguiendo} seguidores={red.seguidores} conCuenta={false} />
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="m-0 font-display text-[26px] font-bold text-[#1B1B18]">{p.nombre}</h1>
                {p.verificado && <Palomita />}
                {p.taller ? <InsigniaTaller a={p} /> : <InsigniaCuenta tipo={p.tipo} />}
                {p.abierto && <Abierto />}
              </div>
              {p.taller && (
                <LocalizedClientLink
                  href={`/talleres/${p.taller.handle}`}
                  className="self-start mt-1 inline-flex items-center gap-1.5 rounded-[10px] bg-[#C2560A] px-4 py-2 text-[14px] font-semibold text-white hover:bg-[#A84A08]"
                >
                  Ver el taller {p.taller.nombre} y pedir cotización →
                </LocalizedClientLink>
              )}
              <span className="text-[14px] text-[#6B6A63]">
                @{p.usuario}
                {lugar ? ` · ${lugar}` : ""} · Miembro desde{" "}
                {new Date(p.creado).toLocaleDateString("es-MX", { month: "long", year: "numeric", timeZone: "America/Mexico_City" })}
              </span>
            </div>
            {p.bio && <p className="m-0 text-[15px] text-[#23231F] leading-relaxed whitespace-pre-line max-w-[760px]">{p.bio}</p>}

            <div className="flex gap-6 flex-wrap text-[14px]">
              <span>
                <strong className="text-[18px] text-[#1B1B18]">{red.seguidores}</strong> <span className="text-[#6B6A63]">seguidores</span>
              </span>
              <span>
                <strong className="text-[18px] text-[#1B1B18]">{cuentas.siguiendo}</strong> <span className="text-[#6B6A63]">siguiendo</span>
              </span>
              <span>
                <strong className="text-[18px] text-[#1B1B18]">{p.reputacion}</strong> <span className="text-[#6B6A63]">puntos</span>
              </span>
              <span>
                <strong className="text-[18px] text-[#1B1B18]">{p.temas}</strong> <span className="text-[#6B6A63]">temas</span>
              </span>
              <span>
                <strong className="text-[18px] text-[#1B1B18]">{p.respuestas}</strong> <span className="text-[#6B6A63]">respuestas</span>
              </span>
              <span>
                <strong className="text-[18px] text-[#16794F]">{p.mejores}</strong> <span className="text-[#6B6A63]">mejores respuestas</span>
              </span>
            </div>

            {(p.maquinas.length > 0 || p.software.length > 0) && (
              <div className="flex flex-col gap-2">
                {p.maquinas.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-bold text-[#44433D] w-[88px]">Máquinas</span>
                    {p.maquinas.map((m) => (
                      <span key={m} className="text-[13px] bg-[#F4F1EA] px-2.5 py-1 rounded-full">
                        {m}
                      </span>
                    ))}
                  </div>
                )}
                {p.software.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-bold text-[#44433D] w-[88px]">Programas</span>
                    {p.software.map((m) => (
                      <span key={m} className="text-[13px] bg-[#EEF4FB] px-2.5 py-1 rounded-full">
                        {m}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {redes.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {redes.map((r) => (
                  <a
                    key={r}
                    href={p.redes[r]}
                    target="_blank"
                    rel="nofollow ugc noopener noreferrer me"
                    className="inline-flex items-center gap-2 border border-[#E0DCD2] rounded-full px-3 py-1.5 text-[13.5px] font-semibold text-[#44433D] hover:border-[#C2560A] hover:text-[#B34D07]"
                  >
                    <SocialIcon label={ETIQUETA_ICONO[r] || r} size={15} />
                    {REDES[r].nombre}
                  </a>
                ))}
              </div>
            )}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 lg:gap-8">
          <section className="flex flex-col gap-3 min-w-0">
            {(avales.length > 0 || propio) && (
              <div className={`${CAJA_RED} flex flex-col gap-3`}>
                <h2 className="m-0 text-[18px] font-bold text-[#1B1B18]">Aptitudes</h2>
                {avales.length ? (
                  <Aptitudes perfilId={p.id} avales={avales} puedeAvalar={Boolean(yo) && !propio} />
                ) : (
                  <p className="m-0 text-[14px] text-[#6B6A63]">
                    Agrega lo que sabes hacer para que la comunidad lo avale.{" "}
                    <LocalizedClientLink href="/foro-cnc/mi-perfil#curriculum" className="font-semibold text-[#B34D07] hover:underline">
                      Agregar aptitudes
                    </LocalizedClientLink>
                  </p>
                )}
              </div>
            )}
            {(p.trayectoria.length > 0 || propio) && (
              <div className={`${CAJA_RED} flex flex-col gap-3`}>
                <h2 className="m-0 text-[18px] font-bold text-[#1B1B18]">Trayectoria</h2>
                {p.trayectoria.length ? (
                  <Trayectoria pasos={p.trayectoria} />
                ) : (
                  <p className="m-0 text-[14px] text-[#6B6A63]">
                    Tu experiencia, estudios, certificaciones y proyectos.{" "}
                    <LocalizedClientLink href="/foro-cnc/mi-perfil#curriculum" className="font-semibold text-[#B34D07] hover:underline">
                      Armar mi currículum
                    </LocalizedClientLink>
                  </p>
                )}
              </div>
            )}
            {(recomendaciones.length > 0 || (!propio && !p.suspendido)) && (
              <div id="recomendaciones" className={`${CAJA_RED} flex flex-col gap-3 scroll-mt-4`}>
                <h2 className="m-0 text-[18px] font-bold text-[#1B1B18]">Recomendaciones</h2>
                <ListaRecomendaciones lista={recomendaciones} propio={propio} />
                {!recomendaciones.length && <p className="m-0 text-[14px] text-[#6B6A63]">Aún no tiene recomendaciones.</p>}
                {!propio && <FormRecomendar perfilId={p.id} nombre={p.nombre} previa={previa} />}
              </div>
            )}
            <h2 className="m-0 mt-2 text-[18px] font-bold text-[#1B1B18]">Publicaciones</h2>
            {temas && temas.temas.length ? (
              temas.temas.map((t) => <TarjetaTema key={t.id} t={t} />)
            ) : (
              <p className="m-0 bg-white border border-dashed border-[#D9D4C8] rounded-[14px] p-6 text-center text-[14.5px] text-[#6B6A63]">
                {propio ? "Aún no publicas. Presume tu primer trabajo o haz una pregunta." : "Aún no tiene publicaciones."}
              </p>
            )}
            {temas && <Paginacion pagina={pagina} total={temas.total} porPagina={POR_PAGINA} base={urlPerfil(p.usuario)} />}
          </section>
          <aside className="flex flex-col gap-4">
            <AvisoSeguro />
          </aside>
        </div>
      </div>
    </main>
  )
}
