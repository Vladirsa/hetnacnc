import type { Metadata } from "next"

import CotizadorEnvio from "@/components/hetna/envios/CotizadorEnvio"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"

export const metadata: Metadata = {
  title: "Envíos HETNA | Cotiza tu envío al instante",
  description:
    "Envíos HETNA calcula el costo de tu envío en el checkout. Para clientes y talleres CNC de todo México.",
}

const REJILLA =
  "repeating-linear-gradient(0deg,rgba(255,255,255,.06) 0 1px,transparent 1px 28px),repeating-linear-gradient(90deg,rgba(255,255,255,.06) 0 1px,transparent 1px 28px)"

const PASOS = [
  ["1", "Elige tu producto", "Agrégalo al carrito de cualquier taller de HETNA."],
  ["2", "Escribe tu dirección", "En el checkout se calcula el envío con tu código postal."],
  ["3", "Ve el precio al instante", "Verás el costo y los días estimados antes de pagar."],
] as const

const CLIENTES = [
  "Precio del envío visible antes de pagar",
  "Sin cotizar por separado ni escribir a cada taller",
  "Cobertura en todo México",
]

const TALLERES = [
  "Configura el origen de tus envíos con la dirección de tu taller",
  "El costo se calcula solo en cada pedido",
  "Sin contratar paqueterías por tu cuenta",
]

export default function EnviosHetnaPage() {
  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 py-8 lg:px-6">
      <header
        className="overflow-hidden rounded-3xl bg-[#142033] p-8 text-white sm:p-14"
        style={{ backgroundImage: REJILLA }}
      >
        <p className="text-xs font-bold uppercase tracking-[.2em] text-[#F2A25F]">Servicio HETNA</p>
        <h1 className="mt-2 max-w-2xl text-4xl font-extrabold leading-tight sm:text-5xl">Envíos HETNA</h1>
        <p className="mt-3 max-w-xl text-lg text-white/75">
          Cotiza tu envío al instante, directo en el checkout. Un solo servicio para clientes y talleres de todo México.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <LocalizedClientLink
            href="/categories"
            className="rounded-xl bg-[#C2560A] px-5 py-3 font-semibold text-white hover:brightness-110"
          >
            Ir a comprar
          </LocalizedClientLink>
          <LocalizedClientLink
            href="/talleres"
            className="rounded-xl border border-white/30 px-5 py-3 font-semibold text-white hover:bg-white/10"
          >
            Ver talleres
          </LocalizedClientLink>
        </div>
      </header>
      <CotizadorEnvio />

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        {PASOS.map(([n, t, d]) => (
          <div key={n} className="rounded-2xl border border-[#E7E4DC] bg-white p-6">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#C2560A] font-extrabold text-white">{n}</span>
            <h2 className="mt-3 text-lg font-extrabold text-[#142033]">{t}</h2>
            <p className="mt-1 text-sm text-[#6B675C]">{d}</p>
          </div>
        ))}
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[#E7E4DC] bg-white p-6 sm:p-8">
          <h2 className="text-xl font-extrabold text-[#142033]">Para clientes</h2>
          <ul className="mt-4 grid gap-2">
            {CLIENTES.map((x) => (
              <li key={x} className="flex gap-2 text-[#40403A]">
                <span className="font-bold text-[#C2560A]">✓</span>
                {x}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-[#E7E4DC] bg-white p-6 sm:p-8">
          <h2 className="text-xl font-extrabold text-[#142033]">Para talleres</h2>
          <ul className="mt-4 grid gap-2">
            {TALLERES.map((x) => (
              <li key={x} className="flex gap-2 text-[#40403A]">
                <span className="font-bold text-[#C2560A]">✓</span>
                {x}
              </li>
            ))}
          </ul>
          <a
            href="/seller"
            className="mt-5 inline-block rounded-xl bg-[#142033] px-5 py-2.5 font-semibold text-white hover:brightness-125"
          >
            Registrar mi taller
          </a>
        </div>
      </section>

      <p className="mt-6 text-center text-sm text-[#6B675C]">
        Próximamente: generación de guías e historial de rastreo desde tu panel.
      </p>
    </main>
  )
}
