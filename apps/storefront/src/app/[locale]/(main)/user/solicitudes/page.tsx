import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import type { Metadata } from "next"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { misSolicitudes } from "@/lib/cotizar/solicitud-taller"

export const dynamic = "force-dynamic"

const metadataEs: Metadata = {
  title: "Mis solicitudes de fabricación",
  description: "Tus solicitudes a talleres CNC: propuestas, pago, seguimiento y entrega.",
  robots: { index: false, follow: false },
}

const pesos = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default async function MisSolicitudesPage() {
  const { sesion, solicitudes } = await misSolicitudes()

  if (!sesion) {
    return (
      <main className="container">
        <div className="mx-auto max-w-[460px] py-16 text-center">
          <h1 className="text-[24px] font-bold text-[#1B1B18]"><TS>Entra a tu cuenta</TS></h1>
          <p className="mt-2 text-[15px] leading-relaxed text-[#4A4943]">
            <TS>Tus solicitudes de fabricación se guardan en tu cuenta cuando las mandas con sesión iniciada o cuando abres su liga
            estando dentro.</TS>
          </p>
          <LocalizedClientLink
            href="/login"
            className="mt-6 inline-block rounded-[10px] bg-[#C2560A] px-6 py-3 text-[15px] font-semibold text-white hover:bg-[#A84A08]"
          >
            <TS>Iniciar sesión</TS>
          </LocalizedClientLink>
        </div>
      </main>
    )
  }

  return (
    <main className="container">
      <div className="mx-auto max-w-[820px] py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[26px] font-bold text-[#1B1B18]"><TS>Mis solicitudes de fabricación</TS></h1>
            <p className="mt-1 text-[15px] text-[#4A4943]"><TS>Propuestas de talleres, pago y seguimiento de cada trabajo.</TS></p>
          </div>
          <LocalizedClientLink href="/user/cotizar" className="rounded-[10px] bg-[#C2560A] px-4 py-2.5 text-[14px] font-semibold text-white">
            <TS>Nueva solicitud</TS>
          </LocalizedClientLink>
        </div>

        {!solicitudes.length ? (
          <div className="mt-8 rounded-[14px] border border-[#E7E4DC] bg-white p-6">
            <p className="text-[15px] text-[#4A4943]">
              <TS>Todavía no tienes solicitudes en tu cuenta. Si mandaste una antes, abre la liga que te llegó por correo estando dentro de tu
              cuenta y aparecerá aquí.</TS>
            </p>
          </div>
        ) : (
          <ul className="mt-6 grid gap-3">
            {solicitudes.map((s) => (
              <li key={s.folio}>
                <a
                  href={s.liga}
                  className="block rounded-[14px] border border-[#E7E4DC] bg-white p-5 transition hover:border-[#C2560A]/50 hover:shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#C2560A]"><TS>Folio</TS> <TS>{s.folio}</TS></p>
                      <p className="mt-1 truncate font-bold text-[#142033]"><TS>{s.resumen || "Solicitud de fabricación"}</TS></p>
                      <p className="mt-1 text-sm text-[#6B675C]">
                        <TS>{s.taller
                          ? `${s.taller.nombre} · ${pesos(s.taller.precio)} MXN`
                          : s.propuestas
                            ? `${s.propuestas} ${s.propuestas === 1 ? "propuesta" : "propuestas"} para comparar`
                            : "Esperando propuestas"}</TS>
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-sm font-bold ${
                        s.falta_pago ? "bg-[#FFF1E6] text-[#C2560A]" : s.etapa === "cancelada" ? "bg-[#FDECEA] text-[#B3261E]" : "bg-[#F3F1EA] text-[#40403A]"
                      }`}
                    >
                      <TS>{s.falta_pago ? "Falta tu pago" : s.etapa_nombre}</TS>
                    </span>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata() {
  return metaEnIdioma(metadataEs)
}
