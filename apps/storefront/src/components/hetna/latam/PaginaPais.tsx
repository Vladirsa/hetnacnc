import { TS } from "@/i18n/TS"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { FormLatam } from "@/components/hetna/latam/FormLatam"
import { PAISES_LATAM, paisPorClave, rutaPais } from "@/components/hetna/latam/paises"
import { QuitarPerfil } from "@/components/hetna/taller/SolicitudDirectorio"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { NOMBRE_TIPO, directorioPais } from "@/lib/hetna/directorio"
import { conteoLatam } from "@/lib/hetna/latam"

// Página de pre-registro de un país (fase 5): /latinoamerica/<país>, /espana y
// /estados-unidos. A ella llevan las publicaciones de cada mercado
// (lib/latam-campana en la API) y las búsquedas "talleres CNC en <país>".

export function metaPais(pais: string): Metadata {
  const p = paisPorClave(pais)
  if (!p) return {}
  return {
    alternates: { canonical: `https://hetnacnc.com${rutaPais(p.clave)}` },
    title: { absolute: `HETNA CNC en ${p.nombre}: talleres de corte láser, router y plasma` },
    description: `HETNA CNC se prepara para abrir en ${p.nombre}. Talleres de router, láser y plasma: apúntate como fundador. Clientes: te avisamos al abrir.`,
  }
}

