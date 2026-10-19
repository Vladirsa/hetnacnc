import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { AccionesCotizacion } from "@/components/hetna/taller/AccionesCotizacion"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { cargarCotizacion } from "@/lib/cotizador/acciones"
import { dinero, ESTATUS_CLASE, ESTATUS_ETIQUETA, fechaCorta } from "@/lib/cotizador/formato"

export const metadata: Metadata = {
  title: "Cotización — HETNA CNC",
}

export default async function TallerCotizacionDetalle({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const res = await cargarCotizacion(id)

  if (!res.ok) {
    // El backend responde 404 tanto si no existe como si es de otro taller:
    // ese filtro por perfil_id es el aislamiento entre talleres.
    if (!res.noAutenticado) notFound()
    return (
      <section className="pt-10 max-w-[620px]">
        <h1 className="text-[24px] font-bold text-[#1B1B18]">No se pudo abrir la cotización</h1>
        <p className="mt-2 text-[15px] text-[#4A4943]">{res.mensaje}</p>
      </section>
    )
  }

  const { cotizacion: c, partidas } = res.datos
  const moneda = c.moneda || "MXN"

  return (
    <section className="pt-8">
      <LocalizedClientLink
        href="/taller/cotizaciones"
        className="text-[14px] font-semibold text-[#6B6A63] hover:text-[#B34D07]"
      >
        ← Cotizaciones
      </LocalizedClientLink>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[26px] lg:text-[32px] font-bold text-[#1B1B18] leading-tight font-mono">
              {c.folio}
            </h1>
            <span className="text-[14px] text-[#6B6A63]">Rev {c.revision}</span>
            <span className={`px-2.5 py-1 rounded-full text-[12px] font-semibold ${ESTATUS_CLASE[c.estatus]}`}>
              {ESTATUS_ETIQUETA[c.estatus]}
            </span>
          </div>
          <p className="mt-1.5 text-[15px] text-[#4A4943]">
            {c.cliente_nombre}
            {c.cliente_empresa ? ` · ${c.cliente_empresa}` : ""}
          </p>
          <p className="mt-0.5 text-[13px] text-[#6B6A63]">
            Emitida {fechaCorta(c.fecha)}
            {c.validez_hasta ? ` · vigente hasta ${fechaCorta(c.validez_hasta)}` : ""}
          </p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-8 items-start">
        <div>
          <div className="overflow-x-auto rounded-[14px] border border-[#E7E4DC] bg-white">
            <table className="w-full text-[14px]">
              <thead>
                <tr className="border-b border-[#E7E4DC] text-left text-[12px] uppercase tracking-wide text-[#6B6A63]">
                  <th className="px-4 py-3 font-semibold w-[44px]">#</th>
                  <th className="px-4 py-3 font-semibold">Concepto</th>
                  <th className="px-4 py-3 font-semibold text-right w-[80px]">Cant.</th>
                  <th className="px-4 py-3 font-semibold text-right w-[120px]">P. unitario</th>
                  <th className="px-4 py-3 font-semibold text-right w-[120px]">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {partidas.map((p) => (
                  <tr key={p.id} className="border-b border-[#F1EFEA] last:border-b-0 align-top">
                    <td className="px-4 py-3.5 text-[#6B6A63] tabular-nums">{p.posicion}</td>
                    <td className="px-4 py-3.5">
                      <span className="block font-semibold text-[#1B1B18]">{p.concepto}</span>
                      {p.descripcion && (
                        <span className="mt-0.5 block text-[13px] text-[#6B6A63] leading-snug">{p.descripcion}</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums">
                      {p.cantidad} {p.unidad}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums">{dinero(p.precio_unitario, moneda)}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-semibold">
                      {dinero(p.subtotal, moneda)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <dl className="mt-5 ml-auto max-w-[320px] flex flex-col gap-2 text-[14px]">
            <Fila termino="Subtotal" valor={dinero(c.subtotal, moneda)} />
            {Number(c.descuento) > 0 && <Fila termino="Descuento" valor={`− ${dinero(c.descuento, moneda)}`} />}
            {Number(c.iva) > 0 && <Fila termino="IVA" valor={dinero(c.iva, moneda)} />}
            {Number(c.envio) > 0 && <Fila termino="Envío" valor={dinero(c.envio, moneda)} />}
            <div className="mt-1 pt-3 border-t border-[#E7E4DC] flex justify-between items-baseline">
              <dt className="text-[14px] font-semibold text-[#4A4943]">Total</dt>
              <dd className="text-[22px] font-bold text-[#1B1B18] tabular-nums">{dinero(c.total, moneda)}</dd>
            </div>
          </dl>
        </div>

        <aside className="flex flex-col gap-5 lg:sticky lg:top-6">
          <AccionesCotizacion cotizacionId={c.id} yaEnviada={c.estatus !== "borrador"} />

          {(c.cliente_telefono || c.cliente_correo) && (
            <div className="rounded-[14px] border border-[#E7E4DC] bg-white p-5">
              <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[#6B6A63]">Contacto</h2>
              <ul className="mt-2.5 flex flex-col gap-1.5 text-[14px] text-[#1B1B18]">
                {c.cliente_telefono && <li>{c.cliente_telefono}</li>}
                {c.cliente_correo && <li className="break-all">{c.cliente_correo}</li>}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}

const Fila = ({ termino, valor }: { termino: string; valor: string }) => (
  <div className="flex justify-between gap-4">
    <dt className="text-[#6B6A63]">{termino}</dt>
    <dd className="tabular-nums text-[#1B1B18]">{valor}</dd>
  </div>
)
