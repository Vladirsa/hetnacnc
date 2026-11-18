import { HORAS_REVISION_ANUNCIO } from "@/lib/hetna/promesas"
import type { Metadata } from "next"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"

export const metadata: Metadata = {
  title: { absolute: "Gracias por anunciarte | HETNA CNC" },
  robots: { index: false, follow: false },
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function Gracias({ searchParams }: Props) {
  const q = await searchParams
  const pedido = typeof q.pedido === "string" ? q.pedido : ""
  const t = typeof q.t === "string" ? q.t : ""
  const panel = /^[0-9a-f-]{36}$/i.test(pedido) && /^[a-f0-9]{32,64}$/.test(t) ? `/anunciate/mi-anuncio?pedido=${pedido}&t=${t}` : null
  return (
    <main className="w-full bg-[#FAF9F6]">
      <div className="max-w-[640px] mx-auto px-4 py-16 flex flex-col gap-4 text-center items-center">
        <h1 className="m-0 font-display text-[30px] font-bold text-[#1B1B18]">¡Gracias!</h1>
        <p className="m-0 text-[16px] leading-relaxed text-[#44433D]">
          Si tu pago fue aprobado, ya recibimos tu pedido. Revisamos tu anuncio y lo activamos, normalmente en {HORAS_REVISION_ANUNCIO} horas.
          Te escribiremos al correo que dejaste si necesitamos algo.
        </p>
        <p className="m-0 text-[14px] text-[#6B6A63]">Si pagaste en OXXO o por transferencia, el anuncio se activa cuando Mercado Pago confirme el pago.</p>
        {panel ? (
          <>
            <LocalizedClientLink href={panel} className="mt-2 bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold px-6 py-3 rounded-[10px]">
              Ver mi anuncio
            </LocalizedClientLink>
            <p className="m-0 text-[13px] text-[#6B6A63]">
              Guarda esta liga (también te llega por correo): ahí ves si ya está activo, sus vistas y sus clics, y lo renuevas.
            </p>
          </>
        ) : (
          <LocalizedClientLink href="/" className="mt-2 bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold px-6 py-3 rounded-[10px]">
            Volver al inicio
          </LocalizedClientLink>
        )}
      </div>
    </main>
  )
}
