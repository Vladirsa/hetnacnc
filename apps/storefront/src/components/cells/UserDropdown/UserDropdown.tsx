"use client"

import {
  Badge,
  Divider,
  LogoutButton,
  NavigationItem,
} from "@/components/atoms"
import { Dropdown } from "@/components/molecules"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { ProfileIcon } from "@/icons"
import { HttpTypes } from "@medusajs/types"
import { useUnreads } from "@talkjs/react"
import { useState } from "react"

export const UserDropdown = ({
  isLoggedIn,
}: {
  isLoggedIn: boolean
}) => {
  const [open, setOpen] = useState(false)

  const unreads = useUnreads()

  return (
    <div
      className="relative"
      onMouseOver={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
    >
      <LocalizedClientLink
        href={isLoggedIn ? "/user" : "/login"}
        className="relative"
        aria-label="Ir a mi perfil"
      >
        <ProfileIcon size={20} />
      </LocalizedClientLink>
      <Dropdown show={open}>
        {isLoggedIn ? (
          <div className="p-1">
            <div className="lg:w-[200px]">
              <h3 className="uppercase heading-xs border-b p-4">
                Mi cuenta
              </h3>
            </div>
            <NavigationItem href="/user/orders">Mis pedidos</NavigationItem>
            {/* <NavigationItem href="/user/messages" className="relative">
              Mensajes
              {Boolean(unreads?.length) && (
                <Badge className="absolute top-3 left-24 w-4 h-4 p-0">
                  {unreads?.length}
                </Badge>
              )}
            </NavigationItem>
            <NavigationItem href="/user/returns">Devoluciones</NavigationItem> */}
            <NavigationItem href="/user/addresses">Direcciones</NavigationItem>
            <Divider />
            <NavigationItem href="/user/settings">Configuración</NavigationItem>
            <LogoutButton />
          </div>
        ) : (
          <div className="p-1">
            <NavigationItem href="/login">Iniciar sesión</NavigationItem>
            <NavigationItem href="/register">Crear cuenta</NavigationItem>
          </div>
        )}
      </Dropdown>
    </div>
  )
}
