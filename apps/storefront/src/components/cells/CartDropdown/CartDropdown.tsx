"use client"

import { useEffect, useState } from "react"

import { usePathname } from "next/navigation"

import { Badge } from "@/components/atoms/Badge/Badge"
import { Button } from "@/components/atoms/Button/Button"
import { CartDropdownItem } from "@/components/molecules/CartDropdownItem/CartDropdownItem"
import { Dropdown } from "@/components/molecules/Dropdown/Dropdown"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { useCartContext } from "@/components/providers"
import { usePrevious } from "@/hooks/usePrevious"
import { CartIcon } from "@/icons"
import { filterValidCartItems } from "@/lib/helpers/filter-valid-cart-items"
import { convertToLocale } from "@/lib/helpers/money"
import { Cart } from "@/types/cart"

// Cuántos renglones se alcanzan a ver antes de mandar a la página del carrito.
const RENGLONES_VISIBLES = 4

const contarPiezas = (cart: Cart | null) =>
  cart?.items?.reduce((acc, item) => acc + item.quantity, 0) || 0

export const CartDropdown = () => {
  const { cart } = useCartContext()
  const [abierto, setAbierto] = useState(false)
  // Se abrió solo porque acabas de agregar algo: ése es el único caso que se
  // cierra por tiempo. Antes el temporizador corría también cuando lo abrías
  // con el mouse, así que se te cerraba en la cara a los 2 segundos aunque
  // siguieras ahí.
  const [porAgregar, setPorAgregar] = useState(false)

  const piezas = contarPiezas(cart)
  const piezasAnteriores = usePrevious(piezas)
  const pathname = usePathname()

  const items = filterValidCartItems(cart?.items)
  const visibles = items.slice(0, RENGLONES_VISIBLES)
  const sobrantes = items.length - visibles.length

  const moneda = cart?.currency_code || "mxn"
  const precio = (amount: number) => convertToLocale({ amount, currency_code: moneda })

  useEffect(() => {
    if (!porAgregar) return
    const t = setTimeout(() => {
      setPorAgregar(false)
      setAbierto(false)
    }, 4000)
    return () => clearTimeout(t)
  }, [porAgregar])

  useEffect(() => {
    if (
      piezasAnteriores !== undefined &&
      piezas > piezasAnteriores &&
      pathname.split("/")[2] !== "cart"
    ) {
      setAbierto(true)
      setPorAgregar(true)
    }
  }, [piezas, piezasAnteriores, pathname])

  return (
    <div
      className="relative"
      onMouseOver={() => setAbierto(true)}
      onMouseLeave={() => {
        setPorAgregar(false)
        setAbierto(false)
      }}
    >
      <LocalizedClientLink href="/cart" className="relative" aria-label="Ir al carrito">
        <CartIcon size={20} />
        {Boolean(piezas) && (
          <Badge className="absolute -top-2 -right-2 h-4 w-4 p-0">{piezas}</Badge>
        )}
      </LocalizedClientLink>

      <Dropdown show={abierto}>
        <div className="shadow-lg lg:w-[400px]">
          <div className="flex items-baseline justify-between border-b border-[#EDEAE2] px-4 py-3">
            <h3 className="text-[15px] font-bold text-[#1B1B18]">Tu carrito</h3>
            {Boolean(piezas) && (
              <span className="text-[13px] text-[#6B6A63]">
                {piezas === 1 ? "1 pieza" : `${piezas} piezas`}
              </span>
            )}
          </div>

          {items.length ? (
            <div className="px-4 pb-4">
              <div className="no-scrollbar max-h-[320px] overflow-y-auto">
                {visibles.map((item, index) => (
                  <CartDropdownItem
                    key={item.id ?? index}
                    item={item}
                    currency_code={moneda}
                  />
                ))}
              </div>

              {sobrantes > 0 && (
                <p className="pt-2 text-[13px] text-[#6B6A63]">
                  y {sobrantes} {sobrantes === 1 ? "producto más" : "productos más"}
                </p>
              )}

              <div className="mt-3 border-t border-[#EDEAE2] pt-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] text-[#6B6A63]">Productos</span>
                  <span className="text-[15px] font-bold text-[#1B1B18]">
                    {precio(cart?.item_subtotal || 0)}
                  </span>
                </div>
                <p className="mt-0.5 text-[12px] text-[#6B6A63]">
                  El envío se calcula con tu dirección.
                </p>

                <LocalizedClientLink href="/checkout" className="mt-3 block">
                  <Button className="flex w-full items-center justify-center py-2.5">
                    Ir a pagar
                  </Button>
                </LocalizedClientLink>
                <LocalizedClientLink
                  href="/cart"
                  className="mt-2 block text-center text-[13px] font-semibold text-[#B34D07] underline"
                >
                  Ver y editar el carrito
                </LocalizedClientLink>
              </div>
            </div>
          ) : (
            <div className="px-6 py-6 text-center">
              <p className="text-[15px] font-semibold text-[#1B1B18]">
                Tu carrito está vacío
              </p>
              <p className="mt-1 text-[13px] text-[#6B6A63]">
                Mira lo que se está cortando esta semana.
              </p>
              <LocalizedClientLink href="/categories" className="mt-4 block">
                <Button className="flex w-full items-center justify-center py-2.5">
                  Ver productos
                </Button>
              </LocalizedClientLink>
            </div>
          )}
        </div>
      </Dropdown>
    </div>
  )
}
