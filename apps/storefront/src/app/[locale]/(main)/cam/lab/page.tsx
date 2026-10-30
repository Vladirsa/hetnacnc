import type { Metadata } from "next"

import { MarcoLaboratorio } from "@/components/hetna/cam/lab/MarcoLaboratorio"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { listarServiciosCam } from "@/lib/data/cam"

export const metadata: Metadata = {
  title: "CAM 3, 4 y 5 ejes | Laboratorio CAM — HETNA CNC",
  description:
    "Sube tu STL, OBJ o STEP, configura tu máquina y genera trayectorias de 3, 4 y 5 ejes con anticolisión, simulación y G-code para Mach3, LinuxCNC, GRBL, Fanuc y más.",
}

const PASOS = [
  ["Sube tu pieza", "STL, OBJ, STEP o IGES. Te decimos si la malla tiene huecos."],
  ["Configura tu máquina", "Cinemática, recorridos, pivote, controlador y tus herramientas reales."],
  ["Simula y revisa", "Trayectoria de 3, 4 o 5 ejes con anticolisión y remoción de material."],
  ["Paga y recibe", "El precio depende de la complejidad. Recibes el programa en tu cuenta."],
]

const pesos = (n: number, moneda: string) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: moneda.toUpperCase(), maximumFractionDigits: 0 }).format(n)

// Sin guardia de sesión: el laboratorio se prueba gratis. La cuenta se pide
// hasta pagar, igual que cualquier otra compra.
export default async function LaboratorioCam5Ejes({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const servicios = await listarServiciosCam(locale)

  return (
    <main className="w-full bg-[#FAF9F6]">
      <div className="px-4 lg:px-16 pt-6 text-[13px] text-[#6B6A63] flex flex-wrap gap-1.5">
        <LocalizedClientLink href="/" className="hover:text-[#B34D07]">
          Inicio
        </LocalizedClientLink>
        <span>/</span>
        <LocalizedClientLink href="/herramientas-cnc" className="hover:text-[#B34D07]">
          Herramientas CNC
        </LocalizedClientLink>
        <span>/</span>
        <LocalizedClientLink href="/herramientas-cnc#laboratorio-cam" className="hover:text-[#B34D07]">
          Laboratorio CAM
        </LocalizedClientLink>
        <span>/</span>
        <span className="text-[#1B1B18] font-medium">3, 4 y 5 ejes</span>
      </div>

      <section className="px-4 lg:px-16 pt-6 pb-8">
        <h1 className="text-[30px] lg:text-[40px] font-bold text-[#1B1B18] leading-[1.1] max-w-[820px]">
          Programa tu pieza para 3, 4 y 5 ejes
        </h1>
        <p className="mt-3 text-[16px] text-[#4A4943] leading-relaxed max-w-[680px]">
          Prueba el laboratorio gratis con tu modelo. Cuando la trayectoria te convenza, pide el
          servicio: el programa listo para tu controlador, un posprocesador a la medida o la
          revisión de un especialista antes de cortar.
        </p>
        <ol className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-[1100px]">
          {PASOS.map(([titulo, texto], i) => (
            <li key={titulo} className="rounded-[14px] border border-[#E7E4DC] bg-white p-4">
              <span className="text-[12px] font-semibold text-[#B34D07]">{i + 1}</span>
              <h2 className="mt-1 text-[16px] font-bold text-[#1B1B18]">{titulo}</h2>
              <p className="mt-1 text-[13px] text-[#4A4943] leading-relaxed">{texto}</p>
            </li>
          ))}
        </ol>
      </section>

      <MarcoLaboratorio
        locale={locale}
        publishableKey={process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""}
      />

      <section className="px-4 lg:px-16 py-12">
        <p className="max-w-[760px] rounded-[10px] border border-[#F0D9B5] bg-[#FFF8EC] px-4 py-3 text-[13px] leading-relaxed text-[#7A4A06]">
          La simulación es de referencia. Todo programa se prueba primero en vacío y con avance
          reducido antes de cortar material.
        </p>

        {servicios.length > 0 && (
          <>
            <h2 id="precios" className="mt-10 scroll-mt-24 text-[22px] font-bold text-[#1B1B18]">Precios</h2>
            <p className="mt-2 text-[14px] text-[#4A4943] max-w-[680px]">
              El nivel (Básica, Media o Alta) se asigna solo, según el tiempo de mecanizado y los
              puntos de la trayectoria que calculaste. Se entrega en tu cuenta, sin envío.
            </p>
            <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-[1100px]">
              {servicios.map((s) => (
                <li key={s.handle} className="flex flex-col rounded-[14px] border border-[#E7E4DC] bg-white p-5">
                  <h3 className="text-[16px] font-bold text-[#1B1B18]">{s.titulo}</h3>
                  {s.subtitulo && <p className="text-[13px] text-[#6B6A63]">{s.subtitulo}</p>}
                  <p className="mt-3 flex-1 text-[13px] text-[#4A4943] leading-relaxed">{s.descripcion}</p>
                  <p className="mt-4 text-[18px] font-bold text-[#1B1B18]">
                    {s.desde !== null ? `Desde ${pesos(s.desde, s.moneda)}` : "Cotización"}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}

        <p className="mt-10 text-[14px] text-[#4A4943]">
          ¿Ya pagaste un servicio?{" "}
          <LocalizedClientLink href="/user/cam" className="font-semibold text-[#B34D07] underline">
            Mira tus trabajos CAM
          </LocalizedClientLink>
          .
        </p>
      </section>
    </main>
  )
}
