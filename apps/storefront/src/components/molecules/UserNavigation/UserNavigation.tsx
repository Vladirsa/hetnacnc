"use client"
import {
  Badge,
  Card,
  Divider,
  LogoutButton,
  NavigationItem,
} from "@/components/atoms"
import { useUnreads } from "@talkjs/react"
import { usePathname } from "next/navigation"

const navigationItems = [
  {
    label: "Mis pedidos",
    href: "/user/orders",
  },
  // {
  //   label: "Messages",
  //   href: "/user/messages",
  // },
  // {
  //   label: "Devoluciones",
  //   href: "/user/returns",
  // },
  {
    label: "Mis trabajos CAM",
    href: "/user/cam",
  },
  {
    label: "Direcciones",
    href: "/user/addresses",
  },
  // El cotizador y los escaneos 3D viven fuera de /user, en su propia
  // sección. Sin esta entrada no hay forma de llegar más que escribiendo la
  // dirección a mano.
  {
    label: "Mi taller",
    href: "/taller",
  },
]

export const UserNavigation = () => {
  const unreads = useUnreads()
  const path = usePathname()

  return (
    <Card className="h-min">
      {navigationItems.map((item) => (
        <NavigationItem
          key={item.label}
          href={item.href}
          active={path === item.href}
          className="relative"
        >
          {item.label}
          {item.label === "Messages" && Boolean(unreads?.length) && (
            <Badge className="absolute top-3 left-24 w-4 h-4 p-0">
              {unreads?.length}
            </Badge>
          )}
        </NavigationItem>
      ))}
      <Divider className="my-2" />
      <NavigationItem
        href={"/user/settings"}
        active={path === "/user/settings"}
      >
        Configuración
      </NavigationItem>
      <LogoutButton className="w-full text-left" />
    </Card>
  )
}
