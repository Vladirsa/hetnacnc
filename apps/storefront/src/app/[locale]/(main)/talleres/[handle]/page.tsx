// Pasa por ImagenSegura: estas direcciones vienen de la base o del
// navegador, y next/image TRUENA con las que no empiezan en "/" o
// "https://" (una vista previa "blob:", por ejemplo).
import { ImagenSegura as Image } from '@/components/hetna/ImagenSegura'
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import BotonPreguntarTaller from "@/components/hetna/chat/BotonPreguntarTaller"
import FormSolicitudTaller from "@/components/hetna/taller/FormSolicitudTaller"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { ProductListingSkeleton } from "@/components/organisms/ProductListingSkeleton/ProductListingSkeleton"
import { SellerOffersListing } from "@/components/sections"
import { tallerPorHandle, ubicacion, type Taller } from "@/lib/hetna/talleres"

// Mini-sitio del taller (estilo "showroom"): portada, pestañas y cotización dentro de HETNA.

type Props = {
  params: Promise<{ handle: string; locale: string }>
  searchParams: Promise<{ tab?: string; page?: string }>
}

const PESTANAS = [
  ["inicio", "Inicio"],
  ["productos", "Productos"],
  ["nosotros", "Quiénes somos"],
  ["capacidades", "Capacidades"],
  ["cotizar", "Cotizar"],
] as const
type Pestana = (typeof PESTANAS)[number][0]

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params
  const t = await tallerPorHandle(handle)
  if (!t) return {}
  const donde = ubicacion(t.perfil)
  return {
    title: `${t.nombre}${donde ? ` · ${donde}` : ""} | Taller CNC`,
    description:
      t.perfil.lema ||
      t.descripcion?.slice(0, 155) ||
      `${t.nombre}: taller CNC en HETNA. Capacidades, máquinas, materiales y cotización.`,
    openGraph: t.banner ? { images: [t.banner] } : undefined,
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

  const p = t.perfil
  const donde = ubicacion(p)
  const datos: [string, string][] = [
    p.entrega ? ["Entrega típica", p.entrega] : null,
    p.maquinas.length ? ["Máquinas", String(p.maquinas.length)] : null,
    p.anos !== undefined ? ["Años de experiencia", String(p.anos)] : null,
    p.calificacion !== undefined
      ? ["Calificación", `★ ${p.calificacion.toFixed(1)}${p.resenas ? ` (${p.resenas})` : ""}`]
      : ["Calificación", "Taller nuevo"],
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
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-extrabold text-[#142033] sm:text-3xl">{t.nombre}{t.fundador && (<span className="rounded-full bg-[#FFF1E6] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#C2560A]">★ Taller fundador</span>)}</h1>
            {p.lema && <p className="mt-0.5 text-[#40403A]">{p.lema}</p>}
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[#6B675C]">
              {donde && <span>📍 {donde}</span>}
              {p.servicios.slice(0, 3).map((s) => (
                <span key={s}>· {s}</span>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <BotonPreguntarTaller tallerHandle={t.handle} tallerNombre={t.nombre} />
            <LocalizedClientLink
              href={`/talleres/${t.handle}?tab=cotizar`}
              className="flex h-12 items-center justify-center rounded-xl bg-[#C2560A] px-5 text-center font-semibold text-white hover:brightness-110"
            >
              Solicitar cotización
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
                {label}
              </LocalizedClientLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mx-auto mt-6 grid max-w-[1100px] gap-5 px-4 lg:px-6">
        {tab === "inicio" && <Inicio t={t} datos={datos} />}

        {tab === "productos" && (
          <section className={CAJA}>
            <h2 className={H2}>Productos de {t.nombre}</h2>
            <Suspense key={page} fallback={<ProductListingSkeleton />}>
              <SellerOffersListing seller_id={t.id} locale={locale} page={page} />
            </Suspense>
          </section>
        )}

        {tab === "nosotros" && <Nosotros t={t} donde={donde} />}

        {tab === "capacidades" && <Capacidades t={t} />}

        {tab === "cotizar" && (
          <section>
            <h2 className={H2}>Cotiza con {t.nombre}</h2>
            <p className="mb-4 text-sm text-[#6B675C]">
              Describe tu trabajo y {t.nombre} te manda su propuesta por HETNA. Tú comparas, eliges y pagas dentro de la plataforma.
            </p>
            <FormSolicitudTaller taller={t.handle} nombreTaller={t.nombre} />
          </section>
        )}
      </div>
    </main>
  )
}

function Inicio({ t, datos }: { t: Taller; datos: [string, string][] }) {
  const p = t.perfil
  return (
    <>
      <dl className="grid grid-cols-2 overflow-hidden rounded-2xl border border-[#E7E4DC] bg-white sm:grid-cols-4">
        {datos.map(([k, v]) => (
          <div key={k} className="border-b border-r border-[#E7E4DC] px-5 py-4 sm:border-b-0">
            <dt className="text-xs uppercase tracking-wider text-[#6B675C]">{k}</dt>
            <dd className="mt-1 text-lg font-bold text-[#142033]">{v}</dd>
          </div>
        ))}
      </dl>

      {p.galeria.length > 0 && (
        <section className={CAJA}>
          <h2 className={H2}>Trabajos y taller</h2>
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
        <h2 className={H2}>Sobre el taller</h2>
        <p className="line-clamp-6 whitespace-pre-line leading-relaxed text-[#40403A]">
          {t.descripcion || "Este taller está completando su perfil. Solicita una cotización y te responderá por HETNA."}
        </p>
        <LocalizedClientLink href={`/talleres/${t.handle}?tab=nosotros`} className="mt-3 inline-block text-sm font-semibold text-[#C2560A]">
          Conocer más →
        </LocalizedClientLink>
      </section>

      {(p.servicios.length > 0 || p.maquinas.length > 0) && (
        <section className={CAJA}>
          <h2 className={H2}>Lo que hace</h2>
          <div className="flex flex-wrap gap-2">
            {p.servicios.map((x) => (
              <span key={x} className="rounded-full bg-[#142033] px-3 py-1 text-sm font-medium text-white">
                {x}
              </span>
            ))}
          </div>
          {p.maquinas.length > 0 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {p.maquinas.slice(0, 3).map((m) => (
                <div key={m.nombre} className="rounded-xl border border-[#E7E4DC] p-4">
                  <p className="font-bold text-[#142033]">{m.nombre}</p>
                  {m.area && <p className="text-sm text-[#C2560A]">Área: {m.area}</p>}
                </div>
              ))}
            </div>
          )}
          <LocalizedClientLink href={`/talleres/${t.handle}?tab=capacidades`} className="mt-3 inline-block text-sm font-semibold text-[#C2560A]">
            Ver todas las capacidades →
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
        <h2 className={H2}>Quiénes somos</h2>
        <p className="whitespace-pre-line leading-relaxed text-[#40403A]">
          {t.descripcion || "Este taller está completando su perfil."}
        </p>
        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
          {p.anos !== undefined && (
            <div>
              <dt className="text-[#6B675C]">Años de experiencia</dt>
              <dd className="font-semibold text-[#142033]">{p.anos}</dd>
            </div>
          )}
          {p.entrega && (
            <div>
              <dt className="text-[#6B675C]">Entrega típica</dt>
              <dd className="font-semibold text-[#142033]">{p.entrega}</dd>
            </div>
          )}
          {donde && (
            <div>
              <dt className="text-[#6B675C]">Zona de servicio</dt>
              <dd className="font-semibold text-[#142033]">{donde} · envíos a todo México</dd>
            </div>
          )}
        </dl>
      </section>
      <section className="rounded-2xl bg-[#F3F1EA] p-5 text-sm text-[#40403A]">
        Por seguridad de clientes y talleres, la cotización, el pago y el seguimiento se hacen dentro de HETNA.
      </section>
      <CtaCotizar t={t} />
    </>
  )
}

function Capacidades({ t }: { t: Taller }) {
  const p = t.perfil
  const vacio = !p.capacidades.length && !p.maquinas.length && !p.materiales.length && !p.servicios.length
  if (vacio) {
    return (
      <section className={CAJA}>
        <p className="text-[#6B675C]">Pronto verás aquí capacidades, máquinas y materiales de este taller.</p>
      </section>
    )
  }
  return (
    <>
      {(p.capacidades.length > 0 || p.servicios.length > 0) && (
        <section className={CAJA}>
          <h2 className={H2}>Capacidades y servicios</h2>
          {p.servicios.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {p.servicios.map((x) => (
                <span key={x} className="rounded-full bg-[#142033] px-3 py-1 text-sm font-medium text-white">
                  {x}
                </span>
              ))}
            </div>
          )}
          <ul className="grid gap-2 sm:grid-cols-2">
            {p.capacidades.map((x) => (
              <li key={x} className="flex gap-2 text-[#40403A]">
                <span className="font-bold text-[#C2560A]">✓</span>
                {x}
              </li>
            ))}
          </ul>
        </section>
      )}
      {p.maquinas.length > 0 && (
        <section className={CAJA}>
          <h2 className={H2}>Máquinas</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {p.maquinas.map((m) => (
              <div key={m.nombre} className="rounded-xl border border-[#E7E4DC] p-4">
                <p className="font-bold text-[#142033]">{m.nombre}</p>
                {m.area && <p className="text-sm text-[#C2560A]">Área: {m.area}</p>}
                {m.detalle && <p className="mt-1 text-sm text-[#6B675C]">{m.detalle}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
      {p.materiales.length > 0 && (
        <section className={CAJA}>
          <h2 className={H2}>Materiales que trabaja</h2>
          <div className="flex flex-wrap gap-2">
            {p.materiales.map((x) => (
              <span key={x} className={CHIP}>
                {x}
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
      <h2 className="text-2xl font-extrabold">¿Tienes una pieza para fabricar?</h2>
      <p className="mx-auto mt-2 max-w-md text-white/70">
        Describe tu trabajo y {t.nombre} te cotiza. El envío lo manejas con Envíos HETNA.
      </p>
      <LocalizedClientLink
        href={`/talleres/${t.handle}?tab=cotizar`}
        className="mt-5 inline-block rounded-xl bg-[#C2560A] px-6 py-3 font-semibold text-white hover:brightness-110"
      >
        Solicitar cotización
      </LocalizedClientLink>
    </section>
  )
}
