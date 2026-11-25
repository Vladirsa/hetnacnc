"use client"

// Ficha de un diseño de "Impresión 3D bajo pedido": los talleres que lo
// imprimen, cada uno con su material, precio, días, colores y envío. Los
// destacados (pagan por salir primero) llevan insignia. Arriba, la liga para
// bajar el archivo gratis o cambiarle las medidas en la herramienta.
import { useMemo, useState } from "react"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { useCartContext } from "@/components/providers"
import { trackAddToCart } from "@/lib/analytics/events"
import type { DatosImpresion, OfertaImpresion } from "@/lib/data/impresion"
import { toast } from "@/lib/helpers/toast"

const pesos = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: n < 100 ? 2 : 0 })

function Oferta({ o, locale, producto }: { o: OfertaImpresion; locale: string; producto: { id: string; titulo: string } }) {
  const { addToCart, isAddingItem } = useCartContext()
  const [color, setColor] = useState(o.colores[0] || "")
  const [listo, setListo] = useState(false)

  const agregar = async () => {
    try {
      await addToCart({ offerId: o.offer_id, quantity: 1, countryCode: locale, metadata: color ? { color } : undefined })
      trackAddToCart({ item_id: producto.id, item_name: producto.titulo, price: o.precio, quantity: 1 }, "mxn")
      setListo(true)
      toast.success({ title: "Agregado al carrito", description: `${o.material}${color ? ` · ${color}` : ""} · ${o.taller.nombre}` })
    } catch (e) {
      toast.error({ title: "No se pudo agregar", description: e instanceof Error ? e.message : "Intenta de nuevo." })
    }
  }

  return (
    <li
      className={`rounded-[12px] border p-3 ${o.destacado ? "border-[#E8A33D] bg-[#FFF8EC]" : "border-[#E7E4DC] bg-white"}`}
      data-testid="oferta-impresion"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {o.destacado && <span className="rounded-full bg-[#E8A33D] px-2 py-0.5 text-[11px] font-bold uppercase text-white">Destacado</span>}
        <LocalizedClientLink href={`/sellers/${o.taller.handle}`} className="text-[15px] font-bold text-[#142033] hover:underline">
          {o.taller.nombre}
        </LocalizedClientLink>
        <span className="text-[14px] text-[#40403A]">te lo imprime en</span>
        <span className="text-[17px] font-extrabold text-[#B34D07]">{pesos(o.precio)}</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-[#40403A]">
        <span>
          <b>{o.material}</b>
        </span>
        {o.dias && <span>Listo para enviar en {o.dias} {o.dias === 1 ? "día hábil" : "días hábiles"}</span>}
        {o.envio_gratis ? (
          <span className="font-semibold text-[#1E7B3A]">Envío gratis</span>
        ) : o.envio_gratis_desde ? (
          <span>Envío gratis desde {pesos(o.envio_gratis_desde)}</span>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {o.colores.length > 1 ? (
          <label className="flex items-center gap-1 text-[13px] text-[#40403A]">
            Color
            <select value={color} onChange={(e) => setColor(e.target.value)} className="rounded-[8px] border border-[#D9D5C9] bg-white px-2 py-1 text-[13px]">
              {o.colores.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        ) : o.colores[0] ? (
          <span className="text-[13px] text-[#40403A]">Color: {o.colores[0]}</span>
        ) : null}
        <button
          type="button"
          onClick={agregar}
          disabled={isAddingItem}
          className="ml-auto rounded-[8px] bg-[#C2560A] px-3 py-1.5 text-[13px] font-bold text-white hover:bg-[#A84A08] disabled:opacity-60"
        >
          {listo ? "Agregar otro" : "Agregar al carrito"}
        </button>
      </div>
    </li>
  )
}

export function TalleresImpresion({ datos, locale, herramienta }: { datos: DatosImpresion; locale: string; herramienta?: string | null }) {
  const conOferta = useMemo(() => new Set(datos.ofertas.map((o) => o.material)), [datos.ofertas])
  const [material, setMaterial] = useState<string>("")
  const lista = material ? datos.ofertas.filter((o) => o.material === material) : datos.ofertas
  const info = datos.materiales.find((m) => m.material === material)

  return (
    <section className="flex flex-col gap-3 rounded-[14px] border border-[#E7E4DC] bg-[#FBFAF7] p-4" data-testid="talleres-impresion">
      {herramienta && (
        <div className="rounded-[12px] border border-[#C2560A]/40 bg-[#FDEEE1] p-3">
          <p className="m-0 text-[14px] font-bold text-[#5A3A12]">¿Tienes impresora 3D? Descárgalo gratis</p>
          <p className="m-0 mt-0.5 text-[13px] text-[#5A3A12]">Ábrelo en la herramienta, cámbiale las medidas (o el texto, si lleva) y baja el STL sin costo.</p>
          <LocalizedClientLink
            href={herramienta}
            className="mt-2 inline-block rounded-[8px] bg-[#142033] px-3 py-1.5 text-[13px] font-bold text-white hover:bg-[#24324A]"
          >
            Descargar gratis o modificar las medidas
          </LocalizedClientLink>
        </div>
      )}

      <div>
        <h2 className="m-0 text-[17px] font-bold text-[#142033]">Talleres que te lo imprimen</h2>
        <p className="m-0 mt-0.5 text-[13px] text-[#6B6A63]">Compara material, precio final, días y envío. Pagas dentro de HETNA.</p>
      </div>

      {datos.materiales.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setMaterial("")}
            className={`rounded-full px-3 py-1 text-[12.5px] font-semibold ${!material ? "bg-[#142033] text-white" : "bg-white text-[#40403A] ring-1 ring-[#D9D5C9]"}`}
          >
            Todos
          </button>
          {datos.materiales
            .filter((m) => conOferta.has(m.material))
            .map((m) => (
              <button
                key={m.variant_id}
                type="button"
                onClick={() => setMaterial(m.material)}
                className={`rounded-full px-3 py-1 text-[12.5px] font-semibold ${material === m.material ? "bg-[#142033] text-white" : "bg-white text-[#40403A] ring-1 ring-[#D9D5C9]"}`}
              >
                {m.material}
              </button>
            ))}
        </div>
      )}
      {info?.gramos ? <p className="m-0 text-[12.5px] text-[#6B6A63]">En {info.material} la pieza pesa unos {info.gramos} g.</p> : null}

      {lista.length ? (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {lista.map((o) => (
            <Oferta key={o.offer_id} o={o} locale={locale} producto={{ id: datos.producto.id, titulo: datos.producto.titulo }} />
          ))}
        </ul>
      ) : (
        <p className="m-0 text-[14px] text-[#40403A]">Todavía ningún taller lo imprime. Descárgalo gratis arriba o pide que te lo fabriquen.</p>
      )}

      <p className="m-0 text-[12.5px] text-[#6B6A63]">
        ¿Tienes impresora 3D y quieres venderlo?{" "}
        <a href={`${process.env.NEXT_PUBLIC_VENDOR_URL || "/seller"}/imprimir`} className="font-semibold text-[#B34D07] underline">
          Ofrécelo desde tu panel de taller
        </a>
        .
      </p>
    </section>
  )
}
