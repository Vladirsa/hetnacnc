"use client"

// Botón para imprimir o guardar el expediente como PDF (el diálogo del navegador).
import { T } from "@/components/hetna/i18n/Idioma"
export function Imprimir() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-xl bg-[#142033] px-4 py-2 text-sm font-semibold text-white print:hidden"
    >
      <T>Imprimir o guardar PDF</T>
    </button>
  )
}
