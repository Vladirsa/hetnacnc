// Tarjetas de servicios con precio "desde" que publica un taller o diseñador
// (panel > Mis servicios). No se compran en el carrito: «Pedir cotización»
// abre la solicitud directa a quien lo publica, con el servicio ya escrito.
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import type { Paquete } from "@/lib/hetna/talleres"

const pesos = (n: number) => `$${n.toLocaleString("es-MX")}`

export const ligaPaquete = (handle: string, p: Paquete) => `/talleres/${handle}?tab=cotizar&paquete=${p.id}`

export function TarjetaPaquete({ p, handle, taller }: { p: Paquete; handle: string; taller?: string }) {
  return (
    <div className="flex flex-col rounded-2xl border border-[#E7E4DC] bg-white p-4">
      <p className="text-[15px] font-bold leading-snug text-[#142033]">{p.titulo}</p>
      {taller && (
        <LocalizedClientLink href={`/talleres/${handle}`} className="mt-0.5 text-[13px] font-semibold text-[#C2560A] hover:underline">
          {taller}
        </LocalizedClientLink>
      )}
      <p className="mt-2 text-[13px] text-[#6B675C]">
        <span className="text-lg font-extrabold text-[#142033]">desde {pesos(p.desde)}</span> MXN
        {p.entrega_dias ? ` · ${p.entrega_dias} ${p.entrega_dias === 1 ? "día hábil" : "días hábiles"}` : ""}
      </p>
      {p.descripcion && <p className="mt-2 line-clamp-3 text-[13px] text-[#40403A]">{p.descripcion}</p>}
      <div className="mt-auto pt-3">
        <LocalizedClientLink
          href={ligaPaquete(handle, p)}
          className="inline-flex w-full items-center justify-center rounded-xl bg-[#C2560A] px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
        >
          Pedir cotización
        </LocalizedClientLink>
      </div>
    </div>
  )
}

export function ListaPaquetes({
  items,
  titulo,
  texto,
}: {
  items: { p: Paquete; handle: string; taller?: string }[]
  titulo: string
  texto?: string
}) {
  if (!items.length) return null
  return (
    <section className="mt-10">
      <h2 className="text-xl font-extrabold text-[#142033] sm:text-2xl">{titulo}</h2>
      {texto && <p className="mt-1 text-sm text-[#6B675C]">{texto}</p>}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(({ p, handle, taller }) => (
          <TarjetaPaquete key={`${handle}-${p.id}`} p={p} handle={handle} taller={taller} />
        ))}
      </div>
    </section>
  )
}
