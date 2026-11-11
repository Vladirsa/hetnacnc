import { ProductCard } from "../ProductCard/ProductCard"
import { HttpTypes } from "@medusajs/types"

export const ProductsList = ({
  products,
}: {
  products: HttpTypes.StoreProduct[]
}) => {
  return (
    <>
      {products.map((product, i) => (
        <ProductCard key={product.id} product={product} prioridad={i < 4} />
      ))}
    </>
  )
}
