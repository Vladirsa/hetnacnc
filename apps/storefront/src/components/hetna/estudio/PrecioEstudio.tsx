"use client"

// Precio aproximado en vivo dentro del 2D Studio ("¿No tienes máquina?"): la
// herramienta dice qué servicio, material y medidas lleva el trabajo y aquí se
// pide el precio de referencia a /store/precio-instantaneo (el mismo de las
// calculadoras públicas). Es una referencia: los talleres dan el precio final.
import { useEffect, useRef, useState } from "react"

import { type CotizarLeadInput, type PrecioEnVivo, precioEnVivo } from "@/lib/cotizar/acciones"

/** Lo que el precio necesita saber del trabajo, en el vocabulario de precio-instantaneo. */
export type PedidoPrecio = Pick<CotizarLeadInput, "servicio" | "material" | "calibre" | "corte_mm" | "perforaciones"> & {
  /** mm del trabajo (o del material que ocupa, si son varias piezas) */
  anchoMm: number
  largoMm: number
}

const pesos = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: n < 100 ? 2 : 0 })

export function PrecioEstudio({ pedido }: { pedido: PedidoPrecio }) {
  const [precio, setPrecio] = useState<PrecioEnVivo | null>(null)
  const [cargando, setCargando] = useState(false)
  const turno = useRef(0)
  const clave = JSON.stringify(pedido)

  useEffect(() => {
    const p = JSON.parse(clave) as PedidoPrecio
    if (!(p.anchoMm > 0 && p.largoMm > 0)) return setPrecio(null)
    const mio = ++turno.current
    setCargando(true)
    // se espera a que el cliente deje de mover medidas
    const t = setTimeout(async () => {
      const r = await precioEnVivo({
        servicio: p.servicio,
        material: p.material,
        calibre: p.calibre,
        ancho: Math.max(1, Math.round(p.anchoMm) / 10),
        largo: Math.max(1, Math.round(p.largoMm) / 10),
        cantidad: 1,
        corte_mm: p.corte_mm && p.corte_mm > 0 ? Math.round(p.corte_mm) : undefined,
        perforaciones: p.perforaciones && p.perforaciones > 0 ? Math.round(p.perforaciones) : undefined,
      })
      if (mio !== turno.current) return
      setCargando(false)
      setPrecio(r)
    }, 600)
    return () => clearTimeout(t)
  }, [clave])

  return (
    <div className={`mb-2 rounded-[10px] bg-[#121923] px-3 py-2 ${cargando ? "opacity-60" : ""}`} data-testid="precio-estudio">
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-[#9AA6B8]">Precio aprox. de corte</span>
      {precio ? (
        <>
          <b className="text-[17px] text-white">
            {pesos(precio.minimo)} – {pesos(precio.maximo)}
          </b>{" "}
          <span className="text-[12px] text-[#9AA6B8]">+ IVA, con material</span>
          <span className="mt-0.5 block text-[11.5px] text-[#8A97AB]">Referencia sin envío. Los talleres te mandan su precio final y tú eliges.</span>
        </>
      ) : (
        <span className="block text-[13px] text-[#9AA6B8]">{cargando ? "Calculando…" : "Sin estimado para este trabajo: cotízalo abajo."}</span>
      )}
    </div>
  )
}