export async function PaginaPais({ pais }: { pais: string }) {
  const p = paisPorClave(pais)
  if (!p) notFound()
  // Empresas CNC del país que encontró el buscador (hoja de prospectos, en vivo):
  // cada noche que encuentra más, aparecen aquí solas. Sólo datos públicos.
  const [conteos, empresas] = await Promise.all([conteoLatam(), directorioPais(p.nombre, ...(p.en_hoja || []))])
  const conteo = conteos[p.clave]
  const total = conteo ? conteo.talleres + conteo.clientes : 0
  return (
    <main className="w-full bg-[#FAF9F6]">
      <section className="bg-[#142033] text-white">
        <div className="mx-auto max-w-[1000px] px-4 py-14 lg:px-6">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#F2A25F]">{p.bandera} <TS>Muy pronto en</TS> {p.nombre}</p>
          <h1 className="mt-2 max-w-3xl text-4xl font-extrabold leading-tight sm:text-5xl"><TS>HETNA CNC llega a</TS> {p.nombre}</h1>
          <p className="mt-4 max-w-2xl text-lg text-white/75">
            <TS>La red de talleres de router, láser y plasma de México se prepara para abrir en</TS> {p.nombre}
            {p.ciudades.length ? ` (${p.ciudades.slice(0, 3).join(", ")} y más)` : ""}<TS>. Abrimos primero donde más talleres y clientes se registren.</TS>
          </p>
          {p.nota && <p className="mt-3 max-w-2xl text-base font-semibold text-[#F2C9A5]"><TS>{p.nota}</TS></p>}
          {empresas.length > 0 && (
            <p className="mt-3 text-sm text-white/80">
              <TS>Ya ubicamos</TS> {empresas.length} {empresas.length === 1 ? "empresa CNC" : "empresas CNC"} <TS>en</TS> {p.nombre}.{" "}
              <a href="#directorio" className="font-semibold text-[#F2A25F] underline"><TS>Ver la lista</TS></a>
            </p>
          )}
          {total > 0 && (
            <p className="mt-3 text-sm text-[#F2C9A5]">
              <TS>Ya</TS> {total === 1 ? "hay 1 registro" : `hay ${total} registros`} <TS>en</TS> {p.nombre}
              {conteo?.talleres ? ` (${conteo.talleres} ${conteo.talleres === 1 ? "taller" : "talleres"})` : ""}.
            </p>
          )}
        </div>
      </section>

      <section className="mx-auto grid max-w-[1000px] gap-6 px-4 py-12 lg:grid-cols-[1fr_minmax(0,460px)] lg:px-6">
        <div className="grid content-start gap-4">
          {p.cotizador && (
            <div className="rounded-2xl border border-[#BFE3CC] bg-[#E6F4EA] p-5">
              <p className="font-bold text-[#0F5C2A]"><TS>📱 El Cotizador para talleres ya funciona en</TS> {p.nombre}</p>
              <p className="mt-1 text-sm text-[#1E4D2B]">
                <TS>Con</TS> {p.cotizador}<TS>: cotiza desde DXF, STL o STEP con tus costos, manda PDF por WhatsApp y controla tu taller.</TS>
              </p>
              <LocalizedClientLink href="/servicios/cotizador-cnc" className="mt-2 inline-block text-sm font-semibold text-[#0F5C2A] underline">
                <TS>Conocer el Cotizador →</TS>
              </LocalizedClientLink>
            </div>
          )}
          <div className="rounded-2xl border border-[#E7E4DC] bg-white p-5">
            <p className="font-bold text-[#142033]"><TS>Si tienes un taller CNC</TS></p>
            <p className="mt-1 text-sm text-[#6B675C]">
              <TS>Apúntate como taller fundador: cuando abramos</TS> {p.nombre}<TS>, recibes antes que nadie las solicitudes de fabricación de tu país, con el archivo revisado y precio estimado.</TS>
            </p>
          </div>
          <div className="rounded-2xl border border-[#E7E4DC] bg-white p-5">
            <p className="font-bold text-[#142033]"><TS>Si necesitas piezas</TS></p>
            <p className="mt-1 text-sm text-[#6B675C]"><TS>Corte láser, router, plasma, lámina con doblez e impresión 3D: subes tu archivo y varios talleres te mandan su propuesta.</TS></p>
          </div>
          <div className="rounded-2xl border border-[#E7E4DC] bg-white p-5">
            <p className="font-bold text-[#142033]"><TS>Gratis desde hoy</TS></p>
            <ul className="mt-1 grid gap-1 text-sm">
              <li><LocalizedClientLink href="/calculadora-cnc" className="text-[#C2560A] underline"><TS>Calculadora CNC</TS></LocalizedClientLink> <TS>(velocidades y avances)</TS></li>
              <li><LocalizedClientLink href="/disenar" className="text-[#C2560A] underline"><TS>Diseños para láser y router</TS></LocalizedClientLink> <TS>(cajas, letreros, llaveros)</TS></li>
              <li><LocalizedClientLink href="/herramientas-cnc" className="text-[#C2560A] underline"><TS>CAM 2D y 3D</TS></LocalizedClientLink></li>
            </ul>
          </div>
        </div>
        <div id="apuntate" className="scroll-mt-20 rounded-3xl border border-[#E7E4DC] bg-white p-6">
          <h2 className="text-xl font-extrabold text-[#142033]"><TS>Apúntate en</TS> {p.nombre}</h2>
          <p className="mb-4 mt-1 text-sm text-[#6B675C]"><TS>Sin costo. Te avisamos primero cuando abramos.</TS></p>
          <FormLatam paisInicial={p.clave} />
        </div>
      </section>

      {empresas.length > 0 && (
        <section id="directorio" className="mx-auto max-w-[1000px] scroll-mt-20 px-4 pb-12 lg:px-6">
          <h2 className="text-2xl font-extrabold text-[#142033]"><TS>Empresas CNC en</TS> {p.nombre}</h2>
          <p className="mt-1 max-w-3xl text-sm text-[#6B675C]">
            <TS>Talleres, proveedores e instructores de</TS> {p.nombre} <TS>que todavía no forman parte de HETNA. Son perfiles no reclamados:
            los datos son públicos y vienen del sitio web de cada empresa. ¿Es la tuya?</TS>{" "}
            <a href="#apuntate" className="font-semibold text-[#C2560A] underline"><TS>Apúntate como fundador</TS></a>.
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {empresas.map((e) => (
              <li key={e.slug} className="rounded-2xl border border-[#E7E4DC] bg-white p-4">
                <p className="font-bold text-[#142033]">{e.empresa}</p>
                <p className="mt-0.5 text-xs text-[#6B675C]">
                  {NOMBRE_TIPO[e.tipo]}
                  {e.ciudad ? ` · ${e.ciudad}` : ""} · <span className="rounded-full bg-[#F1F0EC] px-2 py-0.5"><TS>Perfil no reclamado</TS></span>
                </p>
                {e.servicios && <p className="mt-2 line-clamp-3 text-sm text-[#40403A]">{e.servicios}</p>}
                <div className="mt-2 text-xs">
                  <QuitarPerfil slug={e.slug} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mx-auto max-w-[1000px] px-4 pb-12 lg:px-6">
        <p className="text-sm text-[#6B675C]">
          <TS>Otros países:</TS>{" "}
          {PAISES_LATAM.filter((x) => x.clave !== p.clave).map((x, i) => (
            <span key={x.clave}>
              {i ? " · " : ""}
              <a href={rutaPais(x.clave)} className="underline">{x.bandera} {x.nombre}</a>
            </span>
          ))}
        </p>
      </section>
    </main>
  )
}
