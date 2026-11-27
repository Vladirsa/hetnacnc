// /mx/talleres/en/<estado> (p. ej. nuevo-leon) — "Talleres CNC en <estado>": los talleres de HETNA y
// las empresas del directorio de ese estado, con qué servicios hacen y cómo
// pedirles cotización. Sólo datos reales (lib/seo/estados.ts): con menos de
// MIN_EMPRESAS la página lleva noindex y sin ninguna da 404.
import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { JsonLd } from "@/components/hetna/JsonLd"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { NOMBRE_TIPO } from "@/lib/hetna/directorio"
import { migas } from "@/lib/hetna/schema"
import { ubicacion } from "@/lib/hetna/talleres"
import { MIN_EMPRESAS, SERVICIOS_ESTADO, ciudadPorEstadoSlug, datosEstado, estadosIndexables, filtrarServicio, limpiarServicios, rutaEstado, rutaServicioEstado } from "@/lib/seo/estados"

export const revalidate = 3600

const SITIO = "https://hetnacnc.com"

type Props = { params: Promise<{ locale: string; ciudad: string }> }

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

async function generateMetadataEs({ params }: Props): Promise<Metadata> {
  const { ciudad } = await params
  const c = ciudadPorEstadoSlug(ciudad)
  if (!c) return {}
  const d = await datosEstado(c)
  if (!d.total) return {}
  const url = `${SITIO}/mx${rutaEstado(c)}`
  return {
    title: `Talleres CNC en ${c.estado}: láser, router y maquinado`,
    description: `${plural(d.total, "empresa CNC", "empresas CNC")} en ${c.estado}: corte láser, router, plasma y maquinado. Compara y pide cotización a varios talleres gratis.`,
    alternates: { canonical: url },
    robots: d.total >= MIN_EMPRESAS ? { index: true, follow: true } : { index: false, follow: true },
  }
}

