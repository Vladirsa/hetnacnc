import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { type ArticuloResumen, urlArticulo } from "@/lib/foro/blog"
import type { Cta } from "@/lib/foro/cta"

// Piezas del blog dentro del foro: tarjetas de artículo, la franja "Del blog"
// de la portada, las guías fijas de una sección y los botones de servicio.

const fechaCorta = (s: string) => new Date(s).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })

export const TarjetaArticulo = ({ a, compacta = false }: { a: ArticuloResumen; compacta?: boolean }) => (
  <LocalizedClientLink
    href={urlArticulo(a.slug)}
    className={`group bg-white border border-[#E7E4DC] rounded-[14px] hover:border-[#C2560A] transition flex flex-col ${compacta ? "p-3.5 gap-1" : "p-4 gap-2"}`}
  >
    <span className="flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-wide">
      <span className={a.guia ? "text-[#16794F]" : "text-[#C2560A]"}>{a.guia ? "Guía" : "Artículo"}</span>
      <span className="text-[#9A978C] normal-case font-medium tracking-normal">{fechaCorta(a.published_at)}</span>
    </span>
    <span className={`font-bold text-[#1B1B18] leading-snug group-hover:text-[#B34D07] ${compacta ? "text-[14.5px] line-clamp-2" : "text-[16.5px]"}`}>{a.title}</span>
    {!compacta && <span className="text-[13.5px] text-[#55544D] leading-relaxed line-clamp-3">{a.excerpt}</span>}
  </LocalizedClientLink>
)

export const BloqueBlog = ({ articulos }: { articulos: ArticuloResumen[] }) =>
  articulos.length ? (
    <section className="bg-white border border-[#E7E4DC] rounded-[12px] p-4 flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="m-0 text-[15px] font-bold text-[#1B1B18]">Guías y artículos del blog</h2>
        <LocalizedClientLink href="/foro-cnc/blog" className="text-[13px] font-semibold text-[#C2560A]">
          Ver todo el blog →
        </LocalizedClientLink>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-3">
        {articulos.map((a) => (
          <TarjetaArticulo key={a.id} a={a} compacta />
        ))}
      </div>
    </section>
  ) : null

// Arriba de una sección del foro: sus guías fijas, para las dudas que se repiten.
export const GuiasSeccion = ({ guias }: { guias: ArticuloResumen[] }) =>
  guias.length ? (
    <section className="bg-[#EEF6EE] border border-[#B9DCC4] rounded-[12px] p-4 flex flex-col gap-2.5">
      <p className="m-0 text-[13px] font-bold text-[#16794F]">📌 Antes de preguntar, revisa la guía de esta sección</p>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {guias.map((a) => (
          <TarjetaArticulo key={a.id} a={a} compacta />
        ))}
      </div>
    </section>
  ) : null

// Botones de "de la duda al servicio".
export const BotonesServicio = ({ ctas, titulo = "Si prefieres resolverlo ya" }: { ctas: Cta[]; titulo?: string }) =>
  ctas.length ? (
    <section className="flex flex-col gap-2.5">
      <p className="m-0 text-[12px] font-bold uppercase tracking-wide text-[#9A978C]">{titulo}</p>
      <div className={`grid gap-3 ${ctas.length > 1 ? "sm:grid-cols-2" : ""}`}>
        {ctas.map((c) => (
          <LocalizedClientLink
            key={c.href}
            href={c.href}
            className="group flex flex-col gap-1 rounded-[14px] border border-[#F2C98F] bg-[#FFF6E8] p-4 hover:border-[#C2560A]"
          >
            <span className="text-[15px] font-bold text-[#1B1B18]">{c.titulo}</span>
            <span className="text-[13.5px] text-[#5A3A12]">{c.texto}</span>
            <span className="mt-1 self-start rounded-full bg-[#C2560A] px-3.5 py-1.5 text-[13px] font-semibold text-white group-hover:bg-[#A84A08]">
              {c.boton} →
            </span>
          </LocalizedClientLink>
        ))}
      </div>
    </section>
  ) : null
