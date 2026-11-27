// /mx/talleres/en/<estado>/<servicio> (p. ej. ciudad-de-mexico/corte-laser) —
// "Corte láser en Ciudad de México": los talleres de ese servicio en el estado
// (los de HETNA primero y los del directorio), precio estimado al instante y el
// botón para publicar una licitación. Es la página para quien hoy busca
// "corte láser cdmx" y termina pidiendo en un sitio de contactos pagados: aquí
// publica gratis y los talleres le mandan propuesta dentro de HETNA.
// Sólo datos reales (lib/seo/estados.ts): con menos de MIN_EMPRESAS talleres de
// ese servicio la página lleva noindex; sin ninguno, regresa a la del estado.
import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { CalculadoraLead } from "@/components/hetna/cotizar/CalculadoraLead"
import { JsonLd } from "@/components/hetna/JsonLd"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { migas, servicioSchema } from "@/lib/hetna/schema"
import { ubicacion } from "@/lib/hetna/talleres"
import {
  MIN_EMPRESAS,
  PAGINAS_SERVICIO,
  SERVICIOS_ESTADO,
  ciudadPorEstadoSlug,
  datosEstado,
  filtrarServicio,
  limpiarServicios,
  rutaEstado,
  rutaServicioEstado,
  servicioPorSlug,
  serviciosEstadoIndexables,
} from "@/lib/seo/estados"
import { CALC_LASER, CALC_PLASMA, CALC_ROUTER } from "@/lib/seo/guias"

export const revalidate = 3600

const SITIO = "https://hetnacnc.com"
const CALCULADORA = { laser: CALC_LASER, router: CALC_ROUTER, plasma: CALC_PLASMA, maquinado: null } as const

type Props = { params: Promise<{ locale: string; ciudad: string; servicio: string }> }

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

async function cargar(p: { ciudad: string; servicio: string }) {
  const c = ciudadPorEstadoSlug(p.ciudad)
  const s = servicioPorSlug(p.servicio)
  if (!c || !s) return null
  const d = await datosEstado(c)
  return { c, s, pag: PAGINAS_SERVICIO[s.clave], d, f: filtrarServicio(d, s.clave) }
}

async function generateMetadataEs({ params }: Props): Promise<Metadata> {
  const x = await cargar(await params)
  if (!x || !x.f.total) return {}
  const { c, pag, f } = x
  const url = `${SITIO}/mx${rutaServicioEstado(c, x.s.clave)}`
  return {
    title: `${pag.nombre} en ${c.estado}: talleres y cotización gratis`,
    description: `${plural(f.total, "taller", "talleres")} de ${pag.nombre.toLowerCase()} en ${c.estado}. Publica tu trabajo gratis y recibe propuestas con precio y tiempo de entrega. Sin pagar por contacto.`,
    alternates: { canonical: url },
    robots: f.total >= MIN_EMPRESAS ? { index: true, follow: true } : { index: false, follow: true },
  }
}

