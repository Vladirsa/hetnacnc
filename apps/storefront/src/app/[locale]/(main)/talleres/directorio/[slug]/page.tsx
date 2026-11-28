import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { QuitarPerfil, SolicitudDirectorio } from "@/components/hetna/taller/SolicitudDirectorio"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { descripcionCorta } from "@/lib/helpers/seo"
import { NOMBRE_TIPO, empresaPorSlug, nombreVisible, slugCanonico } from "@/lib/hetna/directorio"
import { listarTalleres } from "@/lib/hetna/talleres"
import { CIUDADES, guiaPorSlug, h1EnCiudad } from "@/lib/seo/guias"

// Perfil NO RECLAMADO de una empresa del directorio (lib/hetna/directorio.ts).
// Confianza ante todo: dice claramente que la empresa no es parte de HETNA, de
// dónde salen los datos, qué pasa con la solicitud del cliente y cómo la empresa
// puede reclamar o quitar su perfil.

export const revalidate = 3600

type Props = { params: Promise<{ slug: string; locale: string }> }

async function generateMetadataEs({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const e = await empresaPorSlug(slug)
  if (!e) return { robots: { index: false } }
  const donde = [e.ciudad, e.estado].filter(Boolean).join(", ")
  // Nombre limpio ("Inicio" del sitio fuera) y título corto: Google corta en ~60 caracteres
  const nombre = nombreVisible(e)
  const conLugar = `${nombre}${e.ciudad ? ` · ${e.ciudad}` : ""}`
  const titulo = conLugar.length <= 44 ? `${conLugar} | Directorio CNC` : conLugar.length <= 60 ? conLugar : nombre
  const canonico = await slugCanonico(e)
  return {
    title: titulo,
    description: descripcionCorta(`${nombre}: ${e.servicios || NOMBRE_TIPO[e.tipo]}${donde ? ` en ${donde}` : ""}. Pide cotización con HETNA CNC.`),
    alternates: { canonical: `https://hetnacnc.com/mx/talleres/directorio/${canonico}` },
    // Perfil vacío fuera de Google (plan SEO del 27 nov 2026, riesgo 1): se indexa
    // con servicios y lugar, o con una descripción de servicios con sustancia. La
    // regla «servicios y ciudad» a secas sacaba 105 perfiles con 545 impresiones
    // en 3 meses (perfiles con buena descripción y sin ciudad en la hoja); ésta
    // saca sólo los de verdad vacíos (19 perfiles, 14 impresiones).
    robots: perfilIndexable(e) ? undefined : { index: false, follow: true },
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

function perfilIndexable(e: { servicios?: string; ciudad?: string; estado?: string; region?: string }) {
  const servicios = (e.servicios || "").trim()
  return !!servicios && (!!(e.ciudad || e.estado || e.region) || servicios.length >= 80)
}

// Guía de la ciudad que corresponde al estado y al servicio de la empresa
// (/cnc/<guía>/<ciudad>). Los perfiles del directorio son las páginas que Google
// más visita: enlazar desde aquí ayuda a que encuentre las páginas de ciudad
// (el reporte de Search Console del 27 nov mostró «cnc router puebla» llevando a
// la página nacional en vez de la de Puebla).
function guiaDeCiudad(estado: string | undefined, texto: string): { href: string; texto: string; ciudad: string } | null {
  const ciudad = estado ? CIUDADES.find((c) => c.estado === estado) : undefined
  if (!ciudad) return null
  const t = texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
  const slug = /plasma|oxicorte/.test(t) ? "corte-plasma" : /laser/.test(t) ? "corte-laser-mdf" : /impresion 3d|impresora 3d|3d print/.test(t) ? "impresion-3d" : "taller-router-cnc-mexico"
  const guia = guiaPorSlug(slug)
  return guia ? { href: `/cnc/${slug}/${ciudad.slug}`, texto: h1EnCiudad(guia, ciudad), ciudad: ciudad.nombre } : null
}

export default async function PerfilDirectorioPage({ params }: Props) {
  const { slug } = await params
  const e = await empresaPorSlug(slug)
  if (!e) notFound()
  const donde = [e.ciudad, e.estado].filter(Boolean).join(", ")
  const calculadora = calculadoraDe(`${e.empresa} ${e.servicios || ""} ${e.segmento || ""}`)
  const guiaCiudad = guiaDeCiudad(e.estado, `${e.empresa} ${e.servicios || ""} ${e.segmento || ""}`)
  const cercanos = e.estado
    ? (await listarTalleres().catch(() => [])).filter((t) => t.perfil.estado === e.estado).slice(0, 4)
    : []

  return (
    <main className="mx-auto w-full max-w-[1000px] px-4 py-8 lg:px-8">
      <nav className="mb-4 text-sm text-[#6B675C]">
        <LocalizedClientLink href="/talleres" className="hover:text-[#C2560A]"><TS>Talleres</TS></LocalizedClientLink> ›<TS>{" "}</TS>
        <LocalizedClientLink href={e.estado ? `/talleres/directorio?estado=${encodeURIComponent(e.estado)}` : "/talleres/directorio"} className="hover:text-[#C2560A]">
          <TS>Directorio</TS><TS>{e.estado ? ` · ${e.estado}` : ""}</TS>
        </LocalizedClientLink>
      </nav>

      <header className={CAJA}>
        <span className="inline-block rounded-full bg-[#F3F1EA] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#6B675C]">
          <TS>Perfil no reclamado</TS>
        </span>
        <h1 className="mt-3 text-3xl font-extrabold text-[#142033]"><TS>{e.empresa}</TS></h1>
        <p className="mt-1 text-[#6B675C]">
          <TS>{NOMBRE_TIPO[e.tipo]}</TS>
          <TS>{donde ? ` · ${donde}` : ""}</TS>
          <TS>{e.tamano ? ` · Empresa ${e.tamano.toLowerCase()}` : ""}</TS>
        </p>
        {e.servicios && <p className="mt-4 text-[#1B1B18]"><TS>{e.servicios}</TS></p>}
        {/* Quien llega desde Google ve aquí mismo qué hacer (antes el formulario quedaba
            fuera de la pantalla del celular y no había ningún botón arriba). */}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <a href="#cotizar" className="inline-flex justify-center rounded-xl bg-[#C2560A] px-5 py-3 text-center font-bold text-white hover:brightness-110">
            <TS>Pide cotización a</TS> <TS>{e.empresa.length > 28 ? "esta empresa" : e.empresa}</TS>
          </a>
          {/* Con ciudad: la guía de esa ciudad (talleres de la zona y precio al
              instante); sin ciudad, la calculadora del servicio. */}
          <LocalizedClientLink
            href={guiaCiudad ? guiaCiudad.href : calculadora.href}
            className="inline-flex justify-center rounded-xl border-2 border-[#142033] px-5 py-3 text-center font-bold text-[#142033] hover:bg-[#142033] hover:text-white"
          >
            {guiaCiudad ? (
              <><TS>Cotiza con talleres en</TS> <TS>{guiaCiudad.ciudad}</TS></>
            ) : (
              <><TS>Precio al instante de</TS> <TS>{calculadora.nombre}</TS></>
            )}
          </LocalizedClientLink>
        </div>
        <p className="mt-4 text-[13px] text-[#6B675C]">
          <TS>Esta empresa todavía no es parte de HETNA. La información es pública y viene de su propio sitio web; no la ha
          revisado la empresa ni HETNA la verificó.</TS>
        </p>
      </header>

      <section className={`${CAJA} mt-6 scroll-mt-28`} id="cotizar">
        <h2 className="text-xl font-extrabold text-[#142033]"><TS>Pide una cotización</TS></h2>
        <ol className="mt-3 grid gap-2 text-sm text-[#40403A] sm:grid-cols-3">
          <li className="rounded-xl bg-[#FAF8F3] p-3">
            <b className="text-[#142033]"><TS>1. Te responde la red HETNA.</TS></b> <TS>Tu solicitud llega a los talleres registrados que hacen ese trabajo, para que no te quedes sin propuestas.</TS>
          </li>
          <li className="rounded-xl bg-[#FAF8F3] p-3">
            <b className="text-[#142033]"><TS>2. Invitamos a</TS> <TS>{e.empresa}</TS>.</b> <TS>Le avisamos qué necesitas y dónde para que se una y te cotice. No le damos tu nombre ni tu contacto.</TS>
          </li>
          <li className="rounded-xl bg-[#FAF8F3] p-3">
            <b className="text-[#142033]"><TS>3. Tú eliges.</TS></b> <TS>Comparas propuestas, pagas dentro de HETNA y el taller empieza a producir.</TS>
          </li>
        </ol>
        <div className="mt-6">
          <SolicitudDirectorio slug={e.slug} />
        </div>
      </section>

      {cercanos.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xl font-extrabold text-[#142033]"><TS>Talleres de HETNA en</TS> <TS>{e.estado}</TS></h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {cercanos.map((t) => (
              <li key={t.id} className="rounded-2xl border border-[#E7E4DC] bg-white p-4">
                <LocalizedClientLink href={`/talleres/${t.handle}`} className="font-bold text-[#142033] hover:text-[#C2560A]">
                  <TS>{t.nombre}</TS>
                </LocalizedClientLink>
                <p className="text-[13px] text-[#6B675C]">
                  <TS>{[t.perfil.ciudad, t.perfil.estado].filter(Boolean).join(", ")}</TS>
                  <TS>{t.verificado ? " · ✓ Verificado" : ""}</TS>
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {guiaCiudad && (
        <p className="mt-6 text-sm text-[#40403A]">
          <TS>Compara con otras opciones:</TS>{" "}
          <LocalizedClientLink href={guiaCiudad.href} className="font-semibold text-[#C2560A] hover:underline">
            <TS>{guiaCiudad.texto}</TS>
          </LocalizedClientLink>
        </p>
      )}

      <section className="mt-6 rounded-2xl border-2 border-[#C2560A] bg-[#FDEEE1] p-6">
        <h2 className="text-lg font-extrabold text-[#142033]"><TS>¿Es tu empresa?</TS></h2>
        <p className="mt-1 text-sm text-[#40403A]">
          <TS>Reclama tu perfil gratis: recibe las solicitudes de clientes que te buscan, cotiza sólo lo que te conviene, publica
          tus productos y cobra seguro dentro de HETNA. Pon tus propias fotos, máquinas y servicios.</TS>
        </p>
        <LocalizedClientLink
          href={`/talleres/unete?perfil=${encodeURIComponent(e.slug)}`}
          className="mt-3 inline-flex rounded-xl bg-[#C2560A] px-5 py-3 font-semibold text-white hover:brightness-110"
        >
          <TS>Reclamar mi perfil</TS>
        </LocalizedClientLink>
        <div className="mt-4">
          <QuitarPerfil slug={e.slug} />
        </div>
      </section>
    </main>
  )
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata(...args: Parameters<typeof generateMetadataEs>) {
  return metaEnIdioma(await generateMetadataEs(...args))
}
