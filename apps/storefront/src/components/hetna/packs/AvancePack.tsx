"use client"

import type { Pack } from "@/lib/packs/acciones"

import { frasePack, piezasDelPack } from "./AvisoPack"

// El avance de un pack dentro del carrito: "llevas 2 · te falta 1".
//
// Es el momento que de verdad cambia la conducta. En la ficha el pack es una
// promesa; aquí es una cuenta, y la cuenta es lo que hace que alguien suba la
// cantidad de 2 a 3.
//
// Se cuentan sólo las piezas del MISMO taller y de las categorías del pack,
// porque así lo aplica el backend: la promoción es del taller, y Mercur limita
// el descuento a sus propios renglones.
export const AvancePack = ({
  pack,
  piezas,
  // Cuando debajo no va nada más, la esquina redondeada le toca a este bloque:
  // dos bloques pegados con la de arriba redondeada se ven partidos.
  ultimo = false,
}: {
  pack: Pack
  piezas: number
  ultimo?: boolean
}) => {
  const necesarias = piezasDelPack(pack)
  const faltan = Math.max(0, necesarias - piezas)
  const logrado = faltan <= 0
  const porcentaje = Math.max(0, Math.min(100, (piezas / necesarias) * 100))

  return (
    <div
      className={`border border-t-0 px-3 py-2.5 sm:px-4 ${
        ultimo ? "rounded-b-[12px]" : ""
      } ${logrado ? "border-[#A8D3AC] bg-[#EDF7EE]" : "border-[#C9A8D9] bg-[#FBF5FF]"}`}
      data-testid="avance-pack"
    >
      <div className="flex items-start gap-2">
        <span aria-hidden className="mt-[1px] text-[14px] leading-none">
          {logrado ? "✅" : "🎁"}
        </span>
        <p
          className={`text-[13px] leading-snug ${
            logrado ? "text-[#1F5B29]" : "text-[#4A2460]"
          }`}
        >
          {logrado ? (
            <>
              <span className="font-bold">¡Ya tienes el pack!</span>{" "}
              {frasePack(pack)}.
            </>
          ) : (
            <>
              <span className="font-semibold">{frasePack(pack)}</span>
              {" — "}
              llevas <span className="font-bold">{piezas}</span>, te{" "}
              {faltan === 1 ? "falta" : "faltan"}{" "}
              <span className="font-bold">
                {faltan} {faltan === 1 ? "pieza" : "piezas"}
              </span>
              .
            </>
          )}
        </p>
      </div>

      <div
        className="mt-2 h-[6px] w-full overflow-hidden rounded-full bg-white/80"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={necesarias}
        aria-valuenow={Math.min(piezas, necesarias)}
        aria-label={
          logrado
            ? "Ya alcanzaste el pack"
            : `Te faltan ${faltan} piezas para el pack`
        }
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${
            logrado ? "bg-[#2E7D34]" : "bg-[#7A3FA0]"
          }`}
          style={{ width: `${porcentaje}%` }}
        />
      </div>
    </div>
  )
}

// Cuántas piezas del carrito de ESE taller caen en las categorías del pack.
export const piezasQueCuentan = (
  pack: Pack,
  items: { quantity: number; product?: { categories?: { id?: string }[] | null } | null }[]
): number => {
  const ids = new Set(pack.categorias.map((c) => c.id))
  let total = 0
  for (const item of items) {
    const categorias = item.product?.categories || []
    if (categorias.some((c) => c?.id && ids.has(c.id))) {
      total += item.quantity
    }
  }
  return total
}