export default async function ServicioEnEstado({ params }: Props) {
  const p = await params
  const x = await cargar(p)
  if (!x) notFound()
  const { c, s, pag, d, f } = x
  // Sin talleres de ese servicio no hay página: a la del estado
  if (!f.total) redirect(`/${p.locale}${rutaEstado(c)}`)

  const url = `${SITIO}/mx${rutaServicioEstado(c, s.clave)}`
  const licitacion = `/cotizar?servicio=${encodeURIComponent(pag.servicioSolicitud)}`
  const calc = CALCULADORA[s.clave]
  const top = f.municipios.slice(0, 8).map(([m]) => m)
  const otrosServicios = SERVICIOS_ESTADO.filter((o) => o.clave !== s.clave && filtrarServicio(d, o.clave).total > 0)
  const otrosEstados = (await serviciosEstadoIndexables().catch(() => [])).filter((o) => o.clave === s.clave && o.ciudad.slug !== c.slug)

  const faqs = [
    {
      p: `¿Cuántos talleres de ${pag.nombre.toLowerCase()} hay en ${c.estado}?`,
      r: `En HETNA tenemos ${plural(f.total, "taller", "talleres")} de ${pag.nombre.toLowerCase()} en ${c.estado}${f.talleres.length ? ` (${plural(f.talleres.length, "ya cotiza", "ya cotizan")} dentro de HETNA)` : ""}.${top.length ? ` Están en ${top.slice(0, 5).join(", ")}${f.municipios.length > 5 ? " y otros municipios" : ""}.` : ""}`,
    },
    {
      p: `¿Cuánto cuesta el ${pag.nombre.toLowerCase()} en ${c.estado}?`,
      r: calc
        ? `Depende del material, el grosor, el tamaño y la cantidad. Arriba puedes subir tu archivo o poner medidas y ver un precio estimado al instante; para el precio final, publica tu trabajo y los talleres te mandan su propuesta.`
        : `Depende del material, la complejidad, las tolerancias y la cantidad. Publica tu plano y los talleres te mandan su propuesta con precio y tiempo de entrega.`,
    },
    {
      p: `¿Tengo que pagar para recibir cotizaciones?`,
      r: `No. Publicar tu trabajo en HETNA es gratis y no pagas por contacto. Comparas las propuestas, eliges una y pagas dentro de HETNA cuando decides. Tus datos de contacto no se comparten.`,
    },
    {
      p: `¿Qué necesito para pedir ${pag.nombre.toLowerCase()}?`,
      r: `${pag.enviar.join(". ")}.`,
    },
    {
      p: `¿Puede hacerlo un taller de otro estado y enviármelo a ${c.estado}?`,
      r: `Sí. Las propuestas de talleres de otros estados dicen si incluyen el envío, y los envíos con guía llegan a toda la República.`,
    },
  ]

  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 pb-16 pt-6 lg:px-6">
      <JsonLd
        datos={[
          {
            ...servicioSchema({
              nombre: `${pag.nombre} en ${c.estado}`,
              descripcion: `Talleres de ${pag.nombre.toLowerCase()} en ${c.estado}: ${pag.queHacen}.`,
              ruta: `/mx${rutaServicioEstado(c, s.clave)}`,
              tipo: pag.nombre,
            }),
            areaServed: { "@type": "State", name: c.estado, containedInPlace: { "@type": "Country", name: "México" } },
          },
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            "@id": `${url}#talleres`,
            name: `Talleres de ${pag.nombre.toLowerCase()} en ${c.estado}`,
            numberOfItems: f.total,
            itemListElement: [
              ...f.talleres.map((t) => ({ name: t.nombre, url: `${SITIO}/mx/talleres/${t.handle}` })),
              ...f.empresas.map((e) => ({ name: e.empresa, url: `${SITIO}/mx/talleres/directorio/${e.slug}` })),
            ].map((it, i) => ({ "@type": "ListItem", position: i + 1, ...it })),
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((q) => ({ "@type": "Question", name: q.p, acceptedAnswer: { "@type": "Answer", text: q.r } })),
          },
          migas([
            { nombre: "Inicio", ruta: `${SITIO}/mx` },
            { nombre: "Talleres", ruta: `${SITIO}/mx/talleres` },
            { nombre: c.estado, ruta: `${SITIO}/mx${rutaEstado(c)}` },
            { nombre: pag.nombre },
          ]),
        ]}
      />

      <nav aria-label="Migas de pan" className="flex flex-wrap gap-1.5 text-[13px] text-[#6B675C]">
        <LocalizedClientLink href="/" className="hover:text-[#B34D07]"><TS>Inicio</TS></LocalizedClientLink>
        <span>/</span>
        <LocalizedClientLink href="/talleres" className="hover:text-[#B34D07]"><TS>Talleres</TS></LocalizedClientLink>
        <span>/</span>
        <LocalizedClientLink href={rutaEstado(c)} className="hover:text-[#B34D07]"><TS>{c.estado}</TS></LocalizedClientLink>
        <span>/</span>
        <span className="font-medium text-[#1B1B18]"><TS>{pag.nombre}</TS></span>
      </nav>

      <section className="mt-4 rounded-3xl bg-[#142033] p-6 text-white sm:p-10">
        <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">
          <TS>{pag.nombre}</TS> <TS>en</TS> <TS>{c.estado}</TS>
        </h1>
        <p className="mt-3 max-w-2xl text-[#F2C9A5]">
          {plural(f.total, "taller", "talleres")} <TS>de</TS> {pag.nombre.toLowerCase()}
          <TS>{top.length ? ` en ${top.slice(0, 3).join(", ")}${f.municipios.length > 3 ? " y más municipios" : ""}` : ` en ${c.estado}`}</TS>.
        </p>
        <p className="mt-3 max-w-2xl text-white/80">
          <TS>Publica tu trabajo gratis y recibe propuestas de varios talleres con precio y tiempo de entrega. Sin pagar por contacto: comparas, eliges y pagas dentro de HETNA.</TS>
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <LocalizedClientLink href={licitacion} className="rounded-xl bg-[#C2560A] px-5 py-3 font-semibold text-white hover:bg-[#A84A08]">
            <TS>Publicar mi trabajo gratis</TS>
          </LocalizedClientLink>
          {calc && (
            <a href="#precio" className="rounded-xl border border-white/30 px-5 py-3 font-semibold text-white hover:bg-white/10">
              <TS>Ver precio al instante</TS>
            </a>
          )}
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="text-xl font-extrabold text-[#142033]"><TS>Qué hacen los talleres de</TS> {pag.nombre.toLowerCase()}</h2>
          <p className="mt-2 text-[#40403A]"><TS>En</TS> <TS>{c.estado}</TS> <TS>encuentras</TS> <TS>{pag.queHacen}</TS>.</p>
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-[#142033]"><TS>Qué mandar para recibir un buen precio</TS></h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[#40403A]">
            {pag.enviar.map((e) => (
              <li key={e}><TS>{e}</TS></li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-extrabold text-[#142033]"><TS>Cómo funciona</TS></h2>
        <ol className="mt-3 grid gap-3 sm:grid-cols-3">
          {[
            ["1. Publicas tu trabajo", "Sube tu archivo o una foto con medidas, el material y la cantidad. Es gratis."],
            ["2. Te llegan propuestas", `Talleres de ${c.estado} y de otros estados te mandan precio y tiempo de entrega.`],
            ["3. Eliges y pagas en HETNA", "Comparas, eliges la que te convence y pagas dentro de HETNA. Tus datos no se comparten."],
          ].map(([t, r]) => (
            <li key={t} className="rounded-2xl border border-[#E7E4DC] bg-white p-4">
              <p className="font-bold text-[#142033]"><TS>{t}</TS></p>
              <p className="mt-1 text-sm text-[#40403A]"><TS>{r}</TS></p>
            </li>
          ))}
        </ol>
      </section>

      {calc && (
        <section id="precio" className="mt-8 scroll-mt-24">
          <h2 className="text-xl font-extrabold text-[#142033]"><TS>Precio estimado de</TS> {pag.nombre.toLowerCase()}</h2>
          <p className="mt-1 text-sm text-[#6B675C]"><TS>Sube tu archivo o pon las medidas. El precio final te lo da el taller en su propuesta.</TS></p>
          <div className="mt-3">
            <CalculadoraLead
              servicio={calc.servicio}
              tituloServicio={calc.titulo}
              materiales={calc.materiales}
              opcion={calc.opcion}
              servicioSolicitud={calc.servicioSolicitud}
            />
          </div>
        </section>
      )}

      {f.talleres.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-extrabold text-[#142033]"><TS>Talleres de HETNA en</TS> <TS>{c.estado}</TS></h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {f.talleres.map((t) => (
              <li key={t.id} className="rounded-2xl border-2 border-[#C2560A] bg-white p-4">
                <LocalizedClientLink href={`/talleres/${t.handle}`} className="font-bold text-[#142033] hover:text-[#C2560A]">
                  <TS>{t.nombre}</TS>
                  <TS>{t.verificado ? " ✓" : ""}</TS>
                </LocalizedClientLink>
                <p className="mt-0.5 text-[13px] text-[#6B675C]">{ubicacion(t.perfil) || c.estado}</p>
                {t.perfil.servicios.length > 0 && <p className="mt-2 text-sm text-[#40403A]"><TS>{t.perfil.servicios.join(" · ")}</TS></p>}
                <LocalizedClientLink
                  href={`/cotizar?taller=${encodeURIComponent(t.handle)}&servicio=${encodeURIComponent(pag.servicioSolicitud)}`}
                  className="mt-2 inline-block rounded-full bg-[#FDEEE1] px-2.5 py-1 text-[12px] font-semibold text-[#C2560A] hover:bg-[#FBDDC4]"
                >
                  <TS>Pedir cotización a este taller</TS>
                </LocalizedClientLink>
              </li>
            ))}
          </ul>
        </section>
      )}

      {f.empresas.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-extrabold text-[#142033]">
            <TS>Más talleres de</TS> {pag.nombre.toLowerCase()} <TS>en</TS> <TS>{c.estado}</TS>
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-[#6B675C]">
            <TS>Empresas que todavía no forman parte de HETNA, con datos públicos de su sitio web. Si pides cotización desde su perfil, tu solicitud llega a la red de talleres y además invitamos a esa empresa a responderte.</TS>
          </p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {f.empresas.map((e) => {
              const texto = limpiarServicios(e.servicios)
              return (
                <li key={e.slug} className="rounded-2xl border border-[#E7E4DC] bg-white p-4">
                  <LocalizedClientLink href={`/talleres/directorio/${e.slug}`} className="font-bold text-[#142033] hover:text-[#C2560A]">
                    <TS>{e.empresa}</TS>
                  </LocalizedClientLink>
                  <p className="mt-0.5 text-[13px] text-[#6B675C]">{e.ciudad || c.estado}</p>
                  {texto && <p className="mt-2 line-clamp-2 text-sm text-[#40403A]"><TS>{texto}</TS></p>}
                  <span className="mt-2 inline-block rounded-full bg-[#F3F1EA] px-2 py-0.5 text-[11px] font-semibold text-[#6B675C]"><TS>Perfil no reclamado</TS></span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {f.municipios.length > 1 && (
        <section className="mt-8">
          <h2 className="text-xl font-extrabold text-[#142033]">
            <TS>{pag.nombre}</TS> <TS>por</TS> <TS>{c.slug === "cdmx" ? "alcaldía" : "municipio"}</TS>
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {f.municipios.map(([m, n]) => (
              <li key={m} className="rounded-full border border-[#E7E4DC] bg-white px-3 py-1 text-sm text-[#142033]">
                <TS>{pag.nombre}</TS> <TS>en</TS> <TS>{m}</TS> <span className="text-[#6B675C]">({n})</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8 rounded-3xl border border-[#E7E4DC] bg-[#FDF6EF] p-6">
        <h2 className="text-xl font-extrabold text-[#142033]"><TS>¿Tienes un taller de</TS> {pag.nombre.toLowerCase()} <TS>en</TS> <TS>{c.estado}</TS>?</h2>
        <p className="mt-2 max-w-3xl text-[#40403A]">
          <TS>En HETNA te llegan trabajos de clientes de tu zona sin pagar por cada contacto: las licitaciones no cobran comisión. Registra tu taller gratis y empieza a mandar propuestas.</TS>
        </p>
        <LocalizedClientLink href="/talleres/unete" className="mt-4 inline-block rounded-xl bg-[#142033] px-5 py-3 font-semibold text-white hover:bg-[#0D1726]">
          <TS>Registrar mi taller gratis</TS>
        </LocalizedClientLink>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-extrabold text-[#142033]"><TS>Preguntas frecuentes</TS></h2>
        {faqs.map((q) => (
          <details key={q.p} className="border-t border-[#E7E4DC] py-3 first:border-t-0">
            <summary className="cursor-pointer font-semibold text-[#142033]"><TS>{q.p}</TS></summary>
            <p className="mt-2 text-[#40403A]"><TS>{q.r}</TS></p>
          </details>
        ))}
      </section>

      {(otrosServicios.length > 0 || otrosEstados.length > 0) && (
        <section className="mt-10 grid gap-6 sm:grid-cols-2">
          {otrosServicios.length > 0 && (
            <div>
              <h2 className="text-lg font-extrabold text-[#142033]"><TS>Otros servicios en</TS> <TS>{c.estado}</TS></h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                <li>
                  <LocalizedClientLink href={rutaEstado(c)} className="inline-block rounded-full border border-[#E7E4DC] bg-white px-3 py-1 text-sm text-[#142033] hover:border-[#C2560A]">
                    <TS>Todos los talleres CNC</TS>
                  </LocalizedClientLink>
                </li>
                {otrosServicios.map((o) => (
                  <li key={o.clave}>
                    <LocalizedClientLink
                      href={rutaServicioEstado(c, o.clave)}
                      className="inline-block rounded-full border border-[#E7E4DC] bg-white px-3 py-1 text-sm text-[#142033] hover:border-[#C2560A]"
                    >
                      <TS>{PAGINAS_SERVICIO[o.clave].nombre}</TS>
                    </LocalizedClientLink>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {otrosEstados.length > 0 && (
            <div>
              <h2 className="text-lg font-extrabold text-[#142033]"><TS>{pag.nombre}</TS> <TS>en otros estados</TS></h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {otrosEstados.map((o) => (
                  <li key={o.ciudad.slug}>
                    <LocalizedClientLink
                      href={rutaServicioEstado(o.ciudad, o.clave)}
                      className="inline-block rounded-full border border-[#E7E4DC] bg-white px-3 py-1 text-sm text-[#142033] hover:border-[#C2560A]"
                    >
                      <TS>{o.ciudad.estado}</TS> <span className="text-[#6B675C]">({o.total})</span>
                    </LocalizedClientLink>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </main>
  )
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata(...args: Parameters<typeof generateMetadataEs>) {
  return metaEnIdioma(await generateMetadataEs(...args))
}
