// /mx/novedades — los productos más nuevos de la tienda. Aquí llega el aviso
// diario de "productos nuevos" (packages/api/src/jobs/novedades-push.ts) y
// desde aquí se activa ese aviso en el celular.
import type { Metadata } from "next"
import { Suspense } from "react"

import { AvisosNovedades } from "@/components/hetna/push/AvisosNovedades"
import { ProductListingSkeleton } from "@/components/organisms/ProductListingSkeleton/ProductListingSkeleton"
import { ProductListing } from "@/components/sections/ProductListing/ProductListing"

export const revalidate = 300

export const metadata: Metadata = {
  title: "Productos nuevos en HETNA CNC",
  description: "Lo más nuevo de la tienda: diseños, piezas impresas en 3D y productos de los talleres de México. Activa el aviso y entérate primero.",
  alternates: { canonical: "https://hetnacnc.com/mx/novedades" },
}

export default async function NovedadesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale } = await params
  const sp = await searchParams
  return (
    <main className="container py-6">
      <h1 className="heading-xl uppercase">Productos nuevos</h1>
      <p className="mt-1 text-[14px] text-[#5B6370]">Lo último que llegó a la tienda, lo más nuevo primero.</p>
      <div className="mt-4">
        <AvisosNovedades />
      </div>
      <Suspense fallback={<ProductListingSkeleton />}>
        <ProductListing locale={locale} searchParams={{ sortBy: "created_at", ...sp }} />
      </Suspense>
    </main>
  )
}
