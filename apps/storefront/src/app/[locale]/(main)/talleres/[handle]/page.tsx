import type { Metadata } from "next"
import { notFound } from "next/navigation"

import MapaTalleres from "@/components/hetna/taller/MapaTalleres"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { tallerPorHandle, ubicacion } from "@/lib/hetna/talleres"

type Props = { params: Promise<{ handle: string; locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params
  const t = await tallerPorHandle(handle)
  if (!t) return {}
  const donde = ubicacion(t.perfil)
  return {
    title: `${t.nombre}${donde ? ` · ${donde}` : ""} | Taller CNC | HETNA CNC`,
    description:
      t.perfil.lema ||
      t.descripcion?.slice(0, 155) ||
      `${t.nombre}: taller CNC en HETNA. Capacidades, máquinas, materiales y cotización.`,
  }
}

const SECCION = "scroll-mt-28 rounded-2xl border border-[#E7E4DC] bg-white p-6 sm:p-8"
const H2 = "mb-4 text-xl font-extrabold text-[#1B1B1B]"
const CHIP = "rounded-full bg-[#F3F1EA] px-3 py-1 text-sm text-[#40403A]"

export default async function PerfilTaller({ params }: Props) {
  const { handle, locale } = await params
  const t = await tallerPorHandle(handle)
  if (!t) notFound()

  const p = t.perfil
  const donde = ubicacion(p)
  const tieneMapa = p.lat !== undefined && p.lng !== undefined
  const vacio =
    !p.capacidades.length && !p.maquinas.length && !p.materiales.length && !p.servicios.length

  const datos: [string, string][] = [
    p.entrega ? ["Entrega típica", p.entrega] : null,
    p.maquinas.length ? ["Máquinas", String(p.maquinas.length)] : null,
    p.anos !== undefined ? ["Años de experiencia", String(p.anos)] : null,
    p.calificacion !== undefined
      ? ["Calificación", `★ ${p.calificacion.toFixed(1)}${p.resenas ? ` (${p.resenas})` : ""}`]
      : ["Calificación", "Taller nuevo"],
  ].filter(Boolean) as [string, string][]

  const menu = [
    ["resumen", "Resumen"],
    ["capacidades", "Capacidades"],
    ["maquinas", "Máquinas"],
    ["materiales", "Materiales"],
    ["ubicacion", "Ubicación"],
  ].filter(([id]) => {
    if (id === "capacidades") return p.capacidades.length || p.servicios.length
    if (id === "maquinas") return p.maquinas.length
    if (id === "materiales") return p.materiales.length
    if (id === "ubicacion") return tieneMapa
    return true
  })

  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 pb-16 pt-6 lg:px-6">
      {/* Portada */}
      <section className="overflow-hidden rounded-3xl border border-[#E7E4DC] bg-white">
        <div
          className="relative h-44 bg-[#1B1B1B] sm:h-60"
          style={
            t.banner
              ? { backgroundImage: `url(${t.banner})`, backgroundSize: "cover", backgroundPosition: "center" }
              : {
                  backgroundImage:
                    "repeating-linear-gradient(0deg,rgba(255,255,255,.06) 0 1px,transparent 1px 24px),repeating-linear-gradient(90deg,rgba(255,255,255,.06) 0 1px,transparent 1px 24px)",
                }
          }
        >
          <div className="absolute inset-x-0 bottom-0 h-1.5 bg-[#E8590C]" />
        </div>

        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-end sm:p-8">
          <div className="-mt-16 grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl border-4 border-white bg-[#1B1B1B] text-3xl font-extrabold text-white shadow-lg sm:-mt-20 sm:h-28 sm:w-28">
            {t.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.logo} alt={t.nombre} className="h-full w-full object-cover" />
            ) : (
              t.nombre.slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-extrabold text-[#1B1B1B] sm:text-3xl">{t.nombre}</h1>
            {p.lema && <p className="mt-1 text-[#40403A]">{p.lema}</p>}
            {donde && <p className="mt-1 text-sm text-[#6B675C]">📍 {donde}</p>}
          </div>
          <div className="flex flex-wrap gap-2 sm:flex-col sm:items-stretch">
            <LocalizedClientLink
              href={`/cotizar?taller=${t.handle}`}
              className="rounded-xl bg-[#E8590C] px-5 py-3 text-center font-semibold text-white hover:brightness-110"
            >
              Solicitar cotización
            </LocalizedClientLink>
            {p.whatsapp && (
              <a
                href={`https://wa.me/${p.whatsapp}?text=${encodeURIComponent(`Hola ${t.nombre}, vi su taller en HETNA CNC y quiero cotizar una pieza.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-[#1B1B1B] px-5 py-3 text-center font-semibold text-[#1B1B1B] hover:bg-[#1B1B1B] hover:text-white"
              >
                WhatsApp
              </a>
            )}
          </div>
        </div>

        <dl className="grid grid-cols-2 border-t border-[#E7E4DC] sm:grid-cols-4">
          {datos.map(([k, v]) => (
            <div key={k} className="border-b border-r border-[#E7E4DC] px-5 py-4 last:border-r-0 sm:border-b-0">
              <dt className="text-xs uppercase tracking-wider text-[#6B675C]">{k}</dt>
              <dd className="mt-1 text-lg font-bold text-[#1B1B1B]">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Menú interno */}
      <nav className="sticky top-0 z-20 -mx-4 mt-4 overflow-x-auto bg-[#FAF9F5]/95 px-4 backdrop-blur" aria-label="Secciones del taller">
        <ul className="flex gap-1 whitespace-nowrap py-2">
          {menu.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} className="block rounded-lg px-3 py-2 text-sm font-semibold text-[#40403A] hover:bg-[#F3F1EA]">
                {label}
              </a>
            </li>
          ))}
          <li>
            <LocalizedClientLink href={`/sellers/${t.handle}`} className="block rounded-lg px-3 py-2 text-sm font-semibold text-[#E8590C] hover:bg-[#F3F1EA]">
              Ver catálogo →
            </LocalizedClientLink>
          </li>
        </ul>
      </nav>

      <div className="mt-4 grid gap-5">
        <section id="resumen" className={SECCION}>
          <h2 className={H2}>Sobre el taller</h2>
          <p className="whitespace-pre-line leading-relaxed text-[#40403A]">
            {t.descripcion || "Este taller está completando su perfil. Solicita una cotización y te responderá directamente."}
          </p>
          {vacio && (
            <p className="mt-4 rounded-xl bg-[#F3F1EA] p-4 text-sm text-[#6B675C]">
              Pronto verás aquí capacidades, máquinas y materiales.
            </p>
          )}
        </section>

        {(p.capacidades.length > 0 || p.servicios.length > 0) && (
          <section id="capacidades" className={SECCION}>
            <h2 className={H2}>Capacidades y servicios</h2>
            {p.servicios.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {p.servicios.map((x) => (
                  <span key={x} className="rounded-full bg-[#1B1B1B] px-3 py-1 text-sm font-medium text-white">
                    {x}
                  </span>
                ))}
              </div>
            )}
            <ul className="grid gap-2 sm:grid-cols-2">
              {p.capacidades.map((x) => (
                <li key={x} className="flex gap-2 text-[#40403A]">
                  <span className="font-bold text-[#E8590C]">✓</span>
                  {x}
                </li>
              ))}
            </ul>
          </section>
        )}

        {p.maquinas.length > 0 && (
          <section id="maquinas" className={SECCION}>
            <h2 className={H2}>Máquinas</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {p.maquinas.map((m) => (
                <div key={m.nombre} className="rounded-xl border border-[#E7E4DC] p-4">
                  <p className="font-bold text-[#1B1B1B]">{m.nombre}</p>
                  {m.area && <p className="text-sm text-[#E8590C]">Área: {m.area}</p>}
                  {m.detalle && <p className="mt-1 text-sm text-[#6B675C]">{m.detalle}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        {p.materiales.length > 0 && (
          <section id="materiales" className={SECCION}>
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

        {tieneMapa && (
          <section id="ubicacion" className={SECCION}>
            <h2 className={H2}>Ubicación</h2>
            <p className="mb-3 text-sm text-[#6B675C]">{donde}</p>
            <MapaTalleres talleres={[t]} locale={locale} altura={320} />
          </section>
        )}

        <section className="rounded-2xl bg-[#1B1B1B] p-8 text-center text-white">
          <h2 className="text-2xl font-extrabold">¿Tienes una pieza para fabricar?</h2>
          <p className="mx-auto mt-2 max-w-md text-white/70">
            Sube tu archivo y {t.nombre} te cotiza. El envío lo manejas con Envíos HETNA.
          </p>
          <LocalizedClientLink
            href={`/cotizar?taller=${t.handle}`}
            className="mt-5 inline-block rounded-xl bg-[#E8590C] px-6 py-3 font-semibold text-white hover:brightness-110"
          >
            Solicitar cotización
          </LocalizedClientLink>
        </section>
      </div>
    </main>
  )
}
