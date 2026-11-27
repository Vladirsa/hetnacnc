"use client"

import { T } from "@/components/hetna/i18n/Idioma"
import { Button } from "@/components/atoms/Button/Button"
import Link from "next/link"

export const OrderReturn = ({ order }: { order: any }) => {
  return (
    <div className="md:flex justify-between items-center">
      <div className="mb-4 md:mb-0">
        <h2 className="text-primary label-lg uppercase"><T>Devolver pedido</T></h2>
        <p className="text-secondary label-md max-w-sm">
          <T>Once you receive your order, you will have [14] days to return items.
          Find out more about</T>{" "}
          <Link href="/returns" className="underline">
            <T>returns and refunds</T>
          </Link>
          .
        </p>
      </div>
      <Link href={`/user/orders/${order.id}/return`}>
        <Button variant="tonal" className="uppercase" onClick={() => null}>
          <T>Devolver</T>
        </Button>
      </Link>
    </div>
  )
}
