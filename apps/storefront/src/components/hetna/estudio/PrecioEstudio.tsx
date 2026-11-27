"use client"

// Precio aproximado en vivo dentro del 2D Studio ("¿No tienes máquina?"): la
// herramienta dice qué servicio y material lleva el trabajo y Estudio2D pone
// las medidas del dibujo. Es una referencia: los talleres dan el precio final.
import { T } from "@/components/hetna/i18n/Idioma"
import { type EntradaPrecioEnVivo, pesos, usePrecioEnVivo } from "@/components/hetna/cotizar/usePrecioEnVivo"

/**
 * Lo que la herramienta sabe del trabajo (vocabulario de precio-instantaneo).
 * Las medidas, el corte y las perforaciones salen del dibujo si no se dan;
 * se dan cuando el trabajo no es una sola pieza (p. ej. por hojas de material).
 */
export type PedidoPrecio = Pick<EntradaPrecioEnVivo, "servicio" | "material" | "calibre"> & {
  anchoMm?: number
  largoMm?: number
  cantidad?: number
  /** qué cuenta la cantidad: "piezas" (copias) u "hojas" (de material) */
  unidad?: "piezas" | "hojas"
  corte_mm?: number
  perforaciones?: number
}

export function PrecioEstudio({ entrada, unidad = "piezas" }: { entrada: EntradaPrecioEnVivo | null; unidad?: "piezas" | "hojas" }) {
  const { precio, cargando } = usePrecioEnVivo(entrada, 600)
  return (
    <div className={`mb-2 rounded-[10px] bg-[#121923] px-3 py-2 ${cargando ? "opacity-60" : ""}`} data-testid="precio-estudio">
      <span className="block text-[11px] font-semibold uppercase tracking-wide text-[#9AA6B8]">
        <T>Precio aprox. de corte</T>{entrada && entrada.cantidad > 1 ? ` (${entrada.cantidad} ${unidad})` : ""}
      </span>
      {precio ? (
        <>
          <b className="text-[17px] text-white">
            {pesos(precio.minimo)} – {pesos(precio.maximo)}
          </b>{" "}
          <span className="text-[12px] text-[#9AA6B8]"><T>+ IVA, con material</T></span>
          <span className="mt-0.5 block text-[11.5px] text-[#8A97AB]"><T>Referencia sin envío. Los talleres te mandan su precio final y tú eliges.</T></span>
        </>
      ) : (
        <span className="block text-[13px] text-[#9AA6B8]">{cargando ? "Calculando…" : "Sin estimado para este trabajo: cotízalo abajo."}</span>
      )}
    </div>
  )
}
