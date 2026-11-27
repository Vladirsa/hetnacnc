"use client"

import { T } from "@/components/hetna/i18n/Idioma"
export function BotonImprimir() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-[10px] bg-[#C2560A] px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-[#A84A08]"
    >
      <T>Descargar PDF / Imprimir</T>
    </button>
  )
}
