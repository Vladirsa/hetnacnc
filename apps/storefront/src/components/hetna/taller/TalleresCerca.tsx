"use client"

import { useEffect, useMemo, useState } from "react"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { CreditoIp, TuUbicacion } from "@/components/hetna/ubicacion/TuUbicacion"
import { type MedidaPieza, estimar, pesos } from "@/lib/hetna/estimado"
import type { Taller } from "@/lib/hetna/talleres"
import { ETIQUETA_NIVEL, conNivel, hayCerca, textoUbicacion, type Nivel } from "@/lib/ubicacion/cercania"
import { nombreProcesos, type Proceso } from "@/lib/ubicacion/procesos"
import { useUbicacion } from "@/lib/ubicacion/useUbicacion"

// Lista "talleres cerca de ti" junto al formulario de /cotizar y en la ficha de
// los productos que se fabrican (25 nov 2026: celosías → corte láser, router o
// plasma; maquilados → router o fresadora…, ver lib/ubicacion/procesos.ts).
// Se ordena por cercanía (lib/ubicacion/cercania.ts) con la ubicación del
// cliente (lib/ubicacion/useUbicacion.ts): su código postal (del formulario de
// /cotizar o del campo de esta lista) o, mientras no lo da, su estado
// aproximado por IP.
//
// La cercanía es por municipio, estado y estados vecinos, no por kilómetros:
// los perfiles de taller guardan municipio, estado y código postal, no coordenadas.
//
// Si la pieza viene de "Fabrícamelo" (evento "hetna:pieza": medidas del archivo
// y cantidad), cada taller que publicó tarifas muestra un precio estimado.

type Pieza = { medida: MedidaPieza | null; cantidad: number }

const ETIQUETA_OFRECE: Record<string, string> = {
  diseno: "Diseño incluido",
  entrega_local: "Entrega local",
  envio: "Envío a todo México",
}

// "Todo incluido": diseña o ajusta el archivo y además entrega (local o envío)
const COLOR_NIVEL: Partial<Record<Nivel, string>> = { 0: "bg-[#FF6A1A] text-white", 1: "bg-[#FFC53D] text-[#142033]", 2: "bg-[#E7E4DC] text-[#142033]" }

const todoIncluido = (ofrece: string[]) => ofrece.includes("diseno") && (ofrece.includes("entrega_local") || ofrece.includes("envio"))

// `query`: los parámetros actuales de /cotizar (pieza, material, archivo…) para
// que al elegir un taller la solicitud siga prellenada.
//
// En la ficha (`procesos`): la lista ya viene filtrada por los procesos del
// producto (ProductDetailsPage); aquí sólo se nombran, trae su propio campo de
// código postal y, si nadie está en el estado del cliente, ofrece mandar la
// solicitud a toda la red.
type Props = { talleres: Taller[]; proceso?: string; query: string; procesos?: Proceso[]; limite?: number }

