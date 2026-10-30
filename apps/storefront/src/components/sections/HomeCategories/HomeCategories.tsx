import { CustomCarousel as Carousel } from "@/components/cells/Carousel/Carousel"
import { CategoryCard } from "@/components/organisms/CategoryCard/CategoryCard"

export const categories: { id: number; name: string; handle: string }[] = [
  {
    id: 1,
    name: "Tienda",
    handle: "tienda",
  },
  {
    id: 2,
    name: "Servicios",
    handle: "servicios",
  },
  {
    id: 3,
    name: "Recursos",
    handle: "recursos",
  },
  {
    id: 4,
    name: "Marketplace",
    handle: "marketplace",
  },
]

export const HomeCategories = async ({ heading }: { heading: string }) => {
  return (
    <section className="bg-primary py-8 w-full">
      <div className="mb-6">
        <h2 className="heading-lg text-primary uppercase">{heading}</h2>
      </div>
      <Carousel
        items={categories?.map((category) => (
          <CategoryCard key={category.id} category={category} />
        ))}
      />
    </section>
  )
}
