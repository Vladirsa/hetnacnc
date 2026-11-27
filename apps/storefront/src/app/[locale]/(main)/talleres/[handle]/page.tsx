// Pasa por ImagenSegura: estas direcciones vienen de la base o del
// navegador, y next/image TRUENA con las que no empiezan en "/" o
// "https://" (una vista previa "blob:", por ejemplo).
import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import { textoCapacidad } from "@/lib/hetna/capacidad-libre"
import { resenasDeTaller, type ResenaTaller } from "@/lib/hetna/resenas-taller"
import { cotizadorDeTaller } from "@/lib/hetna/perfil-unico"
import { IMAGEN_OG, descripcionCorta } from "@/lib/helpers/seo"
import { ImagenSegura as Image } from '@/components/hetna/ImagenSegura'
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import BotonPreguntarTaller from "@/components/hetna/chat/BotonPreguntarTaller"
import FormSolicitudTaller from "@/components/hetna/taller/FormSolicitudTaller"
import { ListaPaquetes } from "@/components/hetna/taller/PaquetesServicio"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { ProductListingSkeleton } from "@/components/organisms/ProductListingSkeleton/ProductListingSkeleton"
import { SellerOffersListing } from "@/components/sections/SellerOffersListing/SellerOffersListing"
import { areaTexto, nombreTipoMaquina, tallerPorHandle, textoRespuesta, ubicacion, type Medido, type Taller } from "@/lib/hetna/talleres"
import { TarjetaTema } from "@/components/hetna/foro/Piezas"
import { BotonSeguir } from "@/components/hetna/foro/RedCliente"
import { listaTemas, sesionForo } from "@/lib/foro/consultas"
import { estadoRed, objetivosDeTaller } from "@/lib/foro/red"
import { type TemaResumen, objetivoTaller } from "@/lib/foro/tipos"

// Mini-sitio del taller (estilo "showroom"): portada, pestañas y cotización dentro de HETNA.

type Props = {
  params: Promise<{ handle: string; locale: string }>
  searchParams: Promise<{ tab?: string; page?: string; paquete?: string }>
}

const PESTANAS = [
  ["inicio", "Inicio"],
  ["productos", "Productos"],
  ["nosotros", "Quiénes somos"],
  ["capacidades", "Capacidades"],
  ["cotizar", "Cotizar"],
] as const
type Pestana = (typeof PESTANAS)[number][0]

async function generateMetadataEs({ params }: Props): Promise<Metadata> {
  const { handle } = await params
  const t = await tallerPorHandle(handle)
  if (!t) return {}
  const donde = ubicacion(t.perfil)
  return {
    title: `${t.nombre}${donde ? ` · ${donde}` : ""} | Taller CNC`,
    description: descripcionCorta(
      t.perfil.lema ||
        t.descripcion ||
        `${t.nombre}: taller CNC en HETNA. Capacidades, máquinas, materiales y cotización.`
    ),
    alternates: { canonical: `https://hetnacnc.com/mx/talleres/${encodeURIComponent(handle)}` },
    openGraph: { images: t.banner ? [t.banner] : [IMAGEN_OG] },
  }
}

const CAJA = "rounded-2xl border border-[#E7E4DC] bg-white p-6 sm:p-8"
const H2 = "mb-4 text-xl font-extrabold text-[#142033]"
const CHIP = "rounded-full bg-[#F3F1EA] px-3 py-1 text-sm text-[#40403A]"

