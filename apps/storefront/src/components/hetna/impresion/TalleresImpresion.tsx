"use client"

// Ficha de un diseño de "Impresión 3D bajo pedido": los talleres que lo
// imprimen, cada uno con su material, precio, días, colores y envío. Los
// destacados (pagan por salir primero) llevan insignia. La lista va debajo de
// las fotos; en la columna de compra va ResumenImpresion (precio desde y la
// liga para bajar el archivo gratis o cambiarle las medidas).
import { useMemo, useState } from "react"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { useCartContext } from "@/components/providers"
import { trackAddToCart } from "@/lib/analytics/events"
import type { DatosImpresion, OfertaImpresion } from "@/lib/data/impresion"
import { toast } from "@/lib/helpers/toast"
import { TuUbicacion } from "@/components/hetna/ubicacion/TuUbicacion"
import { ETIQUETA_NIVEL, conNivel, textoUbicacion, type Nivel } from "@/lib/ubicacion/cercania"
import { useUbicacion } from "@/lib/ubicacion/useUbicacion"

const pesos = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: n < 100 ? 2 : 0 })

/** Largo máximo del texto si el producto no trae el suyo (el API revisa lo mismo) */
const MAX_TEXTO = 40

function Oferta({ o, locale, producto, nivel, texto }: { o: OfertaImpresion; locale: string; producto: { id: string; titulo: string; personalizable: boolean; max: number; grupos: [string, string] | null }; nivel: Nivel; texto: string }) {
  const { addToCart, isAddingItem } = useCartContext()
  const [color, setColor] = useState(o.colores[0] || "")
  // a dos colores: un color por parte, de arranque los dos primeros del taller
  const grupos = o.dos_colores && producto.grupos ? producto.grupos : null
  const [porParte, setPorParte] = useState<string[]>([o.colores[0] || "", o.colores[1] || o.colores[0] || ""])
  const [listo, setListo] = useState(false)

  const agregar = async () => {
    try {
      // llaveros y letras: el texto del cliente viaja en el renglón (el taller lo ve en el pedido)
      const t = texto.trim().slice(0, producto.max)
      if (producto.personalizable && !t) {
        toast.error({ title: "Falta el texto", description: "Escribe arriba el nombre o el texto que quieres en la pieza." })
        document.getElementById("texto-personalizado")?.focus()
        return
      }
      const metadata = {
        ...(grupos ? { colores: { [grupos[0]]: porParte[0], [grupos[1]]: porParte[1] } } : color ? { color } : {}),
        ...(producto.personalizable ? { texto: t } : {}),
      }
      await addToCart({ offerId: o.offer_id, quantity: 1, countryCode: locale, metadata: Object.keys(metadata).length ? metadata : undefined })
      trackAddToCart({ item_id: producto.id, item_name: producto.titulo, price: o.precio, quantity: 1 }, "mxn")
      setListo(true)
      const tono = grupos ? ` · ${grupos[0]}: ${porParte[0]}, ${grupos[1]}: ${porParte[1]}` : color ? ` · ${color}` : ""
      toast.success({ title: "Agregado al carrito", description: `${o.material}${tono}${producto.personalizable ? ` · «${texto.trim().slice(0, producto.max)}»` : ""} · ${o.taller.nombre}` })
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
        {(o.taller.ciudad || o.taller.estado) && (
          <span data-testid="oferta-ubicacion">
            📍 {textoUbicacion(o.taller)}
            {ETIQUETA_NIVEL[nivel] && <b className="ml-1 rounded-full bg-[#FFE9D6] px-1.5 py-px text-[11.5px] text-[#8A3B05]">{ETIQUETA_NIVEL[nivel]}</b>}
          </span>
        )}
        {o.dias && <span>Listo para enviar en {o.dias} {o.dias === 1 ? "día hábil" : "días hábiles"}</span>}
        {o.envio_gratis ? (
          <span className="font-semibold text-[#1E7B3A]">Envío gratis</span>
        ) : o.envio_gratis_desde ? (
          <span>Envío gratis desde {pesos(o.envio_gratis_desde)}</span>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {grupos ? (
          grupos.map((g, i) => (
            <label key={g} className="flex items-center gap-1 text-[13px] text-[#40403A]">
              {g}
              <select
                value={porParte[i]}
                onChange={(e) => setPorParte((p) => p.map((x, j) => (j === i ? e.target.value : x)))}
                className="rounded-[8px] border border-[#D9D5C9] bg-white px-2 py-1 text-[13px]"
                data-testid="color-parte"
              >
                {o.colores.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          ))
        ) : o.colores.length > 1 ? (
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

/** El cuadro de descarga gratis (va en la columna de compra, junto al resumen). */
function DescargaGratis({ herramienta }: { herramienta: string }) {
  return (
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
  )
}

/**
 * Columna de compra: precio desde, cuántos talleres y la liga a la lista de
 * talleres (que va debajo de las fotos, id="talleres-impresion").
 */
export function ResumenImpresion({ datos, herramienta }: { datos: DatosImpresion; herramienta?: string | null }) {
  const precios = datos.ofertas.map((o) => o.precio).filter((n) => n > 0)
  const desde = precios.length ? Math.min(...precios) : null
  const talleres = new Set(datos.ofertas.map((o) => o.taller.handle)).size
  const dias = datos.ofertas.map((o) => o.dias).filter((n): n is number => !!n)
  const masRapido = dias.length ? Math.min(...dias) : null
  return (
    <div className="flex flex-col gap-3" data-testid="resumen-impresion">
      {desde !== null ? (
        <div className="rounded-[12px] border border-[#E7E4DC] bg-white p-4">
          <p className="m-0 text-[13px] text-[#6B6A63]">Impreso y enviado desde</p>
          <p className="m-0 text-[28px] font-extrabold leading-tight text-[#B34D07]">{pesos(desde)}</p>
          <p className="m-0 mt-1 text-[13px] text-[#40403A]">
            {talleres} {talleres === 1 ? "taller lo imprime" : "talleres lo imprimen"}
            {masRapido ? ` · listo desde ${masRapido} ${masRapido === 1 ? "día hábil" : "días hábiles"}` : ""}
          </p>
          <a
            href="#talleres-impresion"
            className="mt-3 flex w-full items-center justify-center rounded-sm bg-[#C2560A] py-3 text-[15px] font-bold text-white hover:bg-[#A9480A]"
          >
            Elegir taller, material y color
          </a>
        </div>
      ) : (
        <p className="m-0 rounded-[12px] border border-[#E7E4DC] bg-white p-4 text-[14px] text-[#40403A]">
          Todavía no hay talleres imprimiéndolo. <a href="#talleres-impresion" className="font-semibold text-[#B34D07] underline">Ver opciones</a>
        </p>
      )}
      {herramienta && <DescargaGratis herramienta={herramienta} />}
    </div>
  )
}

export function TalleresImpresion({ datos, locale }: { datos: DatosImpresion; locale: string }) {
  const conOferta = useMemo(() => new Set(datos.ofertas.map((o) => o.material)), [datos.ofertas])
  const [material, setMaterial] = useState<string>("")
  const { ubicacion, ponerCp, aviso } = useUbicacion()
  const [texto, setTexto] = useState("")
  const maxTexto = datos.producto.max_texto || MAX_TEXTO
  // Los destacados (pagan por salir primero) van arriba; luego, del más cercano
  // al más lejano; a igual cercanía, el orden del API (precio y días).
  const lista = useMemo(() => {
    const base = material ? datos.ofertas.filter((o) => o.material === material) : datos.ofertas
    return conNivel(base, (o) => o.taller, ubicacion)
      .sort((a, b) => Number(b.item.destacado) - Number(a.item.destacado) || a.nivel - b.nivel || a.i - b.i)
      .map(({ item: o, nivel }) => ({ o, nivel }))
  }, [datos.ofertas, material, ubicacion])
  const hayUbicaciones = datos.ofertas.some((o) => o.taller.estado)
  const info = datos.materiales.find((m) => m.material === material)

  return (
    <section id="talleres-impresion" className="flex scroll-mt-24 flex-col gap-3 rounded-[14px] border border-[#E7E4DC] bg-[#FBFAF7] p-4" data-testid="talleres-impresion">
      <div>
        <h2 className="m-0 text-[17px] font-bold text-[#142033]">Talleres que te lo imprimen</h2>
        <p className="m-0 mt-0.5 text-[13px] text-[#6B6A63]">Compara material, precio final, días y envío. Pagas dentro de HETNA.</p>
      </div>

      {datos.producto.personalizable && (
        <label className="flex flex-col gap-1" htmlFor="texto-personalizado">
          <span className="text-[13.5px] font-bold text-[#142033]">Nombre o texto para tu pieza</span>
          <input
            id="texto-personalizado"
            value={texto}
            onChange={(e) => setTexto(e.target.value.slice(0, maxTexto))}
            maxLength={maxTexto}
            placeholder="Escribe el nombre como lo quieres"
            className="min-h-[44px] rounded-[10px] border border-[#D9D5C9] bg-white px-3 text-[15px] outline-none focus:border-[#C2560A]"
            data-testid="texto-personalizado"
          />
          <span className="text-[12px] text-[#6B6A63]">
            Hasta {maxTexto} {maxTexto === 1 ? "letra" : "letras"} ({texto.trim().length}/{maxTexto}). Sale con la forma y la letra de la foto; revisa mayúsculas y acentos: se imprime tal cual.
          </span>
        </label>
      )}

      {hayUbicaciones && <TuUbicacion ubicacion={ubicacion} ponerCp={ponerCp} aviso={aviso} />}

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
          {lista.map(({ o, nivel }) => (
            <Oferta key={o.offer_id} o={o} nivel={nivel} texto={texto} locale={locale} producto={{ id: datos.producto.id, titulo: datos.producto.titulo, personalizable: datos.producto.personalizable, max: maxTexto, grupos: datos.producto.grupos_color || null }} />
          ))}
        </ul>
      ) : (
        <p className="m-0 text-[14px] text-[#40403A]">Todavía ningún taller lo imprime. Descárgalo gratis (en el cuadro de compra) o pide que te lo fabriquen.</p>
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
