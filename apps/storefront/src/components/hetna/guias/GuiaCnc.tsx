// Página de una guía CNC (lib/seo/guias.ts): contenido propio para una
// búsqueda concreta más datos vivos de la red (talleres de ese servicio y
// trabajos abiertos) y enlaces internos a cotizadores, herramientas y tienda.
// Con `ciudad`, la misma guía enfocada en esa ciudad: primero sus talleres.
import { ImagenSegura as Image } from "@/components/hetna/ImagenSegura"
import { JsonLd } from "@/components/hetna/JsonLd"
import { TarjetaTrabajo } from "@/components/hetna/trabajos/TarjetaTrabajo"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { listarTalleres, ubicacion, type Taller } from "@/lib/hetna/talleres"
import { migas, servicioSchema } from "@/lib/hetna/schema"
import { CIUDADES, GUIAS, enCiudad, type Ciudad, type Guia } from "@/lib/seo/guias"
import { trabajosAbiertos } from "@/lib/trabajos/datos"

const SITIO = "https://hetnacnc.com"

/** Talleres de la guía, los verificados y los que trabajan sus materiales primero. */
export async function talleresDeGuia(g: Guia): Promise<Taller[]> {
  const todos = await listarTalleres().catch(() => [] as Taller[])
  const mats = (g.materiales || []).map((m) => m.toLowerCase())
  const pesa = (t: Taller) =>
    Number(t.verificado) * 2 + Number(t.perfil.materiales.some((m) => mats.some((x) => m.toLowerCase().includes(x))))
  return todos.filter((t) => t.perfil.servicios.some((s) => g.coincide.includes(s))).sort((a, b) => pesa(b) - pesa(a))
}