export default async function MiniSitioTaller({ params, searchParams }: Props) {
  const { handle, locale } = await params
  const sp = await searchParams
  const t = await tallerPorHandle(handle)
  if (!t) notFound()

  const valida = PESTANAS.some(([id]) => id === sp.tab)
  const tab: Pestana = valida ? (sp.tab as Pestana) : sp.page ? "productos" : "inicio"
  const page = sp.page ? Math.max(1, parseInt(sp.page, 10) || 1) : 1

  // Red del foro: seguidores del taller y lo que publica en la comunidad
  const [sesion, objetivos] = await Promise.all([sesionForo(), objetivosDeTaller(t.id)])
  const [red, publicaciones, opiniones, enLinea] = await Promise.all([
    estadoRed(objetivos, sesion?.perfil?.id),
    tab === "inicio" ? listaTemas({ vendedorId: t.id, orden: "nuevos", limite: 4 }) : Promise.resolve(null),
    tab === "inicio" ? resenasDeTaller(t.handle) : Promise.resolve(null),
    cotizadorDeTaller(t.handle),
  ])
  const esDueno = Boolean(sesion?.perfil?.vendedor && sesion.perfil.vendedor === t.id)
  // «Pedir cotización» de un servicio con precio "desde": llega con el servicio escrito
  const paquete = sp.paquete ? t.paquetes.find((x) => x.id === sp.paquete) : undefined

  const p = t.perfil
  const donde = ubicacion(p)
  const datos: [string, string][] = [
    p.entrega ? ["Entrega típica", p.entrega] : null,
    p.horario ? ["Horario", p.horario] : null,
    p.maquinas.length ? ["Máquinas", String(p.maquinas.length)] : null,
    p.anos !== undefined ? ["Años de experiencia", String(p.anos)] : null,
    p.calificacion !== undefined
      ? ["Calificación", `★ ${p.calificacion.toFixed(1)}${p.resenas ? ` (${p.resenas})` : ""}`]
      : ["Calificación", "Taller nuevo"],
    p.medido?.respuesta_horas != null ? ["Responde en", textoRespuesta(p.medido.respuesta_horas)] : null,
    p.medido?.puntualidad_pct != null && p.medido.con_fecha >= 3 ? ["Entregas a tiempo", `${p.medido.puntualidad_pct}%`] : null,
  ].filter(Boolean) as [string, string][]

  return (
    <main className="w-full pb-16">
      {/* Portada */}
      <section className="relative">
        <div
          className="h-40 w-full bg-[#142033] sm:h-64"
          style={
            t.banner
              ? { backgroundImage: `url(${t.banner})`, backgroundSize: "cover", backgroundPosition: "center" }
              : {
                  backgroundImage:
                    "repeating-linear-gradient(0deg,rgba(255,255,255,.06) 0 1px,transparent 1px 24px),repeating-linear-gradient(90deg,rgba(255,255,255,.06) 0 1px,transparent 1px 24px)",
                }
          }
        />
        <div className="h-1.5 w-full bg-[#C2560A]" />
        <div className="mx-auto flex max-w-[1100px] flex-col gap-4 px-4 pb-4 sm:flex-row sm:items-end lg:px-6">
          <div className="-mt-12 grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl border-4 border-white bg-[#142033] text-3xl font-extrabold text-white shadow-lg sm:-mt-16 sm:h-28 sm:w-28">
            {t.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <Image src={t.logo} alt={t.nombre} className="h-full w-full object-cover" width={300} height={300} />
            ) : (
              t.nombre.slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1 pt-2">
            <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-extrabold text-[#142033] sm:text-3xl"><TS>{t.nombre}</TS></h1>{t.verificado ? (<span className="rounded-full bg-[#E7F5EC] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#1E7B3A]" title="HETNA revisó su identificación y su taller"><TS>✓ Taller verificado</TS></span>) : (<span className="rounded-full bg-[#F1F0EC] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#6B675C]" title="Se registró en HETNA; todavía no revisamos su identificación ni su taller"><TS>Registrado · sin verificar</TS></span>)}{t.empresaVerificada && (<span className="rounded-full bg-[#E7F5EC] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#1E7B3A]" title="HETNA revisó su constancia de situación fiscal"><TS>🏢 Empresa verificada</TS></span>)}{t.fundador && (<span className="rounded-full bg-[#FFF1E6] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#C2560A]"><TS>★ Taller fundador</TS></span>)}{t.capacidadLibre && (<span className="rounded-full bg-[#FFF6E0] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#8A5A00]" title={t.capacidadLibre.nota || "Tiene máquina libre esta semana"}>{textoCapacidad(t.capacidadLibre)}</span>)}{t.embajador && (<span className="rounded-full bg-[#EEF2FB] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#1a3a5c]" title="Invitó a otro taller de confianza que ya vende en HETNA"><TS>🤝 Taller embajador</TS></span>)}{t.perfil.tipo_cuenta && t.perfil.tipo_cuenta !== "taller" && (<span className="rounded-full bg-[#EEF2FB] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#1a3a5c]"><TS>{t.perfil.tipo_cuenta === "ambos" ? "🏭📦 Taller y proveedor" : "📦 Proveedor"}</TS></span>)}{t.perfil.importacion && (<span className="rounded-full bg-[#EEF2FB] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#1a3a5c]" title="Envía puerta a puerta con impuestos de importación incluidos"><TS>🌏 Importación desde</TS> <TS>{t.perfil.importacion.pais}</TS></span>)}</div>
            {t.certificaciones.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2" aria-label="Certificaciones acreditadas">
                {t.certificaciones.map((c) => (
                  <li key={c.tipo + c.nombre} className="rounded-full border border-[#CFE3D6] bg-white px-3 py-1 text-xs font-semibold text-[#1E7B3A]" title={[c.emisor && `Emitida por ${c.emisor}`, c.vigencia && `vigente hasta ${c.vigencia}`, "Documento revisado por HETNA"].filter(Boolean).join(" · ")}>
                    🎖 <TS>{c.nombre}</TS>
                  </li>
                ))}
              </ul>
            )}
            {p.lema && <p className="mt-0.5 text-[#40403A]"><TS>{p.lema}</TS></p>}
            {p.marcas && p.marcas.length > 0 && <p className="mt-1 text-sm text-[#40403A]"><b><TS>Marcas que distribuye:</TS></b> <TS>{p.marcas.join(", ")}</TS></p>}
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[#6B675C]">
              {donde && <span>📍 <TS>{donde}</TS></span>}
              {p.servicios.slice(0, 3).map((s) => (
                <span key={s}>· <TS>{s}</TS></span>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {!esDueno && (
              <BotonSeguir objetivo={objetivoTaller(t.id)} siguiendo={red.siguiendo} seguidores={red.seguidores} etiqueta="Seguir taller" />
            )}
            <BotonPreguntarTaller tallerHandle={t.handle} tallerNombre={t.nombre} />
            {enLinea && (
              <LocalizedClientLink
                href={`/t/${enLinea}`}
                className="flex h-12 items-center justify-center rounded-xl border-2 border-[#142033] px-5 text-center font-semibold text-[#142033] hover:bg-[#142033] hover:text-white"
                title="Sube tu archivo y ve un precio estimado al momento"
              >
                <TS>Precio al momento</TS>
              </LocalizedClientLink>
            )}
            <LocalizedClientLink
              href={`/talleres/${t.handle}?tab=cotizar`}
              className="flex h-12 items-center justify-center rounded-xl bg-[#C2560A] px-5 text-center font-semibold text-white hover:brightness-110"
            >
              <TS>Solicitar cotización</TS>
            </LocalizedClientLink>
          </div>
        </div>
      </section>

      {/* Pestañas */}
      <nav className="sticky top-0 z-20 border-y border-[#E7E4DC] bg-white/95 backdrop-blur" aria-label="Secciones del taller">
        <ul className="mx-auto flex max-w-[1100px] gap-1 overflow-x-auto whitespace-nowrap px-4 lg:px-6">
          {PESTANAS.map(([id, label]) => (
            <li key={id}>
              <LocalizedClientLink
                href={`/talleres/${t.handle}${id === "inicio" ? "" : `?tab=${id}`}`}
                aria-current={tab === id ? "page" : undefined}
                className={`block border-b-[3px] px-4 py-3 text-sm font-semibold ${
                  tab === id ? "border-[#C2560A] text-[#142033]" : "border-transparent text-[#6B675C] hover:text-[#142033]"
                }`}
              >
                <TS>{label}</TS>
              </LocalizedClientLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mx-auto mt-6 grid max-w-[1100px] gap-5 px-4 lg:px-6">
        {tab === "inicio" && t.paquetes.length > 0 && (
          <div className="mb-8">
            <ListaPaquetes
              items={t.paquetes.map((p) => ({ p, handle: t.handle }))}
              titulo="Servicios"
              texto={`Precios de referencia. Pide tu cotización y ${t.nombre} te manda el precio final por HETNA.`}
            />
          </div>
        )}
        {tab === "inicio" && <Inicio t={t} datos={datos} publicaciones={publicaciones?.temas || []} resenas={opiniones?.resenas || []} />}

        {tab === "productos" && (
          <section className={CAJA}>
            <h2 className={H2}><TS>Productos de</TS> <TS>{t.nombre}</TS></h2>
            <Suspense key={page} fallback={<ProductListingSkeleton />}>
              <SellerOffersListing seller_id={t.id} locale={locale} page={page} />
            </Suspense>
          </section>
        )}

        {tab === "nosotros" && <Nosotros t={t} donde={donde} />}

        {tab === "capacidades" && <Capacidades t={t} />}

        {tab === "cotizar" && (
          <section>
            <h2 className={H2}><TS>Cotiza con</TS> <TS>{t.nombre}</TS></h2>
            <p className="mb-4 text-sm text-[#6B675C]">
              <TS>Describe tu trabajo y</TS> <TS>{t.nombre}</TS> <TS>te manda su propuesta por HETNA. Tú comparas, eliges y pagas dentro de la plataforma.</TS>
            </p>
            {paquete && (
              <p className="mb-4 rounded-xl bg-[#FFF1E6] px-4 py-3 text-sm text-[#142033]">
                <TS>Servicio:</TS> <strong><TS>{paquete.titulo}</TS></strong> <TS>· desde $</TS>{paquete.desde.toLocaleString("es-MX")} <TS>MXN</TS>
                <TS>{paquete.entrega_dias ? ` · ${paquete.entrega_dias} días hábiles` : ""}</TS>
              </p>
            )}
            <FormSolicitudTaller
              taller={t.handle}
              nombreTaller={t.nombre}
              servicioInicial={paquete && paquete.categoria !== "otro" ? "Diseño CAD/CAM" : undefined}
              necesidadInicial={paquete && paquete.categoria !== "otro" ? "Diseño" : undefined}
              descripcionInicial={paquete ? `el servicio «${paquete.titulo}» (desde $${paquete.desde.toLocaleString("es-MX")} MXN)` : undefined}
            />
          </section>
        )}
      </div>
    </main>
  )
}

function Inicio({
  t,
  datos,
  publicaciones,
  resenas,
}: {
  t: Taller
  datos: [string, string][]
  publicaciones: TemaResumen[]
  resenas: ResenaTaller[]
}) {
  const p = t.perfil
  return (
    <>
      <dl className="grid grid-cols-2 overflow-hidden rounded-2xl border border-[#E7E4DC] bg-white sm:grid-cols-4">
        {datos.map(([k, v]) => (
          <div key={k} className="border-b border-r border-[#E7E4DC] px-5 py-4 sm:border-b-0">
            <dt className="text-xs uppercase tracking-wider text-[#6B675C]"><TS>{k}</TS></dt>
            <dd className="mt-1 text-lg font-bold text-[#142033]"><TS>{v}</TS></dd>
          </div>
        ))}
      </dl>

      {p.medido && (p.medido.terminados > 0 || p.medido.respuesta_horas != null) && <Cumplimiento m={p.medido} />}

      {p.resenas ? (
        <section className={CAJA}>
          <h2 className={H2}><TS>Reputación en HETNA</TS></h2>
          {!p.historial_suficiente && (
            <p className="-mt-2 mb-3 rounded-lg bg-[#FFF8EE] px-3 py-2 text-xs text-[#8A5A00]">
              <TS>Perfil nuevo: todavía no tiene suficiente historial (</TS><TS>{p.resenas}</TS> <TS>{p.resenas === 1 ? "evaluación" : "evaluaciones"}</TS><TS>). Toma la calificación con cautela.</TS>
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-[#FAF9F5] p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[#6B675C]"><TS>Reputación comercial</TS></p>
              <p className="text-2xl font-extrabold text-[#142033]"><TS>{p.reputacion_comercial ?? "—"}</TS><span className="text-sm font-semibold text-[#6B675C]"> / 5</span></p>
              <ul className="mt-2 grid gap-1 text-sm text-[#40403A]">
                {[["tiempo", "Cumplimiento de entregas"], ["comunicacion", "Comunicación"], ["precio", "Precio"], ["profesionalismo", "Profesionalismo"], ["posventa", "Servicio posventa"]]
                  .filter(([k]) => p.indicadores?.[k] != null)
                  .map(([k, n]) => (
                    <li key={k} className="flex justify-between"><span>{n}</span><b><TS>{p.indicadores?.[k]}</TS></b></li>
                  ))}
              </ul>
            </div>
            <div className="rounded-xl bg-[#FAF9F5] p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-[#6B675C]"><TS>Capacidad técnica</TS></p>
              <p className="text-2xl font-extrabold text-[#142033]"><TS>{p.capacidad_tecnica ?? "—"}</TS><span className="text-sm font-semibold text-[#6B675C]"> / 5</span></p>
              <ul className="mt-2 grid gap-1 text-sm text-[#40403A]">
                {[["calidad", "Calidad de fabricación"], ["capacidad", "Cumple especificaciones"]]
                  .filter(([k]) => p.indicadores?.[k] != null)
                  .map(([k, n]) => (
                    <li key={k} className="flex justify-between"><span>{n}</span><b><TS>{p.indicadores?.[k]}</TS></b></li>
                  ))}
              </ul>
              {t.certificaciones.length > 0 && <p className="mt-2 text-xs text-[#1E7B3A]">+ <TS>{t.certificaciones.length}</TS> <TS>certificación(es) acreditada(s)</TS></p>}
            </div>
          </div>
          <p className="mt-3 text-xs text-[#6B675C]">
            <TS>Calculada sólo con evaluaciones de trabajos pagados y entregados en HETNA. Los planes y membresías no cambian esta calificación.</TS>
          </p>
        </section>
      ) : null}

      {resenas.length > 0 && (
        <section className={CAJA}>
          <h2 className={H2}><TS>Opiniones de clientes</TS></h2>
          <p className="-mt-2 mb-3 text-xs text-[#6B675C]"><TS>Sólo de trabajos pagados y entregados por HETNA.</TS></p>
          <ul className="grid gap-3">
            {resenas.slice(0, 8).map((r, i) => (
              <li key={i} className="rounded-xl bg-[#FAF9F5] p-4 text-sm">
                <p className="font-bold text-[#142033]">
                  <span className="text-[#C2560A]">{"★".repeat(Math.round(r.promedio))}</span>
                  <span className="text-[#D9D5C9]">{"★".repeat(5 - Math.round(r.promedio))}</span><TS>{" "}</TS>
                  <TS>{r.autor || "Cliente"}</TS>
                  {r.trabajo ? <span className="font-normal text-[#6B675C]"> · <TS>{r.trabajo}</TS></span> : null}
                </p>
                <p className="mt-0.5 text-xs text-[#6B675C]">
                  <TS>Calidad</TS> <TS>{r.calidad}</TS><TS>/5 · Tiempo</TS> <TS>{r.tiempo}</TS><TS>/5 · Trato</TS> <TS>{r.trato}</TS>/5 ·<TS>{" "}</TS>
                  {new Date(r.fecha).toLocaleDateString("es-MX", { month: "short", year: "numeric" })}
                </p>
                {r.comentario && <p className="mt-2 text-[#40403A]"><TS>{r.comentario}</TS></p>}
                {r.respuesta_taller && (
                  <p className="mt-2 border-l-2 border-[#E7E4DC] pl-3 text-[#40403A]">
                    <span className="font-semibold"><TS>{t.nombre}</TS>:</span> <TS>{r.respuesta_taller}</TS>
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {p.galeria.length > 0 && (
        <section className={CAJA}>
          <h2 className={H2}><TS>Trabajos y taller</TS></h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {p.galeria.map((u, i) => (
              <a key={u} href={u} target="_blank" rel="noopener" className="block aspect-square overflow-hidden rounded-xl bg-[#F3F1EA]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <Image src={u} alt={`${t.nombre} foto ${i + 1}`} loading="lazy" className="h-full w-full object-cover transition hover:scale-105" width={300} height={300} />
              </a>
            ))}
          </div>
        </section>
      )}

      <section className={CAJA}>
        <h2 className={H2}><TS>Sobre el taller</TS></h2>
        <p className="line-clamp-6 whitespace-pre-line leading-relaxed text-[#40403A]">
          <TS>{t.descripcion || "Este taller está completando su perfil. Solicita una cotización y te responderá por HETNA."}</TS>
        </p>
        <LocalizedClientLink href={`/talleres/${t.handle}?tab=nosotros`} className="mt-3 inline-block text-sm font-semibold text-[#C2560A]">
          <TS>Conocer más →</TS>
        </LocalizedClientLink>
      </section>

      {publicaciones.length > 0 && (
        <section className={CAJA}>
          <h2 className={H2}><TS>Novedades y trabajos en el foro</TS></h2>
          <div className="flex flex-col gap-3">
            {publicaciones.map((x) => (
              <TarjetaTema key={x.id} t={x} />
            ))}
          </div>
        </section>
      )}

      {(p.servicios.length > 0 || p.maquinas.length > 0) && (
        <section className={CAJA}>
          <h2 className={H2}><TS>Lo que hace</TS></h2>
          <div className="flex flex-wrap gap-2">
            {p.servicios.map((x) => (
              <span key={x} className="rounded-full bg-[#142033] px-3 py-1 text-sm font-medium text-white">
                <TS>{x}</TS>
              </span>
            ))}
          </div>
          {p.maquinas.length > 0 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {p.maquinas.slice(0, 3).map((m) => (
                <div key={m.nombre} className="rounded-xl border border-[#E7E4DC] p-4">
                  <p className="font-bold text-[#142033]"><TS>{m.nombre}</TS></p>
                  {m.area && <p className="text-sm text-[#C2560A]"><TS>Área:</TS> <TS>{m.area}</TS></p>}
                </div>
              ))}
            </div>
          )}
          <LocalizedClientLink href={`/talleres/${t.handle}?tab=capacidades`} className="mt-3 inline-block text-sm font-semibold text-[#C2560A]">
            <TS>Ver todas las capacidades →</TS>
          </LocalizedClientLink>
        </section>
      )}

      <CtaCotizar t={t} />
    </>
  )
}

function Nosotros({ t, donde }: { t: Taller; donde: string }) {
  const p = t.perfil
  return (
    <>
      <section className={CAJA}>
        <h2 className={H2}><TS>Quiénes somos</TS></h2>
        <p className="whitespace-pre-line leading-relaxed text-[#40403A]">
          <TS>{t.descripcion || "Este taller está completando su perfil."}</TS>
        </p>
        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
          {p.anos !== undefined && (
            <div>
              <dt className="text-[#6B675C]"><TS>Años de experiencia</TS></dt>
              <dd className="font-semibold text-[#142033]"><TS>{p.anos}</TS></dd>
            </div>
          )}
          {p.entrega && (
            <div>
              <dt className="text-[#6B675C]"><TS>Entrega típica</TS></dt>
              <dd className="font-semibold text-[#142033]"><TS>{p.entrega}</TS></dd>
            </div>
          )}
          {donde && (
            <div>
              <dt className="text-[#6B675C]"><TS>Zona de servicio</TS></dt>
              <dd className="font-semibold text-[#142033]"><TS>{donde}</TS> <TS>· envíos a todo México</TS></dd>
            </div>
          )}
        </dl>
      </section>
      <section className="rounded-2xl bg-[#F3F1EA] p-5 text-sm text-[#40403A]">
        <TS>Por seguridad de clientes y talleres, la cotización, el pago y el seguimiento se hacen dentro de HETNA.</TS>
      </section>
      <CtaCotizar t={t} />
    </>
  )
}

function Capacidades({ t }: { t: Taller }) {
  const p = t.perfil
  const vacio = !p.capacidades.length && !p.maquinas.length && !p.materiales.length && !p.servicios.length && !p.acabados.length
  if (vacio) {
    return (
      <section className={CAJA}>
        <p className="text-[#6B675C]"><TS>Pronto verás aquí capacidades, máquinas y materiales de este taller.</TS></p>
      </section>
    )
  }
  return (
    <>
      {(p.capacidades.length > 0 || p.servicios.length > 0) && (
        <section className={CAJA}>
          <h2 className={H2}><TS>Capacidades y servicios</TS></h2>
          {p.servicios.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {p.servicios.map((x) => (
                <span key={x} className="rounded-full bg-[#142033] px-3 py-1 text-sm font-medium text-white">
                  <TS>{x}</TS>
                </span>
              ))}
            </div>
          )}
          <ul className="grid gap-2 sm:grid-cols-2">
            {p.capacidades.map((x) => (
              <li key={x} className="flex gap-2 text-[#40403A]">
                <span className="font-bold text-[#C2560A]">✓</span>
                <TS>{x}</TS>
              </li>
            ))}
          </ul>
        </section>
      )}
      {p.acabados.length > 0 && (
        <section className={CAJA}>
          <h2 className={H2}><TS>Acabados que hace</TS></h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {p.acabados.map((a) => (
              <li key={a.clave} className="flex items-baseline justify-between gap-3 rounded-xl bg-[#FAF9F5] px-3 py-2 text-[#40403A]">
                <span><span className="font-bold text-[#C2560A]">✓</span> <TS>{a.nombre}</TS></span>
                {a.precio && <span className="text-sm font-semibold text-[#142033]">{a.precio}</span>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-[#6B675C]"><TS>Precios de referencia que pone el taller; el precio final va en su propuesta.</TS></p>
        </section>
      )}
      {p.maquinas.length > 0 && (
        <section className={CAJA}>
          <h2 className={H2}><TS>Máquinas</TS></h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {p.maquinas.map((m, i) => (
              <div key={`${m.nombre}-${i}`} className="rounded-xl border border-[#E7E4DC] p-4">
                {m.tipo && <p className="text-xs font-semibold uppercase tracking-wider text-[#6B675C]">{nombreTipoMaquina(m.tipo)}</p>}
                <p className="font-bold text-[#142033]">
                  <TS>{m.nombre}</TS>
                  {m.marca ? <span className="font-normal text-[#6B675C]"> · <TS>{m.marca}</TS></span> : null}
                </p>
                {areaTexto(m) && <p className="text-sm text-[#C2560A]"><TS>Área:</TS> {areaTexto(m)}</p>}
                {(m.potencia || m.controlador) && (
                  <p className="mt-1 text-sm text-[#40403A]"><TS>{[m.potencia, m.controlador && `Control ${m.controlador}`].filter(Boolean).join(" · ")}</TS></p>
                )}
                {m.detalle && <p className="mt-1 text-sm text-[#6B675C]"><TS>{m.detalle}</TS></p>}
              </div>
            ))}
          </div>
        </section>
      )}
      {p.materiales.length > 0 && (
        <section className={CAJA}>
          <h2 className={H2}><TS>Materiales que trabaja</TS></h2>
          <div className="flex flex-wrap gap-2">
            {p.materiales.map((x) => (
              <span key={x} className={CHIP}>
                <TS>{x}</TS>
              </span>
            ))}
          </div>
        </section>
      )}
      <CtaCotizar t={t} />
    </>
  )
}

function CtaCotizar({ t }: { t: Taller }) {
  return (
    <section className="rounded-2xl bg-[#142033] p-8 text-center text-white">
      <h2 className="text-2xl font-extrabold"><TS>¿Tienes una pieza para fabricar?</TS></h2>
      <p className="mx-auto mt-2 max-w-md text-white/70">
        <TS>Describe tu trabajo y</TS> <TS>{t.nombre}</TS> <TS>te cotiza. El envío lo manejas con Envíos HETNA.</TS>
      </p>
      <LocalizedClientLink
        href={`/talleres/${t.handle}?tab=cotizar`}
        className="mt-5 inline-block rounded-xl bg-[#C2560A] px-6 py-3 font-semibold text-white hover:brightness-110"
      >
        <TS>Solicitar cotización</TS>
      </LocalizedClientLink>
    </section>
  )
}

/** Lo que el taller hizo en HETNA (medido, no opinado): lib/reputacion-medida.ts en la API. */
function Cumplimiento({ m }: { m: Medido }) {
  const datos: [string, string, string?][] = []
  if (m.puntualidad_pct != null && m.con_fecha > 0)
    datos.push(["Entregas a tiempo", `${m.puntualidad_pct}%`, `de ${m.con_fecha} ${m.con_fecha === 1 ? "entrega con fecha" : "entregas con fecha"}`])
  datos.push(["Trabajos terminados", String(m.terminados), m.terminados_pct != null ? `${m.terminados_pct}% de los que empezó` : undefined])
  if (m.respuesta_horas != null) datos.push(["Tiempo de respuesta", textoRespuesta(m.respuesta_horas), "mediana, últimos 4 meses"])
  datos.push(["Reclamos", m.reclamos ? `${m.reclamos_resueltos} de ${m.reclamos}` : "0", m.reclamos ? "resueltos" : "sin reclamos"])
  return (
    <section className={CAJA}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={H2}><TS>Cumplimiento medido en HETNA</TS></h2>
        {m.suficiente && m.puntaje != null && (
          <span
            className={`rounded-full px-3 py-1 text-sm font-bold ${m.puntaje >= 80 ? "bg-[#E6F4EA] text-[#1E7B3A]" : m.puntaje >= 60 ? "bg-[#FFF6E0] text-[#8A5A00]" : "bg-[#FDECEC] text-[#B42318]"}`}
          >
            <TS>{m.puntaje}</TS>/100
          </span>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {datos.map(([k, v, nota]) => (
          <div key={k} className="rounded-xl bg-[#FAF9F5] p-3">
            <dt className="text-xs font-bold uppercase tracking-wide text-[#6B675C]"><TS>{k}</TS></dt>
            <dd className="m-0 mt-1 text-xl font-extrabold text-[#142033]"><TS>{v}</TS></dd>
            {nota && <dd className="m-0 text-xs text-[#6B675C]"><TS>{nota}</TS></dd>}
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-[#6B675C]">
        <TS>Datos reales de sus pedidos en HETNA, recalculados cada día. El puntaje pesa trabajos terminados 30%, calidad calificada por clientes
        30%, entregas a tiempo 25%, tiempo de respuesta 10% y reclamos 5%. Pagar un plan o la verificación no lo cambia.</TS>
        <TS>{m.suficiente ? "" : ` El puntaje aparece a partir de 3 trabajos terminados.`}</TS>
      </p>
    </section>
  )
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata(...args: Parameters<typeof generateMetadataEs>) {
  return metaEnIdioma(await generateMetadataEs(...args))
}
