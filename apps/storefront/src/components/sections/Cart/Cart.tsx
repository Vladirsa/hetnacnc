"use client"

import { useMemo, useState } from "react"

import { Button, Checkbox } from "@/components/atoms"
import { agregarFavoritos } from "@/components/hetna/favoritos-datos"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { CartEmpty, CartItems } from "@/components/organisms"
import { useCartContext } from "@/components/providers"
import { filterValidCartItems } from "@/lib/helpers/filter-valid-cart-items"
import { convertToLocale } from "@/lib/helpers/money"
import { toast } from "@/lib/helpers/toast"

import { ResumenCarrito } from "./ResumenCarrito"
import { useSeleccion } from "./useSeleccion"

export const Cart = () => {
  const { cart, removeCartItem } = useCartContext()
  const [trabajando, setTrabajando] = useState<"quitar" | "guardar" | null>(null)

  const items = useMemo(() => filterValidCartItems(cart?.items), [cart?.items])
  const ids = useMemo(() => items.map((i) => i.id), [items])
  const seleccion = useSeleccion(ids)

  if (!cart || !items.length) {
    return <CartEmpty />
  }

  const piezas = items.reduce((suma, item) => suma + item.quantity, 0)
  const marcados = seleccion.seleccionados
  const sinMarcar = ids.length - marcados.length

  // Se borran de uno en uno y en orden. El provider refresca el carrito después
  // de cada borrado, así que lanzarlos en paralelo haría que las respuestas se
  // pisaran entre ellas y el carrito quedara mostrando un estado viejo.
  const quitar = async (aQuitar: string[], etiqueta: "quitar" | "guardar") => {
    if (!aQuitar.length) return
    setTrabajando(etiqueta)
    try {
      for (const id of aQuitar) {
        await removeCartItem(id)
      }
      seleccion.limpiar()
    } catch (error) {
      console.error("No se pudieron quitar los productos", error)
      toast.error({ title: "Algunos productos no se pudieron quitar" })
    } finally {
      setTrabajando(null)
    }
  }

  const guardarYQuitar = async () => {
    const elegidos = items.filter((i) => marcados.includes(i.id))
    agregarFavoritos(
      elegidos
        .filter((i) => i.product_id && i.product_handle)
        .map((i) => ({
          id: i.product_id as string,
          handle: i.product_handle as string,
          title: i.product_title || "",
          thumbnail: i.thumbnail || undefined,
        }))
    )
    await quitar(
      elegidos.map((i) => i.id),
      "guardar"
    )
    toast.success({ title: "Se guardaron en tus favoritos" })
  }

  return (
    <>
      <div className="col-span-12 pb-2 pt-4">
        <h1 className="text-[24px] font-bold text-[#1B1B18] lg:text-[30px]">
          Carrito{" "}
          <span className="font-semibold text-[#6B6A63]">({piezas})</span>
        </h1>
      </div>

      {/* En el teléfono el resumen queda hasta el final, después de la lista.
          Esta barra pone el total y el botón arriba, donde se ven sin bajar:
          es la única decisión que la pantalla necesita mostrar de inmediato.
          No se fija al borde de abajo a propósito, porque ahí ya vive la
          barra de navegación móvil y se taparían. */}
      <div className="col-span-12 mb-3 lg:hidden">
        <div className="flex items-center justify-between gap-3 rounded-[12px] border border-[#E7E4DC] bg-white px-3 py-2.5">
          <div>
            <p className="text-[12px] text-[#6B6A63]">
              {(cart.shipping_subtotal || 0) > 0 ? "Total" : "Estimación (falta envío)"}
            </p>
            <p className="text-[19px] font-bold leading-tight text-[#1B1B18]">
              {convertToLocale({
                amount: cart.total || 0,
                currency_code: cart.currency_code || "mxn",
              })}
            </p>
          </div>
          <LocalizedClientLink href="/checkout?step=address" className="shrink-0">
            <Button className="px-5 py-2.5">Ir a pagar ({piezas})</Button>
          </LocalizedClientLink>
        </div>
      </div>

      <div className="col-span-12 lg:col-span-8">
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[12px] border border-[#E7E4DC] bg-white px-3 py-2.5 sm:px-4">
          <Checkbox
            checked={seleccion.todosSeleccionados}
            indeterminate={seleccion.algunoSeleccionado && !seleccion.todosSeleccionados}
            onChange={seleccion.alternarTodos}
            label={`Seleccionar todo (${ids.length})`}
            data-testid="cart-select-all"
          />

          <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1">
            <button
              type="button"
              onClick={guardarYQuitar}
              disabled={!marcados.length || trabajando !== null}
              className="text-[13px] font-medium text-[#4A4943] underline hover:text-[#B34D07] disabled:text-[#B6B3AB] disabled:no-underline"
            >
              {trabajando === "guardar" ? "Guardando…" : "Guardar en favoritos"}
            </button>
            <button
              type="button"
              onClick={() => quitar(marcados, "quitar")}
              disabled={!marcados.length || trabajando !== null}
              className="text-[13px] font-medium text-[#9B3225] underline hover:text-[#7E2A1F] disabled:text-[#B6B3AB] disabled:no-underline"
              data-testid="cart-delete-selected"
            >
              {trabajando === "quitar"
                ? "Quitando…"
                : `Quitar seleccionados${marcados.length ? ` (${marcados.length})` : ""}`}
            </button>
          </div>
        </div>

        <CartItems
          cart={cart}
          seleccion={seleccion}
        />

        <LocalizedClientLink
          href="/categories"
          className="mt-4 inline-block text-[14px] font-semibold text-[#B34D07] underline"
        >
          Seguir viendo productos
        </LocalizedClientLink>
      </div>

      <div className="col-span-12 mt-6 lg:col-span-4 lg:mt-0 lg:pl-6">
        <div className="lg:sticky lg:top-6">
          <ResumenCarrito
            cart={cart}
            piezas={piezas}
            sinMarcar={sinMarcar}
            onQuitarSinMarcar={() =>
              quitar(
                ids.filter((id) => !marcados.includes(id)),
                "quitar"
              )
            }
            quitando={trabajando === "quitar"}
          />
        </div>
      </div>
    </>
  )
}
