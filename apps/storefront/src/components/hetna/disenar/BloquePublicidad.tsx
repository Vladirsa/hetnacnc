import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { ANUNCIOS, type Anuncio } from "@/lib/hetna/anuncios"

// Espacio de publicidad del espacio Diseñar: talleres y proveedores que pagan
// por salir frente a quien está diseñando. Muestra los anuncios activos (con
// su imagen) y, al final, el cuadro "Anúnciate aquí".

const Tarjeta = ({ a }: { a: Anuncio }) => (
  <div className="overflow-hidden rounded-[14px] border border-[#E7E4DC] bg-white">
    {a.imagen ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={a.imagen} alt={a.nombre} className="aspect-[16/9] w-full object-cover" loading="lazy" />
    ) : (
      <div className="grid aspect-[16/9] w-full place-items-center bg-[#142033] text-[22px] font-extrabold text-[#FFC53D]">{a.nombre.slice(0, 2).toUpperCase()}</div>
    )}
    <div className="p-3">
      <p className="text-[13.5px] font-bold text-[#1B1B18]">{a.nombre}</p>
      {a.detalle && <p className="text-[11.5px] text-[#6B6A63]">{a.detalle}</p>}
      <p className="mt-1 text-[12.5px] leading-snug text-[#4A4943]">{a.texto}</p>
      <LocalizedClientLink href={a.href} className="mt-2 inline-block rounded-full bg-[#FF6A1A] px-3 py-1 text-[12px] font-bold text-white hover:bg-[#E65C12]">
        {a.boton || "Cotizar aquí"}
      </LocalizedClientLink>
    </div>
  </div>
)

export const BloquePublicidad = ({ compacto = false }: { compacto?: boolean }) => (
  <div className="flex flex-col gap-2.5">
    <div className="flex items-center justify-between px-1">
      <span className="text-[11px] font-bold uppercase tracking-wide text-[#6B6A63]">Talleres destacados</span>
      <span className="text-[10px] text-[#9A978F]">Patrocinado</span>
    </div>
    <div className={compacto ? "grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3" : "flex flex-col gap-2.5"}>
      {ANUNCIOS.map((a) => (
        <Tarjeta key={a.id} a={a} />
      ))}
      <LocalizedClientLink
        href="/anunciate"
        className="flex flex-col items-center justify-center gap-1 rounded-[14px] border-2 border-dashed border-[#C2560A] p-4 text-center text-[#B34D07]"
      >
        <span className="text-[13.5px] font-extrabold">Anúnciate aquí</span>
        <span className="text-[11.5px] text-[#6B6A63]">Tu taller o tus materiales frente a quien está diseñando ahora.</span>
      </LocalizedClientLink>
    </div>
  </div>
)
