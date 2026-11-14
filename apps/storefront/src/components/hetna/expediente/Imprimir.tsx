"use client"

// Botón para imprimir o guardar el expediente como PDF (el diálogo del navegador).
export function Imprimir() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-xl bg-[#142033] px-4 py-2 text-sm font-semibold text-white print:hidden"
    >
      Imprimir o guardar PDF
    </button>
  )
}
