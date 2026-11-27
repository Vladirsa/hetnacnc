import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import type { Metadata } from "next"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { misPiezas } from "@/lib/cotizar/solicitud-taller"

// Mis piezas (estrategia 2.4): todo lo que el cliente ha mandado a fabricar,
// con "Repetir pedido" en un clic (mismos datos y archivos, si siguen guardados).
export const dynamic = "force-dynamic"
const metadataEs: Metadata = { title: "Mis piezas", robots: { index: false, follow: false } }

const pesos = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default async function MisPiezasPage() {
  const { sesion, piezas } = await misPiezas()
  if (!sesion) {
    return (
      <main className="container">
        <div className="mx-auto max-w-[460px] py-16 text-center">
          <h1 className="text-[24px] font-bold text-[#1B1B18]"><TS>Entra a tu cuenta</TS></h1>
          <p className="mt-2 text-[15px] text-[#4A4943]"><TS>Aquí guardamos las piezas que mandas a fabricar para que las vuelvas a pedir en un clic.</TS></p>
          <LocalizedClientLink href="/login" className="mt-6 inline-block rounded-[10px] bg-[#C2560A] px-6 py-3 text-[15px] font-semibold text-white">
            <TS>Iniciar sesión</TS>
          </LocalizedClientLink>
        </div>
      </main>
    )
  }
  return (
    <main className="container">
      <div className="mx-auto max-w-[820px] py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[26px] font-bold text-[#1B1B18]"><TS>Mis piezas</TS></h1>
            <p className="mt-1 text-[15px] text-[#4A4943]"><TS>Lo que has mandado a fabricar. Vuelve a pedir cualquiera con los mismos datos y archivos.</TS></p>
          </div>
          <LocalizedClientLink href="/user/empresa" className="rounded-[10px] border border-[#E7E4DC] bg-white px-4 py-2.5 text-[14px] font-semibold text-[#142033]">
            <TS>Datos de facturación</TS>
          </LocalizedClientLink>
        </div>
        {!piezas.length ? (
          <div className="mt-8 rounded-[14px] border border-[#E7E4DC] bg-white p-6 text-[15px] text-[#4A4943]">
            <TS>Todavía no has mandado piezas a fabricar con tu cuenta.</TS>{" "}
            <LocalizedClientLink href="/cotizar" className="font-semibold text-[#C2560A] underline"><TS>Pide tu primera cotización</TS></LocalizedClientLink>.
          </div>
        ) : (
          <ul className="mt-6 grid gap-3">
            {piezas.map((p) => (
              <li key={p.folio} className="rounded-[14px] border border-[#E7E4DC] bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold text-[#6B675C]">
                      {p.folio} · {new Date(p.creada).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                    <p className="mt-1 line-clamp-2 text-[15px] font-semibold text-[#1B1B18]">{p.descripcion || p.necesidad || "Pieza"}</p>
                    <p className="mt-1 text-[13px] text-[#4A4943]">
                      {[p.servicio, p.material, p.medidas, p.cantidad && `${p.cantidad}`, p.acabado].filter(Boolean).join(" · ")}
                    </p>
                    <p className="mt-1 text-[12px] text-[#6B675C]">
                      {p.archivos.length
                        ? `📎 ${p.archivos.map((a) => a.nombre).join(", ")}`
                        : p.archivos_borrados
                          ? "Los archivos ya se borraron (más de 180 días); al repetir súbelos de nuevo."
                          : "Sin archivos"}
                    </p>
                    {p.taller && (
                      <p className="mt-1 text-[12px] text-[#0F7A4A]">
                        <TS>Lo hizo</TS> {p.taller.nombre}
                        {p.taller.precio != null ? ` por ${pesos(p.taller.precio)}` : ""}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <LocalizedClientLink href={`/user/piezas/${encodeURIComponent(p.folio)}`} className="rounded-[10px] bg-[#C2560A] px-4 py-2 text-center text-[14px] font-semibold text-white hover:bg-[#A84A08]">
                      <TS>Repetir pedido</TS>
                    </LocalizedClientLink>
                    {p.taller?.handle && (
                      <LocalizedClientLink href={`/user/piezas/${encodeURIComponent(p.folio)}?taller=${encodeURIComponent(p.taller.handle)}`} className="rounded-[10px] border border-[#E7E4DC] px-4 py-2 text-center text-[13px] font-semibold text-[#142033]">
                        <TS>Pedírselo a</TS> {p.taller.nombre.split(" ").slice(0, 2).join(" ")}
                      </LocalizedClientLink>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata() {
  return metaEnIdioma(metadataEs)
}
