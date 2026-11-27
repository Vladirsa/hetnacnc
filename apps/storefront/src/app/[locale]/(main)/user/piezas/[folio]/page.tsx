import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import FormSolicitudTaller from "@/components/hetna/taller/FormSolicitudTaller"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { misPiezas } from "@/lib/cotizar/solicitud-taller"
import { tallerPorHandle } from "@/lib/hetna/talleres"

// Repetir pedido (estrategia 2.4): la solicitud ya llena con la pieza anterior
// (descripción, material, medidas, cantidad, acabado y sus archivos). Con
// ?taller=<handle>, va directo al taller que la hizo.
export const dynamic = "force-dynamic"
const metadataEs: Metadata = { title: "Repetir pedido", robots: { index: false, follow: false } }

type Props = { params: Promise<{ folio: string; locale: string }>; searchParams: Promise<{ taller?: string }> }

export default async function RepetirPedidoPage({ params, searchParams }: Props) {
  const { folio } = await params
  const { taller } = await searchParams
  const { sesion, piezas } = await misPiezas()
  if (!sesion) notFound()
  const p = piezas.find((x) => x.folio === decodeURIComponent(folio))
  if (!p) notFound()
  const t = taller ? await tallerPorHandle(taller).catch(() => null) : null
  return (
    <main className="container">
      <div className="mx-auto max-w-[900px] py-10">
        <LocalizedClientLink href="/user/piezas" className="text-sm font-semibold text-[#C2560A] hover:underline"><TS>← Mis piezas</TS></LocalizedClientLink>
        <h1 className="mt-2 text-[26px] font-bold text-[#1B1B18]"><TS>Repetir pedido</TS> <TS>{p.folio}</TS><TS>{t ? ` con ${t.nombre}` : ""}</TS></h1>
        <p className="mb-6 mt-1 text-[15px] text-[#4A4943]"><TS>Ya va todo puesto como la vez pasada. Cambia la cantidad o lo que necesites y envía.</TS></p>
        <FormSolicitudTaller
          taller={t?.handle}
          nombreTaller={t?.nombre}
          servicioInicial={p.servicio || undefined}
          prellenado={{
            pieza: (p.descripcion || "Pieza").split(/[.\n]/)[0].slice(0, 80),
            medidas: p.medidas || undefined,
            material: p.material || undefined,
            proceso: p.servicio || undefined,
            archivos: p.archivos.map((a) => ({ ...a, geo: p.medidas_archivo || undefined })),
            cantidad: p.cantidad || undefined,
            descripcion: p.descripcion,
            repiteFolio: p.folio,
          }}
        />
      </div>
    </main>
  )
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata() {
  return metaEnIdioma(metadataEs)
}
