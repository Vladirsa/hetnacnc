import type { Metadata } from "next"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"

export const metadata: Metadata = {
  title: "Gracias | Envíos HETNA",
  robots: { index: false, follow: false },
}

export default async function EnvioListoPage({ searchParams }: { searchParams: Promise<{ folio?: string; status?: string; collection_status?: string }> }) {
  const sp = await searchParams
  const folio = /^ENV-\d+$/.test(sp.folio || "") ? sp.folio : ""
  const estado = sp.collection_status || sp.status || ""
  const aprobado = estado === "approved"
  const pendiente = estado === "pending" || estado === "in_process"

  return (
    <main className="mx-auto w-full max-w-[640px] px-4 py-14 text-center">
      <p className="text-sm font-semibold uppercase tracking-wider text-[#C2560A]">Envíos HETNA{folio ? ` · ${folio}` : ""}</p>
      <h1 className="mt-2 text-3xl font-extrabold text-[#142033]">
        {aprobado ? "¡Pago recibido!" : pendiente ? "Tu pago está en proceso" : "No se completó el pago"}
      </h1>
      <p className="mt-3 text-[#40403A]">
        {aprobado
          ? "Estamos generando tu guía. Te la enviaremos por correo con el número de rastreo."
          : pendiente
            ? "En cuanto Mercado Pago confirme tu pago te avisaremos por correo y generaremos tu guía."
            : "Puedes volver a cotizar e intentarlo de nuevo. No se hizo ningún cargo."}
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <LocalizedClientLink href="/servicios/envios-hetna#cotizar-envio" className="rounded-xl bg-[#C2560A] px-6 py-3 font-semibold text-white">
          Cotizar otro envío
        </LocalizedClientLink>
        <LocalizedClientLink href="/" className="rounded-xl border border-[#E7E4DC] px-6 py-3 font-semibold text-[#142033]">
          Ir al inicio
        </LocalizedClientLink>
      </div>
    </main>
  )
}
