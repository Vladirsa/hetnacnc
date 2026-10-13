import { SellerInfo } from "@/components/molecules"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { tallerPorHandle, ubicacion } from "@/lib/hetna/talleres"
import { SellerDTO } from "@mercurjs/types"

// Tarjeta "Vendido por": muestra quién fabrica o vende el producto (logo, ciudad, experiencia,
// calificación) con liga a su mini-sitio. Si el perfil del taller no está disponible,
// se muestra la tarjeta original del vendedor.
export const ProductDetailsSeller = async ({ seller }: { seller?: SellerDTO }) => {
  if (!seller) return null

  const t = seller.handle ? await tallerPorHandle(seller.handle).catch(() => null) : null

  if (!t) {
    return (
      <div className="border rounded-sm">
        <div className="flex justify-between">
          <SellerInfo seller={seller} showArrow bottomBorder showReviews={false} />
        </div>
      </div>
    )
  }

  const p = t.perfil
  const donde = ubicacion(p)
  const datos: string[] = [
    p.anos !== undefined ? `${p.anos} años de experiencia` : "",
    p.entrega ? `Entrega: ${p.entrega}` : "",
    p.calificacion !== undefined ? `★ ${p.calificacion.toFixed(1)}${p.resenas ? ` (${p.resenas} reseñas)` : ""}` : "Taller nuevo en HETNA",
  ].filter(Boolean)

  return (
    <section className="rounded-lg border border-[#E7E4DC] bg-white p-4" data-testid="product-seller-card">
      <p className="text-xs font-bold uppercase tracking-wider text-[#6B675C]">Vendido por</p>
      <div className="mt-2 flex items-center gap-3">
        <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#142033] text-lg font-extrabold text-white">
          {t.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={t.logo} alt={t.nombre} className="h-full w-full object-cover" />
          ) : (
            t.nombre.slice(0, 2).toUpperCase()
          )}
        </div>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-bold text-[#142033]">
            {t.nombre}
            {t.fundador && (
              <span className="rounded-full bg-[#FFF1E6] px-2 py-0.5 text-[10px] font-bold uppercase text-[#C2560A]">★ Taller fundador</span>
            )}
          </p>
          {donde && <p className="text-sm text-[#6B675C]">📍 {donde}</p>}
        </div>
      </div>
      <ul className="mt-3 grid gap-1 text-sm text-[#40403A]">
        {datos.map((d) => (
          <li key={d}>✓ {d}</li>
        ))}
      </ul>
      <LocalizedClientLink
        href={`/talleres/${t.handle}`}
        className="mt-3 inline-block text-sm font-semibold text-[#C2560A] hover:underline"
      >
        Ver el taller y todos sus productos →
      </LocalizedClientLink>
    </section>
  )
}
