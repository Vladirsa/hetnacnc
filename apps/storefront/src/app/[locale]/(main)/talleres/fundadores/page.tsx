import type { Metadata } from "next"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { listarTalleres } from "@/lib/hetna/talleres"

export const metadata: Metadata = {
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
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#F2A25F]">Red de talleres HETNA</p>
          <h1 className="mt-2 max-w-3xl text-4xl font-extrabold leading-tight sm:text-5xl">
            Sé uno de los primeros {CUPO} talleres fundadores
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-white/75">
            Registra tu taller gratis, recibe solicitudes de clientes y llévate <strong className="text-white">6 meses de plan Pro sin costo</strong> y la insignia de Taller fundador.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <LocalizedClientLink href="/talleres/unete" className="rounded-xl bg-[#C2560A] px-7 py-3.5 text-lg font-semibold text-white hover:brightness-110">
              Registrar mi taller
            </LocalizedClientLink>
            {quedan > 0 ? (
              <span className="text-white/80">Quedan <strong className="text-white">{quedan}</strong> lugares de fundador</span>
            ) : (
              <span className="text-white/80">El cupo de fundadores se llenó, pero puedes registrarte gratis.</span>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1100px] px-4 py-12 lg:px-6">
        <h2 className="text-2xl font-extrabold text-[#142033]">Lo que recibe un taller fundador</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFICIOS.map(([i, t, d]) => (
            <div key={t} className="rounded-2xl border border-[#E7E4DC] bg-white p-5">
              <p className="text-2xl">{i}</p>
              <p className="mt-2 font-bold text-[#142033]">{t}</p>
              <p className="mt-1 text-sm text-[#6B675C]">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1100px] px-4 pb-12 lg:px-6">
        <div className="grid gap-6 rounded-3xl border border-[#E7E4DC] bg-white p-6 sm:p-10 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-extrabold text-[#142033]">Cómo funciona</h2>
            <ol className="mt-4 grid gap-3 text-[#40403A]">
              <li><strong>1.</strong> Crea tu cuenta de taller (es gratis).</li>
              <li><strong>2.</strong> Llena tu perfil: municipio, servicios, máquinas, materiales y fotos de tus trabajos.</li>
              <li><strong>3.</strong> Revisamos que tu taller sea real y activamos tu insignia y tu plan Pro.</li>
              <li><strong>4.</strong> Recibe solicitudes en la pestaña &quot;Solicitudes&quot; de tu panel y manda tus propuestas.</li>
            </ol>
          </div>
          <div className="rounded-2xl bg-[#F3F1EA] p-5 text-sm text-[#40403A]">
            <p className="font-bold text-[#142033]">Condiciones</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Cupo para los primeros {CUPO} talleres verificados.</li>
              <li>El plan Pro gratis dura 6 meses a partir de la activación; después puedes seguir en el plan gratuito o contratar uno.</li>
              <li>La insignia de Taller fundador se queda para siempre.</li>
              <li>Los tratos y pagos con clientes de HETNA se hacen dentro de la plataforma.</li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  )
}