export async function GuiaCnc({ guia: g, ciudad }: { guia: Guia; ciudad?: Ciudad }) {
  const [talleres, trabajos] = await Promise.all([
    talleresDeGuia(g),
    trabajosAbiertos({ servicio: g.servicio, limit: 4 }).catch(() => ({ trabajos: [] as never[] })),
  ])
  const locales = ciudad ? talleres.filter((t) => enCiudad(ciudad, t.perfil.estado, t.perfil.ciudad)) : []
  const mostrar = (ciudad ? [...locales, ...talleres.filter((t) => !locales.includes(t))] : talleres).slice(0, 6)
  const ruta = `/mx/cnc/${g.slug}${ciudad ? `/${ciudad.slug}` : ""}`
  const h1 = ciudad ? `${g.h1} en ${ciudad.nombre}` : g.h1

  const faqs = ciudad
    ? [
        {
          p: `¿Hay talleres de ${g.h1.toLowerCase()} en ${ciudad.nombre}?`,
          r: locales.length
            ? `Sí: ${locales.length === 1 ? "hay un taller" : `hay ${locales.length} talleres`} de la red en ${ciudad.estado} (${locales
                .slice(0, 3)
                .map((t) => t.nombre)
                .join(", ")}). También puedes recibir propuestas de talleres de otros estados con envío.`
            : `Todavía no hay talleres de la red en ${ciudad.estado}, pero los de otros estados envían a ${ciudad.nombre}. Publica tu trabajo y cada propuesta dirá si incluye el envío.`,
        },
        ...g.faqs,
      ]
    : g.faqs

  const otras = GUIAS.filter((x) => x.slug !== g.slug)

  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 pb-16 pt-6 lg:px-6">
      <JsonLd
        datos={[
          servicioSchema({ nombre: h1, descripcion: g.descripcion, ruta, tipo: g.tipo }),
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.p, acceptedAnswer: { "@type": "Answer", text: f.r } })),
          },
          migas([
            { nombre: "Inicio", ruta: `${SITIO}/mx` },
            { nombre: "Guías CNC", ruta: `${SITIO}/mx/cnc` },
            ...(ciudad ? [{ nombre: g.h1, ruta: `${SITIO}/mx/cnc/${g.slug}` }, { nombre: ciudad.nombre }] : [{ nombre: g.h1 }]),
          ]),
        ]}
      />

      <nav aria-label="Migas de pan" className="flex flex-wrap gap-1.5 text-[13px] text-[#6B675C]">
        <LocalizedClientLink href="/" className="hover:text-[#B34D07]">Inicio</LocalizedClientLink>
        <span>/</span>
        <LocalizedClientLink href="/cnc" className="hover:text-[#B34D07]">Guías CNC</LocalizedClientLink>
        <span>/</span>
        {ciudad ? (
          <>
            <LocalizedClientLink href={`/cnc/${g.slug}`} className="hover:text-[#B34D07]">{g.h1}</LocalizedClientLink>
            <span>/</span>
            <span className="font-medium text-[#1B1B18]">{ciudad.nombre}</span>
          </>
        ) : (
          <span className="font-medium text-[#1B1B18]">{g.h1}</span>
        )}
      </nav>

      <section className="mt-4 rounded-3xl bg-[#142033] p-6 text-white sm:p-10">
        <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">{h1}</h1>
        {ciudad && (
          <p className="mt-3 max-w-2xl text-[#F2C9A5]">
            {locales.length
              ? `${locales.length === 1 ? "Un taller" : `${locales.length} talleres`} de la red en ${ciudad.estado}, y más con envío a ${ciudad.nombre}.`
              : `Talleres de la red con envío a ${ciudad.nombre}.`}
          </p>
        )}
        {g.intro.map((p, i) => (
          <p key={i} className="mt-3 max-w-2xl text-white/80">{p}</p>
        ))}
        <div className="mt-6 flex flex-wrap gap-3">
          <LocalizedClientLink href={g.cta.href} className="rounded-xl bg-[#C2560A] px-5 py-3 font-semibold text-white hover:bg-[#A84A08]">
            {g.cta.texto}
          </LocalizedClientLink>
          <LocalizedClientLink
            href={`/cotizar?servicio=${encodeURIComponent(g.servicio)}`}
            className="rounded-xl border border-white/30 px-5 py-3 font-semibold text-white hover:bg-white/10"
          >
            Publicar mi trabajo gratis
          </LocalizedClientLink>
        </div>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <article className="grid gap-6">
          {g.secciones.map((s) => (
            <section key={s.titulo}>
              <h2 className="text-xl font-extrabold text-[#142033]">{s.titulo}</h2>
              {s.parrafos?.map((p, i) => (
                <p key={i} className="mt-2 text-[#40403A]">{p}</p>
              ))}
              {s.lista && (
                <ul className="mt-2 grid list-disc gap-1 pl-5 text-[#40403A]">
                  {s.lista.map((x) => <li key={x}>{x}</li>)}
                </ul>
              )}
            </section>
          ))}

          {trabajos.trabajos.length > 0 && (
            <section>
              <h2 className="text-xl font-extrabold text-[#142033]">Trabajos que se están cotizando ahora</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {trabajos.trabajos.map((t) => <TarjetaTrabajo key={t.folio} trabajo={t} />)}
              </div>
            </section>
          )}

          <section>
            <h2 className="text-xl font-extrabold text-[#142033]">Preguntas frecuentes</h2>
            {faqs.map((f) => (
              <details key={f.p} className="border-t border-[#E7E4DC] py-3 first:border-t-0">
                <summary className="cursor-pointer font-semibold text-[#142033]">{f.p}</summary>
                <p className="mt-2 text-[#40403A]">{f.r}</p>
              </details>
            ))}
          </section>
        </article>

        <aside className="grid content-start gap-6">
          {mostrar.length > 0 && (
            <section className="rounded-2xl border border-[#E7E4DC] bg-white p-4">
              <h2 className="text-base font-extrabold text-[#142033]">{ciudad && locales.length ? `Talleres en ${ciudad.estado} y con envío` : "Talleres de la red"}</h2>
              <div className="mt-3 grid gap-2">
                {mostrar.map((t) => (
                  <LocalizedClientLink key={t.id} href={`/talleres/${t.handle}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-[#FAF9F6]">
                    <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-[#142033] text-sm font-extrabold text-white">
                      {t.logo ? <Image src={t.logo} alt={`Logo de ${t.nombre}`} className="h-full w-full object-cover" width={80} height={80} /> : t.nombre.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-[#142033]">{t.nombre}{t.verificado ? " ✓" : ""}</span>
                      <span className="block truncate text-xs text-[#6B675C]">{ubicacion(t.perfil) || "México"}</span>
                    </span>
                  </LocalizedClientLink>
                ))}
              </div>
              <LocalizedClientLink href="/talleres" className="mt-3 inline-block text-sm font-semibold text-[#C2560A]">Ver todos los talleres →</LocalizedClientLink>
            </section>
          )}

          <section className="rounded-2xl border border-[#E7E4DC] bg-white p-4">
            <h2 className="text-base font-extrabold text-[#142033]">Te puede servir</h2>
            <ul className="mt-2 grid gap-2">
              {g.enlaces.map((e) => (
                <li key={e.href}>
                  <LocalizedClientLink href={e.href} className="font-semibold text-[#C2560A] hover:underline">{e.texto}</LocalizedClientLink>
                  {e.detalle && <span className="block text-xs text-[#6B675C]">{e.detalle}</span>}
                </li>
              ))}
            </ul>
          </section>

          {g.ciudades && (
            <section className="rounded-2xl border border-[#E7E4DC] bg-white p-4">
              <h2 className="text-base font-extrabold text-[#142033]">{g.h1} por ciudad</h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {CIUDADES.filter((c) => c.slug !== ciudad?.slug).map((c) => (
                  <li key={c.slug}>
                    <LocalizedClientLink href={`/cnc/${g.slug}/${c.slug}`} className="inline-block rounded-full border border-[#E7E4DC] px-3 py-1 text-sm text-[#142033] hover:border-[#C2560A]">
                      {c.nombre}
                    </LocalizedClientLink>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-2xl border border-[#E7E4DC] bg-white p-4">
            <h2 className="text-base font-extrabold text-[#142033]">Otras guías</h2>
            <ul className="mt-2 grid gap-1.5">
              {otras.map((o) => (
                <li key={o.slug}>
                  <LocalizedClientLink href={`/cnc/${o.slug}`} className="text-sm text-[#142033] hover:text-[#C2560A]">{o.h1}</LocalizedClientLink>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </main>
  )
}