export const TalleresCerca = ({ talleres, proceso, query, procesos, limite = 5 }: Props) => {
  const cotizarCon = (handle: string) => `/cotizar?taller=${encodeURIComponent(handle)}${query ? `&${query}` : ""}`
  const enFicha = !!procesos?.length
  const { ubicacion: u, ponerCp, aviso } = useUbicacion()
  const [pieza, setPieza] = useState<Pieza | null>(null)
  const [soloTodo, setSoloTodo] = useState(false)

  useEffect(() => {
    const g = (e: Event) => setPieza((e as CustomEvent<Pieza>).detail)
    window.addEventListener("hetna:pieza", g)
    return () => window.removeEventListener("hetna:pieza", g)
  }, [])

  const hayTodo = talleres.some((t) => todoIncluido(t.perfil.ofrece))

  const lista = useMemo(() => {
    const hacen = talleres.filter(
      (t) =>
        (enFicha || !proceso || !t.perfil.servicios.length || t.perfil.servicios.includes(proceso)) &&
        (!soloTodo || todoIncluido(t.perfil.ofrece))
    )
    const precio = (t: Taller) => {
      const tarifa = proceso ? t.perfil.tarifas[proceso] : undefined
      return tarifa && pieza?.medida ? estimar(tarifa, pieza.medida, pieza.cantidad) : null
    }
    // del más cercano al más lejano; más allá de los estados vecinos, primero
    // los que envían a todo México; luego verificados y mejor calificados
    const lejosSinEnvio = (n: Nivel, t: Taller) => Number(n >= 3 && !t.perfil.ofrece.includes("envio"))
    // En /cotizar los perfiles traen el CP: el mismo CP que el cliente es "en tu municipio"
    return conNivel(hacen, (t) => t.perfil, u)
      .map((x) => (u?.cp && x.item.perfil.cp === u.cp ? { ...x, nivel: 0 as Nivel } : x))
      .sort(
        (a, b) =>
          a.nivel - b.nivel ||
          lejosSinEnvio(a.nivel, a.item) - lejosSinEnvio(b.nivel, b.item) ||
          Number(b.item.verificado) - Number(a.item.verificado) ||
          (b.item.perfil.calificacion || 0) - (a.item.perfil.calificacion || 0)
      )
      .slice(0, limite)
      .map(({ item: t, nivel: n }) => ({ t, n, precio: precio(t) }))
  }, [talleres, proceso, enFicha, u, pieza, soloTodo, limite])

  if (!lista.length && !soloTodo) return null

  const etiqueta = (n: Nivel) => (ETIQUETA_NIVEL[n] ? [ETIQUETA_NIVEL[n] as string, COLOR_NIVEL[n] || ""] : null)
  const cerca = hayCerca(lista.map((x) => x.n))
  const enMunicipio = lista.some((x) => x.n === 0)
  const hayEstimados = lista.some((x) => x.precio !== null)

  return (
    <div className="rounded-2xl border-2 border-[#FFD5B8] bg-white p-4">
      {enFicha ? (
        <>
          <h2 className="m-0 text-[17px] font-bold text-[#142033]">Talleres que te lo hacen</h2>
          <p className="mt-0.5 text-[13px] text-[#6B675C]">Talleres de la red con {nombreProcesos(procesos)}. Elige uno y le llega tu solicitud con este producto.</p>
          <div className="mt-2">
            <TuUbicacion ubicacion={u} ponerCp={ponerCp} aviso={aviso} />
          </div>
        </>
      ) : (
        <>
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#B34D07]">Talleres cerca de ti</p>
          <p className="mt-1 text-[13px] text-[#6B675C]">
            {u ? `Para ${textoUbicacion(u)}. Elige uno y le llega tu solicitud primero.` : "Escribe tu código postal en el formulario y los ordenamos por cercanía."}
            {u?.fuente === "ip" && <CreditoIp />}
          </p>
        </>
      )}
      {hayTodo && (
        <label className="mt-2 flex cursor-pointer items-center gap-2 text-[13px] text-[#142033]">
          <input type="checkbox" checked={soloTodo} onChange={(e) => setSoloTodo(e.target.checked)} className="accent-[#C2560A]" />
          Solo <strong>todo incluido</strong>: diseño + corte + entrega
        </label>
      )}
      {!lista.length ? (
        <p className="mt-3 rounded-xl bg-[#F3F1EA] px-3 py-2 text-[13px] text-[#6B675C]">Ningún taller con todo incluido hace este proceso todavía. Quita el filtro para ver los demás.</p>
      ) : (
        <ul className="mt-3 grid gap-2.5">
          {lista.map(({ t, n, precio }) => {
            const e = etiqueta(n)
            return (
              <li key={t.id} className="rounded-xl border border-[#E7E4DC] p-3">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-[#142033] text-[13px] font-extrabold text-[#FFC53D]">
                    {t.nombre.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-[14px] font-bold text-[#142033]">{t.nombre}</p>
                      {precio !== null && (
                        <span className="shrink-0 rounded-lg bg-[#E7F5EC] px-2 py-0.5 text-[13px] font-extrabold text-[#0F7A4A]" title="Estimado con las tarifas que publicó el taller">
                          ~{pesos(precio)}
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-[#6B675C]">
                      {textoUbicacion(t.perfil)}
                      {t.perfil.calificacion ? ` · ★ ${t.perfil.calificacion.toFixed(1)}` : ""}
                      {t.perfil.entrega ? ` · ${t.perfil.entrega}` : ""}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {e && <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${e[1]}`}>{e[0]}</span>}
                      {todoIncluido(t.perfil.ofrece) && (
                        <span className="rounded-full bg-[#FFC53D] px-2 py-0.5 text-[11px] font-bold text-[#142033]">Todo incluido</span>
                      )}
                      {t.perfil.ofrece.map((o) => ETIQUETA_OFRECE[o] && (
                        <span key={o} className="rounded-full bg-[#EEE7FB] px-2 py-0.5 text-[11px] font-bold text-[#6D28D9]">{ETIQUETA_OFRECE[o]}</span>
                      ))}
                      {t.verificado && <span className="rounded-full bg-[#D9F6E8] px-2 py-0.5 text-[11px] font-bold text-[#0F7A4A]">Verificado</span>}
                    </div>
                  </div>
                </div>
                <LocalizedClientLink
                  href={cotizarCon(t.handle)}
                  className="mt-2.5 block rounded-[10px] border-2 border-[#142033] px-3 py-2 text-center text-[13px] font-bold text-[#142033] hover:bg-[#142033] hover:text-white"
                >
                  Cotizar con este taller
                </LocalizedClientLink>
              </li>
            )
          })}
        </ul>
      )}
      {enFicha && u && (!cerca || (!!u.municipio && !enMunicipio)) && (
        <div className="mt-3 rounded-xl bg-[#FFF4EA] px-3 py-2.5 text-[13px] text-[#5A3A12]" data-testid="sin-talleres-cerca">
          {cerca
            ? "No hay uno en tu municipio, pero los de tu estado te lo mandan o lo recoges cerca."
            : `Todavía no hay talleres de ${nombreProcesos(procesos)} en ${u.estado}. Los de arriba te lo mandan por paquetería.`}{" "}
          También puedes{" "}
          <LocalizedClientLink href={`/cotizar${query ? `?${query}` : ""}`} className="font-bold text-[#B34D07] underline">
            pedir cotización a toda la red
          </LocalizedClientLink>{" "}
          y te contesta quien pueda hacerlo.
        </div>
      )}
      {hayEstimados && (
        <p className="mt-2 text-[11.5px] text-[#9A978C]">
          Los estimados salen de las tarifas que publicó cada taller y de las medidas de tu archivo ({pieza?.cantidad} pza{pieza && pieza.cantidad > 1 ? "s" : ""}). El precio formal te llega en su propuesta.
        </p>
      )}
    </div>
  )
}
