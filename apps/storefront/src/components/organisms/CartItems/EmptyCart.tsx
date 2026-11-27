"use client"

import { useEffect, useState } from "react"
import type { HttpTypes } from "@medusajs/types"
import { T } from "@/components/hetna/i18n/Idioma"
import { Button } from '@/components/atoms/Button/Button'
import { CustomCarousel as Carousel } from '@/components/cells/Carousel/Carousel'
import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { CategoryCard } from '@/components/organisms/CategoryCard/CategoryCard'
import { listarCategoriasAccion } from '@/lib/data/categories-accion';

export const EmptyCart = () => {
  // Se piden en el servidor (acción): el carrito es un componente de cliente.
  const [categories, setCategories] = useState<HttpTypes.StoreProductCategory[]>([])
  useEffect(() => {
    listarCategoriasAccion().then(setCategories).catch(() => {})
  }, [])

  return (
    <div>
      <div
        className="mb-16 flex h-full w-full flex-col items-center justify-center py-4 md:mx-auto md:w-[426px]"
        data-testid="empty-cart"
      >
        <h4 className="heading-md text-center uppercase text-primary"><T>Carrito de compras</T></h4>
        <p className="py-2 text-center text-lg"><T>Tu carrito está vacío.</T></p>
        <LocalizedClientLink
          href="/categories"
          className="mt-6 w-full"
        >
          <Button className="w-full py-3 uppercase md:px-24"><T>Explorar</T></Button>
        </LocalizedClientLink>
      </div>
      <Carousel
        items={categories?.map(category => (
          <CategoryCard
            key={category.id}
            category={category}
          />
        ))}
      />
    </div>
  );
};
