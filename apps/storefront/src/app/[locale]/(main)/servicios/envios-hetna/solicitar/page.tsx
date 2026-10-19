import type { Metadata } from "next"
import { redirect } from "next/navigation"

import FormSolicitudEnvio from "@/components/hetna/envios/FormSolicitudEnvio"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { retrieveCustomer } from "@/lib/data/customer"
import { verCotizacion } from "@/lib/envios/cotizar"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Solicitar envío | Envíos HETNA",
  robots: { index: false, follow: false },
}

export default async function SolicitarEnvioPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ c?: string; t?: string }>
}) {
  const { locale } = await params
  const { c = "", t = "" } = await searchParams
  const aqui = `/${locale}/servicios/envios-hetna/solicitar?c=${encodeURIComponent(c)}&t=${encodeURIComponent(t)}`

  const cliente = await retrieveCustomer().catch(() => null)
  if (!cliente) redirect(`/${locale}/login?volver=${encodeURIComponent(aqui)}`)

  const cot = c && t ? await verCotizacion(c, t) : { error: "Falta la cotización." }

  if ("error" in cot) {
    return (
      <main className="mx-auto w-full max-w-[720px] px-4 py-12 text-center">
        <h1 className="text-2xl font-extrabold text-[#142033]">No encontramos esa cotización</h1>
        <p className="mt-2 text-[#6B675C]">{cot.error}</p>
        <LocalizedClientLink href="/servicios/envios-hetna#cotizar-envio" className="mt-6 inline-block rounded-xl bg-[#C2560A] px-6 py-3 font-semibold text-white">
          Volver a cotizar
        </LocalizedClientLink>
      </main>
    )
  }

  const o = cot.opcion
  const p = cot.paquete
  return (
    <main className="mx-auto w-full max-w-[900px] px-4 pb-16 pt-8 lg:px-6">
      <p className="text-sm font-semibold uppercase tracking-wider text-[#C2560A]">Envíos HETNA</p>
      <h1 className="mt-1 text-3xl font-extrabold text-[#142033]">Solicitar tu envío</h1>

      <section className="mt-5 grid gap-3 rounded-2xl bg-[#142033] p-5 text-white sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <p className="text-lg font-extrabold">
            {o.paqueteria} <span className="font-normal text-white/70">· {o.servicio}</span>
          </p>
          <p className="text-sm text-white/75">
            {p.tipo} · {p.largo}×{p.ancho}×{p.alto} cm · {p.peso} kg
            {p.peso_cobrado > p.peso ? ` (se cobra como ${p.peso_cobrado} kg)` : ""} · {o.dias ? `${o.dias} días hábiles` : "tiempo según paquetería"}
          </p>
          <p className="mt-1 text-sm text-white/75">
            {o.recoleccion ? "Con recolección" : "Sin recolección: llevas el paquete a sucursal"} · Entrega {o.entrega_domicilio ? "a domicilio" : "en sucursal"}
          </p>
        </div>
        <p className="text-3xl font-extrabold">
          ${o.precio.toLocaleString("es-MX")} <span className="text-sm font-semibold text-white/70">MXN</span>
        </p>
      </section>

      {cot.vencida ? (
        <div className="mt-5 rounded-2xl bg-[#FDECEA] p-5 text-[#B3261E]">
          Esta cotización ya venció (los precios cambian).{" "}
          <LocalizedClientLink href="/servicios/envios-hetna#cotizar-envio" className="font-semibold underline">Vuelve a cotizar</LocalizedClientLink>.
        </div>
      ) : (
        <div className="mt-5">
          <FormSolicitudEnvio
            cot={cot}
            volver={aqui}
            cliente={{
              nombre: [cliente!.first_name, cliente!.last_name].filter(Boolean).join(" "),
              email: cliente!.email || "",
              telefono: (cliente!.phone || "").replace(/\D/g, "").slice(-10),
            }}
          />
        </div>
      )}
      <p className="mt-6 text-center text-xs text-[#6B675C]">
        Después de pagar generamos tu guía y te la enviamos por correo con el número de rastreo.
      </p>
    </main>
  )
}
