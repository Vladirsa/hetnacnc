import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { BotonImprimir } from "@/components/hetna/academia/BotonImprimir"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { constanciaSim } from "@/lib/data/simulador"

// Constancia del Simulador CNC: sólo para quien aprobó todos los ejercicios
// (calificados en el servidor). Registra que completó los ejercicios del
// simulador de HETNA; no es una certificación oficial.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Constancia del Simulador CNC — Academia HETNA",
  robots: { index: false, follow: false },
}

export default async function ConstanciaSimulador({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const c = await constanciaSim()
  if (!c) redirect(`/${locale}/cam/simulador?maquina=ejercicios`)
  const fecha = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Mexico_City" }).format(new Date(c.fecha))
  const fresa = c.ejercicios.filter((e) => e.maquina === "fresadora").length
  const torno = c.ejercicios.length - fresa

  return (
    <main className="min-h-[80vh] bg-[#F3F1EA] px-4 py-8 print:bg-white print:p-0">
      <style>{`@page{size:landscape;margin:0}@media print{header,footer,nav,.no-imprimir{display:none!important}}`}</style>
      <div className="no-imprimir mx-auto mb-4 flex max-w-[1000px] flex-wrap items-center justify-between gap-3">
        <LocalizedClientLink href="/cam/simulador?maquina=ejercicios" className="text-[14px] font-semibold text-[#6B6A63] hover:text-[#B34D07]">
          ← Volver al simulador
        </LocalizedClientLink>
        <BotonImprimir />
      </div>

      <article className="relative mx-auto aspect-[1.414] w-full max-w-[1000px] overflow-hidden bg-white shadow-[0_20px_60px_-20px_rgba(20,32,51,0.4)] print:shadow-none">
        <div className="absolute inset-4 border-[3px] border-[#142033] sm:inset-6" />
        <div className="absolute inset-6 border border-[#C2560A] sm:inset-9" />
        <div className="relative flex h-full flex-col items-center justify-center px-10 text-center sm:px-20">
          <p className="m-0 text-[12px] font-extrabold uppercase tracking-[0.3em] text-[#C2560A] sm:text-[14px]">Academia HETNA CNC</p>
          <h1 className="m-0 mt-2 font-display text-[28px] font-extrabold text-[#142033] sm:text-[44px]">Constancia de práctica</h1>
          <p className="m-0 mt-4 text-[13px] text-[#6B6A63] sm:mt-6 sm:text-[16px]">Se otorga a</p>
          <p className="m-0 mt-1 border-b-2 border-[#E7E4DC] px-6 pb-1 font-display text-[26px] font-bold text-[#1B1B18] sm:text-[40px]">{c.alumno}</p>
          <p className="m-0 mt-4 max-w-[680px] text-[13px] leading-relaxed text-[#4A4943] sm:mt-6 sm:text-[17px]">
            por aprobar los {c.ejercicios.length} ejercicios de programación en G-code del Simulador CNC de HETNA
            ({fresa} de fresadora y router{torno ? ` y ${torno} de torno` : ""}), calificados automáticamente por la pieza obtenida.
          </p>
          <p className="m-0 mt-2 text-[15px] font-bold text-[#142033] sm:text-[20px]">Promedio: {c.promedio} / 100</p>
          <div className="mt-6 grid w-full max-w-[640px] grid-cols-2 gap-6 text-[11px] text-[#6B6A63] sm:mt-10 sm:text-[13px]">
            <div className="border-t border-[#9A978C] pt-2">
              <p className="m-0 font-semibold text-[#1B1B18]">{fecha}</p>
              <p className="m-0">Fecha</p>
            </div>
            <div className="border-t border-[#9A978C] pt-2">
              <p className="m-0 font-semibold text-[#1B1B18]">Folio {c.folio}</p>
              <p className="m-0">hetnacnc.com/mx/cam/simulador</p>
            </div>
          </div>
          <p className="m-0 mt-4 max-w-[640px] text-[10px] text-[#9A978C] sm:text-[11px]">
            Esta constancia registra la práctica en el simulador de HETNA CNC. No es una certificación oficial ni sustituye una evaluación en máquina.
          </p>
        </div>
      </article>
    </main>
  )
}
