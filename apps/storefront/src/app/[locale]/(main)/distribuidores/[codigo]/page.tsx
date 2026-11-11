import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { CopiarCodigo } from "@/components/hetna/distribuidor/CopiarCodigo"
import { leerDistribuidor, ligaCotizador } from "@/lib/hetna/distribuidor"

// Página de cada distribuidor: hetnacnc.com/distribuidores/<código>. El botón
// abre el Cotizador con ?ref=<código>; la app lo guarda y lo aplica sola en
// cuanto el taller se registra (supabase/referidos.sql → aplicar_referido).
type Props = { params: Promise<{ codigo: string; locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { codigo } = await params
  const d = await leerDistribuidor(codigo)
  if (!d) return { title: "Código de distribuidor", robots: { index: false } }
  return {
    title: `${d.nombre} te regala ${d.dias} días de HETNA Taller`,
    description: `Activa tu código ${d.codigo} y usa el Cotizador HETNA gratis ${d.dias} días: cotiza desde DXF o STL, controla tu taller y cobra en línea.`,
    robots: { index: false, follow: true },
  }
}

export default async function DistribuidorPage({ params }: Props) {
  const { codigo } = await params
  const d = await leerDistribuidor(codigo)
  if (!d) notFound()
  const liga = ligaCotizador(d.codigo)
  const meses = d.dias >= 30 ? `${Math.round(d.dias / 30)} ${Math.round(d.dias / 30) === 1 ? "mes" : "meses"}` : `${d.dias} días`
  return (
    <main className="w-full bg-[#FAF9F6]">
      <section className="bg-[#142033] text-white">
        <div className="mx-auto max-w-[900px] px-4 py-14 text-center lg:px-6">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#F2A25F]">Regalo de {d.nombre}</p>
          <h1 className="mx-auto mt-2 max-w-2xl text-4xl font-extrabold leading-tight sm:text-5xl">
            {meses} de HETNA Taller, gratis
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/75">
            Con tu máquina nueva viene el Cotizador HETNA: sube tu DXF o STL y sabe en 2 minutos cuánto tarda, cuánto te cuesta y cuánto cobrar.
          </p>
          <div className="mx-auto mt-8 max-w-sm rounded-2xl bg-white/10 p-5">
            <p className="m-0 text-xs uppercase tracking-widest text-white/60">Tu código</p>
            <CopiarCodigo codigo={d.codigo} />
          </div>
          <a href={liga} className="mt-6 inline-block rounded-xl bg-[#C2560A] px-8 py-4 text-lg font-semibold text-white no-underline hover:brightness-110">
            Activar mis {d.dias} días
          </a>
          <p className="mt-3 text-sm text-white/60">El código se aplica solo al registrarte desde este botón.</p>
        </div>
      </section>

      <section className="mx-auto max-w-[900px] px-4 py-12 lg:px-6">
        <h2 className="text-center text-2xl font-extrabold text-[#142033]">En 3 pasos</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            ["1", "Regístrate", "Con el botón de arriba. Si ya bajaste la app, escribe el código en Menú → Invitar a un taller."],
            ["2", "Configura en 2 minutos", "Marca tus máquinas y materiales; los costos y velocidades típicos ya vienen puestos."],
            ["3", "Cotiza tu primera pieza", "Sube tu archivo, ajusta tu margen y manda la cotización por WhatsApp."],
          ].map(([n, t, txt]) => (
            <div key={n} className="rounded-2xl border border-[#E7E4DC] bg-white p-5">
              <p className="text-3xl font-black text-[#C2560A]">{n}</p>
              <p className="mt-1 font-bold text-[#142033]">{t}</p>
              <p className="mt-1 text-sm text-[#6B675C]">{txt}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-[12px] text-[#7A776E]">
          Vale para talleres nuevos en sus primeros 30 días. Al terminar el regalo puedes seguir con el plan gratis o contratar un plan.
        </p>
      </section>
    </main>
  )
}
