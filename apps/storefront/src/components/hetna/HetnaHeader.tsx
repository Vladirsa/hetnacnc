import { Suspense } from "react"
import Image from "next/image"
import { HttpTypes } from "@medusajs/types"

import { CartDropdown, MobileNavbar } from "@/components/cells"
import { UserDropdown } from "@/components/cells/UserDropdown/UserDropdown"
import { NavbarSearch } from "@/components/molecules"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import footerLinks from "@/data/footerLinks"
import { listCategories } from "@/lib/data/categories"
import { retrieveCustomer } from "@/lib/data/customer"

import { SocialIcon } from "./SocialIcon"
import { ServiciosNav } from "./ServiciosNav"
import { FavoritosBoton, MisComprasBoton } from "./Favoritos"
import { IdiomaSelector, MonedaSelector } from "./Selectores"
import { listRegions } from "@/lib/data/regions"
import { EnvioA } from "./EnvioA"

// Encabezado HETNA CNC: barra superior, barra principal con buscador
// y barra azul marino con las categorias reales de la tienda.
export const HetnaHeader = async ({ locale }: { locale: string }) => {
  const user = await retrieveCustomer().catch(() => null)
  const isLoggedIn = Boolean(user)
  const regions = (await listRegions().catch(() => [])) || []

  const { categories, parentCategories } = (await listCategories({
    query: { include_ancestors_tree: true },
  }).catch(() => ({ categories: [], parentCategories: [] }))) as {
    categories: HttpTypes.StoreProductCategory[]
    parentCategories: HttpTypes.StoreProductCategory[]
  }

  const navCategories = categories.length ? categories : parentCategories
  const redes = footerLinks.connect
  const whatsapp = redes.find((r) => r.label === "WhatsApp")?.path

  return (
    <header data-testid="header" data-locale={locale} className="w-full">
      {/* Barra superior */}
      <div className="hidden md:flex bg-[#0F1826] text-[#C9D2E0] text-[12px] px-4 lg:px-16 py-2 justify-between items-center">
        <span>Envíos a toda la República Mexicana</span>
        <div className="flex gap-5 items-center">
          {whatsapp && (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white"
            >
              Ayuda por WhatsApp
            </a>
          )}
          <a href="/seller" className="hover:text-white">
            Vender en HETNA CNC
          </a>
          <div className="flex gap-3 items-center border-l border-[#23324A] pl-4">
            {redes.map((r) => (
              <a
                key={r.label}
                href={r.path}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={r.label}
                className="hover:text-white"
              >
                <SocialIcon label={r.label} size={14} />
              </a>
            ))}
          </div>
          <IdiomaSelector oscuro />
          <MonedaSelector regions={regions} oscuro />
        </div>
      </div>

      {/* Barra principal */}
      <div className="bg-white border-b border-[#E7E4DC] px-4 lg:px-16 py-3 lg:py-4 flex items-center gap-4 lg:gap-8">
        <MobileNavbar
          parentCategories={parentCategories}
          categories={categories}
        />
        <LocalizedClientLink
          href="/"
          className="shrink-0 flex items-center"
          data-testid="header-logo-link"
        >
          <Image src="/logo-hetna.webp" width={180} height={48} alt="HETNA CNC" priority />
        </LocalizedClientLink>
        <div className="hidden md:flex shrink-0">
          <EnvioA user={user} />
        </div>
        <div className="hidden md:block flex-1 max-w-[760px]">
          <Suspense fallback={null}>
            <NavbarSearch />
          </Suspense>
        </div>
        <div
          className="ml-auto flex items-center gap-4 lg:gap-6"
          data-testid="header-actions"
        >
          <FavoritosBoton />
          <MisComprasBoton isLoggedIn={isLoggedIn} />
          <UserDropdown isLoggedIn={isLoggedIn} />
          <CartDropdown />
        </div>
      </div>

      {/* Buscador en celular */}
      <div className="md:hidden bg-white px-4 pb-3 border-b border-[#E7E4DC]">
        <div className="mb-2 flex items-center justify-between gap-2">
          <EnvioA user={user} />
          <div className="flex items-center gap-2">
            <IdiomaSelector />
            <MonedaSelector regions={regions} />
          </div>
        </div>
        <Suspense fallback={null}>
          <NavbarSearch />
        </Suspense>
      </div>

      {/* Tienda y servicios */}
      <ServiciosNav categorias={navCategories} />
    </header>
  )
}
