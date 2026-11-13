import type { Metadata } from "next"

import { MarcoLaboratorio } from "@/components/hetna/cam/lab/MarcoLaboratorio"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { listarServiciosCam } from "@/lib/data/cam"

export const metadata: Metadata = {
  alternates: { canonical: "https://hetnacnc.com/mx/cam/lab" },
  title: "CAM Studio 3D: 3, 4 y 5 ejes",
  description:
    "Sube tu STL, OBJ o STEP, configura tu máquina y genera trayectorias de 3, 4 y 5 ejes con anticolisión, simulación y G-code para Mach3, LinuxCNC, GRBL, Fanuc y más.",
}

const pesos = (n: number, moneda: string) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: moneda.toUpperCase(), maximumFractionDigits: 0 }).format(n)

// Sin guardia de sesión: el laboratorio se prueba gratis. La cuenta se pide
// hasta pagar, igual que cualquier otra compra. El laboratorio llena la
// pantalla; los precios se abren en un panel flotante (sin JavaScript).
export default async function CamStudio3D({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const servicios = await listarServiciosCam(locale)

  return (
    <div className="relative">
      <MarcoLaboratorio
        locale={locale}
        publishableKey={process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""}
        pantallaCompleta
      />
      <details className="group absolute bottom-4 right-4 z-20 max-w-[min(420px,calc(100vw-2rem))] text-white">
        <summary className="ml-auto flex w-fit cursor-pointer list-none items-center gap-2 rounded-full bg-[#C2560A] px-4 py-2 text-[13px] font-bold shadow-lg hover:bg-[#A84A08] [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">Precios del servicio</span>
          <span className="hidden group-open:inline">Cerrar precios</span>
        </summary>
        <div className="mb-2 max-h-[60vh] overflow-y-auto rounded-[14px] border border-[#2B3648] bg-[#111722]/97 p-4 shadow-2xl">
          <p className="m-0 text-[13px] leading-relaxed text-[#C9D2E0]">
            Prueba gratis. Cuando la trayectoria te convenza, pide el programa listo para tu controlador. El nivel
            (Básica, Media o Alta) se asigna solo, según el tiempo de mecanizado. Se entrega en tu cuenta.
          </p>
          {servicios.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-2 p-0">
              {servicios.map((s) => (
                <li key={s.handle} className="list-none rounded-[10px] bg-[#1C2431] p-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <b className="text-[14px]">{s.titulo}</b>
                    <span className="shrink-0 text-[14px] font-bold text-[#F28A3C]">
                      {s.desde !== null ? `Desde ${pesos(s.desde, s.moneda)}` : "Cotización"}
                    </span>
                  </div>
                  {s.subtitulo && <p className="m-0 text-[12px] text-[#8A97AB]">{s.subtitulo}</p>}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mb-0 mt-3 rounded-[8px] border border-[#6a3a14] bg-[#2a1a0c] px-3 py-2 text-[12px] leading-relaxed text-[#F6C79B]">
            La simulación es de referencia: prueba todo programa en vacío y con avance reducido antes de cortar.
          </p>
          <p className="mb-0 mt-3 text-[12.5px] text-[#8A97AB]">
            ¿Ya pagaste?{" "}
            <LocalizedClientLink href="/user/cam" className="font-semibold text-[#F28A3C] underline">
              Mira tus trabajos CAM
            </LocalizedClientLink>
          </p>
        </div>
      </details>
    </div>
  )
}
