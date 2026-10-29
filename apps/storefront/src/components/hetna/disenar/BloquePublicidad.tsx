import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"

// Espacio de publicidad del espacio Diseñar: talleres y proveedores que pagan
// por salir frente a quien está diseñando. Por ahora muestra el cuadro
// "Anúnciate aquí"; los anuncios reales (con su imagen) se cargan después
// desde el panel de publicidad.
export const BloquePublicidad = () => (
  <div className="flex flex-col gap-2.5">
    <div className="flex items-center justify-between px-1">
      <span className="text-[11px] font-bold uppercase tracking-wide text-[#6B6A63]">Talleres destacados</span>
      <span className="text-[10px] text-[#9A978F]">Patrocinado</span>
    </div>
    <LocalizedClientLink
      href="/anunciate"
      className="flex flex-col items-center gap-1 rounded-[14px] border-2 border-dashed border-[#C2560A] p-4 text-center text-[#B34D07]"
    >
      <span className="text-[13.5px] font-extrabold">Anúnciate aquí</span>
      <span className="text-[11.5px] text-[#6B6A63]">Tu taller o tus materiales frente a quien está diseñando ahora.</span>
    </LocalizedClientLink>
  </div>
)
