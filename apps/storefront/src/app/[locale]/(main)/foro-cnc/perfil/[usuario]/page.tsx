import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import type { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { ImagenSegura as Image } from "@/components/hetna/ImagenSegura"
import { AvisoSeguro } from "@/components/hetna/foro/AvisoSeguro"
import { Avatar, ForoCerrado, InsigniaCuenta, InsigniaTaller, Migas, Paginacion, Palomita, TarjetaTema } from "@/components/hetna/foro/Piezas"
import { Abierto, CAJA_RED, ListaRecomendaciones, Portafolio, Trayectoria } from "@/components/hetna/foro/Red"
import { Aptitudes, BotonSeguir, FormRecomendar } from "@/components/hetna/foro/RedCliente"
import { MaquinasTaller, MaterialesTaller, PortafolioTrabajos, textoZonas } from "@/components/hetna/foro/PerfilTaller"
import { POR_PAGINA, listaTemas, perfilPorUsuario, sesionForo, usuarioDeLigaVieja } from "@/lib/foro/consultas"
import { avalesDe, cuentasRed, estadoRed, miRecomendacion, objetivosDe, recomendacionesDe } from "@/lib/foro/red"
import { SITIO, TIPOS_CUENTA, TIPOS_MAQUINA, objetivoPerfil, urlConversacion, urlPerfil } from "@/lib/foro/tipos"

type Props = {
  params: Promise<{ locale: string; usuario: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

async function generateMetadataEs({ params }: Props): Promise<Metadata> {
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
    robots:
      p.temas + p.respuestas === 0 && !p.bio && !p.trayectoria.length && !p.equipos.length && !p.portafolio.length
        ? { index: false, follow: true }
        : undefined,
  }
}

export default async function ForoPerfil({ params, searchParams }: Props) {
  const { usuario, locale } = await params
  const q = await searchParams
  const pagina = Math.max(1, parseInt(Array.isArray(q.pagina) ? q.pagina[0] : q.pagina || "") || 1)
  const [p, sesion] = await Promise.all([perfilPorUsuario(usuario), sesionForo()])
  if (!p) {
    // Liga vieja (cambió su usuario o estaba cortada a 30 letras): a la nueva
    const nuevo = await usuarioDeLigaVieja(usuario)
    if (nuevo) permanentRedirect(`/${locale}${urlPerfil(nuevo)}`)
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
  const zonas = textoZonas(p.zonas)
  // Redes sociales y página web ya no se muestran: el contacto es sólo por
  // Mensaje o Pedir cotización (dentro de HETNA)

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
      ...(p.aptitudes.length || p.equipos.length
        ? { knowsAbout: [...new Set([...p.aptitudes, ...p.equipos.map((e) => TIPOS_MAQUINA[e.tipo])])] }
        : {}),
      ...(lugar ? { address: { "@type": "PostalAddress", addressLocality: p.ciudad || undefined, addressRegion: p.estadoMx || undefined, addressCountry: "MX" } } : {}),
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
          {p.portada ? (
            <div className="relative h-[140px] sm:h-[220px] bg-[#142033]">
              <Image src={p.portada} alt={`Portada de ${p.nombre}`} fill sizes="(max-width: 1180px) 100vw, 1180px" className="object-cover" priority />
            </div>
          ) : (
            <div className="h-[84px] sm:h-[110px] bg-[#142033] relative">
              <div
                className="absolute inset-0 opacity-[0.12]"
                style={{ backgroundImage: "linear-gradient(#C9D2E0 1px, transparent 1px), linear-gradient(90deg, #C9D2E0 1px, transparent 1px)", backgroundSize: "24px 24px" }}
              />
            </div>
          )}
          <div className="relative px-5 sm:px-7 pb-6 -mt-10 sm:-mt-12 flex flex-col gap-4">
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div className="rounded-full ring-4 ring-white bg-white">
                <Avatar a={p} size={96} />
              </div>
              {propio ? (
                <LocalizedClientLink href="/foro-cnc/mi-perfil" className="border border-[#E0DCD2] font-semibold px-4 py-2 rounded-[10px] text-[14px] hover:border-[#C2560A]">
                  <TS>Editar perfil</TS>
                </LocalizedClientLink>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {p.taller && (
                    <LocalizedClientLink
                      href={`/cotizar?taller=${encodeURIComponent(p.taller.handle)}`}
                      className="inline-flex min-h-[44px] items-center rounded-full bg-[#C2560A] px-5 text-[14.5px] font-semibold text-white hover:bg-[#A84A08]"
                    >
                      <TS>Pedir cotización</TS>
                    </LocalizedClientLink>
                  )}
                  <BotonSeguir objetivo={objetivoPerfil(p)} siguiendo={red.siguiendo} seguidores={red.seguidores} conCuenta={false} />
                  <LocalizedClientLink
                    href={urlConversacion(p.usuario)}
                    className="inline-flex min-h-[44px] items-center rounded-full border border-[#C9C4B8] bg-white px-4 py-2 text-[14px] font-semibold text-[#44433D] hover:border-[#C2560A]"
                  >
                    <TS>✉ Mensaje</TS>
                  </LocalizedClientLink>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="m-0 font-display text-[24px] sm:text-[26px] font-bold text-[#1B1B18] break-words"><TS>{p.nombre}</TS></h1>
                {p.verificado && <Palomita />}
                {p.taller ? <InsigniaTaller a={p} /> : <InsigniaCuenta tipo={p.tipo} />}
                {p.abierto && <Abierto />}
              </div>
              {p.titular && <p className="m-0 text-[16px] text-[#23231F]"><TS>{p.titular}</TS></p>}
              {p.taller && (
                <LocalizedClientLink
                  href={`/talleres/${p.taller.handle}`}
                  className="self-start mt-1 inline-flex items-center gap-1.5 rounded-[10px] bg-[#C2560A] px-4 py-2 text-[14px] font-semibold text-white hover:bg-[#A84A08]"
                >
                  <TS>Ver el taller</TS> <TS>{p.taller.nombre}</TS> <TS>y pedir cotización →</TS>
                </LocalizedClientLink>
              )}
              <span className="text-[14px] text-[#6B6A63]">
                <TS>{lugar ? `📍 ${lugar} · ` : ""}</TS>
                <TS>{zonas ? `${zonas} · ` : ""}</TS><TS>Miembro desde</TS><TS>{" "}</TS>
                {new Date(p.creado).toLocaleDateString("es-MX", { month: "long", year: "numeric", timeZone: "America/Mexico_City" })}
              </span>
            </div>

            <div className="flex gap-6 flex-wrap text-[14px]">
              <span>
                <strong className="text-[18px] text-[#1B1B18]"><TS>{red.seguidores}</TS></strong> <span className="text-[#6B6A63]"><TS>seguidores</TS></span>
              </span>
              <span>
                <strong className="text-[18px] text-[#1B1B18]"><TS>{cuentas.siguiendo}</TS></strong> <span className="text-[#6B6A63]"><TS>siguiendo</TS></span>
              </span>
              <span>
                <strong className="text-[18px] text-[#1B1B18]"><TS>{p.reputacion}</TS></strong> <span className="text-[#6B6A63]"><TS>puntos</TS></span>
              </span>
              <span>
                <strong className="text-[18px] text-[#1B1B18]"><TS>{p.temas}</TS></strong> <span className="text-[#6B6A63]"><TS>temas</TS></span>
              </span>
              <span>
                <strong className="text-[18px] text-[#1B1B18]"><TS>{p.respuestas}</TS></strong> <span className="text-[#6B6A63]"><TS>respuestas</TS></span>
              </span>
              <span>
                <strong className="text-[18px] text-[#16794F]"><TS>{p.mejores}</TS></strong> <span className="text-[#6B6A63]"><TS>mejores respuestas</TS></span>
              </span>
            </div>

            {((p.maquinas.length > 0 && !p.equipos.length) || p.software.length > 0) && (
              <div className="flex flex-col gap-2">
                {/* Lista vieja de máquinas (texto): sólo mientras no capture las nuevas */}
                {p.maquinas.length > 0 && !p.equipos.length && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-bold text-[#44433D] w-[88px]"><TS>Máquinas</TS></span>
                    {p.maquinas.map((m) => (
                      <span key={m} className="text-[13px] bg-[#F4F1EA] px-2.5 py-1 rounded-full">
                        <TS>{m}</TS>
                      </span>
                    ))}
                  </div>
                )}
                {p.software.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-bold text-[#44433D] w-[88px]"><TS>Programas</TS></span>
                    {p.software.map((m) => (
                      <span key={m} className="text-[13px] bg-[#EEF4FB] px-2.5 py-1 rounded-full">
                        <TS>{m}</TS>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 lg:gap-8">
          <section className="flex flex-col gap-3 min-w-0">
            {p.bio && (
              <div className={`${CAJA_RED} flex flex-col gap-2`}>
                <h2 className="m-0 text-[18px] font-bold text-[#1B1B18]"><TS>Acerca de</TS></h2>
                <p className="m-0 text-[15px] text-[#23231F] leading-relaxed whitespace-pre-line break-words"><TS>{p.bio}</TS></p>
              </div>
            )}
            {p.portafolio.length > 0 && (
              <div className={`${CAJA_RED} flex flex-col gap-3`}>
                <h2 className="m-0 text-[18px] font-bold text-[#1B1B18]"><TS>Portafolio</TS></h2>
                <PortafolioTrabajos trabajos={p.portafolio} />
              </div>
            )}
            {p.equipos.length > 0 && (
              <div className={`${CAJA_RED} flex flex-col gap-3`}>
                <h2 className="m-0 text-[18px] font-bold text-[#1B1B18]"><TS>Máquinas</TS></h2>
                <MaquinasTaller equipos={p.equipos} />
              </div>
            )}
            {p.materiales.length > 0 && (
              <div className={`${CAJA_RED} flex flex-col gap-3`}>
                <h2 className="m-0 text-[18px] font-bold text-[#1B1B18]"><TS>Materiales y espesores</TS></h2>
                <MaterialesTaller materiales={p.materiales} />
              </div>
            )}
            {propio && p.tipo !== "cliente" && !p.equipos.length && !p.portafolio.length && (
              <div className={`${CAJA_RED} flex flex-col gap-2`}>
                <h2 className="m-0 text-[18px] font-bold text-[#1B1B18]"><TS>Muestra tu taller</TS></h2>
                <p className="m-0 text-[14px] text-[#6B6A63]">
                  <TS>Agrega tus máquinas, los materiales que cortas y fotos de tus trabajos: es lo que más convence a un cliente.</TS><TS>{" "}</TS>
                  <LocalizedClientLink href="/foro-cnc/mi-perfil#taller" className="font-semibold text-[#B34D07] hover:underline">
                    <TS>Completar mi perfil</TS>
                  </LocalizedClientLink>
                </p>
              </div>
            )}
            {/* Portafolio viejo (fotos de "Proyectos" de la trayectoria): sólo si no hay del nuevo */}
            {!p.portafolio.length && p.trayectoria.some((x) => x.tipo === "proyecto" && x.fotos?.length) && (
              <div className={`${CAJA_RED} flex flex-col gap-3`}>
                <h2 className="m-0 text-[18px] font-bold text-[#1B1B18]"><TS>Portafolio</TS></h2>
                <Portafolio pasos={p.trayectoria} />
              </div>
            )}
            {(avales.length > 0 || propio) && (
              <div className={`${CAJA_RED} flex flex-col gap-3`}>
                <h2 className="m-0 text-[18px] font-bold text-[#1B1B18]"><TS>Aptitudes</TS></h2>
                {avales.length ? (
                  <Aptitudes perfilId={p.id} avales={avales} puedeAvalar={Boolean(yo) && !propio} />
                ) : (
                  <p className="m-0 text-[14px] text-[#6B6A63]">
                    <TS>Agrega lo que sabes hacer para que la comunidad lo avale.</TS><TS>{" "}</TS>
                    <LocalizedClientLink href="/foro-cnc/mi-perfil#curriculum" className="font-semibold text-[#B34D07] hover:underline">
                      <TS>Agregar aptitudes</TS>
                    </LocalizedClientLink>
                  </p>
                )}
              </div>
            )}
            {(p.trayectoria.length > 0 || propio) && (
              <div className={`${CAJA_RED} flex flex-col gap-3`}>
                <h2 className="m-0 text-[18px] font-bold text-[#1B1B18]"><TS>Trayectoria</TS></h2>
                {p.trayectoria.length ? (
                  <Trayectoria pasos={p.trayectoria} />
                ) : (
                  <p className="m-0 text-[14px] text-[#6B6A63]">
                    <TS>Tu experiencia, estudios, certificaciones y proyectos.</TS><TS>{" "}</TS>
                    <LocalizedClientLink href="/foro-cnc/mi-perfil#curriculum" className="font-semibold text-[#B34D07] hover:underline">
                      <TS>Armar mi currículum</TS>
                    </LocalizedClientLink>
                  </p>
                )}
              </div>
            )}
            {(recomendaciones.length > 0 || (!propio && !p.suspendido)) && (
              <div id="recomendaciones" className={`${CAJA_RED} flex flex-col gap-3 scroll-mt-4`}>
                <h2 className="m-0 text-[18px] font-bold text-[#1B1B18]"><TS>Recomendaciones</TS></h2>
                <ListaRecomendaciones lista={recomendaciones} propio={propio} />
                {!recomendaciones.length && <p className="m-0 text-[14px] text-[#6B6A63]"><TS>Aún no tiene recomendaciones.</TS></p>}
                {!propio && <FormRecomendar perfilId={p.id} nombre={p.nombre} previa={previa} />}
              </div>
            )}
            <h2 className="m-0 mt-2 text-[18px] font-bold text-[#1B1B18]"><TS>Publicaciones</TS></h2>
            {temas && temas.temas.length ? (
              temas.temas.map((t) => <TarjetaTema key={t.id} t={t} />)
            ) : (
              <p className="m-0 bg-white border border-dashed border-[#D9D4C8] rounded-[14px] p-6 text-center text-[14.5px] text-[#6B6A63]">
                <TS>{propio ? "Aún no publicas. Presume tu primer trabajo o haz una pregunta." : "Aún no tiene publicaciones."}</TS>
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

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata(...args: Parameters<typeof generateMetadataEs>) {
  return metaEnIdioma(await generateMetadataEs(...args))
}
