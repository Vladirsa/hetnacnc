import type { Metadata } from "next"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { listarCotizaciones } from "@/lib/cotizador/acciones"
import { dinero, ESTATUS_CLASE, ESTATUS_ETIQUETA, fechaCorta } from "@/lib/cotizador/formato"

export const metadata: Metadata = {
  title: "Cotizaciones — HETNA CNC",
  description: "Todas las cotizaciones que ha emitido tu taller.",
}

const FILTROS = [
  { valor: "", etiqueta: "Todas" },
  { valor: "borrador", etiqueta: "Borradores" },
  { valor: "enviada", etiqueta: "Enviadas" },
  { valor: "vista", etiqueta: "Vistas" },
  { valor: "aceptada", etiqueta: "Aceptadas" },
  { valor: "rechazada", etiqueta: "Rechazadas" },
]

export default async function TallerCotizacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ estatus?: string }>
}) {
  const { estatus } = await searchParams
  const res = await listarCotizaciones({ estatus, limite: 100 })

  if (!res.ok) {
    return (
      <section className="pt-10 max-w-[620px]">
        <h1 className="text-[24px] font-bold text-[#1B1B18]">No se pudieron cargar tus cotizaciones</h1>
        <p className="mt-2 text-[15px] text-[#4A4943]">{res.mensaje}</p>
      </section>
    )
  }

  const { cotizaciones, count } = res.datos

  return (
    <section className="pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] lg:text-[32px] font-bold text-[#1B1B18] leading-tight">Cotizaciones</h1>
          <p className="mt-1.5 text-[14px] text-[#6B6A63]">
            {count} {count === 1 ? "cotización" : "cotizaciones"}
            {estatus ? ` con estatus ${ESTATUS_ETIQUETA[estatus as keyof typeof ESTATUS_ETIQUETA] || estatus}` : ""}
          </p>
        </div>
        <LocalizedClientLink
          href="/taller/cotizaciones/nueva"
          className="inline-flex bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold px-5 py-3 rounded-[10px] text-[15px]"
        >
          Nueva cotización
        </LocalizedClientLink>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTROS.map((f) => {
          const activo = (estatus || "") === f.valor
          return (
            <LocalizedClientLink
              key={f.valor || "todas"}
              href={f.valor ? `/taller/cotizaciones?estatus=${f.valor}` : "/taller/cotizaciones"}
              className={`px-3.5 py-1.5 rounded-full text-[13px] font-semibold ${
                activo ? "bg-[#1B1B18] text-white" : "border border-[#E7E4DC] text-[#4A4943] hover:border-[#C2560A]"
              }`}
            >
              {f.etiqueta}
            </LocalizedClientLink>
          )
        })}
      </div>

      {cotizaciones.length === 0 ? (
        <p className="mt-8 text-[15px] text-[#6B6A63]">
          {estatus ? "No hay ninguna con ese estatus." : "Todavía no has emitido ninguna cotización."}
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2.5">
          {cotizaciones.map((c) => (
            <li key={c.id}>
              <LocalizedClientLink
                href={`/taller/cotizaciones/${c.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[12px] border border-[#E7E4DC] bg-white px-4 py-3.5 hover:border-[#C2560A] transition-colors"
              >
                <span className="font-mono text-[13px] text-[#6B6A63] w-[120px]">
                  {c.folio} Rev {c.revision}
                </span>
                <span className="flex-1 min-w-[160px]">
                  <span className="block text-[15px] font-semibold text-[#1B1B18]">{c.cliente_nombre}</span>
                  {c.proyecto_referencia && (
                    <span className="block text-[13px] text-[#6B6A63]">{c.proyecto_referencia}</span>
                  )}
                </span>
                <span className={`px-2.5 py-1 rounded-full text-[12px] font-semibold ${ESTATUS_CLASE[c.estatus]}`}>
                  {ESTATUS_ETIQUETA[c.estatus]}
                </span>
                <span className="text-[13px] text-[#6B6A63] w-[100px]">{fechaCorta(c.fecha)}</span>
                <span className="text-[15px] font-bold text-[#1B1B18] tabular-nums">
                  {dinero(c.total, c.moneda)}
                </span>
              </LocalizedClientLink>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
