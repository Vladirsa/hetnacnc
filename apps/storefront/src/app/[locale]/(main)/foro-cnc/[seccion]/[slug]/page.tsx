import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound } from "next/navigation"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { AvisoSeguro } from "@/components/hetna/foro/AvisoSeguro"
import { FormRespuesta, ResponderA } from "@/components/hetna/foro/FormRespuesta"
import { BotonMejor, BotonVoto, Compartir, EncuestaVotar, MenuMas } from "@/components/hetna/foro/Interaccion"
import { AutorChip, Cuerpo, ForoCerrado, Fotos, InsigniaTema, Migas, haceCuanto } from "@/components/hetna/foro/Piezas"
import { VideoLigero } from "@/components/hetna/foro/VideoLigero"
import { contarVisita, listaTemas, misVotos, respuestas as leerRespuestas, sesionForo, tema as leerTema } from "@/lib/foro/consultas"
import { extracto, leerVideo } from "@/lib/foro/contenido"
import { type Respuesta, SITIO, urlPerfil, urlTema } from "@/lib/foro/tipos"

type Props = {
  params: Promise<{ locale: string; seccion: string; slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { seccion, slug } = await params
  const sesion = await sesionForo()
  const t = await leerTema(seccion, slug, sesion?.perfil?.id)
  if (!t) return { title: { absolute: "Tema no encontrado | Foro CNC México" }, robots: { index: false } }
  const url = `${SITIO}/mx${urlTema(t)}`
  const descripcion = extracto(t.cuerpo, 155)
  return {
    title: { absolute: `${t.titulo} | Foro CNC México` },
    description: descripcion,
    alternates: { canonical: url },
    robots: t.estado === "publicado" ? undefined : { index: false, follow: false },
    openGraph: {
      title: t.titulo,
      description: descripcion,
      url,
      type: "article",
      siteName: "HETNA CNC",
      locale: "es_MX",
      images: t.fotos[0] ? [{ url: `${SITIO}${t.fotos[0]}` }] : undefined,
    },
  }
}

// Datos para Google: preguntas como Pregunta y respuesta; lo demás como publicación de foro
function datosEstructurados(t: NonNullable<Awaited<ReturnType<typeof leerTema>>>, rs: Respuesta[]) {
  const url = `${SITIO}/mx${urlTema(t)}`
  const persona = (a: Respuesta["autor"]) => ({ "@type": "Person", name: a.nombre, url: `${SITIO}/mx${urlPerfil(a.usuario)}` })
  const publicadas = rs.filter((r) => r.estado === "publicado")
  const respuesta = (r: Respuesta) => ({
    "@type": t.tipo === "pregunta" ? "Answer" : "Comment",
    text: r.cuerpo.slice(0, 3000),
    datePublished: r.creado,
    upvoteCount: r.votos,
    url: `${url}#r${r.id}`,
    author: persona(r.autor),
  })
  if (t.tipo === "pregunta" && publicadas.length) {
    const mejor = publicadas.find((r) => r.id === t.mejorRespuestaId)
    return {
      "@context": "https://schema.org",
      "@type": "QAPage",
      mainEntity: {
        "@type": "Question",
        name: t.titulo,
        text: t.cuerpo.slice(0, 3000),
        answerCount: publicadas.length,
        upvoteCount: t.votos,
        datePublished: t.creado,
        author: persona(t.autor),
        ...(mejor ? { acceptedAnswer: respuesta(mejor) } : {}),
        suggestedAnswer: publicadas.filter((r) => r !== mejor).sort((a, b) => b.votos - a.votos).slice(0, 5).map(respuesta),
      },
    }
  }
  return {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    headline: t.titulo,
    text: t.cuerpo.slice(0, 3000),
    url,
    datePublished: t.creado,
    dateModified: t.actualizado,
    author: persona(t.autor),
    ...(t.fotos[0] ? { image: `${SITIO}${t.fotos[0]}` } : {}),
    interactionStatistic: [
      { "@type": "InteractionCounter", interactionType: "https://schema.org/LikeAction", userInteractionCount: t.votos },
      { "@type": "InteractionCounter", interactionType: "https://schema.org/CommentAction", userInteractionCount: publicadas.length },
    ],
    comment: publicadas.slice(0, 10).map(respuesta),
  }
}

export default async function ForoTema({ params, searchParams }: Props) {
  const { seccion, slug } = await params
  const q = await searchParams
  const sesion = await sesionForo()
  const perfil = sesion?.perfil || null
  const t = await leerTema(seccion, slug, perfil?.id)
  if (!t) {
    if (t === null && !(await listaTemas({ limite: 1 }))) return <ForoCerrado />
    notFound()
  }

  const [rs, votos, relacionados] = await Promise.all([
    leerRespuestas(t.id, perfil?.id),
    perfil ? misVotos(perfil.id, t.id) : Promise.resolve({ tema: false, respuestas: [] as number[], encuesta: null }),
    listaTemas({ seccion: t.seccion.slug, orden: "populares", limite: 6 }),
  ])
  if (t.estado === "publicado") await contarVisita(t.id, (await headers()).get("user-agent") || "")

  const esAutor = perfil?.id === t.autor.id
  const esModerador = perfil?.rol === "moderador" || perfil?.rol === "admin"
  const esPregunta = t.tipo === "pregunta"

  // respuestas principales (la mejor primero) y sus respuestas debajo
  const porId = new Map(rs.map((r) => [r.id, r]))
  const raiz = (r: Respuesta): number => {
    let x = r
    for (let i = 0; i < 20 && x.padreId && porId.has(x.padreId); i++) x = porId.get(x.padreId)!
    return x.id
  }
  const principales = rs.filter((r) => !r.padreId || !porId.has(r.padreId))
  principales.sort((a, b) => (a.id === t.mejorRespuestaId ? -1 : b.id === t.mejorRespuestaId ? 1 : 0))
  const hijas = new Map<number, Respuesta[]>()
  for (const r of rs) if (r.padreId && porId.has(r.padreId)) hijas.set(raiz(r), [...(hijas.get(raiz(r)) || []), r])

  const nPublicadas = rs.filter((r) => r.estado === "publicado").length
  const ligasVideo = t.ligas.map((l) => ({ l, v: leerVideo(l) }))
  const aviso = Array.isArray(q.aviso) ? q.aviso[0] : q.aviso

  const tarjetaRespuesta = (r: Respuesta, hija = false) => {
    const mejor = r.id === t.mejorRespuestaId
    return (
      <article
        key={r.id}
        id={`r${r.id}`}
        className={`scroll-mt-24 flex flex-col gap-3 ${hija ? "pl-4 sm:pl-6 border-l-2 border-[#EDE9E0] py-2" : `bg-white border rounded-[14px] p-4 sm:p-5 ${mejor ? "border-[#8CCBA8] shadow-[0_0_0_3px_#E6F4EC]" : "border-[#E7E4DC]"}`}`}
      >
        <div className="flex items-start justify-between gap-3">
          <AutorChip a={r.autor} cuando={r.creado} size={hija ? 28 : 34} />
          <div className="flex items-center gap-1">
            {mejor && <span className="text-[12px] font-bold text-[#16794F] whitespace-nowrap">✓ Mejor respuesta</span>}
            <MenuMas tipo="respuesta" id={r.id} puedeOcultar={perfil?.id === r.autor.id || esModerador} esModerador={esModerador} estado={r.estado} />
          </div>
        </div>
        {r.estado !== "publicado" && (
          <span className="self-start text-[12px] font-bold text-[#9A4A06] bg-[#FFF3E0] px-2 py-0.5 rounded">
            {r.estado === "revision" ? "En revisión: solo tú la ves" : "Oculta"}
          </span>
        )}
        <Cuerpo texto={r.cuerpo} />
        <Fotos fotos={r.fotos} />
        <div className="flex items-center gap-3 flex-wrap">
          <BotonVoto respuestaId={r.id} votos={r.votos} votado={votos.respuestas.includes(r.id)} propio={perfil?.id === r.autor.id} />
          {esPregunta && esAutor && !hija && <BotonMejor temaId={t.id} respuestaId={r.id} esMejor={mejor} />}
          {perfil && <ResponderA temaId={t.id} padreId={r.id} />}
        </div>
        {!hija && (hijas.get(r.id) || []).length > 0 && <div className="flex flex-col gap-2">{hijas.get(r.id)!.map((h) => tarjetaRespuesta(h, true))}</div>}
      </article>
    )
  }

  return (
    <main className="w-full bg-[#FAF9F6]">
      {t.estado === "publicado" && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datosEstructurados(t, rs)).replace(/</g, "\\u003c") }} />
      )}
      <div className="max-w-[1180px] mx-auto px-4 lg:px-16 xl:px-0 py-6 lg:py-8 flex flex-col gap-5">
        <Migas items={[{ nombre: "Foro CNC", href: "/foro-cnc" }, { nombre: t.seccion.nombre, href: `/foro-cnc/${t.seccion.slug}` }, { nombre: t.titulo }]} />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 lg:gap-8">
          <div className="flex flex-col gap-5 min-w-0">
            {aviso === "revision" && (
              <p className="m-0 bg-[#FFF6E8] border border-[#F2C98F] text-[#5A3A12] rounded-[12px] px-4 py-3 text-[14px]">
                Recibimos tu publicación. Se mostrará a todos en cuanto la revisemos (normalmente el mismo día).
              </p>
            )}
            {aviso === "contacto" && (
              <p className="m-0 bg-[#EEF4FB] border border-[#C9DBF0] text-[#1E3A5F] rounded-[12px] px-4 py-3 text-[14px]">
                Publicado. Ocultamos los teléfonos y correos: los clientes te escriben y compran dentro de HETNA, donde tu venta y su pago están protegidos.
              </p>
            )}

            <article className="bg-white border border-[#E7E4DC] rounded-[16px] p-5 sm:p-6 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <InsigniaTema tipo={t.tipo} />
                  {t.patrocinado && <span className="text-[11px] font-bold uppercase tracking-wide text-[#9A978C]">Patrocinado</span>}
                  {t.resuelto && <span className="text-[12px] font-bold text-[#16794F]">✓ Resuelto</span>}
                  {t.estado !== "publicado" && (
                    <span className="text-[12px] font-bold text-[#9A4A06] bg-[#FFF3E0] px-2 py-0.5 rounded">
                      {t.estado === "revision" ? "En revisión: solo tú lo ves" : "Oculto"}
                    </span>
                  )}
                </div>
                <MenuMas tipo="tema" id={t.id} puedeOcultar={esAutor || esModerador} esModerador={esModerador} estado={t.estado} />
              </div>
              <h1 className="m-0 font-display text-[24px] sm:text-[28px] leading-[1.2] font-bold text-[#1B1B18]">{t.titulo}</h1>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <AutorChip a={t.autor} cuando={t.creado} />
                <span className="text-[12.5px] text-[#6B6A63]">
                  {t.vistas} vistas · actividad {haceCuanto(t.ultimaActividad)}
                </span>
              </div>
              <Cuerpo texto={t.cuerpo} />
              <Fotos fotos={t.fotos} />
              {ligasVideo.length > 0 && (
                <div className="flex flex-col gap-3">
                  {ligasVideo.map(({ l, v }) =>
                    v ? (
                      <VideoLigero key={l} video={v} />
                    ) : (
                      <a key={l} href={l} target="_blank" rel="nofollow ugc noopener noreferrer" className="flex items-center gap-3 border border-[#E7E4DC] rounded-[10px] px-4 py-3 hover:border-[#C2560A]">
                        <span className="text-[#B34D07] font-semibold text-[14px] truncate">{new URL(l).hostname.replace(/^www\./, "")}</span>
                        <span className="text-[13px] text-[#6B6A63] truncate">{l.replace(/^https?:\/\/(www\.)?[^/]+/, "") || "/"}</span>
                      </a>
                    )
                  )}
                </div>
              )}
              {t.encuesta && (
                <EncuestaVotar temaId={t.id} pregunta={t.encuesta.pregunta} opciones={t.encuesta.opciones} resultados={t.resultados} elegida={votos.encuesta} sesion={Boolean(perfil)} />
              )}
              <div className="flex items-center gap-2.5 flex-wrap border-t border-[#F0EDE6] mt-1 pt-4">
                <BotonVoto temaId={t.id} votos={t.votos} votado={votos.tema} propio={esAutor} />
                <Compartir url={`/mx${urlTema(t)}`} titulo={t.titulo} />
                <a href="#responder" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#E0DCD2] bg-white text-[13.5px] font-semibold text-[#44433D] hover:border-[#C2560A]">
                  Responder
                </a>
              </div>
            </article>

            <section className="flex flex-col gap-3" aria-label="Respuestas">
              <h2 className="m-0 text-[18px] font-bold text-[#1B1B18]">
                {nPublicadas ? `${nPublicadas} ${nPublicadas === 1 ? "respuesta" : "respuestas"}` : "Aún no hay respuestas"}
              </h2>
              {principales.map((r) => tarjetaRespuesta(r))}
            </section>

            <section id="responder" className="bg-white border border-[#E7E4DC] rounded-[16px] p-5 flex flex-col gap-4 scroll-mt-24">
              <h2 className="m-0 text-[17px] font-bold text-[#1B1B18]">Tu respuesta</h2>
              {!sesion ? (
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <p className="m-0 text-[14.5px] text-[#44433D]">Entra o crea tu cuenta gratis para responder y ganar puntos de reputación.</p>
                  <div className="flex gap-2 shrink-0">
                    <LocalizedClientLink href="/login" className="border border-[#E0DCD2] font-semibold px-4 py-2.5 rounded-[10px] text-[14px] hover:border-[#C2560A]">
                      Entrar
                    </LocalizedClientLink>
                    <LocalizedClientLink href="/register" className="bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold px-4 py-2.5 rounded-[10px] text-[14px]">
                      Crear cuenta
                    </LocalizedClientLink>
                  </div>
                </div>
              ) : !perfil ? (
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <p className="m-0 text-[14.5px] text-[#44433D]">Crea tu perfil del foro (1 minuto) para responder.</p>
                  <LocalizedClientLink href={`/foro-cnc/mi-perfil?siguiente=${encodeURIComponent(urlTema(t) + "#responder")}`} className="shrink-0 bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold px-4 py-2.5 rounded-[10px] text-[14px]">
                    Crear perfil
                  </LocalizedClientLink>
                </div>
              ) : t.estado !== "publicado" ? (
                <p className="m-0 text-[14px] text-[#6B6A63]">Podrás responder cuando el tema se publique.</p>
              ) : (
                <FormRespuesta temaId={t.id} />
              )}
              <AvisoSeguro compacto />
            </section>
          </div>

          <aside className="flex flex-col gap-4">
            <div className="bg-white border border-[#E7E4DC] rounded-[14px] p-4 flex flex-col gap-3">
              <span className="text-[12px] font-bold uppercase tracking-wide text-[#9A978C]">Publicado por</span>
              <AutorChip a={t.autor} />
              <LocalizedClientLink href={urlPerfil(t.autor.usuario)} className="text-center border border-[#E0DCD2] rounded-[10px] py-2 text-[14px] font-semibold hover:border-[#C2560A]">
                Ver perfil y trabajos
              </LocalizedClientLink>
            </div>
            <AvisoSeguro />
            {relacionados && relacionados.temas.filter((x) => x.id !== t.id).length > 0 && (
              <div className="flex flex-col gap-3">
                <span className="text-[12px] font-bold uppercase tracking-wide text-[#9A978C]">Más en {t.seccion.nombre}</span>
                {relacionados.temas
                  .filter((x) => x.id !== t.id)
                  .slice(0, 5)
                  .map((x) => (
                    <LocalizedClientLink key={x.id} href={urlTema(x)} className="bg-white border border-[#E7E4DC] rounded-[12px] px-4 py-3 hover:border-[#C2560A] flex flex-col gap-1">
                      <span className="text-[14px] font-semibold text-[#1B1B18] leading-snug line-clamp-2">{x.titulo}</span>
                      <span className="text-[12.5px] text-[#6B6A63]">
                        {x.respuestas} {x.respuestas === 1 ? "respuesta" : "respuestas"}
                      </span>
                    </LocalizedClientLink>
                  ))}
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  )
}
