import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { FormLatam } from "@/components/hetna/latam/FormLatam"
import { PAISES_LATAM, paisPorClave, rutaPais } from "@/components/hetna/latam/paises"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
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
  const conteo = (await conteoLatam())[p.clave]
  const total = conteo ? conteo.talleres + conteo.clientes : 0
  return (
    <main className="w-full bg-[#FAF9F6]">
      <section className="bg-[#142033] text-white">
        <div className="mx-auto max-w-[1000px] px-4 py-14 lg:px-6">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#F2A25F]">{p.bandera} Muy pronto en {p.nombre}</p>
          <h1 className="mt-2 max-w-3xl text-4xl font-extrabold leading-tight sm:text-5xl">HETNA CNC llega a {p.nombre}</h1>
          <p className="mt-4 max-w-2xl text-lg text-white/75">
            La red de talleres de router, láser y plasma de México se prepara para abrir en {p.nombre}
            {p.ciudades.length ? ` (${p.ciudades.slice(0, 3).join(", ")} y más)` : ""}. Abrimos primero donde más talleres y clientes se registren.
          </p>
          {total > 0 && (
            <p className="mt-3 text-sm text-[#F2C9A5]">
              Ya {total === 1 ? "hay 1 registro" : `hay ${total} registros`} en {p.nombre}
              {conteo?.talleres ? ` (${conteo.talleres} ${conteo.talleres === 1 ? "taller" : "talleres"})` : ""}.
            </p>
          )}
        </div>
      </section>

      <section className="mx-auto grid max-w-[1000px] gap-6 px-4 py-12 lg:grid-cols-[1fr_minmax(0,460px)] lg:px-6">
        <div className="grid content-start gap-4">
          {p.cotizador && (
            <div className="rounded-2xl border border-[#BFE3CC] bg-[#E6F4EA] p-5">
              <p className="font-bold text-[#0F5C2A]">📱 El Cotizador para talleres ya funciona en {p.nombre}</p>
              <p className="mt-1 text-sm text-[#1E4D2B]">
                Con {p.cotizador}: cotiza desde DXF, STL o STEP con tus costos, manda PDF por WhatsApp y controla tu taller.
              </p>
              <LocalizedClientLink href="/servicios/cotizador-cnc" className="mt-2 inline-block text-sm font-semibold text-[#0F5C2A] underline">
                Conocer el Cotizador →
              </LocalizedClientLink>
            </div>
          )}
          <div className="rounded-2xl border border-[#E7E4DC] bg-white p-5">
            <p className="font-bold text-[#142033]">Si tienes un taller CNC</p>
            <p className="mt-1 text-sm text-[#6B675C]">
              Apúntate como taller fundador: cuando abramos {p.nombre}, recibes antes que nadie las solicitudes de fabricación de tu país, con el archivo revisado y precio estimado.
            </p>
          </div>
          <div className="rounded-2xl border border-[#E7E4DC] bg-white p-5">
            <p className="font-bold text-[#142033]">Si necesitas piezas</p>
            <p className="mt-1 text-sm text-[#6B675C]">Corte láser, router, plasma, lámina con doblez e impresión 3D: subes tu archivo y varios talleres te mandan su propuesta.</p>
          </div>
          <div className="rounded-2xl border border-[#E7E4DC] bg-white p-5">
            <p className="font-bold text-[#142033]">Gratis desde hoy</p>
            <ul className="mt-1 grid gap-1 text-sm">
              <li><LocalizedClientLink href="/calculadora-cnc" className="text-[#C2560A] underline">Calculadora CNC</LocalizedClientLink> (velocidades y avances)</li>
              <li><LocalizedClientLink href="/disenar" className="text-[#C2560A] underline">Diseños para láser y router</LocalizedClientLink> (cajas, letreros, llaveros)</li>
              <li><LocalizedClientLink href="/herramientas-cnc" className="text-[#C2560A] underline">CAM 2D y 3D</LocalizedClientLink></li>
            </ul>
          </div>
        </div>
        <div className="rounded-3xl border border-[#E7E4DC] bg-white p-6">
          <h2 className="text-xl font-extrabold text-[#142033]">Apúntate en {p.nombre}</h2>
          <p className="mb-4 mt-1 text-sm text-[#6B675C]">Sin costo. Te avisamos primero cuando abramos.</p>
          <FormLatam paisInicial={p.clave} />
        </div>
      </section>

      <section className="mx-auto max-w-[1000px] px-4 pb-12 lg:px-6">
        <p className="text-sm text-[#6B675C]">
          Otros países:{" "}
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
