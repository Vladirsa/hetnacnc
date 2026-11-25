import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { QuitarPerfil, SolicitudDirectorio } from "@/components/hetna/taller/SolicitudDirectorio"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { descripcionCorta } from "@/lib/helpers/seo"
import { NOMBRE_TIPO, empresaPorSlug } from "@/lib/hetna/directorio"
import { listarTalleres } from "@/lib/hetna/talleres"

// Perfil NO RECLAMADO de una empresa del directorio (lib/hetna/directorio.ts).
// Confianza ante todo: dice claramente que la empresa no es parte de HETNA, de
// dónde salen los datos, qué pasa con la solicitud del cliente y cómo la empresa
// puede reclamar o quitar su perfil.

export const revalidate = 3600

type Props = { params: Promise<{ slug: string; locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const e = await empresaPorSlug(slug)
  if (!e) return { robots: { index: false } }
  const donde = [e.ciudad, e.estado].filter(Boolean).join(", ")
  return {
    title: `${e.empresa}${donde ? ` · ${donde}` : ""} | Directorio CNC`,
    description: descripcionCorta(`${e.empresa}: ${e.servicios || NOMBRE_TIPO[e.tipo]}${donde ? ` en ${donde}` : ""}. Pide cotización con HETNA CNC.`),
    alternates: { canonical: `https://hetnacnc.com/mx/talleres/directorio/${e.slug}` },
    // Sin descripción de servicios la página es muy delgada para Google
    robots: e.servicios ? undefined : { index: false, follow: true },
  }
}

const CAJA = "rounded-2xl border border-[#E7E4DC] bg-white p-6 sm:p-8"

// Calculadora de precio al instante que corresponde a lo que hace la empresa
function calculadoraDe(texto: string): { href: string; nombre: string } {
  const t = texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
  if (/plasma|oxicorte/.test(t)) return { href: "/cotizar/corte-plasma", nombre: "corte plasma" }
  if (/laser/.test(t)) return { href: "/cotizar/corte-laser", nombre: "corte láser" }
  if (/impresion 3d|impresora 3d|3d print/.test(t)) return { href: "/cotizar/impresion-3d", nombre: "impresión 3D" }
  return { href: "/cotizar/router-cnc", nombre: "router CNC" }
}

export default async function PerfilDirectorioPage({ params }: Props) {
  const { slug } = await params
  const e = await empresaPorSlug(slug)
  if (!e) notFound()
  const donde = [e.ciudad, e.estado].filter(Boolean).join(", ")
  const calculadora = calculadoraDe(`${e.empresa} ${e.servicios || ""} ${e.segmento || ""}`)
  const cercanos = e.estado
    ? (await listarTalleres().catch(() => [])).filter((t) => t.perfil.estado === e.estado).slice(0, 4)
    : []

  return (
    <main className="mx-auto w-full max-w-[1000px] px-4 py-8 lg:px-8">
      <nav className="mb-4 text-sm text-[#6B675C]">
        <LocalizedClientLink href="/talleres" className="hover:text-[#C2560A]">Talleres</LocalizedClientLink> ›{" "}
        <LocalizedClientLink href={e.estado ? `/talleres/directorio?estado=${encodeURIComponent(e.estado)}` : "/talleres/directorio"} className="hover:text-[#C2560A]">
          Directorio{e.estado ? ` · ${e.estado}` : ""}
        </LocalizedClientLink>
      </nav>

      <header className={CAJA}>
        <span className="inline-block rounded-full bg-[#F3F1EA] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#6B675C]">
          Perfil no reclamado
        </span>
        <h1 className="mt-3 text-3xl font-extrabold text-[#142033]">{e.empresa}</h1>
        <p className="mt-1 text-[#6B675C]">
          {NOMBRE_TIPO[e.tipo]}
          {donde ? ` · ${donde}` : ""}
          {e.tamano ? ` · Empresa ${e.tamano.toLowerCase()}` : ""}
        </p>
        {e.servicios && <p className="mt-4 text-[#1B1B18]">{e.servicios}</p>}
        {/* Quien llega desde Google ve aquí mismo qué hacer (antes el formulario quedaba
            fuera de la pantalla del celular y no había ningún botón arriba). */}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <a href="#cotizar" className="inline-flex justify-center rounded-xl bg-[#C2560A] px-5 py-3 text-center font-bold text-white hover:brightness-110">
            Pide cotización a {e.empresa.length > 28 ? "esta empresa" : e.empresa}
          </a>
          <LocalizedClientLink
            href={calculadora.href}
            className="inline-flex justify-center rounded-xl border-2 border-[#142033] px-5 py-3 text-center font-bold text-[#142033] hover:bg-[#142033] hover:text-white"
          >
            Precio al instante de {calculadora.nombre}
          </LocalizedClientLink>
        </div>
        <p className="mt-4 text-[13px] text-[#6B675C]">
          Esta empresa todavía no es parte de HETNA. La información es pública y viene de su propio sitio web; no la ha
          revisado la empresa ni HETNA la verificó.
        </p>
      </header>

      <section className={`${CAJA} mt-6 scroll-mt-28`} id="cotizar">
        <h2 className="text-xl font-extrabold text-[#142033]">Pide una cotización</h2>
        <ol className="mt-3 grid gap-2 text-sm text-[#40403A] sm:grid-cols-3">
          <li className="rounded-xl bg-[#FAF8F3] p-3">
            <b className="text-[#142033]">1. Te responde la red HETNA.</b> Tu solicitud llega a los talleres registrados que hacen ese trabajo, para que no te quedes sin propuestas.
          </li>
          <li className="rounded-xl bg-[#FAF8F3] p-3">
            <b className="text-[#142033]">2. Invitamos a {e.empresa}.</b> Le avisamos qué necesitas y dónde para que se una y te cotice. No le damos tu nombre ni tu contacto.
          </li>
          <li className="rounded-xl bg-[#FAF8F3] p-3">
            <b className="text-[#142033]">3. Tú eliges.</b> Comparas propuestas, pagas dentro de HETNA y el taller empieza a producir.
          </li>
        </ol>
        <div className="mt-6">
          <SolicitudDirectorio slug={e.slug} />
        </div>
      </section>

      {cercanos.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xl font-extrabold text-[#142033]">Talleres de HETNA en {e.estado}</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {cercanos.map((t) => (
              <li key={t.id} className="rounded-2xl border border-[#E7E4DC] bg-white p-4">
                <LocalizedClientLink href={`/talleres/${t.handle}`} className="font-bold text-[#142033] hover:text-[#C2560A]">
                  {t.nombre}
                </LocalizedClientLink>
                <p className="text-[13px] text-[#6B675C]">
                  {[t.perfil.ciudad, t.perfil.estado].filter(Boolean).join(", ")}
                  {t.verificado ? " · ✓ Verificado" : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6 rounded-2xl border-2 border-[#C2560A] bg-[#FDEEE1] p-6">
        <h2 className="text-lg font-extrabold text-[#142033]">¿Es tu empresa?</h2>
        <p className="mt-1 text-sm text-[#40403A]">
          Reclama tu perfil gratis: recibe las solicitudes de clientes que te buscan, cotiza sólo lo que te conviene, publica
          tus productos y cobra seguro dentro de HETNA. Pon tus propias fotos, máquinas y servicios.
        </p>
        <LocalizedClientLink
          href={`/talleres/unete?perfil=${encodeURIComponent(e.slug)}`}
          className="mt-3 inline-flex rounded-xl bg-[#C2560A] px-5 py-3 font-semibold text-white hover:brightness-110"
        >
          Reclamar mi perfil
        </LocalizedClientLink>
        <div className="mt-4">
          <QuitarPerfil slug={e.slug} />
        </div>
      </section>
    </main>
  )
}
