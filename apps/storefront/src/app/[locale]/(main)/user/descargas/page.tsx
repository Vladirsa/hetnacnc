import type { Metadata } from "next"

import { BotonDescarga } from "@/components/hetna/cuenta/BotonDescarga"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { UserNavigation } from "@/components/molecules/UserNavigation/UserNavigation"
import { misDescargas } from "@/lib/cuenta/descargas"

export const metadata: Metadata = { title: "Mis descargas", robots: { index: false } }

const fecha = (f: string) => new Date(f).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })

export default async function DescargasPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const lista = await misDescargas()

  return (
    <main className="container">
      <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-4 md:gap-8">
        <UserNavigation />
        <div className="md:col-span-3">
          <h1 className="m-0 text-[26px] font-extrabold text-[#142033]">Mis descargas</h1>
          <p className="mt-1 text-[14.5px] text-[#6B6A63]">
            Tus diseños comprados. Bájalos las veces que quieras: cada clic prepara una liga nueva.
          </p>

          {lista === null && (
            <p className="mt-6 rounded-[12px] bg-[#FDECEA] px-4 py-3 text-[14px] text-[#B3261E]">
              No pudimos cargar tus descargas. Recarga la página.
            </p>
          )}

          {lista?.length === 0 && (
            <div className="mt-6 rounded-[14px] border border-[#E7E4DC] bg-white px-5 py-8 text-center">
              <p className="m-0 text-[16px] font-semibold text-[#142033]">Todavía no tienes diseños digitales</p>
              <p className="mt-1 text-[14px] text-[#6B6A63]">Cuando compres un archivo DXF, SVG o STL aparecerá aquí.</p>
              <LocalizedClientLink
                href="/categories"
                className="mt-4 inline-block rounded-full border border-[#C2560A] px-4 py-2 text-[14px] font-semibold text-[#B34D07]"
              >
                Ver el catálogo
              </LocalizedClientLink>
            </div>
          )}

          {!!lista?.length && (
            <ul className="m-0 mt-6 grid list-none grid-cols-1 gap-3 p-0">
              {lista.map((c) => (
                <li key={c.product_id} className="flex flex-wrap items-center gap-4 rounded-[14px] border border-[#E7E4DC] bg-white p-3 sm:flex-nowrap">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[10px] bg-[#F3F1EA]">
                    {c.thumbnail && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-[15px] font-semibold text-[#142033]">
                      {c.handle ? <LocalizedClientLink href={`/products/${c.handle}`}>{c.titulo}</LocalizedClientLink> : c.titulo}
                    </p>
                    <p className="m-0 mt-0.5 text-[13px] text-[#6B6A63]">
                      {c.formato ? `${c.formato} · ` : ""}Pedido #{c.display_id} · {fecha(c.fecha)}
                    </p>
                  </div>
                  <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
                    <a
                      href={`/${locale}/user/descargas/comprobante/${c.order_id}`}
                      className="text-[13px] font-semibold text-[#6B6A63] underline underline-offset-2 hover:text-[#B34D07]"
                    >
                      Comprobante PDF
                    </a>
                    <BotonDescarga productId={c.product_id} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  )
}
