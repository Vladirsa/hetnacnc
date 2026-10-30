import { Suspense } from "react"
import Image from "next/image"
import { HttpTypes } from "@medusajs/types"

import { CartDropdown } from "@/components/cells"
import { UserDropdown } from "@/components/cells/UserDropdown/UserDropdown"
import { NavbarSearch } from "@/components/molecules"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import footerLinks from "@/data/footerLinks"
import { listCategories } from "@/lib/data/categories"
import { retrieveCustomer } from "@/lib/data/customer"

import { SocialIcon } from "./SocialIcon"
import { BarraNavegacion } from "./BarraNavegacion"
import { FavoritosBoton } from "./Favoritos"
import { CotizadorBoton } from "./TiendaBoton"
import { CampanitaChat } from "./chat/CampanitaChat"
import { MenuMovil } from "./MenuMovil"
import { OcultarAlBajar } from "./OcultarAlBajar"
import { IdiomaSelector, MonedaSelector } from "./Selectores"
import { listRegions } from "@/lib/data/regions"
import { EnvioA } from "./EnvioA"
import { SaldoCreditos } from "./SaldoCreditos"

// Encabezado HETNA CNC: barra superior, barra principal con buscador
// y barra azul marino con las categorias reales de la tienda.
// Siempre queda fijo arriba. Al bajar por la página, la barra superior y la
// barra azul se esconden y solo quedan: logo, dirección, buscador, favoritos,
// mis compras, campanita de mensajes, login y carrito.
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

  const navCategories = parentCategories
  const redes = footerLinks.connect
  const whatsapp = redes.find((r) => r.label === "WhatsApp")?.path

  return (
    <header data-testid="header" data-locale={locale} className="w-full sticky top-0 z-50">
      {/* Barra superior (solo computadora; se esconde al bajar) */}
      <OcultarAlBajar tambienEscritorio>
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
            <SaldoCreditos isLoggedIn={isLoggedIn} oscuro />
          </div>
        </div>
      </OcultarAlBajar>

      {/* En celular se oculta al bajar; solo queda el buscador. En computadora siempre visible. */}
      <OcultarAlBajar>
      {/* Barra principal (z-50: sus menus, como el carrito, quedan por encima de la barra azul) */}
      <div className="relative z-50 bg-white border-b border-[#E7E4DC] px-4 lg:px-16 py-3 lg:py-4 flex items-center gap-3 md:gap-4 lg:gap-8">
        {/* Celular: menú de 3 rayitas con todo lo de la barra azul */}
        <MenuMovil categorias={navCategories} />
        <LocalizedClientLink
          href="/"
          className="shrink-0 flex items-center"
          data-testid="header-logo-link"
        >
          <Image src="/logo-hetna.webp" width={180} height={48} alt="HETNA CNC" priority className="h-auto w-[110px] md:w-[180px]" />
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
          className="ml-auto hidden md:flex items-center gap-4 lg:gap-6"
          data-testid="header-actions"
        >
          {/* Cinco cosas, en este orden: favoritos, notificaciones, cotizador,
              cuenta y carrito. "Mi tienda" (panel del vendedor) pasó al menú
              de la cuenta. Salieron dos: "Mis compras", que ya es la
              primera opción del menú de la cuenta, y una campana repetida --
              NotificacionesBoton y CampanitaChat dibujaban EL MISMO icono, uno
              junto al otro, apuntando a dos bandejas distintas. Se quedó
              CampanitaChat porque es la que trae el contador de no leídos. */}
          <FavoritosBoton />
          <CampanitaChat isLoggedIn={isLoggedIn} />
          <CotizadorBoton />
          <UserDropdown
            isLoggedIn={isLoggedIn}
            nombre={user?.first_name || user?.company_name || null}
            correo={user?.email || null}
          />
          <CartDropdown />
        </div>
        {/* Celular: campanita de mensajes, idioma y moneda */}
        <div className="ml-auto flex md:hidden items-center gap-2">
          <CampanitaChat isLoggedIn={isLoggedIn} compacto />
          <IdiomaSelector />
          <MonedaSelector regions={regions} />
        </div>
      </div>
      </OcultarAlBajar>

      {/* Buscador en celular (siempre visible), con el saldo de créditos al
          lado: en la fila de arriba, junto a la moneda, ya no cabe. */}
      <div className="md:hidden bg-white border-b border-[#E7E4DC] px-4 pb-3 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <Suspense fallback={null}>
            <NavbarSearch />
          </Suspense>
        </div>
        <SaldoCreditos isLoggedIn={isLoggedIn} />
      </div>

      {/* Categorias, servicios y herramientas (solo computadora; se esconde al bajar) */}
      <OcultarAlBajar tambienEscritorio>
        <div className="hidden md:block">
          <BarraNavegacion categorias={navCategories} />
        </div>
      </OcultarAlBajar>
    </header>
  )
}
