"use client"

import { useMemo, useState } from "react"

import { useParams, usePathname, useRouter } from "next/navigation"

import { Button } from "@/components/atoms/Button/Button"
import { Checkbox } from "@/components/atoms/Checkbox/Checkbox"
import { agregarFavoritos } from "@/components/hetna/favoritos-datos"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { CartEmpty } from "@/components/organisms/CartEmpty/CartEmpty"
import { CartItems } from "@/components/organisms/CartItems/CartItems"
import { useCartContext } from "@/components/providers"
import { filterValidCartItems } from "@/lib/helpers/filter-valid-cart-items"
import { convertToLocale } from "@/lib/helpers/money"
import { toast } from "@/lib/helpers/toast"
import { HttpTypes } from "@medusajs/types"

import { ResumenCarrito } from "./ResumenCarrito"
import { calcularTotales } from "./totales"
import { useSeleccion } from "./useSeleccion"

export const Cart = () => {
  const { cart, removeCartItem } = useCartContext()
  const [trabajando, setTrabajando] = useState<"quitar" | "guardar" | "continuar" | null>(null)
  const router = useRouter()
  const params = useParams()
  const pathname = usePathname()

  const items = useMemo(() => filterValidCartItems(cart?.items), [cart?.items])
  const ids = useMemo(() => items.map((i) => i.id), [items])
  const seleccion = useSeleccion(ids)

  if (!cart || !items.length) {
    return <CartEmpty />
  }

  const marcados = items.filter((i) => seleccion.estaSeleccionado(i.id))
  const noMarcados = items.filter((i) => !seleccion.estaSeleccionado(i.id))
  const totalesMarcados = calcularTotales(marcados)

  const aFavorito = (i: HttpTypes.StoreCartLineItem) => ({
    id: i.product_id as string,
    handle: i.product_handle as string,
    title: i.product_title || "",
    thumbnail: i.thumbnail || undefined,
  })

  const guardarEnFavoritos = (lista: HttpTypes.StoreCartLineItem[]) =>
    agregarFavoritos(lista.filter((i) => i.product_id && i.product_handle).map(aFavorito))

  // Se borran de uno en uno y en orden. El provider refresca el carrito después
  // de cada borrado, así que lanzarlos en paralelo haría que las respuestas se
  // pisaran y el carrito quedara mostrando un estado viejo.
  const quitar = async (lista: HttpTypes.StoreCartLineItem[]) => {
    for (const item of lista) {
      await removeCartItem(item.id)
    }
  }

  const accion = async (
    etiqueta: "quitar" | "guardar" | "continuar",
    hacer: () => Promise<void>
  ) => {
    setTrabajando(etiqueta)
    try {
      await hacer()
      seleccion.limpiar()
    } catch (error) {
      console.error("No se pudo actualizar el carrito", error)
      toast.error({
        title: "No se pudo actualizar el carrito",
        description: error instanceof Error ? error.message : "Vuelve a intentarlo.",
      })
    } finally {
      setTrabajando(null)
    }
  }

  // Continuar con parte del carrito. Lo que no esté marcado sale del carrito y
  // se queda en favoritos ANTES de ir a pagar, porque la pasarela cobra lo que
  // haya en el carrito: si se quedaran, el resumen diría un número y el cobro
  // sería otro. El aviso de que esto va a pasar está junto al botón, antes de
  // apretarlo.
  const continuar = () =>
    accion("continuar", async () => {
      guardarEnFavoritos(noMarcados)
      await quitar(noMarcados)
      const locale = params?.locale || pathname?.split("/")[1] || "mx"
      router.push(`/${locale}/checkout`)
    })

  return (
    <>
      <div className="col-span-12 pb-2 pt-4">
        <h1 className="text-[24px] font-bold text-[#1B1B18] lg:text-[30px]">
          Carrito{" "}
          <span className="font-semibold text-[#6B6A63]">
            ({items.reduce((s, i) => s + i.quantity, 0)})
          </span>
        </h1>
      </div>

      {/* En el teléfono el resumen queda hasta el final, después de la lista.
          Esta barra pone el total y el botón arriba, donde se ven sin bajar.
          No se fija al borde de abajo a propósito, porque ahí ya vive la barra
          de navegación móvil y se taparían. */}
      <div className="col-span-12 mb-3 lg:hidden">
        <div className="flex items-center justify-between gap-3 rounded-[12px] border border-[#E7E4DC] bg-white px-3 py-2.5">
          <div>
            <p className="text-[12px] text-[#6B6A63]">Estimación (falta envío)</p>
            <p className="text-[19px] font-bold leading-tight text-[#1B1B18]">
              {convertToLocale({
                amount: totalesMarcados.total,
                currency_code: cart.currency_code || "mxn",
              })}
            </p>
          </div>
          <Button
            className="shrink-0 px-5 py-2.5"
            disabled={!marcados.length || trabajando !== null}
            loading={trabajando === "continuar"}
            onClick={() => {
              if (noMarcados.length) return continuar()
              const locale = params?.locale || pathname?.split("/")[1] || "mx"
              router.push(`/${locale}/checkout`)
            }}
          >
            Continuar ({totalesMarcados.piezas})
          </Button>
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
              onClick={() =>
                accion("guardar", async () => {
                  guardarEnFavoritos(marcados)
                  await quitar(marcados)
                  toast.success({ title: "Se guardaron en tus favoritos" })
                })
              }
              disabled={!marcados.length || trabajando !== null}
              className="text-[13px] font-medium text-[#4A4943] underline hover:text-[#B34D07] disabled:text-[#B6B3AB] disabled:no-underline"
            >
              {trabajando === "guardar" ? "Guardando…" : "Guardar en favoritos"}
            </button>
            <button
              type="button"
              onClick={() => accion("quitar", () => quitar(marcados))}
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
        {/* El tope de alto es lo que hace que de verdad se quede pegado: un
            bloque pegajoso más alto que la pantalla no se ve pegado -- se queda
            quieto hasta que ya lo pasaste de largo. */}
        <div className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto no-scrollbar">
          <ResumenCarrito
            cart={cart}
            marcados={marcados}
            sinMarcar={noMarcados.length}
            onContinuar={continuar}
            trabajando={trabajando === "continuar"}
          />
        </div>
      </div>
    </>
  )
}