export default async function TalleresEnEstado({ params }: Props) {
  const { ciudad, locale } = await params
  const c = ciudadPorEstadoSlug(ciudad)
  if (!c) notFound()
  const [d, indexables] = await Promise.all([datosEstado(c), estadosIndexables()])
  // Sin empresas en el estado no hay página: a la red completa
  if (!d.total) redirect(`/${locale}/talleres`)

  const url = `${SITIO}/mx${rutaEstado(c)}`
  const servicios = SERVICIOS_ESTADO.filter((s) => d.porServicio[s.clave] > 0)
  // Página "<servicio> en <estado>" sólo donde hay talleres de servicio (no sólo proveedores)
  const conPagina = new Set(servicios.filter((s) => filtrarServicio(d, s.clave).total > 0).map((s) => s.clave))
  const nTalleres = d.empresas.filter((e) => e.tipo === "taller").length + d.talleres.length
  const nProveedores = d.empresas.filter((e) => e.tipo === "proveedor").length
  const nCursos = d.empresas.filter((e) => e.tipo === "instructor").length
  const top = d.municipios.slice(0, 5).map(([m]) => m)

  const faqs = [
    {
      p: `¿Cuántos talleres CNC hay en ${c.estado}?`,
      r: `En HETNA tenemos ${plural(d.total, "empresa CNC", "empresas CNC")} en ${c.estado}: ${plural(nTalleres, "taller de servicios CNC", "talleres de servicios CNC")}${nProveedores ? `, ${plural(nProveedores, "proveedor", "proveedores")} de máquinas y herramientas` : ""}${nCursos ? ` y ${plural(nCursos, "centro", "centros")} de capacitación` : ""}.${top.length ? ` La mayoría están en ${top.join(", ")}.` : ""}`,
    },
    ...(servicios.length
      ? [
          {
            p: `¿Qué servicios CNC hay en ${c.estado}?`,
            r: `${servicios.map((s) => `${s.nombre}: ${d.porServicio[s.clave]}`).join("; ")}. Los números cuentan las empresas que mencionan ese servicio.`,
          },
        ]
      : []),
    {
      p: `¿Cómo pido cotización a un taller CNC en ${c.estado}?`,
      r: `Publica tu trabajo gratis en HETNA con el archivo (DXF, SVG, STL o STEP) o una foto con medidas. Los talleres de la red te mandan su propuesta con precio y tiempo de entrega, eliges una y pagas dentro de HETNA. Tus datos de contacto no se comparten.`,
    },
    {
      p: `¿Puedo pedir a un taller de otro estado y que me lo envíe a ${c.estado}?`,
      r: `Sí. Las propuestas de talleres de otros estados dicen si incluyen el envío, y los envíos con guía llegan a toda la República.`,
    },
  ]

  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 pb-16 pt-6 lg:px-6">
      <JsonLd
        datos={[
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "@id": `${url}#pagina`,
            url,
            name: `Talleres CNC en ${c.estado}`,
            inLanguage: "es-MX",
            about: { "@type": "State", name: c.estado, containedInPlace: { "@type": "Country", name: "México" } },
            publisher: { "@type": "Organization", "@id": `${SITIO}/#organization`, name: "HETNA CNC", url: SITIO },
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: d.total,
              itemListElement: [
                ...d.talleres.map((t) => ({ name: t.nombre, url: `${SITIO}/mx/talleres/${t.handle}` })),
                ...d.empresas.map((e) => ({ name: e.empresa, url: `${SITIO}/mx/talleres/directorio/${e.slug}` })),
              ].map((x, i) => ({ "@type": "ListItem", position: i + 1, ...x })),
            },
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.p, acceptedAnswer: { "@type": "Answer", text: f.r } })),
          },
          migas([
            { nombre: "Inicio", ruta: `${SITIO}/mx` },
            { nombre: "Talleres", ruta: `${SITIO}/mx/talleres` },
            { nombre: c.estado },
          ]),
        ]}
      />

      <nav aria-label="Migas de pan" className="flex flex-wrap gap-1.5 text-[13px] text-[#6B675C]">
        <LocalizedClientLink href="/" className="hover:text-[#B34D07]"><TS>Inicio</TS></LocalizedClientLink>
        <span>/</span>
        <LocalizedClientLink href="/talleres" className="hover:text-[#B34D07]"><TS>Talleres</TS></LocalizedClientLink>
        <span>/</span>
        <span className="font-medium text-[#1B1B18]">{c.estado}</span>
      </nav>

      <section className="mt-4 rounded-3xl bg-[#142033] p-6 text-white sm:p-10">
        <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl"><TS>Talleres CNC en</TS> {c.estado}</h1>
        <p className="mt-3 max-w-2xl text-[#F2C9A5]">
          {plural(d.total, "empresa", "empresas")} <TS>de corte láser, router, plasma y maquinado CNC</TS>
          {top.length ? ` en ${top.slice(0, 3).join(", ")}${d.municipios.length > 3 ? " y más municipios" : ""}` : ` en ${c.estado}`}.
        </p>
        <p className="mt-3 max-w-2xl text-white/80">
          <TS>Publica tu trabajo una vez y recibe propuestas de varios talleres con precio y tiempo de entrega. Comparas, eliges y pagas dentro de HETNA.</TS>
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <LocalizedClientLink href="/cotizar" className="rounded-xl bg-[#C2560A] px-5 py-3 font-semibold text-white hover:bg-[#A84A08]">
            <TS>Pedir cotización gratis</TS>
          </LocalizedClientLink>
          <LocalizedClientLink href="/talleres/unete" className="rounded-xl border border-white/30 px-5 py-3 font-semibold text-white hover:bg-white/10">
            <TS>¿Tienes un taller aquí? Únete</TS>
          </LocalizedClientLink>
        </div>
      </section>

      {servicios.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-extrabold text-[#142033]"><TS>Servicios CNC en</TS> {c.estado}</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {servicios.map((s) => (
              <li key={s.clave} className="rounded-2xl border border-[#E7E4DC] bg-white p-4">
                <p className="text-2xl font-extrabold text-[#C2560A]">{d.porServicio[s.clave]}</p>
                {conPagina.has(s.clave) ? (
                  <LocalizedClientLink href={rutaServicioEstado(c, s.clave)} className="font-semibold text-[#142033] hover:text-[#C2560A]">
                    {s.nombre} <TS>en</TS> {c.estado} →
                  </LocalizedClientLink>
                ) : (
                  <p className="font-semibold text-[#142033]">{s.nombre}</p>
                )}
                {s.guia && (
                  <LocalizedClientLink href={`/cnc/${s.guia}/${c.slug}`} className="mt-1 block text-sm text-[#6B675C] hover:underline">
                    <TS>Guía de materiales</TS>
                  </LocalizedClientLink>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {d.talleres.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-extrabold text-[#142033]"><TS>Talleres de HETNA en</TS> {c.estado}</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {d.talleres.map((t) => (
              <li key={t.id} className="rounded-2xl border-2 border-[#C2560A] bg-white p-4">
                <LocalizedClientLink href={`/talleres/${t.handle}`} className="font-bold text-[#142033] hover:text-[#C2560A]">
                  {t.nombre}{t.verificado ? " ✓" : ""}
                </LocalizedClientLink>
                <p className="mt-0.5 text-[13px] text-[#6B675C]">{ubicacion(t.perfil) || c.estado}</p>
                {t.perfil.servicios.length > 0 && <p className="mt-2 text-sm text-[#40403A]">{t.perfil.servicios.join(" · ")}</p>}
                <span className="mt-2 inline-block rounded-full bg-[#FDEEE1] px-2 py-0.5 text-[11px] font-semibold text-[#C2560A]"><TS>Cotiza y vende en HETNA</TS></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {d.empresas.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-extrabold text-[#142033]"><TS>Directorio de empresas CNC en</TS> {c.estado}</h2>
          <p className="mt-1 max-w-3xl text-sm text-[#6B675C]">
            <TS>Empresas que todavía no forman parte de HETNA, con datos públicos de su sitio web. Si pides cotización desde su perfil, tu solicitud llega a la red de talleres y además invitamos a esa empresa a responderte.</TS>
          </p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {d.empresas.map((e) => {
              const texto = limpiarServicios(e.servicios)
              return (
                <li key={e.slug} className="rounded-2xl border border-[#E7E4DC] bg-white p-4">
                  <LocalizedClientLink href={`/talleres/directorio/${e.slug}`} className="font-bold text-[#142033] hover:text-[#C2560A]">
                    {e.empresa}
                  </LocalizedClientLink>
                  <p className="mt-0.5 text-[13px] text-[#6B675C]">
                    {NOMBRE_TIPO[e.tipo]}
                    {e.ciudad ? ` · ${e.ciudad}` : ""}
                  </p>
                  {texto && <p className="mt-2 line-clamp-2 text-sm text-[#40403A]"><TS>{texto}</TS></p>}
                  <span className="mt-2 inline-block rounded-full bg-[#F3F1EA] px-2 py-0.5 text-[11px] font-semibold text-[#6B675C]"><TS>Perfil no reclamado</TS></span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-xl font-extrabold text-[#142033]"><TS>Preguntas frecuentes</TS></h2>
        {faqs.map((f) => (
          <details key={f.p} className="border-t border-[#E7E4DC] py-3 first:border-t-0">
            <summary className="cursor-pointer font-semibold text-[#142033]">{f.p}</summary>
            <p className="mt-2 text-[#40403A]">{f.r}</p>
          </details>
        ))}
      </section>

      {indexables.length > 1 && (
        <section className="mt-10">
          <h2 className="text-xl font-extrabold text-[#142033]"><TS>Talleres CNC en otros estados</TS></h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {indexables
              .filter((x) => x.ciudad.slug !== c.slug)
              .map((x) => (
                <li key={x.ciudad.slug}>
                  <LocalizedClientLink href={rutaEstado(x.ciudad)} className="inline-block rounded-full border border-[#E7E4DC] bg-white px-3 py-1 text-sm text-[#142033] hover:border-[#C2560A]">
                    {x.ciudad.estado} <span className="text-[#6B675C]">({x.total})</span>
                  </LocalizedClientLink>
                </li>
              ))}
          </ul>
        </section>
      )}
    </main>
  )
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata(...args: Parameters<typeof generateMetadataEs>) {
  return metaEnIdioma(await generateMetadataEs(...args))
}
