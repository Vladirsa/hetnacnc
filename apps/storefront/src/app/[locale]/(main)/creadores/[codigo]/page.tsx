import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ContarVisita } from "@/components/hetna/creador/ContarVisita"
import { CopiarCodigo } from "@/components/hetna/distribuidor/CopiarCodigo"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { leerCreador, NOMBRE_RED } from "@/lib/hetna/creador"
import { ligaCotizador } from "@/lib/hetna/distribuidor"

// Página de cada creador: hetnacnc.com/creadores/<código>. El botón abre el
// Cotizador con ?ref=<código>; la app aplica los días sola al registrarse.
// Cada visita se cuenta para el creador (ContarVisita).
type Props = { params: Promise<{ codigo: string; locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { codigo } = await params
  const c = await leerCreador(codigo)
  if (!c) return { title: "Código de creador", robots: { index: false } }
  return {
    title: `${c.nombre} te regala ${c.dias} días de HETNA Taller`,
    description: `Con el código ${c.codigo} de ${c.nombre}, usa el Cotizador HETNA gratis ${c.dias} días: cotiza desde DXF o STL, manda PDF por WhatsApp y controla tu taller.`,
    robots: { index: false, follow: true },
  }
}

export default async function CreadorPage({ params }: Props) {
  const { codigo } = await params
  const c = await leerCreador(codigo)
  if (!c) notFound()
  const liga = ligaCotizador(c.codigo)
  const tiempo = c.dias >= 30 ? `${Math.round(c.dias / 30)} ${Math.round(c.dias / 30) === 1 ? "mes" : "meses"}` : `${c.dias} días`
  return (
    <main className="w-full bg-[#FAF9F6]">
      <ContarVisita codigo={c.codigo} />
      <section className="bg-[#142033] text-white">
        <div className="mx-auto max-w-[900px] px-4 py-14 text-center lg:px-6">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#F2A25F]">
            De parte de {c.nombre}
            {c.red && c.red !== "otra" ? ` · ${NOMBRE_RED[c.red] || ""}` : ""}
          </p>
          <h1 className="mx-auto mt-2 max-w-2xl text-4xl font-extrabold leading-tight sm:text-5xl">{tiempo} de HETNA Taller, gratis</h1>
          {c.mensaje ? (
            <p className="mx-auto mt-4 max-w-xl text-lg italic text-white/80">“{c.mensaje}”</p>
          ) : (
            <p className="mx-auto mt-4 max-w-xl text-lg text-white/75">
              El Cotizador para talleres CNC: sube tu DXF o STL, calcula tiempo, costo y precio con tu margen, y manda la cotización por WhatsApp.
            </p>
          )}
          <div className="mx-auto mt-8 max-w-sm rounded-2xl bg-white/10 p-5">
            <p className="m-0 text-xs uppercase tracking-widest text-white/60">Tu código</p>
            <CopiarCodigo codigo={c.codigo} />
          </div>
          <a href={liga} className="mt-6 inline-block rounded-xl bg-[#C2560A] px-8 py-4 text-lg font-semibold text-white no-underline hover:brightness-110">
            Activar mis {c.dias} días
          </a>
          <p className="mt-3 text-sm text-white/60">El código se aplica solo al registrarte desde este botón.</p>
          {c.canal_url && (
            <a href={c.canal_url} target="_blank" rel="noopener noreferrer nofollow" className="mt-4 inline-block text-sm text-[#F2C9A5] underline underline-offset-2">
              Ver el canal de {c.nombre}
            </a>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-[900px] px-4 py-12 lg:px-6">
        <h2 className="text-center text-2xl font-extrabold text-[#142033]">Qué puedes hacer en HETNA</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            ["Cotizar como profesional", "Precio desde el archivo con tus costos reales y PDF con tu logo por WhatsApp.", "/servicios/cotizador-cnc"],
            ["Conseguir clientes", "Recibe solicitudes de fabricación de hetnacnc.com y licitaciones en tu zona.", "/trabajos"],
            ["Herramientas gratis", "Calculadora CNC, diseños para láser y router, y CAM 2D y 3D.", "/herramientas-cnc"],
          ].map(([t, d, h]) => (
            <LocalizedClientLink key={t} href={h} className="rounded-2xl border border-[#E7E4DC] bg-white p-5 hover:border-[#C2560A]">
              <p className="font-bold text-[#142033]">{t}</p>
              <p className="mt-1 text-sm text-[#6B675C]">{d}</p>
            </LocalizedClientLink>
          ))}
        </div>
        <p className="mt-8 text-center text-[12px] text-[#7A776E]">
          Vale para talleres nuevos. Al terminar el regalo puedes seguir con el plan gratis o contratar un plan. ¿Tú también enseñas CNC?{" "}
          <LocalizedClientLink href="/creadores" className="underline">Únete al programa de creadores</LocalizedClientLink>.
        </p>
      </section>
    </main>
  )
}
