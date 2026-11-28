import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import type { Metadata } from "next"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { listarTalleres } from "@/lib/hetna/talleres"

const metadataEs: Metadata = {
  alternates: { canonical: "https://hetnacnc.com/mx/talleres/fundadores" },
  title: "Talleres fundadores: 6 meses de plan Pro gratis",
  description:
    "Únete a la red de talleres CNC de HETNA. Los primeros 30 talleres reciben la insignia de Taller fundador y 6 meses de plan Pro gratis.",
}

const CUPO = 30

const BENEFICIOS = [
  ["★", "Insignia de Taller fundador", "Para siempre en tu perfil. Los clientes ven que estuviste desde el inicio."],
  ["⬆", "6 meses de plan Pro gratis", "Tus propuestas salen primero cuando un cliente compara cotizaciones."],
  ["✉", "Solicitudes de clientes", "Recibes trabajos de corte, maquinado y diseño de todo México sin buscar clientes."],
  ["🏭", "Tu mini-sitio de taller", "Portada, logo, galería de trabajos, máquinas, materiales y catálogo de productos."],
  ["💳", "Cobras dentro de HETNA", "El cliente paga con Mercado Pago; tú empiezas cuando el pago está confirmado."],
  ["📦", "Envíos HETNA", "Guías con paqueterías desde tu panel, sin contratar por tu cuenta."],
]

export default async function FundadoresPage() {
  const fundadores = (await listarTalleres()).filter((t) => t.fundador).length
  const quedan = Math.max(CUPO - fundadores, 0)

  return (
    <main className="w-full bg-[#FAF9F6]">
      <section className="bg-[#142033] text-white">
        <div className="mx-auto max-w-[1100px] px-4 py-14 lg:px-6">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#F2A25F]"><TS>Red de talleres HETNA</TS></p>
          <h1 className="mt-2 max-w-3xl text-4xl font-extrabold leading-tight sm:text-5xl">
            <TS>Sé uno de los primeros</TS> {CUPO} <TS>talleres fundadores</TS>
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-white/75">
            <TS>Registra tu taller gratis, recibe solicitudes de clientes y llévate</TS> <strong className="text-white"><TS>6 meses de plan Pro sin costo</TS></strong> <TS>y la insignia de Taller fundador.</TS>
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <LocalizedClientLink href="/talleres/unete" className="rounded-xl bg-[#C2560A] px-7 py-3.5 text-lg font-semibold text-white hover:brightness-110">
              <TS>Registrar mi taller</TS>
            </LocalizedClientLink>
            {quedan > 0 ? (
              <span className="font-semibold text-white"><TS>{`Quedan ${quedan} de ${CUPO} lugares de fundador`}</TS></span>
            ) : (
              <span className="text-white/80"><TS>El cupo de fundadores se llenó, pero puedes registrarte gratis.</TS></span>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1100px] px-4 py-12 lg:px-6">
        <h2 className="text-2xl font-extrabold text-[#142033]"><TS>Lo que recibe un taller fundador</TS></h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFICIOS.map(([i, t, d]) => (
            <div key={t} className="rounded-2xl border border-[#E7E4DC] bg-white p-5">
              <p className="text-2xl">{i}</p>
              <p className="mt-2 font-bold text-[#142033]"><TS>{t}</TS></p>
              <p className="mt-1 text-sm text-[#6B675C]"><TS>{d}</TS></p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1100px] px-4 pb-12 lg:px-6">
        <div className="grid gap-6 rounded-3xl border border-[#E7E4DC] bg-white p-6 sm:p-10 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-extrabold text-[#142033]"><TS>Cómo funciona</TS></h2>
            <ol className="mt-4 grid gap-3 text-[#40403A]">
              <li><strong>1.</strong> <TS>Crea tu cuenta de taller (es gratis).</TS></li>
              <li><strong>2.</strong> <TS>Llena tu perfil: municipio, servicios, máquinas, materiales y fotos de tus trabajos.</TS></li>
              <li><strong>3.</strong> <TS>Revisamos que tu taller sea real y activamos tu insignia y tu plan Pro.</TS></li>
              <li><strong>4.</strong> <TS>Recibe solicitudes en la pestaña &quot;Solicitudes&quot; de tu panel y manda tus propuestas.</TS></li>
            </ol>
          </div>
          <div className="rounded-2xl bg-[#F3F1EA] p-5 text-sm text-[#40403A]">
            <p className="font-bold text-[#142033]"><TS>Condiciones</TS></p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li><TS>Cupo para los primeros</TS> {CUPO} <TS>talleres verificados.</TS></li>
              <li><TS>El plan Pro gratis dura 6 meses a partir de la activación; después puedes seguir en el plan gratuito o contratar uno.</TS></li>
              <li><TS>La insignia de Taller fundador se queda para siempre.</TS></li>
              <li><TS>Los tratos y pagos con clientes de HETNA se hacen dentro de la plataforma.</TS></li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  )
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata() {
  return metaEnIdioma(metadataEs)
}
