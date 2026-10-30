"use client"

import { Button } from "@/components/atoms/Button/Button"
import { BinIcon } from "@/icons"
import { useCartContext } from "@/components/providers"
import { toast } from "@/lib/helpers/toast"

export const DeleteCartItemButton = ({
  id,
  disabled,
}: {
  id: string
  disabled?: boolean
}) => {
  const { removeCartItem, isRemovingItem } = useCartContext()

  const handleDelete = async (id: string) => {
    try {
      await removeCartItem(id)
    } catch (error) {
      console.error("Error deleting cart item:", error)
      toast.error({
        title: "No se pudo quitar el producto",
      })
    }
  }

  const isBtnDisabled = isRemovingItem || disabled || !id

  return (
    <Button
      variant="text"
      className="w-10 h-10 flex items-center justify-center p-0"
      onClick={() => handleDelete(id)}
      loading={isRemovingItem}
      disabled={isBtnDisabled}
      aria-label="Quitar del carrito"
    >
      <BinIcon size={20} />
    </Button>
  )
}
